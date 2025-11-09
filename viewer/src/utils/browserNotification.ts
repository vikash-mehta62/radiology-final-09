/**
 * Browser Notification Utility
 * Handles creation and management of browser push notifications
 */

import { CriticalNotification } from '../types/notifications';
import { getNotificationPermission } from './notificationPermission';

export interface BrowserNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
  data?: any;
  onClick?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
}

/**
 * Create and show a browser notification
 */
export const showBrowserNotification = (
  options: BrowserNotificationOptions
): Notification | null => {
  // Check if notifications are supported
  if (!('Notification' in window)) {
    console.warn('Browser notifications are not supported');
    return null;
  }

  // Check permission
  if (Notification.permission !== 'granted') {
    console.warn('Notification permission not granted');
    return null;
  }

  try {
    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon || '/notification-icon.png',
      badge: options.badge || '/notification-badge.png',
      tag: options.tag,
      requireInteraction: options.requireInteraction || false,
      silent: options.silent || false,
      vibrate: options.vibrate,
      data: options.data,
    });

    // Add event handlers
    if (options.onClick) {
      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        options.onClick?.();
        notification.close();
      };
    }

    if (options.onClose) {
      notification.onclose = () => {
        options.onClose?.();
      };
    }

    if (options.onError) {
      notification.onerror = (error) => {
        console.error('Notification error:', error);
        options.onError?.(error);
      };
    }

    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
};

/**
 * Create notification from CriticalNotification object
 */
export const showCriticalNotification = (
  notification: CriticalNotification,
  onNavigate?: (studyId: string, patientId: string) => void
): Notification | null => {
  const severity = notification.severity;
  
  // Determine notification options based on severity
  const requireInteraction = severity === 'critical';
  const vibrate = severity === 'critical' ? [200, 100, 200] : undefined;

  return showBrowserNotification({
    title: notification.title,
    body: notification.message,
    tag: notification.id,
    requireInteraction,
    vibrate,
    data: {
      notificationId: notification.id,
      studyId: notification.studyId,
      patientId: notification.patientId,
      severity: notification.severity,
      type: notification.type,
    },
    onClick: () => {
      if (onNavigate) {
        onNavigate(notification.studyId, notification.patientId);
      }
    },
    onClose: () => {
      console.log('Notification closed:', notification.id);
    },
    onError: (error) => {
      console.error('Notification error for:', notification.id, error);
    },
  });
};

/**
 * Close notification by tag
 */
export const closeNotification = (tag: string): void => {
  // Note: There's no direct API to close notifications by tag
  // This is a limitation of the Notifications API
  console.log('Attempting to close notification with tag:', tag);
};

/**
 * Close all notifications (if supported)
 */
export const closeAllNotifications = async (): Promise<void> => {
  if ('serviceWorker' in navigator && 'getNotifications' in ServiceWorkerRegistration.prototype) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const notifications = await registration.getNotifications();
      notifications.forEach(notification => notification.close());
    } catch (error) {
      console.warn('Could not close all notifications:', error);
    }
  }
};

/**
 * Get active notifications (if supported)
 */
export const getActiveNotifications = async (): Promise<Notification[]> => {
  if ('serviceWorker' in navigator && 'getNotifications' in ServiceWorkerRegistration.prototype) {
    try {
      const registration = await navigator.serviceWorker.ready;
      return await registration.getNotifications();
    } catch (error) {
      console.warn('Could not get active notifications:', error);
      return [];
    }
  }
  return [];
};

/**
 * Check if a notification with a specific tag is active
 */
export const isNotificationActive = async (tag: string): Promise<boolean> => {
  const notifications = await getActiveNotifications();
  return notifications.some(n => n.tag === tag);
};

/**
 * Create a notification group (for multiple related notifications)
 */
export const showNotificationGroup = (
  notifications: CriticalNotification[],
  onNavigate?: (studyId: string, patientId: string) => void
): Notification | null => {
  if (notifications.length === 0) return null;

  if (notifications.length === 1) {
    return showCriticalNotification(notifications[0], onNavigate);
  }

  // Create a summary notification for multiple notifications
  const criticalCount = notifications.filter(n => n.severity === 'critical').length;
  const highCount = notifications.filter(n => n.severity === 'high').length;
  const mediumCount = notifications.filter(n => n.severity === 'medium').length;

  let body = `You have ${notifications.length} new notifications`;
  if (criticalCount > 0) body += `\n${criticalCount} critical`;
  if (highCount > 0) body += `\n${highCount} high priority`;
  if (mediumCount > 0) body += `\n${mediumCount} medium priority`;

  return showBrowserNotification({
    title: 'Multiple Critical Notifications',
    body,
    tag: 'notification-group',
    requireInteraction: criticalCount > 0,
    vibrate: criticalCount > 0 ? [200, 100, 200] : undefined,
    data: {
      notificationIds: notifications.map(n => n.id),
      count: notifications.length,
    },
    onClick: () => {
      // Navigate to notifications panel
      window.focus();
    },
  });
};

/**
 * Test browser notification
 */
export const sendTestNotification = (): Notification | null => {
  return showBrowserNotification({
    title: 'Test Notification',
    body: 'Browser notifications are working correctly!',
    tag: 'test-notification',
    onClick: () => {
      console.log('Test notification clicked');
    },
  });
};

/**
 * Format notification body with patient and study info
 */
export const formatNotificationBody = (notification: CriticalNotification): string => {
  let body = notification.message;
  
  if (notification.findingDetails) {
    body += `\n\nLocation: ${notification.findingDetails.location}`;
    body += `\nDescription: ${notification.findingDetails.description}`;
  }
  
  body += `\n\nPatient: ${notification.patientId}`;
  body += `\nStudy: ${notification.studyId}`;
  
  return body;
};

/**
 * Get notification icon based on severity
 */
export const getNotificationIcon = (severity: 'critical' | 'high' | 'medium'): string => {
  switch (severity) {
    case 'critical':
      return '/notification-critical.png';
    case 'high':
      return '/notification-high.png';
    case 'medium':
      return '/notification-medium.png';
    default:
      return '/notification-icon.png';
  }
};

/**
 * Check if browser supports notification features
 */
export const getNotificationCapabilities = () => {
  return {
    supported: 'Notification' in window,
    permission: getNotificationPermission(),
    maxActions: 'maxActions' in Notification ? (Notification as any).maxActions : 0,
    serviceWorkerSupported: 'serviceWorker' in navigator,
    vibrationSupported: 'vibrate' in navigator,
    badgeSupported: 'setAppBadge' in navigator,
  };
};

/**
 * Log notification capabilities for debugging
 */
export const logNotificationCapabilities = (): void => {
  const capabilities = getNotificationCapabilities();
  console.log('Browser Notification Capabilities:', capabilities);
};
