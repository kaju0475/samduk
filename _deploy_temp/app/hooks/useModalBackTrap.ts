import { useEffect, useCallback, useRef } from 'react';

declare global {
    interface Window {
        __MODAL_COUNT__?: number;
        __MODAL_STACK__?: string[];
    }
}

/**
 * Hook to handle Browser Back Button for Modals with Nested Stacking Support.
 */
export function useModalBackTrap(isOpen: boolean, onClose: () => void, modalId: string = 'modal') {
    // Generate a truly unique ID if specific one is reused or default (optional but safer)
    // For now we trust the consumer uses distinct semantic IDs like 'detail', 'history'
    
    // Track if this instance pushed to stack to avoid duplicate pushes (React 18 Strict Mode double-effect)
    const pushedRef = useRef(false);

    // Manual Close Handler (e.g. for X button)
    const handleCleanClose = useCallback(() => {
        // [Fix] If we pushed a state, we MUST pop it when closing programmatically.
        // We rely on pushedRef to know if *we* are responsible for an extra history entry.
        
        if (pushedRef.current && typeof window !== 'undefined') {
             // Robust check: Only back if we are likely top of stack or if we know we pushed.
             window.history.back();
             // Reset pushedRef immediately to prevent double-pop if this function runs twice
             pushedRef.current = false; 
             
             // [Fix] Explicitly close immediately instead of waiting for popstate.
             // This ensures the X button works even if popstate is swallowed or delayed.
             onClose();
        } else {
            onClose();
        }
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            // [Global Stack Init]
            if (!window.__MODAL_STACK__) {
                window.__MODAL_STACK__ = [];
            }

            const stack = window.__MODAL_STACK__;
            
            // [Robust Push Logic]
            // Check if we are already the current history state (to prevent Double Push in Strict Mode)
            const isAlreadyInHistory = typeof window !== 'undefined' && window.history.state?.modal === modalId;
            const isAlreadyInStack = stack[stack.length - 1] === modalId;

            if (!isAlreadyInHistory) {
                // Normal Open: Push to History AND Stack
                if (!isAlreadyInStack) {
                    stack.push(modalId);
                }
                // [Fix] Preserve existing Next.js history state (key, etc.) to prevent navigation issues
                const currentState = window.history.state || {};
                window.history.pushState({ ...currentState, modal: modalId }, '', window.location.href);
                pushedRef.current = true;
            } else {
                // Already in History (e.g. Refresh, Strict Mode Remount)
                // Just sync the stack if missing
                if (!isAlreadyInStack) {
                    stack.push(modalId);
                }
                // Mark as pushed so we know we 'own' this state conceptually
                pushedRef.current = true;
            }

            // Global Counter
            window.__MODAL_COUNT__ = (window.__MODAL_COUNT__ || 0) + 1;

            const handlePopState = () => {
                const stack = window.__MODAL_STACK__ || [];
                const currentHistoryModal = window.history.state?.modal;
                
                // Determine our position and the "active" position
                const myIndex = stack.indexOf(modalId);
                const activeIndex = currentHistoryModal ? stack.indexOf(currentHistoryModal) : -1;

                // [Stack Logic]
                // If the current active modal (from history) is 'above' or 'equal' to us in the stack,
                // it means we are still part of the active chain -> STAY OPEN.
                // Examples:
                // Stack: [G, A, B]. Current: A (activeIndex=1). 
                // G (0 <= 1): Stay Open.
                // A (1 <= 1): Stay Open. 
                // B (2 > 1): Close.
                
                if (myIndex !== -1 && myIndex <= activeIndex) {
                    return; // Keep open
                }

                // Otherwise, close.
                onClose();
            };

            window.addEventListener('popstate', handlePopState);

            return () => {
                // Cleanup
                window.removeEventListener('popstate', handlePopState);
                if (window.__MODAL_COUNT__) window.__MODAL_COUNT__--;
                
                // Remove from stack if present
                if (window.__MODAL_STACK__) {
                    const idx = window.__MODAL_STACK__.indexOf(modalId);
                    if (idx !== -1) {
                        window.__MODAL_STACK__.splice(idx, 1);
                    }
                }
            };
        }
    }, [isOpen, onClose, modalId]);

    // [New] Handle ESC Key Manually (Since we disabled built-in closeOnEscape)
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                // Check Stack: Only close if we are at the top
                const stack = window.__MODAL_STACK__ || [];
                const topModalId = stack[stack.length - 1];

                // If we are the top modal, close us.
                if (topModalId === modalId) {
                    event.preventDefault(); 
                    event.stopPropagation();
                    handleCleanClose();
                }
            }
        };

        // Use capturing to ensure we catch it before others if needed, 
        // but bubbling is usually fine. Let's use bubbling for now.
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, modalId, handleCleanClose]);



    return handleCleanClose;
}
