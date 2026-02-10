'use client';

// Sound Settings Manager
// Manages user preferences for sound and vibration

export interface SoundSettings {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

const SOUND_SETTINGS_KEY = 'soundSettings';

const defaultSettings: SoundSettings = {
  soundEnabled: true,
  vibrationEnabled: true,
};

/**
 * Get current sound settings from localStorage
 */
export function getSoundSettings(): SoundSettings {
  if (typeof window === 'undefined') {
    return defaultSettings;
  }

  try {
    const stored = localStorage.getItem(SOUND_SETTINGS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load sound settings:', error);
  }

  return defaultSettings;
}

/**
 * Save sound settings to localStorage
 */
export function saveSoundSettings(settings: SoundSettings): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(SOUND_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save sound settings:', error);
  }
}

/**
 * Toggle sound on/off
 */
export function toggleSound(): SoundSettings {
  const current = getSoundSettings();
  const updated = { ...current, soundEnabled: !current.soundEnabled };
  saveSoundSettings(updated);
  return updated;
}

/**
 * Toggle vibration on/off
 */
export function toggleVibration(): SoundSettings {
  const current = getSoundSettings();
  const updated = { ...current, vibrationEnabled: !current.vibrationEnabled };
  saveSoundSettings(updated);
  return updated;
}
