/**
 * Notification Permission Manager
 * Handles browser notification permission requests and status management
 */

export type NotificationPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

export interface NotificationPermissionState {
  permission: NotificationPermissionStatus;
  isSupported: boolean;
  canRequest: boolean;
  lastRequested?: Date;
  deniedCount: number;
}

const STORAGE_KEY = 'notification_permission_state';
const MAX_DENIED_REQUESTS = 3; // Don't ask again after 3 denials
const REQUEST_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check if browser supports notifications
 */
export const isNotificationSupported = (): boolean => {
  return 'Notification' in window;
};

/**
 * Get current notification permission status
 */
export const getNotificationPermission = (): NotificationPermissionStatus => {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }
  return Notification.permission as NotificationPermissionStatus;
};

/**
 * Load permission state from localStorage
 */
const loadPermissionState = (): NotificationPermissionState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const state = JSON.parse(stored);
      return {
        ...state,
        lastRequested: state.lastRequested ? new Date(state.lastRequested) : undefined,
      };
    }
  } catch (error) {
    console.warn('Failed to load notification permission state:', error);
  }

  return {
    permission: getNotificationPermission(),
    isSupported: isNotificationSupported(),
    canRequest: true,
    deniedCount: 0,
  };
};

/**
 * Save permission state to localStorage
 */
const savePermissionState = (state: NotificationPermissionState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to save notification permission state:', error);
  }
};

/**
 * Get current permission state
 */
export const getPermissionState = (): NotificationPermissionState => {
  const state = loadPermissionState();
  state.permission = getNotificationPermission();
  state.isSupported = isNotificationSupported();
  
  // Check if we can request again based on cooldown
  if (state.lastRequested) {
    const timeSinceLastRequest = Date.now() - state.lastRequested.getTime();
    state.canRequest = timeSinceLastRequest > REQUEST_COOLDOWN_MS;
  }
  
  // Don't allow requests if denied too many times
  if (state.deniedCount >= MAX_DENIED_REQUESTS) {
    state.canRequest = false;
  }
  
  // Can't request if already granted or denied by browser
  if (state.permission === 'granted' || state.permission === 'denied') {
    state.canRequest = false;
  }
  
  return state;
};

/**
 * Request notification permission from user
 */
export const requestNotificationPermission = async (): Promise<NotificationPermissionStatus> => {
  if (!isNotificationSupported()) {
    console.warn('Notifications are not supported in this browser');
    return 'unsupported';
  }

  const state = getPermissionState();

  // Check if we should request
  if (!state.canRequest) {
    console.warn('Cannot request notification permission at this time');
    return state.permission;
  }

  try {
    // Request permission
    const permission = await Notification.requestPermission();
    
    // Update state
    const newState: NotificationPermissionState = {
      permission: permission as NotificationPermissionStatus,
      isSupported: true,
      canRequest: false,
      lastRequested: new Date(),
      deniedCount: permission === 'denied' ? state.deniedCount + 1 : state.deniedCount,
    };
    
    savePermissionState(newState);
    
    return permission as NotificationPermissionStatus;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return 'denied';
  }
};

/**
 * Request permission with user-friendly prompt
 * Returns true if permission was granted
 */
export const requestPermissionWithPrompt = async (
  onPrompt?: () => void,
  onGranted?: () => void,
  onDenied?: () => void
): Promise<boolean> => {
  const state = getPermissionState();

  // Already granted
  if (state.permission === 'granted') {
    onGranted?.();
    return true;
  }

  // Can't request
  if (!state.canRequest || !state.isSupported) {
    return false;
  }

  // Show custom prompt if provided
  onPrompt?.();

  // Request permission
  const permission = await requestNotificationPermission();

  if (permission === 'granted') {
    onGranted?.();
    return true;
  } else {
    onDenied?.();
    return false;
  }
};

/**
 * Check if we should show permission prompt to user
 */
export const shouldShowPermissionPrompt = (): boolean => {
  const state = getPermissionState();
  return state.isSupported && state.canRequest && state.permission === 'default';
};

/**
 * Reset permission state (for testing or user request)
 */
export const resetPermissionState = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

/**
 * Get user-friendly permission status message
 */
export const getPermissionStatusMessage = (permission: NotificationPermissionStatus): string => {
  switch (permission) {
    case 'granted':
      return 'Notifications are enabled';
    case 'denied':
      return 'Notifications are blocked. Please enable them in your browser settings.';
    case 'default':
      return 'Click to enable notifications';
    case 'unsupported':
      return 'Notifications are not supported in this browser';
    default:
      return 'Unknown notification status';
  }
};

/**
 * Get instructions for enabling notifications in browser settings
 */
export const getBrowserInstructions = (): string => {
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (userAgent.includes('chrome')) {
    return 'Chrome: Click the lock icon in the address bar → Site settings → Notifications → Allow';
  } else if (userAgent.includes('firefox')) {
    return 'Firefox: Click the lock icon in the address bar → Permissions → Notifications → Allow';
  } else if (userAgent.includes('safari')) {
    return 'Safari: Safari menu → Preferences → Websites → Notifications → Allow for this site';
  } else if (userAgent.includes('edge')) {
    return 'Edge: Click the lock icon in the address bar → Site permissions → Notifications → Allow';
  }
  
  return 'Please check your browser settings to enable notifications for this site';
};

/**
 * Test notification (only works if permission is granted)
 */
export const sendTestNotification = (): boolean => {
  if (getNotificationPermission() !== 'granted') {
    console.warn('Cannot send test notification: permission not granted');
    return false;
  }

  try {
    const notification = new Notification('Test Notification', {
      body: 'Notifications are working correctly!',
      icon: '/notification-icon.png',
      tag: 'test-notification',
    });

    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000);
    
    return true;
  } catch (error) {
    console.error('Failed to send test notification:', error);
    return false;
  }
};
