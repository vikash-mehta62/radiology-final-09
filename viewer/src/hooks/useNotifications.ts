/**
 * useNotifications Hook
 * Manages notification state and real-time updates
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CriticalNotification } from '../types/notifications';
import notificationService from '../services/notificationService';
import { useWebSocket } from './useWebSocket';
import {
  getNotificationPermission,
  getPermissionState,
  NotificationPermissionStatus,
} from '../utils/notificationPermission';
import { showCriticalNotification } from '../utils/browserNotification';
import {
  playNotificationSound,
  NotificationSoundType,
  loadSoundSettings,
} from '../utils/notificationSound';

export interface UseNotificationsReturn {
  notifications: CriticalNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  acknowledgeNotification: (notificationId: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markAllAsRead: () => void;
  permissionStatus: NotificationPermissionStatus;
  hasPermission: boolean;
}

/**
 * Hook for managing notifications
 */
export const useNotifications = (): UseNotificationsReturn => {
  const [notifications, setNotifications] = useState<CriticalNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermissionStatus>('default');
  const { socket, isConnected } = useWebSocket();

  // Track permission status
  useEffect(() => {
    const updatePermissionStatus = () => {
      const status = getNotificationPermission();
      setPermissionStatus(status);
    };

    updatePermissionStatus();

    // Listen for permission changes
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'notifications' as PermissionName }).then((permissionStatus) => {
        permissionStatus.onchange = updatePermissionStatus;
      }).catch(() => {
        // Permissions API not supported, fallback to polling
        const interval = setInterval(updatePermissionStatus, 5000);
        return () => clearInterval(interval);
      });
    }
  }, []);

  // Calculate unread count
  useEffect(() => {
    const count = notifications.filter(n => n.status !== 'acknowledged').length;
    setUnreadCount(count);
  }, [notifications]);

  // Fetch initial notifications
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await notificationService.getNotifications();
      setNotifications(data);
    } catch (err) {
      setError('Failed to load notifications');
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Acknowledge notification
  const acknowledgeNotification = useCallback(async (notificationId: string) => {
    try {
      const success = await notificationService.acknowledgeNotification(notificationId);
      
      if (success) {
        setNotifications(prev =>
          prev.map(n =>
            n.id === notificationId
              ? { ...n, status: 'acknowledged' as const, acknowledgedAt: new Date() }
              : n
          )
        );
      } else {
        throw new Error('Failed to acknowledge notification');
      }
    } catch (err) {
      console.error('Error acknowledging notification:', err);
      throw err;
    }
  }, []);

  // Mark all as read (local only)
  const markAllAsRead = useCallback(() => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, status: 'acknowledged' as const, acknowledgedAt: new Date() }))
    );
  }, []);

  // Refresh notifications
  const refreshNotifications = useCallback(async () => {
    await fetchNotifications();
  }, [fetchNotifications]);

  // Handle incoming WebSocket notification
  const handleNewNotification = useCallback((notification: CriticalNotification) => {
    setNotifications(prev => [notification, ...prev]);
    
    // Play sound based on severity
    const soundSettings = loadSoundSettings();
    if (soundSettings.enabled) {
      const soundType: NotificationSoundType = notification.severity as NotificationSoundType;
      playNotificationSound(soundType).catch(err => {
        console.warn('Could not play notification sound:', err);
      });
    }
    
    // Show browser notification with navigation handler
    showCriticalNotification(notification, (studyId, patientId) => {
      // Navigate to the study viewer
      console.log('Navigating to study:', studyId, 'patient:', patientId);
      // You can implement navigation logic here
      // navigate(`/viewer/${studyId}`);
    });
  }, []);

  // Handle notification acknowledgment updates
  const handleNotificationAcknowledged = useCallback((data: { notificationId: string; userId: string; acknowledgedAt: string }) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === data.notificationId
          ? { ...n, status: 'acknowledged' as const, acknowledgedAt: new Date(data.acknowledgedAt), acknowledgedBy: data.userId }
          : n
      )
    );
  }, []);

  // Setup initial data and WebSocket listeners
  useEffect(() => {
    // Fetch initial notifications
    fetchNotifications();
  }, [fetchNotifications]);

  // Setup WebSocket event listeners for real-time notifications
  useEffect(() => {
    if (!socket || !isConnected) {
      return;
    }

    console.log('Setting up WebSocket listeners for notifications');

    // Listen for new critical notifications
    const handleCriticalNotification = (data: any) => {
      console.log('Received critical notification:', data);
      
      try {
        const notification: CriticalNotification = {
          ...data.notification,
          createdAt: new Date(data.notification.createdAt),
          deliveredAt: data.notification.deliveredAt ? new Date(data.notification.deliveredAt) : undefined,
          acknowledgedAt: data.notification.acknowledgedAt ? new Date(data.notification.acknowledgedAt) : undefined,
        };
        
        handleNewNotification(notification);
      } catch (err) {
        console.error('Error processing critical notification:', err);
      }
    };

    // Listen for notification acknowledgment updates
    const handleAcknowledgment = (data: any) => {
      console.log('Notification acknowledged:', data);
      handleNotificationAcknowledged(data);
    };

    // Listen for notification escalation updates
    const handleEscalation = (data: any) => {
      console.log('Notification escalated:', data);
      
      setNotifications(prev =>
        prev.map(n =>
          n.id === data.notificationId
            ? { ...n, status: 'escalated' as const, escalationLevel: data.escalationLevel }
            : n
        )
      );
    };

    // Register event listeners
    socket.on('critical_notification', handleCriticalNotification);
    socket.on('notification_acknowledged', handleAcknowledgment);
    socket.on('notification_escalated', handleEscalation);

    // Cleanup listeners on unmount or socket change
    return () => {
      socket.off('critical_notification', handleCriticalNotification);
      socket.off('notification_acknowledged', handleAcknowledgment);
      socket.off('notification_escalated', handleEscalation);
    };
  }, [socket, isConnected, handleNewNotification, handleNotificationAcknowledged]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    acknowledgeNotification,
    refreshNotifications,
    markAllAsRead,
    permissionStatus,
    hasPermission: permissionStatus === 'granted',
  };
};

export default useNotifications;
