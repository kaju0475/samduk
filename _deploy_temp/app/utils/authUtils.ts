// Utility for interacting with Auth storage safely

export const getWorkerId = (): string | null => {
    if (typeof window === 'undefined') return null;
    try {
        const userStr = sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser');
        if (!userStr) return null;
        
        const user = JSON.parse(userStr);
        // Prioritize username (legacy system uses username as ID for some records)
        // Check if your system uses 'id' (UUID) or 'username' (Login ID) for history.
        // Based on existing code: `const workerId = user?.username || user?.id;`
        return user.username || user.id || null;
    } catch {
        return null;
    }
};

export const getCurrentUser = () => {
    if (typeof window === 'undefined') return null;
    try {
        const userStr = sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser');
        return userStr ? JSON.parse(userStr) : null;
    } catch {
        return null;
    }
};
