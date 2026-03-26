import React, { useEffect } from 'react';
import { useAppStore } from '@/store';
import styles from './VirtualJoystick.module.css';

interface VirtualJoystickProps {
    visible: boolean;
    isActive: boolean;
    containerRef: React.RefObject<HTMLDivElement | null>;
    stickRef: React.RefObject<HTMLDivElement | null>;
    handlers: {
        onTouchStart: (e: React.TouchEvent) => void;
        onTouchMove: (e: React.TouchEvent) => void;
        onTouchEnd: (e: React.TouchEvent) => void;
        onTouchCancel: (e: React.TouchEvent) => void;
    };
}

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({ 
    visible, 
    isActive, 
    containerRef, 
    stickRef, 
    handlers 
}) => {
    // Get sidebar state to dynamically adjust joystick position
    const { sidebarCollapsed } = useAppStore();

    // Use native event binding with passive: false to prevent scrolling
    // Must be called unconditionally to follow React hook rules
    useEffect(() => {
        // Early return if not visible, but hook is still called
        if (!visible) return;
        
        const container = containerRef.current;
        if (!container) return;

        // ── Pointer capture + stopPropagation on ALL pointer events ──────
        // OrbitControls registers `pointermove` on `document` (not just canvas).
        // When user touches the joystick, the browser fires pointer events that
        // bubble up to document → OrbitControls' handler receives them → calls
        // handleTouchMoveRotate with the joystick finger's coordinates → camera
        // jumps. Fix: capture the pointer AND stop propagation on pointerdown,
        // pointermove, AND pointerup so none of these events reach document.
        const handlePointerDown = (e: PointerEvent) => {
            e.stopPropagation();
            try { container.setPointerCapture(e.pointerId); } catch { /* ok */ }
        };
        const handlePointerMove = (e: PointerEvent) => {
            e.stopPropagation();
        };
        const handlePointerUp = (e: PointerEvent) => {
            e.stopPropagation();
            try { container.releasePointerCapture(e.pointerId); } catch { /* ok */ }
        };

        container.addEventListener('pointerdown', handlePointerDown);
        container.addEventListener('pointermove', handlePointerMove);
        container.addEventListener('pointerup', handlePointerUp);
        container.addEventListener('pointercancel', handlePointerUp);

        const handleTouchStart = (e: TouchEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const syntheticEvent = { 
                preventDefault: () => {},
                touches: e.touches,
                nativeEvent: e 
            } as unknown as React.TouchEvent;
            handlers.onTouchStart(syntheticEvent);
        };

        const handleTouchMove = (e: TouchEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const syntheticEvent = { 
                preventDefault: () => {}, 
                touches: e.touches,
                nativeEvent: e 
            } as unknown as React.TouchEvent;
            handlers.onTouchMove(syntheticEvent);
        };

        const handleTouchEnd = (e: TouchEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const syntheticEvent = { 
                preventDefault: () => {},
                nativeEvent: e 
            } as unknown as React.TouchEvent;
            handlers.onTouchEnd(syntheticEvent);
        };

        container.addEventListener('touchstart', handleTouchStart, { passive: false });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd, { passive: false });
        container.addEventListener('touchcancel', handleTouchEnd, { passive: false });

        return () => {
            container.removeEventListener('pointerdown', handlePointerDown);
            container.removeEventListener('pointermove', handlePointerMove);
            container.removeEventListener('pointerup', handlePointerUp);
            container.removeEventListener('pointercancel', handlePointerUp);
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
            container.removeEventListener('touchcancel', handleTouchEnd);
        };
    }, [containerRef, stickRef, handlers, visible]);

    // Render null when not visible (after hooks are called)
    if (!visible) return null;

    // Render inside component tree (not portal) so it's positioned relative to viewer container
    return (
        <div 
            ref={containerRef}
            className={`${styles.joystickWrapper} ${visible ? styles.visible : ''} ${isActive ? styles.active : ''} ${!sidebarCollapsed ? styles.sidebarExpanded : ''}`}
            id="virtual-joystick"
        >
            <div 
                ref={stickRef} 
                className={styles.stick} 
                id="joystick-stick"
            />
        </div>
    );
};
