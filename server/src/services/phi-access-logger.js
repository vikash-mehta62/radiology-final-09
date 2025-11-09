/**
 * PHI Access Logger Service for HIPAA Compliance
 * Logs all access to Protected Health Information (PHI)
 */

const fs = require('fs').promises;
const path = require('path');
const encryptionService = require('./encryption-service');

class PHIAccessLogger {
  constructor() {
    this.logPath = process.env.PHI_ACCESS_LOG_PATH || './logs/phi-access.log';
    this.encryptLogs = process.env.PHI_ENCRYPTION_ENABLED === 'true';
    this.ensureLogDirectory();
  }

  /**
   * Ensure log directory exists
   */
  async ensureLogDirectory() {
    const logDir = path.dirname(this.logPath);
    try {
      await fs.mkdir(logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  /**
   * Log PHI access event
   * @param {object} accessEvent - PHI access event details
   */
  async logAccess(accessEvent) {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        eventType: 'PHI_ACCESS',
        userId: accessEvent.userId,
        userName: accessEvent.userName,
        userRole: accessEvent.userRole,
        action: accessEvent.action, // 'view', 'edit', 'export', 'delete'
        resourceType: accessEvent.resourceType, // 'patient', 'study', 'report', 'notification'
        resourceId: accessEvent.resourceId,
        patientId: accessEvent.patientId,
        patientName: accessEvent.patientName,
        ipAddress: accessEvent.ipAddress,
        userAgent: accessEvent.userAgent,
        sessionId: accessEvent.sessionId,
        purpose: accessEvent.purpose, // 'treatment', 'payment', 'operations', 'research'
        success: accessEvent.success !== false,
        errorMessage: accessEvent.errorMessage,
        metadata: accessEvent.metadata || {}
      };

      // Encrypt sensitive fields if encryption is enabled
      const finalEntry = this.encryptLogs 
        ? this.encryptLogEntry(logEntry)
        : logEntry;

      // Write to log file
      await this.writeToFile(finalEntry);

      // Also store in database if MongoDB is available
      if (accessEvent.storeInDB !== false) {
        await this.storeInDatabase(finalEntry);
      }

      return finalEntry;
    } catch (error) {
      console.error('Failed to log PHI access:', error);
      // Don't throw - logging failures shouldn't break the application
    }
  }

  /**
   * Log patient record access
   */
  async logPatientAccess(userId, userName, userRole, patientId, patientName, action, ipAddress, userAgent, sessionId, purpose = 'treatment') {
    return this.logAccess({
      userId,
      userName,
      userRole,
      action,
      resourceType: 'patient',
      resourceId: patientId,
      patientId,
      patientName,
      ipAddress,
      userAgent,
      sessionId,
      purpose,
      success: true
    });
  }

  /**
   * Log study access
   */
  async logStudyAccess(userId, userName, userRole, studyId, patientId, patientName, action, ipAddress, userAgent, sessionId) {
    return this.logAccess({
      userId,
      userName,
      userRole,
      action,
      resourceType: 'study',
      resourceId: studyId,
      patientId,
      patientName,
      ipAddress,
      userAgent,
      sessionId,
      purpose: 'treatment',
      success: true
    });
  }

  /**
   * Log report access
   */
  async logReportAccess(userId, userName, userRole, reportId, patientId, patientName, action, ipAddress, userAgent, sessionId) {
    return this.logAccess({
      userId,
      userName,
      userRole,
      action,
      resourceType: 'report',
      resourceId: reportId,
      patientId,
      patientName,
      ipAddress,
      userAgent,
      sessionId,
      purpose: 'treatment',
      success: true
    });
  }

  /**
   * Log notification delivery (contains PHI)
   */
  async logNotificationDelivery(notificationId, recipientId, recipientName, patientId, patientName, channel, success, errorMessage) {
    return this.logAccess({
      userId: recipientId,
      userName: recipientName,
      userRole: 'recipient',
      action: 'notification_delivery',
      resourceType: 'notification',
      resourceId: notificationId,
      patientId,
      patientName,
      ipAddress: 'system',
      userAgent: `notification-${channel}`,
      sessionId: 'system',
      purpose: 'treatment',
      success,
      errorMessage,
      metadata: { channel }
    });
  }

  /**
   * Log export operation
   */
  async logExport(userId, userName, userRole, reportId, patientId, patientName, format, ipAddress, userAgent, sessionId, recipient, purpose) {
    return this.logAccess({
      userId,
      userName,
      userRole,
      action: 'export',
      resourceType: 'report',
      resourceId: reportId,
      patientId,
      patientName,
      ipAddress,
      userAgent,
      sessionId,
      purpose: purpose || 'treatment',
      success: true,
      metadata: {
        format,
        recipient,
        exportTimestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log bulk export operation
   */
  async logBulkExport(userId, userName, userRole, recordCount, format, ipAddress, userAgent, sessionId, purpose, reason) {
    return this.logAccess({
      userId,
      userName,
      userRole,
      action: 'bulk_export',
      resourceType: 'multiple',
      resourceId: 'bulk',
      patientId: 'multiple',
      patientName: 'multiple',
      ipAddress,
      userAgent,
      sessionId,
      purpose: purpose || 'operations',
      success: true,
      metadata: {
        recordCount,
        format,
        reason,
        exportTimestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log failed access attempt
   */
  async logFailedAccess(userId, userName, userRole, resourceType, resourceId, action, reason, ipAddress, userAgent, sessionId) {
    return this.logAccess({
      userId,
      userName,
      userRole,
      action,
      resourceType,
      resourceId,
      patientId: 'unknown',
      patientName: 'unknown',
      ipAddress,
      userAgent,
      sessionId,
      purpose: 'unknown',
      success: false,
      errorMessage: reason
    });
  }

  /**
   * Encrypt sensitive fields in log entry
   */
  encryptLogEntry(logEntry) {
    const sensitiveFields = ['patientId', 'patientName', 'ipAddress', 'userAgent', 'metadata'];
    const encrypted = { ...logEntry };

    sensitiveFields.forEach(field => {
      if (logEntry[field]) {
        encrypted[field] = encryptionService.encrypt(logEntry[field]);
        encrypted[`${field}_encrypted`] = true;
      }
    });

    return encrypted;
  }

  /**
   * Decrypt log entry
   */
  decryptLogEntry(logEntry) {
    const sensitiveFields = ['patientId', 'patientName', 'ipAddress', 'userAgent', 'metadata'];
    const decrypted = { ...logEntry };

    sensitiveFields.forEach(field => {
      if (logEntry[`${field}_encrypted`]) {
        decrypted[field] = encryptionService.decrypt(logEntry[field]);
        delete decrypted[`${field}_encrypted`];
      }
    });

    return decrypted;
  }

  /**
   * Write log entry to file
   */
  async writeToFile(logEntry) {
    try {
      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(this.logPath, logLine, 'utf8');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Store log entry in database
   */
  async storeInDatabase(logEntry) {
    try {
      // Import mongoose model dynamically to avoid circular dependencies
      const PHIAccessLog = require('../models/PHIAccessLog');
      await PHIAccessLog.create(logEntry);
    } catch (error) {
      console.error('Failed to store log in database:', error);
      // Don't throw - database failures shouldn't break logging
    }
  }

  /**
   * Generate access audit report
   * @param {object} filters - Report filters
   * @returns {Array} Audit report entries
   */
  async generateAuditReport(filters = {}) {
    try {
      const PHIAccessLog = require('../models/PHIAccessLog');
      
      const query = {};
      
      if (filters.userId) query.userId = filters.userId;
      if (filters.patientId) query.patientId = filters.patientId;
      if (filters.resourceType) query.resourceType = filters.resourceType;
      if (filters.action) query.action = filters.action;
      if (filters.startDate || filters.endDate) {
        query.timestamp = {};
        if (filters.startDate) query.timestamp.$gte = new Date(filters.startDate);
        if (filters.endDate) query.timestamp.$lte = new Date(filters.endDate);
      }

      const logs = await PHIAccessLog.find(query)
        .sort({ timestamp: -1 })
        .limit(filters.limit || 1000)
        .lean();

      // Decrypt logs if they're encrypted
      return logs.map(log => this.encryptLogs ? this.decryptLogEntry(log) : log);
    } catch (error) {
      console.error('Failed to generate audit report:', error);
      throw error;
    }
  }

  /**
   * Get access statistics
   */
  async getAccessStatistics(filters = {}) {
    try {
      const PHIAccessLog = require('../models/PHIAccessLog');
      
      const matchStage = {};
      if (filters.startDate || filters.endDate) {
        matchStage.timestamp = {};
        if (filters.startDate) matchStage.timestamp.$gte = new Date(filters.startDate);
        if (filters.endDate) matchStage.timestamp.$lte = new Date(filters.endDate);
      }

      const stats = await PHIAccessLog.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalAccesses: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' },
            uniquePatients: { $addToSet: '$patientId' },
            accessesByType: {
              $push: {
                resourceType: '$resourceType',
                action: '$action'
              }
            },
            failedAccesses: {
              $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] }
            }
          }
        },
        {
          $project: {
            _id: 0,
            totalAccesses: 1,
            uniqueUsers: { $size: '$uniqueUsers' },
            uniquePatients: { $size: '$uniquePatients' },
            failedAccesses: 1,
            successRate: {
              $multiply: [
                { $divide: [
                  { $subtract: ['$totalAccesses', '$failedAccesses'] },
                  '$totalAccesses'
                ]},
                100
              ]
            }
          }
        }
      ]);

      return stats[0] || {
        totalAccesses: 0,
        uniqueUsers: 0,
        uniquePatients: 0,
        failedAccesses: 0,
        successRate: 0
      };
    } catch (error) {
      console.error('Failed to get access statistics:', error);
      throw error;
    }
  }

  /**
   * Detect unusual access patterns
   */
  async detectUnusualAccess(userId, timeWindowMinutes = 60) {
    try {
      const PHIAccessLog = require('../models/PHIAccessLog');
      
      const startTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
      
      const recentAccesses = await PHIAccessLog.countDocuments({
        userId,
        timestamp: { $gte: startTime }
      });

      // Get user's average access rate
      const avgAccesses = await PHIAccessLog.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: {
              year: { $year: '$timestamp' },
              month: { $month: '$timestamp' },
              day: { $dayOfMonth: '$timestamp' },
              hour: { $hour: '$timestamp' }
            },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: null,
            avgPerHour: { $avg: '$count' }
          }
        }
      ]);

      const averagePerHour = avgAccesses[0]?.avgPerHour || 0;
      const threshold = averagePerHour * 3; // 3x normal rate

      return {
        unusual: recentAccesses > threshold,
        recentAccesses,
        averagePerHour,
        threshold
      };
    } catch (error) {
      console.error('Failed to detect unusual access:', error);
      return { unusual: false };
    }
  }
}

// Export singleton instance
module.exports = new PHIAccessLogger();
