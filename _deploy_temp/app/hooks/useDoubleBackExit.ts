import { useEffect, useRef } from 'react';
import { notifications } from '@mantine/notifications';

/**
 * Hook to handle "Double Back to Exit" behavior on PWA/Mobile.
 * Active only when the component is mounted (intended for Login page).
 */
export const useDoubleBackExit = () => {
    const lastBackPressTime = useRef<number>(0);

    useEffect(() => {
        // Only active in browser environment
        if (typeof window === 'undefined') return;

        // Initialize: Push a dummy state to "trap" the back actions
        window.history.pushState(null, '', window.location.href);
        
        // Guard: Ignore events during initial mount (e.g. from redirect) to prevent auto-close on logout
        const mountTime = Date.now();

        const handlePopState = () => {
             // [Safety] Ignore events right after mount
            if (Date.now() - mountTime < 500) return;

            const now = Date.now();
            const timeDiff = now - lastBackPressTime.current;

            // If back button pressed within 2.5 seconds (Increased for better UX)
            if (timeDiff < 2500) {
                // Exit Application Strategy
                // [CRITICAL CHANGE] Do NOT close the window.
                // Closing the window reveals the previous App (Native Camera), which users interpret as a bug.
                // Instead, we navigate to Google to "Exit" the critical system context while blocking the view of the native camera.
                
                // Optional: Clear history state to prevent forward navigation back to the app?
                // window.history.replaceState(null, '', '/'); 
                
                window.location.href = 'https://www.google.com';
            } else {
                // First Press
                lastBackPressTime.current = now;
                
                // Prevent going back by pushing state again immediately
                // This keeps the user on the current page (Login)
                window.history.pushState(null, '', window.location.href);

                // Show Toast
                notifications.show({
                    title: '알림',
                    message: '\'뒤로\' 버튼을 한번 더 누르면 종료됩니다.',
                    color: 'dark',
                    autoClose: 2000,
                });
            }
        };

        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, []);
};
