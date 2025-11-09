/**
 * Data Retention Service for HIPAA Compliance
 * Manages retention policies and automated archival
 */

const fs = require('fs').promises;
const path = require('path');
const { createWriteStream } = require('fs');
const archiver = require('archiver');

class DataRetentionService {
  constructor() {
    // Retention periods in days (HIPAA requires 7 years = 2555 days)
    this.retentionPolicies = {
      auditLogs: parseInt(process.env.AUDIT_RETENTION_DAYS || '2555'), // 7 years
      phiAccessLogs: parseInt(process.env.PHI_LOG_RETENTION_DAYS || '2555'), // 7 years
      notifications: parseInt(process.env.NOTIFICATION_RETENTION_DAYS || '2555'), // 7 years
      exportHistory: parseInt(process.env.EXPORT_RETENTION_DAYS || '2555'), // 7 years
      signatures: parseInt(process.env.SIGNATURE_RETENTION_DAYS || '2555'), // 7 years
      sessions: parseInt(process.env.SESSION_RETENTION_DAYS || '90'), // 90 days
      reports: parseInt(process.env.REPORT_RETENTION_DAYS || '3650'), // 10 years
      studies: parseInt(process.env.STUDY_RETENTION_DAYS || '3650') // 10 years
    };

    this.archivePath = process.env.ARCHIVE_PATH || './archives';
    this.enableAutoArchival = process.env.ENABLE_AUTO_ARCHIVAL === 'true';
  }

  /**
   * Get retention policy for a data type
   */
  getRetentionPolicy(dataType) {
    return this.retentionPolicies[dataType] || 2555; // Default to 7 years
  }

  /**
   * Calculate expiration date based on retention policy
   */
  calculateExpirationDate(dataType, createdDate = new Date()) {
    const retentionDays = this.getRetentionPolicy(dataType);
    const expirationDate = new Date(createdDate);
    expirationDate.setDate(expirationDate.getDate() + retentionDays);
    return expirationDate;
  }

  /**
   * Check if data should be archived
   */
  shouldArchive(createdDate, dataType) {
    const retentionDays = this.getRetentionPolicy(dataType);
    const archiveThreshold = retentionDays * 0.9; // Archive at 90% of retention period
    const daysSinceCreation = (Date.now() - new Date(createdDate).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceCreation >= archiveThreshold;
  }

  /**
   * Check if data should be deleted
   */
  shouldDelete(createdDate, dataType) {
    const retentionDays = this.getRetentionPolicy(dataType);
    const daysSinceCreation = (Date.now() - new Date(createdDate).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceCreation >= retentionDays;
  }

  /**
   * Archive audit logs
   */
  async archiveAuditLogs(startDate, endDate) {
    try {
      console.log(`Archiving audit logs from ${startDate} to ${endDate}`);
      
      // Import models
      const AuditLog = require('../models/AuditLog');
      
      // Find logs to archive
      const logs = await AuditLog.find({
        timestamp: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }).lean();

      if (logs.length === 0) {
        console.log('No audit logs to archive');
        return { success: true, count: 0 };
      }

      // Create archive
      const archiveFile = await this.createArchive('audit-logs', logs, startDate, endDate);

      console.log(`Archived ${logs.length} audit logs to ${archiveFile}`);

      return {
        success: true,
        count: logs.length,
        archiveFile
      };
    } catch (error) {
      console.error('Failed to archive audit logs:', error);
      throw error;
    }
  }

  /**
   * Archive PHI access logs
   */
  async archivePHIAccessLogs(startDate, endDate) {
    try {
      console.log(`Archiving PHI access logs from ${startDate} to ${endDate}`);
      
      const PHIAccessLog = require('../models/PHIAccessLog');
      
      const logs = await PHIAccessLog.find({
        timestamp: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }).lean();

      if (logs.length === 0) {
        console.log('No PHI access logs to archive');
        return { success: true, count: 0 };
      }

      const archiveFile = await this.createArchive('phi-access-logs', logs, startDate, endDate);

      console.log(`Archived ${logs.length} PHI access logs to ${archiveFile}`);

      return {
        success: true,
        count: logs.length,
        archiveFile
      };
    } catch (error) {
      console.error('Failed to archive PHI access logs:', error);
      throw error;
    }
  }

  /**
   * Archive notifications
   */
  async archiveNotifications(startDate, endDate) {
    try {
      console.log(`Archiving notifications from ${startDate} to ${endDate}`);
      
      const CriticalNotification = require('../models/CriticalNotification');
      
      const notifications = await CriticalNotification.find({
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }).lean();

      if (notifications.length === 0) {
        console.log('No notifications to archive');
        return { success: true, count: 0 };
      }

      const archiveFile = await this.createArchive('notifications', notifications, startDate, endDate);

      console.log(`Archived ${notifications.length} notifications to ${archiveFile}`);

      return {
        success: true,
        count: notifications.length,
        archiveFile
      };
    } catch (error) {
      console.error('Failed to archive notifications:', error);
      throw error;
    }
  }

  /**
   * Archive export history
   */
  async archiveExportHistory(startDate, endDate) {
    try {
      console.log(`Archiving export history from ${startDate} to ${endDate}`);
      
      const ExportSession = require('../models/ExportSession');
      
      const exports = await ExportSession.find({
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }).lean();

      if (exports.length === 0) {
        console.log('No export history to archive');
        return { success: true, count: 0 };
      }

      const archiveFile = await this.createArchive('export-history', exports, startDate, endDate);

      console.log(`Archived ${exports.length} export records to ${archiveFile}`);

      return {
        success: true,
        count: exports.length,
        archiveFile
      };
    } catch (error) {
      console.error('Failed to archive export history:', error);
      throw error;
    }
  }

  /**
   * Create compressed archive file
   */
  async createArchive(dataType, data, startDate, endDate) {
    try {
      // Ensure archive directory exists
      await fs.mkdir(this.archivePath, { recursive: true });

      // Create archive filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archiveFilename = `${dataType}-${startDate}-to-${endDate}-${timestamp}.zip`;
      const archiveFilePath = path.join(this.archivePath, archiveFilename);

      // Create write stream
      const output = createWriteStream(archiveFilePath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
      });

      return new Promise((resolve, reject) => {
        output.on('close', () => {
          console.log(`Archive created: ${archiveFilePath} (${archive.pointer()} bytes)`);
          resolve(archiveFilePath);
        });

        archive.on('error', (err) => {
          reject(err);
        });

        // Pipe archive data to the file
        archive.pipe(output);

        // Add data as JSON file
        const jsonData = JSON.stringify(data, null, 2);
        archive.append(jsonData, { name: `${dataType}.json` });

        // Add metadata file
        const metadata = {
          dataType,
          startDate,
          endDate,
          recordCount: data.length,
          archivedAt: new Date().toISOString(),
          retentionPolicy: this.getRetentionPolicy(dataType),
          expirationDate: this.calculateExpirationDate(dataType)
        };
        archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });

        // Finalize the archive
        archive.finalize();
      });
    } catch (error) {
      console.error('Failed to create archive:', error);
      throw error;
    }
  }

  /**
   * Delete expired data
   */
  async deleteExpiredData(dataType) {
    try {
      console.log(`Deleting expired ${dataType}`);
      
      const retentionDays = this.getRetentionPolicy(dataType);
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() - retentionDays);

      let result;

      switch (dataType) {
        case 'auditLogs':
          const AuditLog = require('../models/AuditLog');
          result = await AuditLog.deleteMany({
            timestamp: { $lt: expirationDate }
          });
          break;

        case 'phiAccessLogs':
          const PHIAccessLog = require('../models/PHIAccessLog');
          result = await PHIAccessLog.deleteMany({
            timestamp: { $lt: expirationDate }
          });
          break;

        case 'notifications':
          const CriticalNotification = require('../models/CriticalNotification');
          result = await CriticalNotification.deleteMany({
            createdAt: { $lt: expirationDate }
          });
          break;

        case 'exportHistory':
          const ExportSession = require('../models/ExportSession');
          result = await ExportSession.deleteMany({
            createdAt: { $lt: expirationDate }
          });
          break;

        case 'sessions':
          const Session = require('../models/Session');
          result = await Session.deleteMany({
            expiresAt: { $lt: new Date() }
          });
          break;

        default:
          throw new Error(`Unknown data type: ${dataType}`);
      }

      console.log(`Deleted ${result.deletedCount} expired ${dataType} records`);

      return {
        success: true,
        deletedCount: result.deletedCount,
        dataType,
        expirationDate
      };
    } catch (error) {
      console.error(`Failed to delete expired ${dataType}:`, error);
      throw error;
    }
  }

  /**
   * Run automated archival process
   */
  async runAutomatedArchival() {
    try {
      console.log('Starting automated archival process...');

      const results = {
        timestamp: new Date().toISOString(),
        archives: [],
        deletions: []
      };

      // Calculate date ranges for archival
      const now = new Date();
      const archiveStartDate = new Date();
      archiveStartDate.setDate(archiveStartDate.getDate() - 365); // Archive data older than 1 year
      const archiveEndDate = new Date();
      archiveEndDate.setDate(archiveEndDate.getDate() - 30); // But not data from last 30 days

      // Archive audit logs
      const auditArchive = await this.archiveAuditLogs(
        archiveStartDate.toISOString().split('T')[0],
        archiveEndDate.toISOString().split('T')[0]
      );
      results.archives.push({ type: 'auditLogs', ...auditArchive });

      // Archive PHI access logs
      const phiArchive = await this.archivePHIAccessLogs(
        archiveStartDate.toISOString().split('T')[0],
        archiveEndDate.toISOString().split('T')[0]
      );
      results.archives.push({ type: 'phiAccessLogs', ...phiArchive });

      // Archive notifications
      const notifArchive = await this.archiveNotifications(
        archiveStartDate.toISOString().split('T')[0],
        archiveEndDate.toISOString().split('T')[0]
      );
      results.archives.push({ type: 'notifications', ...notifArchive });

      // Archive export history
      const exportArchive = await this.archiveExportHistory(
        archiveStartDate.toISOString().split('T')[0],
        archiveEndDate.toISOString().split('T')[0]
      );
      results.archives.push({ type: 'exportHistory', ...exportArchive });

      // Delete expired sessions (short retention)
      const sessionDeletion = await this.deleteExpiredData('sessions');
      results.deletions.push(sessionDeletion);

      console.log('Automated archival process completed');
      console.log('Results:', JSON.stringify(results, null, 2));

      return results;
    } catch (error) {
      console.error('Automated archival process failed:', error);
      throw error;
    }
  }

  /**
   * Get retention policy summary
   */
  getRetentionPolicySummary() {
    return Object.entries(this.retentionPolicies).map(([dataType, days]) => ({
      dataType,
      retentionDays: days,
      retentionYears: (days / 365).toFixed(2),
      expirationDate: this.calculateExpirationDate(dataType)
    }));
  }

  /**
   * Get archive statistics
   */
  async getArchiveStatistics() {
    try {
      const archiveDir = this.archivePath;
      const files = await fs.readdir(archiveDir);
      
      const archives = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(archiveDir, file);
          const stats = await fs.stat(filePath);
          return {
            filename: file,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
          };
        })
      );

      const totalSize = archives.reduce((sum, archive) => sum + archive.size, 0);

      return {
        archiveCount: archives.length,
        totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
        archives: archives.sort((a, b) => b.created - a.created)
      };
    } catch (error) {
      console.error('Failed to get archive statistics:', error);
      return {
        archiveCount: 0,
        totalSize: 0,
        totalSizeMB: '0.00',
        archives: []
      };
    }
  }
}

// Export singleton instance
module.exports = new DataRetentionService();
