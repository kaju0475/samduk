'use client';

import { useEffect, useRef, useCallback } from 'react';
// import { useRouter } from 'next/navigation';

// 5 Hours in milliseconds
const INACTIVITY_LIMIT = 5 * 60 * 60 * 1000; 

export function AutoLogoutHandler() {
// const router = useRouter(); // Unused
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const performLogout = useCallback(() => {
    // 1. Clear Session
    sessionStorage.removeItem('currentUser');
    localStorage.removeItem('currentUser');
    
    // 2. Clear Cookie
    document.cookie = 'user=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';

    // 3. Redirect
    window.location.replace('/auth/login?reason=timeout');
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(performLogout, INACTIVITY_LIMIT);
  }, [performLogout]);

  // Standard Inactivity Check (Reset on user action)
  useEffect(() => {
    // Events to monitor
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];

    // Initial Start
    resetTimer();

    // Attach listeners
    // Use capture to ensure we catch events even if propagation stops
    const handleActivity = () => resetTimer();
    
    events.forEach(event => {
      window.addEventListener(event, handleActivity, true);
    });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach(event => {
        window.removeEventListener(event, handleActivity, true);
      });
    };
  }, [resetTimer]);

  return null; // Logic only component
}
