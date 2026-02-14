import { useEffect, useState, useCallback, useRef } from 'react';

interface ScannerConfig {
    onChange: (code: string) => void;
    minLength?: number;
    prefix?: string;
    suffix?: string;
}

export const useScanner = ({ onChange, minLength = 3 }: ScannerConfig) => {
    // Buffer (useRef to avoid re-renders on every key)
    const buffer = useRef<string>('');
    const lastKeyTime = useRef<number>(0);
    
    // Config: Scanners are fast, but some wireless scanners or slow PCs have inconsistent timing.
    // 500ms is very generous (human typing speed) but ensures we don't slit a single scan code.
    // Since we check for 'Enter' terminator, this is safe to increase.
    const MAX_KEY_DELAY = 500; 

    // Helper to check if scanning (for UI feedback if needed, currently unused)
    const [isScanningStatus, setIsScanningStatus] = useState(false);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        const currentTime = Date.now();
        const timeDiff = currentTime - lastKeyTime.current;
        
        // Reset buffer if too much time passed (manual typing or lag) and not continuation
        if (buffer.current.length > 0 && timeDiff > MAX_KEY_DELAY) {
            // [Debug] Log reset for potential diagnosis
            // console.log('Scanner Buffer Reset (Timeout)', timeDiff);
            buffer.current = '';
        }

        lastKeyTime.current = currentTime;

        // Ignore modifier keys but allow standard chars
        if (e.key.length > 1 && e.key !== 'Enter') return;

        // [Fix] Ignore if user is typing in an input field (prevent double-submit with local handlers)
        // Hardware scanners simulate keyboard; if an input is focused, let the input handle it logic.
        const target = e.target as HTMLElement;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

        if (e.key === 'Enter') {
            // End of scan sequence
            if (buffer.current.length >= minLength) {
                const code = buffer.current;
                onChange(code);
            }
            buffer.current = '';
            setIsScanningStatus(false);
        } else {
            // Append char to buffer
            buffer.current += e.key;
            if (!isScanningStatus) setIsScanningStatus(true);
        }
    }, [minLength, onChange, isScanningStatus]);

    useEffect(() => {
        // [Fix] Use Caputre Phase (true) to catch events before Inputs/Modals swallow them
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [handleKeyDown]);

    return { 
        isScanning: isScanningStatus 
    };
};
