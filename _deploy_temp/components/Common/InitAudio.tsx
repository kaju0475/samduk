'use client';

import { useEffect } from 'react';
import { initAudioContext } from '@/app/utils/sound-effects';

export function InitAudio() {
    useEffect(() => {
        // Unlock AudioContext on first interaction
        initAudioContext();
    }, []);
    
    return null;
}
