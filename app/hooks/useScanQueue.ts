import { useState, useEffect, useCallback, useRef } from 'react';
import { useVisualFeedbackStore } from '@/store/visualFeedbackStore';

interface ScanItem {
    id: string;
    code: string;
    status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'ERROR';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result?: any;
    error?: string;
}

interface UseScanQueueConfig {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    processFunction: (code: string) => Promise<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess?: (code: string, result: any) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError?: (code: string, error: any) => void;
}

export function useScanQueue({ processFunction, onSuccess, onError }: UseScanQueueConfig) {
    const [queue, setQueue] = useState<ScanItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const { trigger } = useVisualFeedbackStore();

    // Prevent duplicate processing of the same code within a short window (client-side throttling)
    // Helps with "Sweep" scanning the same cylinder twice by mistake
    const processedHistory = useRef<Map<string, number>>(new Map());

    const addToQueue = useCallback((code: string) => {
        // [Smart Debounce]: Ignore if processed successfully in the last 5 seconds
        const lastTime = processedHistory.current.get(code);
        if (lastTime && Date.now() - lastTime < 5000) {
            console.log(`[Queue] Skipped duplicate: ${code}`);
            return; 
        }

        const newItem: ScanItem = {
            id: Math.random().toString(36).substring(7),
            code,
            status: 'PENDING'
        };

        setQueue(prev => [...prev, newItem]);
        // [FIX] Removed trigger('warning') to avoid Yellow Flash. LoadingOverlay provides sufficient feedback.
        // Let's rely on the Processor for Success/Error feedback. 
        // But maybe a short "blip" sound for "Captured"?
    }, []);

    const processNext = useCallback(async () => {
        if (isProcessing) return;

        // Find first PENDING
        const nextItem = queue.find(item => item.status === 'PENDING');
        if (!nextItem) return;

        setIsProcessing(true);

        // Update Status to PROCESSING
        setQueue(prev => prev.map(item => item.id === nextItem.id ? { ...item, status: 'PROCESSING' } : item));

        try {
            const result = await processFunction(nextItem.code);
            
            // Mark Code as Processed History
            processedHistory.current.set(nextItem.code, Date.now());

            // Update Item
            setQueue(prev => prev.map(item => item.id === nextItem.id ? { ...item, status: 'SUCCESS', result } : item));
            
            // Feedback
            trigger('success'); // Green Flash
            // navigator.vibrate([50]); // Short vibe
            if (onSuccess) onSuccess(nextItem.code, result);

        } catch (err: unknown) {
            console.error(`[Queue] Error processing ${nextItem.code}`, err);
            
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const error = err as any;

            setQueue(prev => prev.map(item => item.id === nextItem.id ? { ...item, status: 'ERROR', error: error.message || 'Unknown Error' } : item));
            
            // Feedback
            trigger('error'); // Red Flash
            // navigator.vibrate([100, 50, 100]); // Error vibe
            if (onError) onError(nextItem.code, error);
            
            // [UX Decision]: Stop Queue on Error? Or Continue?
            // "Sweep" implies speed. We should probably continue, but show error clearly.
            // But if it's a System Error (Network), maybe stop?
            // Let's continue for now.
        } finally {
            setIsProcessing(false);
            // Remove from queue after delay to keep list clean? 
            // Or keep history? For now keep them.
        }
    }, [queue, isProcessing, processFunction, onSuccess, onError, trigger]);

    // Loop
    useEffect(() => {
        if (queue.some(i => i.status === 'PENDING') && !isProcessing) {
            processNext();
        }
    }, [queue, isProcessing, processNext]);

    const clearQueue = useCallback(() => setQueue([]), []);

    return {
        queue,
        addToQueue,
        isProcessing,
        clearQueue
    };
}
