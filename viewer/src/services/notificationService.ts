/**
 * Notification Service
 * Handles API calls for critical notification system with retry logic and error handling
 */

import { apiCall } from './ApiService';
import { CriticalNotification, NotificationSettings } from '../types/notifications';

interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  backoffMultiplier?: number;
}

class NotificationService {
  private readonly defaultRetryOptions: RetryOptions = {
    maxRetries: 3,
    retryDelay: 1000,
    backoffMultiplier: 2,
  };

  /**
   * Retry wrapper with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const { maxRetries, retryDelay, backoffMultiplier } = {
      ...this.defaultRetryOptions,
      ...options,
    };

    let lastError: Error | null = null;
    let delay = retryDelay!;

    for (let attempt = 0; attempt <= maxRetries!; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries!) {
          console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`, error);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= backoffMultiplier!;
        }
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  /**
   * Get all notifications for current user with retry logic
   */
  async getNotifications(): Promise<CriticalNotification[]> {
    try {
      return await this.retryWithBackoff(async () => {
        const response = await apiCall('/api/notifications/critical');
        if (!response.ok) {
          throw new Error(`Failed to fetch notifications: ${response.statusText}`);
        }
        const data = await response.json();
        
        // Convert date strings to Date objects
        return data.map((notification: any) => ({
          ...notification,
          createdAt: new Date(notification.createdAt),
          deliveredAt: notification.deliveredAt ? new Date(notification.deliveredAt) : undefined,
          acknowledgedAt: notification.acknowledgedAt ? new Date(notification.acknowledgedAt) : undefined,
          escalationHistory: notification.escalationHistory?.map((event: any) => ({
            ...event,
            timestamp: new Date(event.timestamp),
            acknowledgedAt: event.acknowledgedAt ? new Date(event.acknowledgedAt) : undefined,
          })) || [],
        }));
      });
    } catch (error) {
      console.error('Error fetching notifications after retries:', error);
      throw error;
    }
  }

  /**
   * Get a specific notification by ID with retry logic
   */
  async getNotification(notificationId: string): Promise<CriticalNotification | null> {
    try {
      return await this.retryWithBackoff(async () => {
        const response = await apiCall(`/api/notifications/critical/${notificationId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch notification: ${response.statusText}`);
        }
        const notification = await response.json();
        
        // Convert date strings to Date objects
        return {
          ...notification,
          createdAt: new Date(notification.createdAt),
          deliveredAt: notification.deliveredAt ? new Date(notification.deliveredAt) : undefined,
          acknowledgedAt: notification.acknowledgedAt ? new Date(notification.acknowledgedAt) : undefined,
          escalationHistory: notification.escalationHistory?.map((event: any) => ({
            ...event,
            timestamp: new Date(event.timestamp),
            acknowledgedAt: event.acknowledgedAt ? new Date(event.acknowledgedAt) : undefined,
          })) || [],
        };
      });
    } catch (error) {
      console.error('Error fetching notification after retries:', error);
      throw error;
    }
  }

  /**
   * Acknowledge a notification with retry logic
   */
  async acknowledgeNotification(notificationId: string): Promise<boolean> {
    try {
      await this.retryWithBackoff(async () => {
        const response = await apiCall(`/api/notifications/critical/${notificationId}/acknowledge`, {
          method: 'POST',
        });
        
        if (!response.ok) {
          throw new Error(`Failed to acknowledge notification: ${response.statusText}`);
        }
        
        return response.json();
      });
      
      return true;
    } catch (error) {
      console.error('Error acknowledging notification after retries:', error);
      throw error;
    }
  }

  /**
   * Escalate a notification manually
   */
  async escalateNotification(notificationId: string): Promise<boolean> {
    try {
      await this.retryWithBackoff(async () => {
        const response = await apiCall(`/api/notifications/critical/${notificationId}/escalate`, {
          method: 'POST',
        });
        
        if (!response.ok) {
          throw new Error(`Failed to escalate notification: ${response.statusText}`);
        }
        
        return response.json();
      });
      
      return true;
    } catch (error) {
      console.error('Error escalating notification after retries:', error);
      throw error;
    }
  }

  /**
   * Get notification settings for current user with retry logic
   */
  async getSettings(): Promise<NotificationSettings | null> {
    try {
      return await this.retryWithBackoff(async () => {
        const response = await apiCall('/api/notifications/settings');
        if (!response.ok) {
          throw new Error(`Failed to fetch notification settings: ${response.statusText}`);
        }
        return await response.json();
      });
    } catch (error) {
      console.error('Error fetching notification settings after retries:', error);
      throw error;
    }
  }

  /**
   * Update notification settings with retry logic
   */
  async updateSettings(settings: NotificationSettings): Promise<boolean> {
    try {
      await this.retryWithBackoff(async () => {
        const response = await apiCall('/api/notifications/settings', {
          method: 'PUT',
          body: JSON.stringify(settings),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to update notification settings: ${response.statusText}`);
        }
        
        return response.json();
      });
      
      return true;
    } catch (error) {
      console.error('Error updating notification settings after retries:', error);
      throw error;
    }
  }

  /**
   * Get notification history with retry logic
   */
  async getHistory(startDate?: Date, endDate?: Date): Promise<CriticalNotification[]> {
    try {
      return await this.retryWithBackoff(async () => {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate.toISOString());
        if (endDate) params.append('endDate', endDate.toISOString());
        
        const response = await apiCall(`/api/notifications/history?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch notification history: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.map((notification: any) => ({
          ...notification,
          createdAt: new Date(notification.createdAt),
          deliveredAt: notification.deliveredAt ? new Date(notification.deliveredAt) : undefined,
          acknowledgedAt: notification.acknowledgedAt ? new Date(notification.acknowledgedAt) : undefined,
          escalationHistory: notification.escalationHistory?.map((event: any) => ({
            ...event,
            timestamp: new Date(event.timestamp),
            acknowledgedAt: event.acknowledgedAt ? new Date(event.acknowledgedAt) : undefined,
          })) || [],
        }));
      });
    } catch (error) {
      console.error('Error fetching notification history after retries:', error);
      throw error;
    }
  }

  /**
   * Create a critical notification
   */
  async createNotification(notification: Partial<CriticalNotification>): Promise<CriticalNotification> {
    try {
      return await this.retryWithBackoff(async () => {
        const response = await apiCall('/api/notifications/critical', {
          method: 'POST',
          body: JSON.stringify(notification),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to create notification: ${response.statusText}`);
        }
        
        const data = await response.json();
        return {
          ...data,
          createdAt: new Date(data.createdAt),
          deliveredAt: data.deliveredAt ? new Date(data.deliveredAt) : undefined,
          acknowledgedAt: data.acknowledgedAt ? new Date(data.acknowledgedAt) : undefined,
          escalationHistory: data.escalationHistory?.map((event: any) => ({
            ...event,
            timestamp: new Date(event.timestamp),
            acknowledgedAt: event.acknowledgedAt ? new Date(event.acknowledgedAt) : undefined,
          })) || [],
        };
      });
    } catch (error) {
      console.error('Error creating notification after retries:', error);
      throw error;
    }
  }
}

export const notificationService = new NotificationService();
export default notificationService;
