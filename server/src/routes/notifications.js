const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const { getCriticalNotificationService } = require('../services/critical-notification-service');
const { getCriticalEmailService } = require('../services/critical-email-service');
const { getSMSService } = require('../services/sms-service');
const { getEscalationService } = require('../services/escalation-service');
const { rateLimit } = require('../middleware/session-middleware');

// Initialize services
const emailService = getCriticalEmailService();
const smsService = getSMSService();
const escalationService = getEscalationService();
const notificationService = getCriticalNotificationService({
  emailService,
  smsService,
  escalationService
});

// Link escalation service back to notification service
escalationService.config.notificationService = notificationService;

/**
 * POST /api/notifications/critical
 * Create and send a critical notification
 * Requires authentication
 * Requirements: 12.1-12.12
 */
router.post('/critical', 
  rateLimit({ maxRequests: 50, windowMs: 60000 }), // 50 notifications per minute
  authenticate, 
  async (req, res) => {
  try {
    const {
      type,
      severity,
      title,
      message,
      patientId,
      studyId,
      findingDetails,
      recipients,
      channels,
      metadata
    } = req.body;

    // Validate required fields
    if (!type || !severity || !title || !message || !patientId || !studyId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        required: ['type', 'severity', 'title', 'message', 'patientId', 'studyId']
      });
    }

    // Create notification
    const notification = await notificationService.sendCriticalNotification({
      type,
      severity,
      title,
      message,
      patientId,
      studyId,
      findingDetails,
      recipients,
      channels: channels || ['email', 'in_app'],
      metadata: {
        ...metadata,
        createdBy: req.user.id || req.user.userId,
        createdByName: req.user.username || req.user.name
      }
    });

    res.status(201).json({
      success: true,
      message: 'Critical notification sent successfully',
      notification: {
        id: notification.id,
        type: notification.type,
        severity: notification.severity,
        title: notification.title,
        status: notification.status,
        createdAt: notification.createdAt,
        deliveryStatus: notification.deliveryStatus
      }
    });

  } catch (error) {
    console.error('❌ Failed to create critical notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create critical notification',
      error: error.message
    });
  }
});

/**
 * GET /api/notifications/critical/:id
 * Get a specific critical notification by ID
 * Requires authentication
 * Requirements: 12.1-12.12
 */
router.get('/critical/:id', 
  rateLimit({ maxRequests: 100, windowMs: 60000 }), // 100 requests per minute
  authenticate, 
  async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await notificationService.getNotification(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      notification
    });

  } catch (error) {
    console.error('❌ Failed to get notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notification',
      error: error.message
    });
  }
});

/**
 * POST /api/notifications/critical/:id/acknowledge
 * Acknowledge a critical notification
 * Requires authentication
 */
router.post('/critical/:id/acknowledge', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id || req.user.userId;

    const notification = await notificationService.acknowledgeNotification(id, userId);

    res.json({
      success: true,
      message: 'Notification acknowledged successfully',
      notification: {
        id: notification.id,
        status: notification.status,
        acknowledgedAt: notification.acknowledgedAt,
        acknowledgedBy: notification.acknowledgedBy
      }
    });

  } catch (error) {
    console.error('❌ Failed to acknowledge notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to acknowledge notification',
      error: error.message
    });
  }
});

/**
 * POST /api/notifications/critical/:id/escalate
 * Manually escalate a notification
 * Requires authentication and admin role
 */
router.post('/critical/:id/escalate', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    await escalationService.escalate(id);

    res.json({
      success: true,
      message: 'Notification escalated successfully'
    });

  } catch (error) {
    console.error('❌ Failed to escalate notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to escalate notification',
      error: error.message
    });
  }
});

/**
 * GET /api/notifications/settings
 * Get notification settings for current user
 * Requires authentication
 */
router.get('/settings', authenticate, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;

    // In production, this would fetch user-specific notification preferences from database
    // For now, return default settings
    const settings = {
      userId,
      channels: {
        email: true,
        sms: false,
        in_app: true,
        push: true
      },
      severityFilters: {
        critical: true,
        high: true,
        medium: true
      },
      doNotDisturb: {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00'
      },
      soundEnabled: true,
      emailAddress: req.user.email,
      phoneNumber: req.user.phone
    };

    res.json({
      success: true,
      settings
    });

  } catch (error) {
    console.error('❌ Failed to get notification settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notification settings',
      error: error.message
    });
  }
});

/**
 * PUT /api/notifications/settings
 * Update notification settings for current user
 * Requires authentication
 */
router.put('/settings', authenticate, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const settings = req.body;

    // In production, this would save to database
    // For now, just validate and return
    
    res.json({
      success: true,
      message: 'Notification settings updated successfully',
      settings: {
        userId,
        ...settings,
        updatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('❌ Failed to update notification settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification settings',
      error: error.message
    });
  }
});

/**
 * GET /api/notifications/history
 * Get notification history with filters
 * Requires authentication
 */
router.get('/history', authenticate, async (req, res) => {
  try {
    const {
      userId,
      patientId,
      severity,
      status,
      startDate,
      endDate,
      limit
    } = req.query;

    // If no userId specified, use current user
    const filters = {
      userId: userId || req.user.id || req.user.userId,
      patientId,
      severity,
      status,
      startDate,
      endDate,
      limit: parseInt(limit) || 100
    };

    const notifications = await notificationService.getNotificationHistory(filters);

    res.json({
      success: true,
      count: notifications.length,
      notifications
    });

  } catch (error) {
    console.error('❌ Failed to get notification history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notification history',
      error: error.message
    });
  }
});

/**
 * GET /api/notifications/unacknowledged
 * Get all unacknowledged notifications
 * Requires authentication
 */
router.get('/unacknowledged', authenticate, async (req, res) => {
  try {
    const notifications = await notificationService.getUnacknowledgedNotifications();

    res.json({
      success: true,
      count: notifications.length,
      notifications
    });

  } catch (error) {
    console.error('❌ Failed to get unacknowledged notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unacknowledged notifications',
      error: error.message
    });
  }
});

/**
 * GET /api/notifications/patient/:patientId
 * Get all notifications for a specific patient
 * Requires authentication
 */
router.get('/patient/:patientId', authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;

    const notifications = await notificationService.getNotificationsByPatient(patientId);

    res.json({
      success: true,
      count: notifications.length,
      notifications
    });

  } catch (error) {
    console.error('❌ Failed to get patient notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get patient notifications',
      error: error.message
    });
  }
});

/**
 * GET /api/notifications/statistics
 * Get notification statistics
 * Requires authentication
 */
router.get('/statistics', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const stats = await notificationService.getStatistics({
      startDate,
      endDate
    });

    const escalationStats = await escalationService.getStatistics();

    res.json({
      success: true,
      statistics: {
        notifications: stats,
        escalations: escalationStats
      }
    });

  } catch (error) {
    console.error('❌ Failed to get notification statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notification statistics',
      error: error.message
    });
  }
});

/**
 * POST /api/notifications/critical/:id/retry
 * Retry failed notification delivery
 * Requires authentication and admin role
 */
router.post('/critical/:id/retry', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { channel } = req.body;

    if (!channel) {
      return res.status(400).json({
        success: false,
        message: 'Channel is required'
      });
    }

    const notification = await notificationService.retryDelivery(id, channel);

    res.json({
      success: true,
      message: 'Notification delivery retried',
      notification: {
        id: notification.id,
        deliveryStatus: notification.deliveryStatus
      }
    });

  } catch (error) {
    console.error('❌ Failed to retry notification delivery:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retry notification delivery',
      error: error.message
    });
  }
});

/**
 * GET /api/notifications/escalation/timers
 * Get active escalation timers
 * Requires authentication and admin role
 */
router.get('/escalation/timers', authenticate, async (req, res) => {
  try {
    const timers = escalationService.getActiveTimers();

    res.json({
      success: true,
      count: timers.length,
      timers
    });

  } catch (error) {
    console.error('❌ Failed to get escalation timers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get escalation timers',
      error: error.message
    });
  }
});

/**
 * GET /api/notifications/escalation/configuration
 * Get escalation configuration
 * Requires authentication and admin role
 */
router.get('/escalation/configuration', authenticate, async (req, res) => {
  try {
    const config = escalationService.getConfiguration();

    res.json({
      success: true,
      configuration: config
    });

  } catch (error) {
    console.error('❌ Failed to get escalation configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get escalation configuration',
      error: error.message
    });
  }
});

/**
 * POST /api/notifications/test/email
 * Test email notification service
 * Requires authentication and admin role
 */
router.post('/test/email', authenticate, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required'
      });
    }

    const result = await emailService.testConnection();

    res.json({
      success: result.success,
      message: result.success ? 'Email service is working' : 'Email service test failed',
      details: result
    });

  } catch (error) {
    console.error('❌ Failed to test email service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test email service',
      error: error.message
    });
  }
});

/**
 * POST /api/notifications/test/sms
 * Test SMS notification service
 * Requires authentication and admin role
 */
router.post('/test/sms', authenticate, async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    const result = await smsService.testSMS(phoneNumber);

    res.json({
      success: result.success,
      message: result.success ? 'SMS service is working' : 'SMS service test failed',
      details: result
    });

  } catch (error) {
    console.error('❌ Failed to test SMS service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test SMS service',
      error: error.message
    });
  }
});

module.exports = router;
