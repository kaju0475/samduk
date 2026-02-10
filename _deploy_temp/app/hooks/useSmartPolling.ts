import { useEffect, useRef, useState } from 'react';

interface SmartPollingConfig {
    callback: () => Promise<void> | void;
    activeInterval?: number; // ms, default 5000 (Slower default for mobile battery)
    idleInterval?: number;   // ms, default 30000 
    idleTimeout?: number;    // ms, default 10000
    hiddenInterval?: number; // ms, default 0 (Stop polling when hidden)
}

export const useSmartPolling = ({ 
    callback, 
    activeInterval = 5000, 
    idleInterval = 30000, 
    idleTimeout = 10000,
    hiddenInterval = 0
}: SmartPollingConfig) => {
    // State to track status
    const [status, setStatus] = useState<'ACTIVE' | 'IDLE' | 'HIDDEN'>('ACTIVE');
    const lastActivityTime = useRef<number>(0);
    const callbackRef = useRef(callback);

    // Initialize timestamp on mount
    useEffect(() => {
        lastActivityTime.current = Date.now();
    }, []);

    // Update ref
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    // 1. Visibility Monitor
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                setStatus('HIDDEN');
            } else {
                // Determine if we should go to Active or Idle based on last activity
                const now = Date.now();
                if (now - lastActivityTime.current < idleTimeout) {
                    setStatus('ACTIVE');
                } else {
                    setStatus('IDLE');
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [idleTimeout]);

    // 2. Activity Monitor (for Idle detection)
    useEffect(() => {
        const handleActivity = () => {
            lastActivityTime.current = Date.now();
            if (!document.hidden && status !== 'ACTIVE') {
                 setStatus('ACTIVE');
            }
        };

        const throttle = (func: () => void, limit: number) => {
            let inThrottle: boolean;
            return () => {
                if (!inThrottle) {
                    func();
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        };

        const throttledHandler = throttle(handleActivity, 2000);

        // Listeners
        window.addEventListener('click', throttledHandler, { passive: true });
        window.addEventListener('touchstart', throttledHandler, { passive: true });
        window.addEventListener('keydown', throttledHandler, { passive: true });
        window.addEventListener('scroll', throttledHandler, { passive: true });

        return () => {
            window.removeEventListener('click', throttledHandler);
            window.removeEventListener('touchstart', throttledHandler);
            window.removeEventListener('keydown', throttledHandler);
            window.removeEventListener('scroll', throttledHandler);
        };
    }, [status]);

    // 3. Polling Logic
    useEffect(() => {
        let timerId: NodeJS.Timeout;

        const tick = async () => {
            const now = Date.now();
            
            // Check Idle Transition
            if (status === 'ACTIVE' && (now - lastActivityTime.current > idleTimeout)) {
                setStatus('IDLE');
                // Don't poll immediately on transition, wait for next tick
            }

            // Determine effective interval
            let currentInterval = activeInterval;
            
            if (status === 'HIDDEN') {
                currentInterval = hiddenInterval;
            } else if (status === 'IDLE') {
                currentInterval = idleInterval;
            }

            // Execute Poll
            if (currentInterval > 0) {
                 // Logic: If Hidden, we might skip execution if hiddenInterval is 0 (handled by if check)
                 // But if hiddenInterval > 0, we execute.
                 try {
                     await callbackRef.current();
                 } catch (e) {
                     console.error('[SmartPolling] Error:', e);
                 }
            }

            // Schedule next
            if (currentInterval > 0) {
                timerId = setTimeout(tick, currentInterval);
            }
        };

        // Start first tick
        // Delay initial start slightly to prevent double-fetch on mount if component fetches on mount
        timerId = setTimeout(tick, activeInterval);

        return () => clearTimeout(timerId);
    }, [activeInterval, idleInterval, hiddenInterval, idleTimeout, status]);

    return { status };
};
