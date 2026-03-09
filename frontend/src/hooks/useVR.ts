import { useState, useEffect, useCallback, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import type { ViewerContext } from './useViewer';
import { DEFAULT_CAMERA_CONFIG } from '@/utils/camera';

interface UseVRProps {
  viewerRef: RefObject<ViewerContext | null>;
}

interface UseVRReturn {
  isVRSupported: boolean;
  isInVR: boolean;
  toggleVR: () => Promise<void>;
  isCheckingSupport: boolean;
}

// Movement settings
const VR_MOVE_SPEED = 0.05;
const VR_TURN_SPEED = 0.03;
const DEADZONE = 0.15;

/**
 * Hook to manage WebXR VR session with Camera Rig locomotion.
 *
 * Architecture: A `THREE.Group` ("rig") is created as the camera's parent.
 * Controller joystick input moves/rotates the rig, which in turn moves the
 * camera through the scene — the standard Three.js WebXR pattern.
 * No more inverse splatMesh manipulation or Y-down orientation hacks.
 */
export const useVR = ({ viewerRef }: UseVRProps): UseVRReturn => {
  const [isVRSupported, setIsVRSupported] = useState(false);
  const [isInVR, setIsInVR] = useState(false);
  const [isCheckingSupport, setIsCheckingSupport] = useState(true);

  const sessionRef = useRef<XRSession | null>(null);
  const rigRef = useRef<THREE.Group | null>(null);

  // ── Check VR support on mount ───────────────────────────────────────
  useEffect(() => {
    const checkVRSupport = async () => {
      setIsCheckingSupport(true);
      try {
        if ('xr' in navigator && navigator.xr) {
          const supported = await navigator.xr.isSessionSupported('immersive-vr');
          setIsVRSupported(supported);
          console.log('[VR] WebXR Support:', supported ? '✅ Supported' : '❌ Not supported');
        } else {
          setIsVRSupported(false);
          console.log('[VR] WebXR: ❌ API not available');
        }
      } catch (e) {
        console.warn('[VR] Support check failed:', e);
        setIsVRSupported(false);
      } finally {
        setIsCheckingSupport(false);
      }
    };

    checkVRSupport();
  }, []);

  // ── Process VR controller input — move the Camera Rig ───────────────
  const processControllerInput = useCallback((session: XRSession, rig: THREE.Group) => {
    const ctx = viewerRef.current;
    if (!ctx) return;

    const xrCamera = ctx.renderer.xr.getCamera();
    const camera = xrCamera || ctx.camera;

    for (const inputSource of session.inputSources) {
      if (!inputSource.gamepad) continue;

      const { axes, buttons } = inputSource.gamepad;

      // ── A / X button (index 4) → Reset rig position & rotation ─────
      if (buttons.length > 4 && buttons[4].pressed) {
        rig.position.set(0, 0, 0);
        rig.rotation.set(0, 0, 0);
      }

      let moveX = 0;
      let moveY = 0;
      let turnX = 0;
      let turnY = 0;

      if (inputSource.handedness === 'left') {
        moveX = axes.length > 2 ? axes[2] : axes[0];
        moveY = axes.length > 3 ? axes[3] : axes[1];
      } else if (inputSource.handedness === 'right') {
        turnX = axes.length > 2 ? axes[2] : axes[0];
        turnY = axes.length > 3 ? axes[3] : axes[1];
      }

      // Apply deadzone
      if (Math.abs(moveX) < DEADZONE) moveX = 0;
      if (Math.abs(moveY) < DEADZONE) moveY = 0;
      if (Math.abs(turnX) < DEADZONE) turnX = 0;
      if (Math.abs(turnY) < DEADZONE) turnY = 0;

      // ── Movement (left stick) — 6DOF flight along view direction ────
      if (moveX !== 0 || moveY !== 0) {
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();

        const delta = new THREE.Vector3();
        delta.add(right.clone().multiplyScalar(moveX * VR_MOVE_SPEED));
        delta.add(forward.clone().multiplyScalar(-moveY * VR_MOVE_SPEED));

        rig.position.add(delta);
      }

      // ── Turning (right stick X) — rotate rig around Y axis ──────────
      if (turnX !== 0) {
        rig.rotation.y -= turnX * VR_TURN_SPEED;
      }

      // ── Vertical (right stick Y) — move rig up/down ────────────────
      if (turnY !== 0) {
        rig.position.y -= turnY * VR_MOVE_SPEED;
      }
    }
  }, [viewerRef]);

  // ── Toggle VR session ───────────────────────────────────────────────
  const toggleVR = useCallback(async () => {
    const ctx = viewerRef.current;
    if (!ctx) {
      console.warn('[VR] Viewer not ready');
      return;
    }

    const { renderer, scene, camera, controls } = ctx;

    try {
      if (isInVR && sessionRef.current) {
        // ── Exit VR ───────────────────────────────────────────────────
        console.log('[VR] Exiting VR session...');
        await sessionRef.current.end();
        // Session 'end' event handler will do cleanup
      } else {
        // ── Enter VR ──────────────────────────────────────────────────
        if (!navigator.xr) {
          console.warn('[VR] WebXR not available');
          return;
        }

        console.log('[VR] Entering VR session...');

        renderer.xr.enabled = true;

        const session = await navigator.xr.requestSession('immersive-vr', {
          optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
        });

        sessionRef.current = session;

        // Disable OrbitControls during VR (headset handles orientation)
        controls.enabled = false;

        // Create camera rig and parent the camera under it
        const rig = new THREE.Group();
        rig.name = 'vr-camera-rig';
        scene.add(rig);

        // Detach camera from scene root and attach to rig
        scene.remove(camera);
        rig.add(camera);
        rigRef.current = rig;

        await renderer.xr.setSession(session);

        // Dynamic height calibration on first frame
        let heightCalibrated = false;

        // Switch to XR animation loop
        renderer.setAnimationLoop(() => {
          // Height calibration: raise rig so user's head is at splat origin height
          if (!heightCalibrated) {
            const xrCam = renderer.xr.getCamera();
            if (xrCam && xrCam.position.y > 0) {
              // No need to move rig — user is already standing at floor level
              // which is a natural starting position in local-floor reference
              heightCalibrated = true;
              console.log(`[VR] Height calibrated to ${xrCam.position.y.toFixed(2)}m`);
            }
          }

          processControllerInput(session, rig);

          renderer.render(scene, camera);
        });

        setIsInVR(true);

        console.log('[VR] ✅ VR session started');
        console.log('[VR] Controls:');
        console.log('  - Left stick: Move in view direction (6DOF flight)');
        console.log('  - Right stick X: Turn left/right');
        console.log('  - Right stick Y: Move up/down');
        console.log('  - Head movement: Look around');

        // Listen for session end (user presses Oculus button, etc.)
        session.addEventListener('end', () => {
          console.log('[VR] Session ended');

          // Stop XR animation loop
          renderer.setAnimationLoop(null);
          renderer.xr.enabled = false;

          // Remove rig: detach camera back to scene root, then dispose rig
          const currentRig = rigRef.current;
          if (currentRig) {
            currentRig.remove(camera);
            scene.add(camera);
            scene.remove(currentRig);
            rigRef.current = null;
          }

          // ── Fully restore camera & renderer to pre-VR state ─────────
          // WebXR overrides projection matrix, position, and render target
          // each frame. After exiting, everything must be explicitly reset.
          camera.position.set(...DEFAULT_CAMERA_CONFIG.initialPosition);
          camera.up.set(...DEFAULT_CAMERA_CONFIG.cameraUp);
          camera.rotation.set(0, 0, 0);
          camera.fov = DEFAULT_CAMERA_CONFIG.fov;
          camera.near = DEFAULT_CAMERA_CONFIG.near;
          camera.far = DEFAULT_CAMERA_CONFIG.far;

          // Restore viewport size and pixel ratio
          const container = renderer.domElement.parentElement;
          if (container) {
            const w = container.clientWidth;
            const h = container.clientHeight;
            camera.aspect = w / h;
            renderer.setSize(w, h);
          }
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
          camera.updateProjectionMatrix();

          // Reset OrbitControls — orbit around origin with default state
          controls.target.set(0, 0, 0);
          controls.enabled = true;
          controls.update();

          // Restart normal render loop
          renderer.setAnimationLoop(() => {
            controls.update();
            renderer.render(scene, camera);
          });

          sessionRef.current = null;
          setIsInVR(false);
        });
      }
    } catch (e) {
      console.error('[VR] Session error:', e);
      sessionRef.current = null;
      setIsInVR(false);
    }
  }, [viewerRef, isInVR, processControllerInput]);

  // ── Cleanup on unmount ──────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.end().catch(() => {});
      }
    };
  }, []);

  return {
    isVRSupported,
    isInVR,
    toggleVR,
    isCheckingSupport,
  };
};
