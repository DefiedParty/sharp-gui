import { useState, useEffect, useCallback, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import type { Viewer } from '@mkkellogg/gaussian-splats-3d';

interface UseVRProps {
  viewerRef: RefObject<Viewer | null>;
}

interface UseVRReturn {
  isVRSupported: boolean;
  isInVR: boolean;
  toggleVR: () => Promise<void>;
  isCheckingSupport: boolean;
}

// Movement settings - can be adjusted
const VR_MOVE_SPEED = 0.05;
const VR_TURN_SPEED = 0.03;
const DEADZONE = 0.15;

/**
 * Hook to manage WebXR VR session with controller joystick movement
 * Handles VR support detection, session management, and locomotion
 */
export const useVR = ({ viewerRef }: UseVRProps): UseVRReturn => {
  const [isVRSupported, setIsVRSupported] = useState(false);
  const [isInVR, setIsInVR] = useState(false);
  const [isCheckingSupport, setIsCheckingSupport] = useState(true);
  
  const sessionRef = useRef<XRSession | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Check VR support on mount
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

  /**
   * Process VR controller input and move camera
   * Left stick: Move forward/backward/strafe (6DOF, follows view direction)
   * Right stick X: Turn left/right (Y-axis rotation)
   * Right stick Y: Move up/down (vertical)
   */
  const processControllerInput = useCallback((session: XRSession) => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // In XR mode, we should use the XR camera
    const renderer = viewer.renderer;
    const xrCamera = renderer?.xr?.getCamera();
    const camera = xrCamera || viewer.camera;
    
    if (!camera) return;

    // Get input sources (controllers)
    for (const inputSource of session.inputSources) {
      if (!inputSource.gamepad) continue;

      const { axes } = inputSource.gamepad;
      
      let moveX = 0;
      let moveY = 0;
      let turnX = 0;
      let turnY = 0;

      if (inputSource.handedness === 'left') {
        // Left controller - movement (6DOF, follows view direction)
        // Quest controllers: axes[2] = X, axes[3] = Y for thumbstick
        moveX = axes.length > 2 ? axes[2] : axes[0];
        moveY = axes.length > 3 ? axes[3] : axes[1];
      } else if (inputSource.handedness === 'right') {
        // Right controller - turning (X) + vertical movement (Y)
        turnX = axes.length > 2 ? axes[2] : axes[0];
        turnY = axes.length > 3 ? axes[3] : axes[1];
      }

      // Apply deadzone
      if (Math.abs(moveX) < DEADZONE) moveX = 0;
      if (Math.abs(moveY) < DEADZONE) moveY = 0;
      if (Math.abs(turnX) < DEADZONE) turnX = 0;
      if (Math.abs(turnY) < DEADZONE) turnY = 0;

      // Debug: log when there's actual input
      if (moveX !== 0 || moveY !== 0 || turnX !== 0 || turnY !== 0) {
        console.log(`[VR] Controller input - moveX: ${moveX.toFixed(2)}, moveY: ${moveY.toFixed(2)}, turnX: ${turnX.toFixed(2)}, turnY: ${turnY.toFixed(2)}`);
      }

      // In WebXR, we can't directly move the XR camera - it's controlled by the headset
      // Instead, we move the splatMesh (the model) in the opposite direction
      // This creates the illusion of the player moving through the scene
      const viewerAny = viewer as any;
      const splatMesh = viewerAny.splatMesh;
      if (!splatMesh) return;

      // Movement (left stick) - 6DOF: move along view direction (no horizontal clamping)
      if (moveX !== 0 || moveY !== 0) {
        // Get camera direction (forward vector) - full 3D, no Y clamping for 6DOF flight
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(camera.quaternion);
        forward.normalize();

        // Right vector (strafe) - full 3D
        const right = new THREE.Vector3(1, 0, 0);
        right.applyQuaternion(camera.quaternion);
        right.normalize();

        // Calculate movement delta (INVERTED - we move the model, not the camera)
        const delta = new THREE.Vector3();
        
        // X axis: Strafe left/right (inverted)
        delta.add(right.clone().multiplyScalar(-moveX * VR_MOVE_SPEED));
        
        // Y axis: Forward/backward (push stick forward = model moves back = player moves forward)
        delta.add(forward.clone().multiplyScalar(moveY * VR_MOVE_SPEED));

        // Move the splatMesh
        splatMesh.position.add(delta);
      }

      // Turning (right stick X) - rotate the model around Y axis
      if (turnX !== 0) {
        // Rotate splatMesh (opposite direction = player turns)
        splatMesh.rotation.y += turnX * VR_TURN_SPEED;
      }

      // Vertical movement (right stick Y) - move model up/down
      if (turnY !== 0) {
        splatMesh.position.y += turnY * VR_MOVE_SPEED;
      }
    }
  }, [viewerRef]);

  // Toggle VR session
  const toggleVR = useCallback(async () => {
    if (!viewerRef.current) {
      console.warn('[VR] Viewer not ready');
      return;
    }

    const renderer = viewerRef.current.renderer;
    if (!renderer || !renderer.xr) {
      console.warn('[VR] Renderer or XR not available');
      return;
    }

    try {
      if (isInVR && sessionRef.current) {
        // Exit VR
        console.log('[VR] Exiting VR session...');
        if (animationFrameRef.current) {
          sessionRef.current.cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        await sessionRef.current.end();
        sessionRef.current = null;
        setIsInVR(false);
      } else {
        // Enter VR
        if (!navigator.xr) {
          console.warn('[VR] WebXR not available');
          return;
        }

        console.log('[VR] Entering VR session...');
        
        // Enable XR on the renderer (this is what the library does in webXRMode: VR)
        renderer.xr.enabled = true;
        
        const session = await navigator.xr.requestSession('immersive-vr', {
          optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']
        });

        if (session) {
          sessionRef.current = session;
          
          // Set webXRActive flag on viewer (the library checks this for adjustForWebXRStereo)
          const viewer = viewerRef.current as any;
          if (viewer) {
            viewer.webXRActive = true;
            
            // Save pre-VR splatMesh state for restoration on exit
            if (viewer.splatMesh) {
              viewer._preVRPosition = viewer.splatMesh.position.clone();
              viewer._preVRRotation = viewer.splatMesh.rotation.clone();
              viewer._preVRScale = viewer.splatMesh.scale.clone();
              
              // Fix orientation: Gaussian Splatting uses Y-down (COLMAP convention),
              // WebXR uses Y-up. Rotate 180° around X axis to correct WITHOUT mirroring.
              // (Previously scale.y *= -1 was used, which changed coordinate handedness
              // and caused left-right mirroring)
              viewer.splatMesh.rotation.x += Math.PI;
              console.log('[VR] Applied X-axis π rotation to fix orientation');
            }
            
            // Ensure camera up vector is correct for XR
            if (viewer.camera) {
              viewer.camera.up.set(0, 1, 0);
            }
            
            // Stop the current animation loop
            if (viewer.requestFrameId) {
              cancelAnimationFrame(viewer.requestFrameId);
              viewer.requestFrameId = null;
            }
          }
          
          await renderer.xr.setSession(session);
          
          // Dynamic height calibration: read actual headset height on first XR frame
          let heightCalibrated = false;
          
          // Switch to XR animation loop - this is crucial!
          // The library normally does this in setupWebXR when webXRMode is set
          renderer.setAnimationLoop(() => {
            if (viewer) {
              // Dynamic height calibration on first frame:
              // Read the actual XR camera Y position (real user head height from headset tracking)
              // and position the model at that height so it appears at eye level
              if (!heightCalibrated && viewer.splatMesh) {
                const xrCam = renderer.xr.getCamera();
                if (xrCam && xrCam.position.y > 0) {
                  viewer.splatMesh.position.y = xrCam.position.y;
                  heightCalibrated = true;
                  console.log(`[VR] Height calibrated to ${xrCam.position.y.toFixed(2)}m`);
                }
              }
              
              // Process controller input for movement
              processControllerInput(session);
              
              // Call viewer's update and render methods
              viewer.update();
              if (viewer.shouldRender && viewer.shouldRender()) {
                viewer.render();
              }
            }
          });
          
          setIsInVR(true);
          
          console.log('[VR] ✅ VR session started');
          console.log('[VR] Controls:');
          console.log('  - Left stick: Move in view direction (6DOF flight)');
          console.log('  - Right stick X: Turn left/right');
          console.log('  - Right stick Y: Move up/down');
          console.log('  - Head movement: Look around');

          // Listen for session end
          session.addEventListener('end', () => {
            console.log('[VR] Session ended');
            
            // Stop XR animation loop
            renderer.setAnimationLoop(null);
            
            // Restore webXRActive flag and splatMesh state
            if (viewer) {
              viewer.webXRActive = false;
              
              // Restore splatMesh to pre-VR state
              if (viewer.splatMesh && viewer._preVRPosition) {
                viewer.splatMesh.position.copy(viewer._preVRPosition);
                viewer.splatMesh.rotation.copy(viewer._preVRRotation);
                viewer.splatMesh.scale.copy(viewer._preVRScale);
                console.log('[VR] Restored splatMesh to pre-VR state');
              }
              
              // Restart the normal animation loop
              if (viewer.selfDrivenMode && viewer.selfDrivenUpdateFunc) {
                viewer.requestFrameId = requestAnimationFrame(viewer.selfDrivenUpdateFunc);
              }
            }
            
            sessionRef.current = null;
            setIsInVR(false);
          });
        }
      }
    } catch (e) {
      console.error('[VR] Session error:', e);
      sessionRef.current = null;
      setIsInVR(false);
    }
  }, [viewerRef, isInVR, processControllerInput]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        if (animationFrameRef.current) {
          sessionRef.current.cancelAnimationFrame(animationFrameRef.current);
        }
        sessionRef.current.end().catch(() => {});
      }
    };
  }, []);

  return {
    isVRSupported,
    isInVR,
    toggleVR,
    isCheckingSupport
  };
};
