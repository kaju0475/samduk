
import { create } from 'zustand';

type FeedbackType = 'success' | 'warning' | 'error';

interface VisualFeedbackState {
    isActive: boolean;
    type: FeedbackType;
    message?: string;    // [Added] Message Payload
    subMessage?: string; // [Added] Sub-Message Payload
    trigger: (type: FeedbackType, message?: string, subMessage?: string) => void;
    reset: () => void;
}

export const useVisualFeedbackStore = create<VisualFeedbackState>((set) => ({
    isActive: false,
    type: 'success',
    message: undefined,
    subMessage: undefined,
    trigger: (type, message, subMessage) => {
        // [Sound Restoration] Play Sound immediately
        import('@/app/utils/sound-effects').then(({ playNotificationSound }) => {
             playNotificationSound(type === 'success' ? 'success' : type === 'error' ? 'error' : 'warning');
        }).catch(err => console.error('Failed to load sound effects', err));

        set({ isActive: true, type, message, subMessage });
        const duration = type === 'success' ? 500 : type === 'warning' ? 1000 : 1500;
        setTimeout(() => {
            set({ isActive: false, message: undefined, subMessage: undefined });
        }, duration);
    },
    reset: () => set({ isActive: false, message: undefined, subMessage: undefined })
}));
