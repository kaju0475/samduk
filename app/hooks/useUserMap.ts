import { useState, useEffect } from 'react';

export function useUserMap() {
    const [userMap, setUserMap] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await fetch('/api/master/users');
                if (!res.ok) return;
                const data = await res.json();
                if (data.success && Array.isArray(data.data)) {
                    const map: Record<string, string> = {};
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    data.data.forEach((u: any) => {
                        map[u.username] = u.name;
                        map[u.id] = u.name; // Map both ID and Username for compatibility
                    });
                    setUserMap(map);
                }
            } catch (error) {
                console.warn('Failed to fetch users:', error);
            }
        };

        fetchUsers();
    }, []);

    return userMap;
}
