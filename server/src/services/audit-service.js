const fs = require('fs');
const path = require('path');
const cryptoService = require('./crypto-service');

/**
 * Audit Service for FDA 21 CFR Part 11 Compliance
 * Implements tamper-proof audit logging with encryption
 * Maintains complete audit trail for all signature operations
 */

class AuditService {
  constructor() {
    this.auditLogPath = process.env.AUDIT_LOG_PATH || path.join(__dirname, '../../logs/audit');
    this.encryptionEnabled = process.env.AUDIT_ENCRYPTION_ENABLED !== 'false';
    this.retentionDays = parseInt(process.env.AUDIT_RETENTION_DAYS || '2555'); // 7 years default
    
    // Ensure audit log directory exists
    this.ensureAuditDirectory();
    
    console.log('📋 Audit Service initialized');
    console.log('📁 Audit log path:', this.auditLogPath);
    console.log('🔐 Encryption enabled:', this.encryptionEnabled);
    console.log('📅 Retention period:', this.retentionDays, 'days');
  }

  /**
   * Ensure audit log directory exists
   */
  ensureAuditDirectory() {
    if (!fs.existsSync(this.auditLogPath)) {
      fs.mkdirSync(this.auditLogPath, { recursive: true, mode: 0o700 });
      console.log('📁 Created audit log directory:', this.auditLogPath);
    }
  }

  /**
   * Log signature operation with complete FDA compliance details
   * @param {object} signature - Signature object
   * @param {string} action - Action performed (created, verified, revoked, etc.)
   * @param {string} userId - User ID performing action
   * @param {string} ipAddress - IP address
   * @param {string} result - Result of action (success, failure)
   * @param {string} details - Additional details
   */
  async logSignature(signature, action, userId, ipAddress = 'unknown', result = 'success', details = '') {
    try {
      const auditEntry = {
        timestamp: new Date().toISOString(),
        eventType: 'signature',
        action,
        result,
        signature: {
          id: signature._id?.toString() || signature.id,
          reportId: signature.reportId,
          signerId: signature.signerId?.toString() || signature.signerId,
          signerName: signature.signerName,
          signerRole: signature.signerRole,
          meaning: signature.meaning,
          status: signature.status,
          algorithm: signature.algorithm,
          keySize: signature.keySize,
          timestamp: signature.timestamp
        },
        actor: {
          userId: userId?.toString() || userId,
          ipAddress,
          timestamp: new Date().toISOString(),
          userAgent: signature.metadata?.userAgent
        },
        details: details || `Signature ${action}`,
        metadata: {
          reportHash: signature.reportHash,
          signatureHash: signature.signatureHash?.substring(0, 32) + '...', // Truncate for log
          deviceId: signature.metadata?.deviceId,
          location: signature.metadata?.location
        },
        compliance: {
          standard: 'FDA 21 CFR Part 11',
          requirement: this.getComplianceRequirement(action),
          retained: true,
          retentionPeriod: '7 years'
        }
      };

      await this.writeAuditLog(auditEntry);
      console.log(`📋 Audit log: Signature ${action} - ${result}`);
    } catch (error) {
      console.error('❌ Error logging signature audit:', error);
      // Don't throw - audit logging should not break main flow
    }
  }

  /**
   * Get FDA compliance requirement for action
   * @param {string} action - Action type
   * @returns {string} Compliance requirement reference
   */
  getComplianceRequirement(action) {
    const requirements = {
      'created': '21 CFR 11.50 - Signature manifestations',
      'verified': '21 CFR 11.70 - Signature/record linking',
      'revoked': '21 CFR 11.100 - General requirements',
      'validation_failed': '21 CFR 11.70 - Signature/record linking'
    };
    return requirements[action] || '21 CFR Part 11';
  }

  /**
   * Log export operation
   * @param {string} reportId - Report ID
   * @param {string} format - Export format (pdf, dicom-sr, fhir)
   * @param {string} userId - User ID performing export
   * @param {string} ipAddress - IP address
   * @param {string} result - Result of export
   * @param {object} metadata - Additional metadata
   */
  async logExport(reportId, format, userId, ipAddress = 'unknown', result = 'success', metadata = {}) {
    try {
      const auditEntry = {
        timestamp: new Date().toISOString(),
        eventType: 'export',
        action: 'export_report',
        result,
        export: {
          reportId,
          format,
          fileSize: metadata.fileSize,
          recipient: metadata.recipient,
          purpose: metadata.purpose
        },
        actor: {
          userId: userId?.toString() || userId,
          ipAddress,
          timestamp: new Date().toISOString()
        },
        details: `Report exported as ${format}`,
        metadata
      };

      await this.writeAuditLog(auditEntry);
      console.log(`📋 Audit log: Export ${format} - ${result}`);
    } catch (error) {
      console.error('❌ Error logging export audit:', error);
    }
  }

  /**
   * Log notification operation
   * @param {object} notification - Notification object
   * @param {string} action - Action performed
   * @param {string} userId - User ID
   * @param {string} ipAddress - IP address
   * @param {string} result - Result
   */
  async logNotification(notification, action, userId = null, ipAddress = 'unknown', result = 'success') {
    try {
      const auditEntry = {
        timestamp: new Date().toISOString(),
        eventType: 'notification',
        action,
        result,
        notification: {
          id: notification._id?.toString() || notification.id,
          type: notification.type,
          severity: notification.severity,
          patientId: notification.patientId,
          studyId: notification.studyId,
          status: notification.status,
          channels: notification.channels
        },
        actor: userId ? {
          userId: userId?.toString() || userId,
          ipAddress,
          timestamp: new Date().toISOString()
        } : null,
        details: `Notification ${action}`,
        metadata: {
          recipients: notification.recipients?.length || 0,
          escalationLevel: notification.escalationLevel || 0
        }
      };

      await this.writeAuditLog(auditEntry);
      console.log(`📋 Audit log: Notification ${action} - ${result}`);
    } catch (error) {
      console.error('❌ Error logging notification audit:', error);
    }
  }

  /**
   * Log session operation
   * @param {object} session - Session object
   * @param {string} action - Action performed
   * @param {string} result - Result
   */
  async logSession(session, action, result = 'success') {
    try {
      const auditEntry = {
        timestamp: new Date().toISOString(),
        eventType: 'session',
        action,
        result,
        session: {
          id: session._id?.toString() || session.id,
          userId: session.userId?.toString() || session.userId,
          deviceId: session.deviceInfo?.deviceId,
          ipAddress: session.deviceInfo?.ipAddress,
          status: session.status
        },
        actor: {
          userId: session.userId?.toString() || session.userId,
          ipAddress: session.deviceInfo?.ipAddress || 'unknown',
          timestamp: new Date().toISOString()
        },
        details: `Session ${action}`,
        metadata: {
          lastActivity: session.lastActivity,
          expiresAt: session.expiresAt
        }
      };

      await this.writeAuditLog(auditEntry);
      console.log(`📋 Audit log: Session ${action} - ${result}`);
    } catch (error) {
      console.error('❌ Error logging session audit:', error);
    }
  }

  /**
   * Log report access
   * @param {string} reportId - Report ID
   * @param {string} userId - User ID accessing report
   * @param {string} ipAddress - IP address
   * @param {string} action - Action performed (view, edit, delete)
   */
  async logReportAccess(reportId, userId, ipAddress = 'unknown', action = 'view') {
    try {
      const auditEntry = {
        timestamp: new Date().toISOString(),
        eventType: 'report_access',
        action,
        result: 'success',
        report: {
          reportId
        },
        actor: {
          userId: userId?.toString() || userId,
          ipAddress,
          timestamp: new Date().toISOString()
        },
        details: `Report ${action}`,
        metadata: {}
      };

      await this.writeAuditLog(auditEntry);
    } catch (error) {
      console.error('❌ Error logging report access:', error);
    }
  }

  /**
   * Generic log action method for any audit event
   * @param {object} params - Audit parameters
   * @param {string} params.userId - User ID performing action
   * @param {string} params.action - Action performed
   * @param {string} params.resourceType - Type of resource (Report, User, etc.)
   * @param {string} params.resourceId - ID of resource
   * @param {object} params.details - Additional details
   * @param {string} params.ipAddress - IP address
   * @param {string} params.result - Result of action (success, failure)
   * @returns {Promise<void>}
   */
  async logAction(params) {
    try {
      const {
        userId,
        action,
        resourceType = 'Unknown',
        resourceId,
        details = {},
        ipAddress = 'unknown',
        result = 'success'
      } = params;

      const auditEntry = {
        timestamp: new Date().toISOString(),
        eventType: 'action',
        action,
        result,
        resource: {
          type: resourceType,
          id: resourceId
        },
        actor: {
          userId: userId?.toString() || userId,
          ipAddress,
          timestamp: new Date().toISOString()
        },
        details: typeof details === 'string' ? details : JSON.stringify(details),
        metadata: typeof details === 'object' ? details : {}
      };

      await this.writeAuditLog(auditEntry);
      console.log(`📋 Audit log: ${action} on ${resourceType} - ${result}`);
    } catch (error) {
      console.error('❌ Error logging action:', error);
      // Don't throw - audit logging should not break main flow
    }
  }

  /**
   * Write audit log entry to file with tamper-proof chain
   * @param {object} auditEntry - Audit entry object
   */
  async writeAuditLog(auditEntry) {
    try {
      // Get previous entry hash for chain integrity
      const previousHash = await this.getLastEntryHash();
      auditEntry.previousHash = previousHash;
      auditEntry.sequenceNumber = await this.getNextSequenceNumber();

      // Add integrity hash (includes previous hash for chain)
      const entryString = JSON.stringify(auditEntry);
      const integrityHash = cryptoService.hashData(entryString);
      auditEntry.integrityHash = integrityHash;

      // Add digital signature for tamper-proof guarantee
      auditEntry.signature = cryptoService.generateSignature(integrityHash);

      // Encrypt if enabled
      let logData = JSON.stringify(auditEntry);
      if (this.encryptionEnabled) {
        const encrypted = cryptoService.encryptData(logData);
        logData = JSON.stringify({
          encrypted: true,
          data: encrypted.encrypted,
          iv: encrypted.iv,
          algorithm: encrypted.algorithm
        });
      }

      // Determine log file (one file per day)
      const date = new Date().toISOString().split('T')[0];
      const logFile = path.join(this.auditLogPath, `audit-${date}.log`);

      // Append to log file with atomic write
      fs.appendFileSync(logFile, logData + '\n', { mode: 0o600 });

      // Update last hash cache
      await this.updateLastEntryHash(integrityHash);
    } catch (error) {
      console.error('❌ Error writing audit log:', error);
      throw error;
    }
  }

  /**
   * Get hash of last audit entry for chain integrity
   * @returns {Promise<string>} Last entry hash or null
   */
  async getLastEntryHash() {
    try {
      const cacheFile = path.join(this.auditLogPath, '.last-hash');
      if (fs.existsSync(cacheFile)) {
        return fs.readFileSync(cacheFile, 'utf8').trim();
      }
      return null;
    } catch (error) {
      console.error('⚠️ Error reading last hash:', error);
      return null;
    }
  }

  /**
   * Update last entry hash cache
   * @param {string} hash - Hash to store
   */
  async updateLastEntryHash(hash) {
    try {
      const cacheFile = path.join(this.auditLogPath, '.last-hash');
      fs.writeFileSync(cacheFile, hash, { mode: 0o600 });
    } catch (error) {
      console.error('⚠️ Error updating last hash:', error);
    }
  }

  /**
   * Get next sequence number for audit entries
   * @returns {Promise<number>} Next sequence number
   */
  async getNextSequenceNumber() {
    try {
      const seqFile = path.join(this.auditLogPath, '.sequence');
      let sequence = 1;
      
      if (fs.existsSync(seqFile)) {
        sequence = parseInt(fs.readFileSync(seqFile, 'utf8').trim()) + 1;
      }
      
      fs.writeFileSync(seqFile, sequence.toString(), { mode: 0o600 });
      return sequence;
    } catch (error) {
      console.error('⚠️ Error getting sequence number:', error);
      return Date.now(); // Fallback to timestamp
    }
  }

  /**
   * Search audit logs
   * @param {object} criteria - Search criteria
   * @returns {Promise<Array>} Matching audit entries
   */
  async searchAuditLogs(criteria = {}) {
    try {
      const {
        startDate,
        endDate,
        eventType,
        userId,
        reportId,
        action,
        result,
        limit = 100
      } = criteria;

      const results = [];
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default 30 days
      const end = endDate ? new Date(endDate) : new Date();

      // Iterate through log files in date range
      const currentDate = new Date(start);
      while (currentDate <= end) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const logFile = path.join(this.auditLogPath, `audit-${dateStr}.log`);

        if (fs.existsSync(logFile)) {
          const entries = await this.readLogFile(logFile);
          
          // Filter entries
          for (const entry of entries) {
            if (this.matchesCriteria(entry, criteria)) {
              results.push(entry);
              if (results.length >= limit) {
                return results;
              }
            }
          }
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      return results;
    } catch (error) {
      console.error('❌ Error searching audit logs:', error);
      throw error;
    }
  }

  /**
   * Read and decrypt log file
   * @param {string} logFile - Path to log file
   * @returns {Promise<Array>} Array of audit entries
   */
  async readLogFile(logFile) {
    try {
      const content = fs.readFileSync(logFile, 'utf8');
      const lines = content.trim().split('\n').filter(line => line);
      const entries = [];

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          
          // Decrypt if encrypted
          if (parsed.encrypted) {
            const decrypted = cryptoService.decryptData(parsed.data, parsed.iv);
            const entry = JSON.parse(decrypted);
            entries.push(entry);
          } else {
            entries.push(parsed);
          }
        } catch (error) {
          console.error('⚠️ Error parsing log entry:', error);
          // Continue with next entry
        }
      }

      return entries;
    } catch (error) {
      console.error('❌ Error reading log file:', error);
      return [];
    }
  }

  /**
   * Check if entry matches search criteria
   * @param {object} entry - Audit entry
   * @param {object} criteria - Search criteria
   * @returns {boolean} True if matches
   */
  matchesCriteria(entry, criteria) {
    if (criteria.eventType && entry.eventType !== criteria.eventType) {
      return false;
    }

    if (criteria.action && entry.action !== criteria.action) {
      return false;
    }

    if (criteria.result && entry.result !== criteria.result) {
      return false;
    }

    if (criteria.userId && entry.actor?.userId !== criteria.userId) {
      return false;
    }

    if (criteria.reportId) {
      const reportId = entry.signature?.reportId || entry.report?.reportId || entry.export?.reportId;
      if (reportId !== criteria.reportId) {
        return false;
      }
    }

    return true;
  }

  /**
   * Generate audit report
   * @param {object} criteria - Report criteria
   * @returns {Promise<object>} Audit report
   */
  async generateAuditReport(criteria = {}) {
    try {
      const entries = await this.searchAuditLogs(criteria);

      // Aggregate statistics
      const stats = {
        totalEvents: entries.length,
        eventTypes: {},
        actions: {},
        results: {},
        users: {},
        timeline: []
      };

      for (const entry of entries) {
        // Count by event type
        stats.eventTypes[entry.eventType] = (stats.eventTypes[entry.eventType] || 0) + 1;

        // Count by action
        stats.actions[entry.action] = (stats.actions[entry.action] || 0) + 1;

        // Count by result
        stats.results[entry.result] = (stats.results[entry.result] || 0) + 1;

        // Count by user
        if (entry.actor?.userId) {
          stats.users[entry.actor.userId] = (stats.users[entry.actor.userId] || 0) + 1;
        }

        // Add to timeline
        stats.timeline.push({
          timestamp: entry.timestamp,
          eventType: entry.eventType,
          action: entry.action,
          result: entry.result
        });
      }

      return {
        criteria,
        generatedAt: new Date().toISOString(),
        statistics: stats,
        entries: entries.slice(0, 1000) // Limit entries in report
      };
    } catch (error) {
      console.error('❌ Error generating audit report:', error);
      throw error;
    }
  }

  /**
   * Verify audit log integrity with chain validation
   * @param {string} logFile - Path to log file
   * @returns {Promise<object>} Verification result
   */
  async verifyLogIntegrity(logFile) {
    try {
      const entries = await this.readLogFile(logFile);
      const results = {
        total: entries.length,
        valid: 0,
        invalid: 0,
        chainValid: true,
        errors: [],
        warnings: []
      };

      let previousHash = null;

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        
        // Check for required fields
        if (!entry.integrityHash) {
          results.invalid++;
          results.errors.push({
            index: i,
            sequenceNumber: entry.sequenceNumber,
            error: 'Missing integrity hash'
          });
          continue;
        }

        // Verify chain integrity
        if (i > 0 && entry.previousHash !== previousHash) {
          results.chainValid = false;
          results.errors.push({
            index: i,
            sequenceNumber: entry.sequenceNumber,
            timestamp: entry.timestamp,
            error: 'Chain broken - previous hash mismatch',
            expected: previousHash,
            actual: entry.previousHash
          });
        }

        // Verify integrity hash
        const { integrityHash, signature, ...entryWithoutHash } = entry;
        const entryString = JSON.stringify(entryWithoutHash);
        const calculatedHash = cryptoService.hashData(entryString);

        if (calculatedHash !== integrityHash) {
          results.invalid++;
          results.errors.push({
            index: i,
            sequenceNumber: entry.sequenceNumber,
            timestamp: entry.timestamp,
            error: 'Integrity hash mismatch - possible tampering'
          });
          continue;
        }

        // Verify digital signature if present
        if (entry.signature) {
          const signatureValid = cryptoService.verifySignature(integrityHash, entry.signature);
          if (!signatureValid) {
            results.invalid++;
            results.errors.push({
              index: i,
              sequenceNumber: entry.sequenceNumber,
              timestamp: entry.timestamp,
              error: 'Digital signature verification failed'
            });
            continue;
          }
        } else {
          results.warnings.push({
            index: i,
            sequenceNumber: entry.sequenceNumber,
            warning: 'No digital signature present (older entry)'
          });
        }

        results.valid++;
        previousHash = integrityHash;
      }

      // Check sequence numbers
      const sequenceGaps = this.checkSequenceGaps(entries);
      if (sequenceGaps.length > 0) {
        results.warnings.push({
          warning: 'Sequence number gaps detected',
          gaps: sequenceGaps
        });
      }

      return results;
    } catch (error) {
      console.error('❌ Error verifying log integrity:', error);
      throw error;
    }
  }

  /**
   * Check for gaps in sequence numbers
   * @param {Array} entries - Audit entries
   * @returns {Array} Array of gaps found
   */
  checkSequenceGaps(entries) {
    const gaps = [];
    const sequences = entries
      .filter(e => e.sequenceNumber)
      .map(e => e.sequenceNumber)
      .sort((a, b) => a - b);

    for (let i = 1; i < sequences.length; i++) {
      const expected = sequences[i - 1] + 1;
      const actual = sequences[i];
      if (actual !== expected) {
        gaps.push({
          expected,
          actual,
          missing: actual - expected
        });
      }
    }

    return gaps;
  }

  /**
   * Verify complete audit trail integrity for date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<object>} Complete verification result
   */
  async verifyAuditTrailIntegrity(startDate, endDate) {
    try {
      console.log('🔍 Verifying audit trail integrity...');
      
      const results = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        filesChecked: 0,
        totalEntries: 0,
        validEntries: 0,
        invalidEntries: 0,
        chainIntact: true,
        files: [],
        overallStatus: 'valid'
      };

      // Iterate through date range
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const logFile = path.join(this.auditLogPath, `audit-${dateStr}.log`);

        if (fs.existsSync(logFile)) {
          const fileResult = await this.verifyLogIntegrity(logFile);
          results.filesChecked++;
          results.totalEntries += fileResult.total;
          results.validEntries += fileResult.valid;
          results.invalidEntries += fileResult.invalid;
          
          if (!fileResult.chainValid) {
            results.chainIntact = false;
          }

          results.files.push({
            date: dateStr,
            file: logFile,
            ...fileResult
          });

          if (fileResult.invalid > 0 || !fileResult.chainValid) {
            results.overallStatus = 'invalid';
          }
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      console.log(`✅ Audit trail verification complete: ${results.validEntries}/${results.totalEntries} valid`);
      return results;
    } catch (error) {
      console.error('❌ Error verifying audit trail:', error);
      throw error;
    }
  }

  /**
   * Export audit trail for compliance review
   * @param {object} criteria - Export criteria
   * @param {string} format - Export format (json, csv, pdf)
   * @returns {Promise<string>} Path to exported file
   */
  async exportAuditTrail(criteria = {}, format = 'json') {
    try {
      console.log('📤 Exporting audit trail...');
      
      const entries = await this.searchAuditLogs(criteria);
      const exportDir = path.join(this.auditLogPath, 'exports');
      
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true, mode: 0o700 });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `audit-export-${timestamp}.${format}`;
      const filepath = path.join(exportDir, filename);

      if (format === 'json') {
        fs.writeFileSync(filepath, JSON.stringify({
          exportDate: new Date().toISOString(),
          criteria,
          totalEntries: entries.length,
          entries
        }, null, 2), { mode: 0o600 });
      } else if (format === 'csv') {
        const csv = this.convertToCSV(entries);
        fs.writeFileSync(filepath, csv, { mode: 0o600 });
      }

      console.log('✅ Audit trail exported to:', filepath);
      return filepath;
    } catch (error) {
      console.error('❌ Error exporting audit trail:', error);
      throw error;
    }
  }

  /**
   * Convert audit entries to CSV format
   * @param {Array} entries - Audit entries
   * @returns {string} CSV string
   */
  convertToCSV(entries) {
    const headers = ['Timestamp', 'Event Type', 'Action', 'Result', 'User ID', 'IP Address', 'Details'];
    const rows = [headers.join(',')];

    for (const entry of entries) {
      const row = [
        entry.timestamp,
        entry.eventType,
        entry.action,
        entry.result,
        entry.actor?.userId || '',
        entry.actor?.ipAddress || '',
        `"${(entry.details || '').replace(/"/g, '""')}"`
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  /**
   * Archive old audit logs
   * @returns {Promise<object>} Archive result
   */
  async archiveOldLogs() {
    try {
      const archiveDir = path.join(this.auditLogPath, 'archive');
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true, mode: 0o700 });
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

      const files = fs.readdirSync(this.auditLogPath);
      let archivedCount = 0;

      for (const file of files) {
        if (!file.startsWith('audit-') || !file.endsWith('.log')) {
          continue;
        }

        const filePath = path.join(this.auditLogPath, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime < cutoffDate) {
          // Move to archive
          const archivePath = path.join(archiveDir, file);
          fs.renameSync(filePath, archivePath);
          archivedCount++;
          console.log('📦 Archived old audit log:', file);
        }
      }

      return {
        archivedCount,
        archiveDir
      };
    } catch (error) {
      console.error('❌ Error archiving old logs:', error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new AuditService();
