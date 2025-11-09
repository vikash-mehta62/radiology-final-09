const CriticalNotification = require('../models/CriticalNotification');
const { getEmailService } = require('./email-service');

/**
 * Critical Notification Service
 * Handles critical medical finding notifications with multi-channel delivery and escalation
 * Complies with healthcare notification requirements
 */
class CriticalNotificationService {
  constructor(config = {}) {
    this.config = {
      enabled: config.enabled !== false,
      emailService: config.emailService || getEmailService(),
      smsService: config.smsService || null,
      websocketService: config.websocketService || null,
      escalationService: config.escalationService || null,
      ...config
    };
  }

  /**
   * Send critical notification with multi-channel delivery
   * @param {Object} notificationData - Notification data
   * @returns {Promise<Object>} Created notification
   */
  async sendCriticalNotification(notificationData) {
    try {
      // 1. Validate notification data
      this.validateNotification(notificationData);

      // 2. Determine recipients based on rules
      const recipients = await this.determineRecipients(notificationData);

      // 3. Create notification record
      const notification = new CriticalNotification({
        type: notificationData.type,
        severity: notificationData.severity,
        title: notificationData.title,
        message: notificationData.message,
        patientId: notificationData.patientId,
        studyId: notificationData.studyId,
        findingDetails: notificationData.findingDetails,
        recipients: recipients,
        channels: notificationData.channels || ['email', 'in_app'],
        status: 'pending',
        metadata: notificationData.metadata || {}
      });

      await notification.save();
      console.log(`📢 Critical notification created: ${notification.id}`);

      // 4. Send via all configured channels
      const deliveryResults = await this.deliverNotification(notification);

      // 5. Update notification with delivery status
      notification.deliveryStatus = deliveryResults;
      notification.status = 'delivered';
      notification.deliveredAt = new Date();
      await notification.save();

      // 6. Start escalation timer if configured
      if (this.config.escalationService) {
        await this.config.escalationService.startTimer(notification);
      }

      return notification;
    } catch (error) {
      console.error('❌ Failed to send critical notification:', error);
      throw error;
    }
  }

  /**
   * Deliver notification via all configured channels
   * @param {Object} notification - Notification document
   * @returns {Promise<Array>} Delivery status for each channel
   */
  async deliverNotification(notification) {
    const deliveryResults = [];

    for (const channel of notification.channels) {
      const result = {
        channel,
        status: 'pending',
        attempts: 1,
        lastAttempt: new Date()
      };

      try {
        switch (channel) {
          case 'email':
            await this.sendEmailNotification(notification);
            result.status = 'delivered';
            break;

          case 'sms':
            if (this.config.smsService) {
              await this.config.smsService.sendSMS(notification);
              result.status = 'delivered';
            } else {
              result.status = 'failed';
              result.error = 'SMS service not configured';
            }
            break;

          case 'in_app':
            if (this.config.websocketService) {
              await this.config.websocketService.broadcast('critical_notification', notification);
              result.status = 'delivered';
            } else {
              result.status = 'failed';
              result.error = 'WebSocket service not configured';
            }
            break;

          case 'push':
            // Browser push notifications would be handled here
            result.status = 'delivered';
            break;

          default:
            result.status = 'failed';
            result.error = `Unknown channel: ${channel}`;
        }
      } catch (error) {
        result.status = 'failed';
        result.error = error.message;
        console.error(`❌ Failed to deliver via ${channel}:`, error);
      }

      deliveryResults.push(result);
    }

    return deliveryResults;
  }

  /**
   * Send email notification for critical finding
   * @param {Object} notification - Notification document
   */
  async sendEmailNotification(notification) {
    if (!this.config.emailService) {
      throw new Error('Email service not configured');
    }

    const recipients = notification.recipients
      .filter(r => r.email)
      .map(r => r.email)
      .join(', ');

    if (!recipients) {
      throw new Error('No email recipients found');
    }

    const emailData = {
      summary: notification.title,
      description: notification.message,
      severity: notification.severity,
      service: 'Medical Imaging System',
      component: 'Critical Findings',
      timestamp: notification.createdAt.toISOString(),
      patientId: notification.patientId,
      studyId: notification.studyId,
      findingDetails: notification.findingDetails
    };

    return await this.config.emailService.sendAlert(emailData, recipients);
  }

  /**
   * Acknowledge notification
   * @param {String} notificationId - Notification ID
   * @param {String} userId - User ID who acknowledged
   * @returns {Promise<Object>} Updated notification
   */
  async acknowledgeNotification(notificationId, userId) {
    try {
      const notification = await CriticalNotification.findById(notificationId);

      if (!notification) {
        throw new Error('Notification not found');
      }

      if (notification.status === 'acknowledged') {
        return notification; // Already acknowledged
      }

      // Update notification status
      await notification.acknowledge(userId);

      // Cancel escalation timer if configured
      if (this.config.escalationService) {
        await this.config.escalationService.cancelTimer(notificationId);
      }

      // Notify all parties of acknowledgment
      await this.notifyAcknowledgment(notification, userId);

      console.log(`✅ Notification acknowledged: ${notificationId} by user ${userId}`);
      return notification;
    } catch (error) {
      console.error('❌ Failed to acknowledge notification:', error);
      throw error;
    }
  }

  /**
   * Notify all parties that notification was acknowledged
   * @param {Object} notification - Notification document
   * @param {String} userId - User ID who acknowledged
   */
  async notifyAcknowledgment(notification, userId) {
    if (this.config.websocketService) {
      await this.config.websocketService.broadcast('notification_acknowledged', {
        notificationId: notification.id,
        acknowledgedBy: userId,
        acknowledgedAt: notification.acknowledgedAt
      });
    }
  }

  /**
   * Validate notification data
   * @param {Object} data - Notification data
   * @throws {Error} If validation fails
   */
  validateNotification(data) {
    const required = ['type', 'severity', 'title', 'message', 'patientId', 'studyId'];
    
    for (const field of required) {
      if (!data[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    const validTypes = ['critical_finding', 'urgent_review', 'system_alert'];
    if (!validTypes.includes(data.type)) {
      throw new Error(`Invalid notification type: ${data.type}`);
    }

    const validSeverities = ['critical', 'high', 'medium'];
    if (!validSeverities.includes(data.severity)) {
      throw new Error(`Invalid severity: ${data.severity}`);
    }
  }

  /**
   * Determine recipients based on notification rules
   * @param {Object} notificationData - Notification data
   * @returns {Promise<Array>} List of recipients
   */
  async determineRecipients(notificationData) {
    // This is a simplified implementation
    // In production, this would query user roles, on-call schedules, etc.
    
    const recipients = notificationData.recipients || [];

    // If no recipients specified, use default rules
    if (recipients.length === 0) {
      // TODO: Implement recipient determination logic based on:
      // - Finding type
      // - Severity level
      // - Time of day (on-call schedules)
      // - Department/specialty
      // - User preferences
      
      console.warn('⚠️  No recipients specified for notification');
    }

    return recipients;
  }

  /**
   * Get notification by ID
   * @param {String} notificationId - Notification ID
   * @returns {Promise<Object>} Notification document
   */
  async getNotification(notificationId) {
    return await CriticalNotification.findById(notificationId)
      .populate('recipients.userId', 'name email phone role')
      .populate('acknowledgedBy', 'name email');
  }

  /**
   * Get notifications for a patient
   * @param {String} patientId - Patient ID
   * @returns {Promise<Array>} List of notifications
   */
  async getNotificationsByPatient(patientId) {
    return await CriticalNotification.findByPatient(patientId);
  }

  /**
   * Get unacknowledged notifications
   * @returns {Promise<Array>} List of unacknowledged notifications
   */
  async getUnacknowledgedNotifications() {
    return await CriticalNotification.findUnacknowledged();
  }

  /**
   * Get notification history with filters
   * @param {Object} filters - Query filters
   * @returns {Promise<Array>} List of notifications
   */
  async getNotificationHistory(filters = {}) {
    const query = {};

    if (filters.userId) {
      query['recipients.userId'] = filters.userId;
    }

    if (filters.patientId) {
      query.patientId = filters.patientId;
    }

    if (filters.severity) {
      query.severity = filters.severity;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) {
        query.createdAt.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.createdAt.$lte = new Date(filters.endDate);
      }
    }

    return await CriticalNotification.find(query)
      .sort({ createdAt: -1 })
      .limit(filters.limit || 100)
      .populate('recipients.userId', 'name email')
      .populate('acknowledgedBy', 'name email');
  }

  /**
   * Retry failed notification delivery
   * @param {String} notificationId - Notification ID
   * @param {String} channel - Channel to retry
   * @returns {Promise<Object>} Updated notification
   */
  async retryDelivery(notificationId, channel) {
    const notification = await CriticalNotification.findById(notificationId);

    if (!notification) {
      throw new Error('Notification not found');
    }

    const deliveryStatus = notification.deliveryStatus.find(d => d.channel === channel);

    if (!deliveryStatus) {
      throw new Error(`Channel ${channel} not found in notification`);
    }

    if (deliveryStatus.attempts >= 3) {
      throw new Error('Maximum retry attempts reached');
    }

    // Retry delivery
    const result = await this.deliverNotification({
      ...notification.toObject(),
      channels: [channel]
    });

    // Update delivery status
    deliveryStatus.attempts += 1;
    deliveryStatus.lastAttempt = new Date();
    deliveryStatus.status = result[0].status;
    deliveryStatus.error = result[0].error;

    await notification.save();

    return notification;
  }

  /**
   * Get notification statistics
   * @param {Object} filters - Query filters
   * @returns {Promise<Object>} Statistics
   */
  async getStatistics(filters = {}) {
    const query = {};

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) {
        query.createdAt.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.createdAt.$lte = new Date(filters.endDate);
      }
    }

    const stats = await CriticalNotification.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          critical: {
            $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] }
          },
          high: {
            $sum: { $cond: [{ $eq: ['$severity', 'high'] }, 1, 0] }
          },
          medium: {
            $sum: { $cond: [{ $eq: ['$severity', 'medium'] }, 1, 0] }
          },
          acknowledged: {
            $sum: { $cond: [{ $eq: ['$status', 'acknowledged'] }, 1, 0] }
          },
          pending: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          escalated: {
            $sum: { $cond: [{ $eq: ['$status', 'escalated'] }, 1, 0] }
          },
          avgAcknowledgmentTime: {
            $avg: {
              $cond: [
                { $ne: ['$acknowledgedAt', null] },
                { $subtract: ['$acknowledgedAt', '$createdAt'] },
                null
              ]
            }
          }
        }
      }
    ]);

    return stats[0] || {
      total: 0,
      critical: 0,
      high: 0,
      medium: 0,
      acknowledged: 0,
      pending: 0,
      escalated: 0,
      avgAcknowledgmentTime: 0
    };
  }
}

// Singleton instance
let criticalNotificationService = null;

/**
 * Get the singleton CriticalNotificationService instance
 * @param {Object} config - Service configuration
 * @returns {CriticalNotificationService} Service instance
 */
function getCriticalNotificationService(config) {
  if (!criticalNotificationService) {
    criticalNotificationService = new CriticalNotificationService(config);
  }
  return criticalNotificationService;
}

module.exports = {
  CriticalNotificationService,
  getCriticalNotificationService
};
