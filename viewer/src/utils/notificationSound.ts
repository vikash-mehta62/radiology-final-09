/**
 * Notification Sound Manager
 * Handles playing notification sounds with browser autoplay policy compliance
 */

export type NotificationSoundType = 'critical' | 'high' | 'medium' | 'default';

export interface NotificationSoundOptions {
  volume?: number;
  loop?: boolean;
  respectAutoplayPolicy?: boolean;
}

const SOUND_FILES: Record<NotificationSoundType, string> = {
  critical: '/sounds/notification-critical.mp3',
  high: '/sounds/notification-high.mp3',
  medium: '/sounds/notification-medium.mp3',
  default: '/sounds/notification-default.mp3',
};

const STORAGE_KEY = 'notification_sound_settings';

export interface SoundSettings {
  enabled: boolean;
  volume: number;
  criticalEnabled: boolean;
  highEnabled: boolean;
  mediumEnabled: boolean;
}

/**
 * Default sound settings
 */
const DEFAULT_SETTINGS: SoundSettings = {
  enabled: true,
  volume: 0.5,
  criticalEnabled: true,
  highEnabled: true,
  mediumEnabled: true,
};

/**
 * Load sound settings from localStorage
 */
export const loadSoundSettings = (): SoundSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.warn('Failed to load sound settings:', error);
  }
  return DEFAULT_SETTINGS;
};

/**
 * Save sound settings to localStorage
 */
export const saveSoundSettings = (settings: SoundSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to save sound settings:', error);
  }
};

/**
 * Check if sound should be played based on settings
 */
const shouldPlaySound = (type: NotificationSoundType): boolean => {
  const settings = loadSoundSettings();
  
  if (!settings.enabled) {
    return false;
  }
  
  switch (type) {
    case 'critical':
      return settings.criticalEnabled;
    case 'high':
      return settings.highEnabled;
    case 'medium':
      return settings.mediumEnabled;
    default:
      return true;
  }
};

/**
 * Audio cache to reuse audio elements
 */
const audioCache = new Map<string, HTMLAudioElement>();

/**
 * Get or create audio element
 */
const getAudioElement = (soundFile: string): HTMLAudioElement => {
  if (!audioCache.has(soundFile)) {
    const audio = new Audio(soundFile);
    audio.preload = 'auto';
    audioCache.set(soundFile, audio);
  }
  return audioCache.get(soundFile)!;
};

/**
 * Play notification sound
 */
export const playNotificationSound = async (
  type: NotificationSoundType = 'default',
  options: NotificationSoundOptions = {}
): Promise<boolean> => {
  // Check if sound should be played
  if (!shouldPlaySound(type)) {
    console.log('Sound disabled for type:', type);
    return false;
  }

  const settings = loadSoundSettings();
  const soundFile = SOUND_FILES[type];
  
  try {
    const audio = getAudioElement(soundFile);
    
    // Set volume
    audio.volume = options.volume ?? settings.volume;
    
    // Set loop
    audio.loop = options.loop ?? false;
    
    // Reset audio to start
    audio.currentTime = 0;
    
    // Try to play
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
      await playPromise;
      console.log('Notification sound played:', type);
      return true;
    }
    
    return false;
  } catch (error: any) {
    // Handle autoplay policy errors
    if (error.name === 'NotAllowedError' || error.name === 'NotSupportedError') {
      console.warn('Autoplay prevented. User interaction required:', error.message);
      
      if (options.respectAutoplayPolicy !== false) {
        // Store that we need to play sound after user interaction
        sessionStorage.setItem('pending_notification_sound', type);
      }
    } else {
      console.error('Error playing notification sound:', error);
    }
    return false;
  }
};

/**
 * Play sound after user interaction (to comply with autoplay policy)
 */
export const playPendingSound = async (): Promise<void> => {
  const pendingSound = sessionStorage.getItem('pending_notification_sound');
  if (pendingSound) {
    sessionStorage.removeItem('pending_notification_sound');
    await playNotificationSound(pendingSound as NotificationSoundType);
  }
};

/**
 * Stop all playing sounds
 */
export const stopAllSounds = (): void => {
  audioCache.forEach(audio => {
    audio.pause();
    audio.currentTime = 0;
  });
};

/**
 * Preload notification sounds
 */
export const preloadNotificationSounds = (): void => {
  Object.values(SOUND_FILES).forEach(soundFile => {
    getAudioElement(soundFile);
  });
  console.log('Notification sounds preloaded');
};

/**
 * Test notification sound
 */
export const testNotificationSound = async (
  type: NotificationSoundType = 'default'
): Promise<boolean> => {
  return await playNotificationSound(type, { respectAutoplayPolicy: false });
};

/**
 * Check if browser supports audio
 */
export const isAudioSupported = (): boolean => {
  return typeof Audio !== 'undefined';
};

/**
 * Check autoplay capability
 */
export const checkAutoplayCapability = async (): Promise<boolean> => {
  if (!isAudioSupported()) {
    return false;
  }

  try {
    const audio = new Audio();
    audio.volume = 0;
    audio.muted = true;
    
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      await playPromise;
      audio.pause();
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
};

/**
 * Get sound capabilities
 */
export const getSoundCapabilities = async () => {
  return {
    supported: isAudioSupported(),
    autoplayAllowed: await checkAutoplayCapability(),
    settings: loadSoundSettings(),
  };
};

/**
 * Enable/disable notification sounds
 */
export const setNotificationSoundsEnabled = (enabled: boolean): void => {
  const settings = loadSoundSettings();
  settings.enabled = enabled;
  saveSoundSettings(settings);
};

/**
 * Set notification sound volume
 */
export const setNotificationVolume = (volume: number): void => {
  const settings = loadSoundSettings();
  settings.volume = Math.max(0, Math.min(1, volume));
  saveSoundSettings(settings);
};

/**
 * Enable/disable sound for specific severity
 */
export const setSeveritySoundEnabled = (
  severity: 'critical' | 'high' | 'medium',
  enabled: boolean
): void => {
  const settings = loadSoundSettings();
  
  switch (severity) {
    case 'critical':
      settings.criticalEnabled = enabled;
      break;
    case 'high':
      settings.highEnabled = enabled;
      break;
    case 'medium':
      settings.mediumEnabled = enabled;
      break;
  }
  
  saveSoundSettings(settings);
};

/**
 * Reset sound settings to defaults
 */
export const resetSoundSettings = (): void => {
  saveSoundSettings(DEFAULT_SETTINGS);
};

/**
 * Initialize sound system
 * Should be called after user interaction to enable autoplay
 */
export const initializeSoundSystem = async (): Promise<void> => {
  // Preload sounds
  preloadNotificationSounds();
  
  // Check autoplay capability
  const autoplayAllowed = await checkAutoplayCapability();
  console.log('Autoplay allowed:', autoplayAllowed);
  
  // Play any pending sounds
  await playPendingSound();
};
