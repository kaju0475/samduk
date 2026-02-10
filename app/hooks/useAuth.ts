import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export function useAuth() {
    const router = useRouter();
    const pathname = usePathname();
    
    // Determine initial state based on path
    const isPublic = pathname.startsWith('/auth') || pathname === '/';
    
    const [isAuthorized, setIsAuthorized] = useState(isPublic);
    const [isLoading, setIsLoading] = useState(!isPublic);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        // If public, we are already authorized (initialized above), but we might want to load user if exists?
        // For now, if public, just valid. 
        if (isPublic) {
            return;
        }

        const checkAuth = () => {
             // 1. Check Cookie first
            const getCookie = (name: string): string | null => {
                if (typeof document === 'undefined') return null;
                const value = `; ${document.cookie}`;
                const parts = value.split(`; ${name}=`);
                if (parts.length === 2) {
                    return parts.pop()?.split(';').shift() || null;
                }
                return null;
            };

            const userCookie = getCookie('user');
            
            if (userCookie) {
                try {
                    const userData = JSON.parse(decodeURIComponent(userCookie));
                    // Sync to sessionStorage for consistency
                    sessionStorage.setItem('currentUser', JSON.stringify(userData));
                    setUser(userData);
                    setIsAuthorized(true);
                    setIsLoading(false); // [Fix] Only stop loading on success
                    return;
                } catch {
                     // Cookie parse failed, fall through to localStorage
                }
            }

            // 2. Check SessionStorage
            const stored = sessionStorage.getItem('currentUser');
            if (stored) {
                try {
                    const userData = JSON.parse(stored);
                    setUser(userData);
                    setIsAuthorized(true);
                    setIsLoading(false);
                } catch {
                    // Invalid data
                    router.replace('/auth/login');
                }
            } else {
                // No Auth
                router.replace('/auth/login');
            }
        };

        checkAuth();
    }, [pathname, router, isPublic]);

    return { isAuthorized, isLoading, user };
}
