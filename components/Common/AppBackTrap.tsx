'use client';

import { useEffect } from 'react';

export function AppBackTrap() {
    useEffect(() => {
        // [Refactor] Dashboard Back Trap Removed
        // The Mobile Menu (/menu) is acting as the Hub. 
        // Dashboard is just a page. Back button should return to Menu.
        // We removed the trap here to allow standard history navigation.
    }, []);

    return null;
}
