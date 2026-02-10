// Singleton AudioContext for Mobile Compatibility
let audioCtx: AudioContext | null = null;

const getAudioContext = () => {
    if (typeof window === 'undefined') return null;
    
    if (!audioCtx) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
            audioCtx = new AudioContext();
        }
    }
    return audioCtx;
};

export type SoundType = 'success' | 'error' | 'warning' | 'info';

export const playNotificationSound = async (type: SoundType) => {
    const ctx = getAudioContext();
    if (!ctx) return;

    // [Mobile Fix] Resume context if suspended (common in strict browsers)
    if (ctx.state === 'suspended') {
        try {
            await ctx.resume();
        } catch (e) {
            console.error('Audio Resume Failed:', e);
        }
    }

    const playOscillator = (freq: number, type: OscillatorType, duration: number, startTime: number = 0, vol: number = 0.5) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
        
        gain.gain.setValueAtTime(vol, ctx.currentTime + startTime);
        // Smoother cutoff
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + startTime + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + duration);
    };

    switch (type) {
        case 'success': // User Selection: 6 (Retro Coin)
            playOscillator(987, 'square', 0.1, 0, 0.1); // B5
            playOscillator(1318, 'square', 0.2, 0.1, 0.1); // E6
            break;

        case 'error': // User Selection: 8 (Deep Error / Thud)
            playOscillator(80, 'square', 0.3, 0, 0.6); // Deep thud
            playOscillator(60, 'sawtooth', 0.3, 0.05, 0.4); // Gritty undertone
            break;

        case 'warning': // User Selection: 10 (Urgent Notify)
            playOscillator(1200, 'sine', 0.1, 0, 0.5);
            playOscillator(1200, 'sine', 0.1, 0.15, 0.5);
            break;

        case 'info': // Defaulting to Type 5 (Soft Chime) for Info
            playOscillator(523.25, 'sine', 0.5, 0, 0.4); // C5
            playOscillator(659.25, 'sine', 0.5, 0.1, 0.3); // E5
            break;
    }
};

// [Mobile Fix] Global interaction listener to unlock AudioContext early
// Call this function once in your root layout or main entry point
export const initAudioContext = () => {
    if (typeof window === 'undefined') return;
    
    const unlock = () => {
        const ctx = getAudioContext();
        if (ctx && ctx.state === 'suspended') {
            ctx.resume().then(() => {
                // Remove listener once unlocked
                document.body.removeEventListener('click', unlock);
                document.body.removeEventListener('touchstart', unlock);
                startSilentKeepAlive(); // [Mobile Fix] Keep it warm
            });
        }
    };

    document.body.addEventListener('click', unlock);
    document.body.addEventListener('touchstart', unlock);
};

// [Mobile Fix] Keep AudioContext Active (Silent Oscillator)
// Prevents GC and keeps the hardware warm on iOS/Android
export const startSilentKeepAlive = () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') ctx.resume();

    // Create a silent oscillator
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.value = 100; // Low freq
    gain.gain.value = 0.001; // Nearly silent
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    // Don't stop it intentionally, let it run to keep context active
    // Modern browsers optimize this well
};

// [Optimistic Feedback] Instant low-latency beep for scanner detection
export const playScanBeep = async () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') await ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
};
