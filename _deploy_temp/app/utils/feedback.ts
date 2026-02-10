'use client';

// [Revert] Sound & TTS removed by user request
// These functions are kept as empty no-ops to prevent breaking imports in other files.

export const initAudio = async () => {
    // No-op
};

export const speak = (text: string) => {
    // No-op
    console.log('[Feedback] Speak (Silent):', text);
};

export const playSuccessSound = async () => {
    console.log('[Feedback] Success (Silent)');
};

export const playErrorSound = async () => {
    console.log('[Feedback] Error (Silent)');
};

export const playWarningSound = async () => {
    console.log('[Feedback] Warning (Silent)');
};

export const playInfoSound = async () => {
    console.log('[Feedback] Info (Silent)');
};

export const playCriticalSound = async () => {
    console.log('[Feedback] Critical (Silent)');
};

// Legacy alias
export const playAlertSound = playErrorSound;
