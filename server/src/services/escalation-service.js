const CriticalNotification = require('../models/CriticalNotification');

/**
 * Escalation Service
 * Manages escalation timers and chains for unacknowledged critical notifications
 * Implements automatic escalation workflow based on severity and time
 */
class EscalationService {
  constructor(config = {}) {
    this.config = {
      enabled: config.enabled !== false,
      notificationService: config.notificationService || null,
      
      // Escalation delays by severity (in milliseconds)
      escalationDelays: config.escalationDelays || {
        critical: 5 * 60 * 1000,   // 5 minutes
        high: 15 * 60 * 1000,      // 15 minutes
        medium: 30 * 60 * 1000     // 30 minutes
      },
      
      // Maximum escalation levels before exhaustion
      maxEscalationLevel: config.maxEscalationLevel || 3,
      
      ...config
    };

    // Map of notification ID to timer
    this.timers = new Map();
    
    // Escalation chain configuration
    this.escalationChains = new Map();
    
    console.log('✅ Escalation service initialized');
  }

  /**
   * Start escalation timer for a notification
   * @param {Object} notification - Notification document
   */
  async startTimer(notification) {
    if (!this.config.enabled) {
      return;
    }

    const notificationId = notification.id || notification._id.toString();
    
    // Cancel existing timer if any
    this.cancelTimer(notificationId);

    // Get escalation delay based on severity
    const delay = this.getEscalationDelay(notification.severity);

    console.log(`⏰ Starting escalation timer for notification ${notificationId}: ${delay}ms`);

    // Set timer
    const timer = setTimeout(async () => {
      try {
        await this.escalate(notificationId);
      } catch (error) {
        console.error(`❌ Escalation failed for notification ${notificationId}:`, error);
      }
    }, delay);

    this.timers.set(notificationId, {
      timer,
      startedAt: new Date(),
      delay,
      notificationId
    });
  }

  /**
   * Cancel escalation timer
   * @param {String} notificationId - Notification ID
   */
  cancelTimer(notificationId) {
    const timerData = this.timers.get(notificationId);
    
    if (timerData) {
      clearTimeout(timerData.timer);
      this.timers.delete(notificationId);
      console.log(`✅ Escalation timer cancelled for notification ${notificationId}`);
    }
  }

  /**
   * Escalate notification to next level
   * @param {String} notificationId - Notification ID
   */
  async escalate(notificationId) {
    try {
      // Get notification
      const notification = await CriticalNotification.findById(notificationId);

      if (!notification) {
        console.error(`❌ Notification ${notificationId} not found for escalation`);
        return;
      }

      // Check if already acknowledged
      if (notification.status === 'acknowledged') {
        console.log(`ℹ️  Notification ${notificationId} already acknowledged, skipping escalation`);
        return;
      }

      const currentLevel = notification.escalationLevel;
      const nextLevel = currentLevel + 1;

      console.log(`📢 Escalating notification ${notificationId} from level ${currentLevel} to ${nextLevel}`);

      // Get next level recipients
      const nextRecipients = await this.getEscalationRecipients(notification, nextLevel);

      if (nextRecipients.length === 0) {
        // Escalation chain exhausted
        await this.handleEscalationExhaustion(notification);
        return;
      }

      // Update notification with escalation
      await notification.escalate(nextLevel, nextRecipients);

      // Send escalation notification
      if (this.config.notificationService) {
        await this.sendEscalationNotification(notification, nextRecipients, nextLevel);
      }

      // Start timer for next level if not at max
      if (nextLevel < this.config.maxEscalationLevel) {
        await this.startTimer(notification);
      } else {
        console.warn(`⚠️  Maximum escalation level reached for notification ${notificationId}`);
        await this.handleEscalationExhaustion(notification);
      }

    } catch (error) {
      console.error(`❌ Failed to escalate notification ${notificationId}:`, error);
      throw error;
    }
  }

  /**
   * Get recipients for escalation level
   * @param {Object} notification - Notification document
   * @param {Number} level - Escalation level
   * @returns {Promise<Array>} List of recipients
   */
  async getEscalationRecipients(notification, level) {
    // Get escalation chain for this notification type
    const chain = this.getEscalationChain(notification.type, notification.severity);

    if (!chain || !chain[level]) {
      console.warn(`⚠️  No escalation chain defined for level ${level}`);
      return [];
    }

    // In production, this would query the database for users with specific roles
    // For now, return the configured recipients
    return chain[level];
  }

  /**
   * Get escalation chain configuration
   * @param {String} type - Notification type
   * @param {String} severity - Notification severity
   * @returns {Object} Escalation chain
   */
  getEscalationChain(type, severity) {
    const key = `${type}_${severity}`;
    
    if (this.escalationChains.has(key)) {
      return this.escalationChains.get(key);
    }

    // Default escalation chain
    // Level 0: Primary recipients (already notified)
    // Level 1: Senior staff
    // Level 2: Department supervisor
    // Level 3: Hospital administrator
    
    const defaultChain = {
      1: [], // Senior radiologists
      2: [], // Department head
      3: []  // Hospital administrator
    };

    return defaultChain;
  }

  /**
   * Configure escalation chain
   * @param {String} type - Notification type
   * @param {String} severity - Notification severity
   * @param {Object} chain - Escalation chain configuration
   */
  configureEscalationChain(type, severity, chain) {
    const key = `${type}_${severity}`;
    this.escalationChains.set(key, chain);
    console.log(`✅ Escalation chain configured for ${key}`);
  }

  /**
   * Send escalation notification
   * @param {Object} notification - Original notification
   * @param {Array} recipients - Escalation recipients
   * @param {Number} level - Escalation level
   */
  async sendEscalationNotification(notification, recipients, level) {
    if (!this.config.notificationService) {
      console.warn('⚠️  Notification service not configured for escalation');
      return;
    }

    const escalationData = {
      type: 'urgent_review',
      severity: notification.severity,
      title: `ESCALATED (Level ${level}): ${notification.title}`,
      message: `This critical notification has been escalated to level ${level} due to no acknowledgment.\n\nOriginal Message:\n${notification.message}`,
      patientId: notification.patientId,
      studyId: notification.studyId,
      findingDetails: notification.findingDetails,
      recipients: recipients,
      channels: notification.channels,
      metadata: {
        originalNotificationId: notification.id,
        escalationLevel: level,
        escalatedAt: new Date(),
        reason: 'No acknowledgment received'
      }
    };

    try {
      await this.config.notificationService.sendCriticalNotification(escalationData);
      console.log(`✅ Escalation notification sent for level ${level}`);
    } catch (error) {
      console.error(`❌ Failed to send escalation notification:`, error);
    }
  }

  /**
   * Handle escalation chain exhaustion
   * @param {Object} notification - Notification document
   */
  async handleEscalationExhaustion(notification) {
    console.error(`🚨 ESCALATION EXHAUSTED for notification ${notification.id}`);
    console.error(`   Patient: ${notification.patientId}`);
    console.error(`   Study: ${notification.studyId}`);
    console.error(`   Severity: ${notification.severity}`);
    console.error(`   Title: ${notification.title}`);

    // Update notification status
    notification.status = 'escalated';
    notification.metadata = notification.metadata || {};
    notification.metadata.escalationExhausted = true;
    notification.metadata.escalationExhaustedAt = new Date();
    await notification.save();

    // Send critical alert to administrators
    if (this.config.notificationService) {
      try {
        await this.config.notificationService.sendCriticalNotification({
          type: 'system_alert',
          severity: 'critical',
          title: '🚨 ESCALATION CHAIN EXHAUSTED',
          message: `Critical notification has exhausted all escalation levels without acknowledgment.\n\nNotification ID: ${notification.id}\nPatient: ${notification.patientId}\nStudy: ${notification.studyId}\n\nIMMEDIATE ACTION REQUIRED`,
          patientId: notification.patientId,
          studyId: notification.studyId,
          findingDetails: notification.findingDetails,
          recipients: [], // Would be configured with admin contacts
          channels: ['email', 'sms', 'in_app'],
          metadata: {
            originalNotificationId: notification.id,
            escalationExhausted: true
          }
        });
      } catch (error) {
        console.error('❌ Failed to send escalation exhaustion alert:', error);
      }
    }

    // Log to audit system
    // In production, this would trigger additional alerts, pages, etc.
  }

  /**
   * Get escalation delay based on severity
   * @param {String} severity - Notification severity
   * @returns {Number} Delay in milliseconds
   */
  getEscalationDelay(severity) {
    return this.config.escalationDelays[severity] || this.config.escalationDelays.medium;
  }

  /**
   * Get active timers
   * @returns {Array} List of active timers
   */
  getActiveTimers() {
    const timers = [];
    
    for (const [notificationId, timerData] of this.timers.entries()) {
      const elapsed = Date.now() - timerData.startedAt.getTime();
      const remaining = timerData.delay - elapsed;
      
      timers.push({
        notificationId,
        startedAt: timerData.startedAt,
        delay: timerData.delay,
        elapsed,
        remaining: Math.max(0, remaining),
        willEscalateAt: new Date(timerData.startedAt.getTime() + timerData.delay)
      });
    }
    
    return timers;
  }

  /**
   * Get escalation statistics
   * @returns {Promise<Object>} Statistics
   */
  async getStatistics() {
    const stats = await CriticalNotification.aggregate([
      {
        $group: {
          _id: null,
          totalEscalated: {
            $sum: { $cond: [{ $gt: ['$escalationLevel', 0] }, 1, 0] }
          },
          level1: {
            $sum: { $cond: [{ $eq: ['$escalationLevel', 1] }, 1, 0] }
          },
          level2: {
            $sum: { $cond: [{ $eq: ['$escalationLevel', 2] }, 1, 0] }
          },
          level3: {
            $sum: { $cond: [{ $eq: ['$escalationLevel', 3] }, 1, 0] }
          },
          exhausted: {
            $sum: { $cond: [{ $eq: ['$metadata.escalationExhausted', true] }, 1, 0] }
          }
        }
      }
    ]);

    return {
      activeTimers: this.timers.size,
      totalEscalated: stats[0]?.totalEscalated || 0,
      byLevel: {
        level1: stats[0]?.level1 || 0,
        level2: stats[0]?.level2 || 0,
        level3: stats[0]?.level3 || 0
      },
      exhausted: stats[0]?.exhausted || 0
    };
  }

  /**
   * Check for stale notifications that need escalation
   * This should be called periodically (e.g., every minute)
   */
  async checkStaleNotifications() {
    try {
      const unacknowledged = await CriticalNotification.findUnacknowledged();

      for (const notification of unacknowledged) {
        const notificationId = notification.id || notification._id.toString();
        
        // Check if timer exists
        if (!this.timers.has(notificationId)) {
          // Calculate if escalation is overdue
          const delay = this.getEscalationDelay(notification.severity);
          const elapsed = Date.now() - notification.createdAt.getTime();
          
          if (elapsed > delay) {
            console.warn(`⚠️  Found stale notification ${notificationId}, escalating now`);
            await this.escalate(notificationId);
          } else {
            // Start timer for this notification
            console.log(`ℹ️  Starting timer for existing notification ${notificationId}`);
            await this.startTimer(notification);
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed to check stale notifications:', error);
    }
  }

  /**
   * Clear all timers (for shutdown)
   */
  clearAllTimers() {
    for (const [notificationId, timerData] of this.timers.entries()) {
      clearTimeout(timerData.timer);
    }
    this.timers.clear();
    console.log('✅ All escalation timers cleared');
  }

  /**
   * Get escalation configuration
   * @returns {Object} Configuration
   */
  getConfiguration() {
    return {
      enabled: this.config.enabled,
      escalationDelays: this.config.escalationDelays,
      maxEscalationLevel: this.config.maxEscalationLevel,
      activeTimers: this.timers.size,
      configuredChains: this.escalationChains.size
    };
  }
}

// Singleton instance
let escalationService = null;

/**
 * Get the singleton EscalationService instance
 * @param {Object} config - Service configuration
 * @returns {EscalationService} Service instance
 */
function getEscalationService(config) {
  if (!escalationService) {
    escalationService = new EscalationService(config);
  }
  return escalationService;
}

module.exports = {
  EscalationService,
  getEscalationService
};
