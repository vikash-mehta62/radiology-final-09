/**
 * Anonymization Audit Trail Service
 * 
 * Provides comprehensive audit logging for all anonymization operations.
 * Tracks before/after tag comparisons, validation results, and generates
 * compliance reports for regulatory review.
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class AnonymizationAudit {
  constructor(config = {}) {
    this.config = {
      // Audit storage configuration
      storageType: config.storageType || 'file', // 'file', 'database', 'siem'
      auditPath: config.auditPath || './logs/anonymization-audit',
      retentionDays: config.retentionDays || 2555, // 7 years default for healthcare
      encryptAuditLogs: config.encryptAuditLogs || true,
      encryptionKey: config.encryptionKey || process.env.AUDIT_ENCRYPTION_KEY,
      ...config
    };
    
    this.validateConfiguration();
  }

  /**
   * Validate audit configuration
   */
  validateConfiguration() {
    if (this.config.encryptAuditLogs && !this.config.encryptionKey) {
      throw new Error('Encryption key required when audit log encryption is enabled');
    }
  }

  /**
   * Create audit record for anonymization operation
   */
  async createAuditRecord(anonymizationResult, context = {}) {
    const auditRecord = {
      // Audit metadata
      auditId: uuidv4(),
      timestamp: new Date().toISOString(),
      version: '1.0',
      
      // Operation context
      context: {
        userId: context.userId || 'system',
        sessionId: context.sessionId,
        sourceSystem: context.sourceSystem || 'orthanc-bridge',
        operationType: 'anonymization',
        correlationId: context.correlationId || uuidv4(),
        ...context
      },
      
      // Policy information
      policy: {
        name: anonymizationResult.policy.name,
        version: anonymizationResult.policy.version,
        applied: anonymizationResult.policy.applied
      },
      
      // Operation summary
      summary: {
        totalTagsProcessed: anonymizationResult.originalMetadata ? Object.keys(anonymizationResult.originalMetadata).length : 0,
        tagsRemoved: anonymizationResult.operations ? anonymizationResult.operations.filter(op => op.operation === 'remove').length : 0,
        tagsPseudonymized: anonymizationResult.operations ? anonymizationResult.operations.filter(op => op.operation === 'pseudonymize').length : 0,
        tagsPreserved: anonymizationResult.anonymizedMetadata ? Object.keys(anonymizationResult.anonymizedMetadata).length : 0,
        validationPassed: anonymizationResult.validation ? anonymizationResult.validation.phiRemoved : false,
        validationErrors: anonymizationResult.validation ? anonymizationResult.validation.errors.length : 0,
        validationWarnings: anonymizationResult.validation ? anonymizationResult.validation.warnings.length : 0
      },
      
      // Detailed operations (without actual PHI values)
      operations: anonymizationResult.operations ? this.sanitizeOperations(anonymizationResult.operations) : [],
      
      // Validation results
      validation: {
        phiRemoved: anonymizationResult.validation.phiRemoved,
        errors: anonymizationResult.validation.errors,
        warnings: anonymizationResult.validation.warnings,
        removedTags: anonymizationResult.validation.removedTags,
        pseudonymizedTags: anonymizationResult.validation.pseudonymizedTags,
        preservedTags: anonymizationResult.validation.preservedTags
      },
      
      // Compliance information
      compliance: {
        hipaaCompliant: this.assessHIPAACompliance(anonymizationResult),
        gdprCompliant: this.assessGDPRCompliance(anonymizationResult),
        customCompliance: context.customCompliance || {}
      },
      
      // Data integrity hash (for tamper detection)
      integrityHash: this.calculateIntegrityHash(anonymizationResult)
    };
    
    // Store audit record
    await this.storeAuditRecord(auditRecord);
    
    return auditRecord;
  }

  /**
   * Sanitize operations to remove PHI from audit logs
   */
  sanitizeOperations(operations) {
    return operations.map(operation => ({
      operation: operation.operation,
      tag: operation.tag,
      originalValuePresent: operation.originalValue !== null && operation.originalValue !== undefined,
      originalValueType: typeof operation.originalValue,
      originalValueLength: operation.originalValue ? operation.originalValue.toString().length : 0,
      newValuePresent: operation.newValue !== null && operation.newValue !== undefined,
      newValueType: typeof operation.newValue,
      newValueLength: operation.newValue ? operation.newValue.toString().length : 0,
      // Hash of original value for verification without storing PHI
      originalValueHash: operation.originalValue ? 
        crypto.createHash('sha256').update(operation.originalValue.toString()).digest('hex') : null
    }));
  }

  /**
   * Calculate integrity hash for tamper detection
   */
  calculateIntegrityHash(anonymizationResult) {
    const hashData = {
      policyName: anonymizationResult.policy.name,
      policyVersion: anonymizationResult.policy.version,
      operationsCount: anonymizationResult.operations.length,
      validationResult: anonymizationResult.validation.phiRemoved,
      originalTagCount: Object.keys(anonymizationResult.originalMetadata).length,
      anonymizedTagCount: Object.keys(anonymizationResult.anonymizedMetadata).length
    };
    
    return crypto.createHash('sha256')
      .update(JSON.stringify(hashData))
      .digest('hex');
  }

  /**
   * Assess HIPAA compliance
   */
  assessHIPAACompliance(anonymizationResult) {
    const hipaaIdentifiers = [
      '(0010,0010)', // Patient Name
      '(0010,0020)', // Patient ID
      '(0010,0030)', // Patient Birth Date
      '(0008,0050)', // Accession Number
      '(0008,0080)', // Institution Name
      '(0008,0090)', // Referring Physician Name
      // Add more HIPAA identifiers as needed
    ];
    
    const compliance = {
      compliant: true,
      identifiersRemoved: [],
      identifiersRemaining: [],
      riskLevel: 'low'
    };
    
    // Check if HIPAA identifiers were properly handled
    for (const identifier of hipaaIdentifiers) {
      const wasRemoved = !anonymizationResult.anonymizedMetadata[identifier];
      const wasPseudonymized = anonymizationResult.operations.some(
        op => op.tag === identifier && op.operation === 'pseudonymize'
      );
      
      if (wasRemoved || wasPseudonymized) {
        compliance.identifiersRemoved.push(identifier);
      } else if (anonymizationResult.originalMetadata && anonymizationResult.originalMetadata[identifier]) {
        compliance.identifiersRemaining.push(identifier);
        compliance.compliant = false;
        compliance.riskLevel = 'high';
      }
    }
    
    return compliance;
  }

  /**
   * Assess GDPR compliance
   */
  assessGDPRCompliance(anonymizationResult) {
    return {
      compliant: anonymizationResult.validation.phiRemoved,
      dataMinimization: true, // Assuming anonymization achieves this
      purposeLimitation: true, // Assuming proper purpose limitation
      rightToErasure: anonymizationResult.validation.phiRemoved
    };
  }

  /**
   * Store audit record
   */
  async storeAuditRecord(auditRecord) {
    try {
      let recordData = JSON.stringify(auditRecord, null, 2);
      
      // Encrypt if required
      if (this.config.encryptAuditLogs) {
        recordData = this.encryptAuditData(recordData);
      }
      
      switch (this.config.storageType) {
        case 'file':
          await this.storeToFile(auditRecord.auditId, recordData);
          break;
        case 'database':
          await this.storeToDatabase(auditRecord);
          break;
        case 'siem':
          await this.storeToSIEM(auditRecord);
          break;
        default:
          throw new Error(`Unsupported audit storage type: ${this.config.storageType}`);
      }
      
      console.log(`Anonymization audit record created: ${auditRecord.auditId}`);
      
    } catch (error) {
      console.error('Failed to store anonymization audit record:', error);
      throw error;
    }
  }

  /**
   * Encrypt audit data
   */
  encryptAuditData(data) {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(this.config.encryptionKey, 'salt', 32);
    const cipher = crypto.createCipher('aes-256-cbc', this.config.encryptionKey);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encrypted: encrypted,
      algorithm: 'aes-256-cbc'
    };
  }

  /**
   * Store audit record to file
   */
  async storeToFile(auditId, recordData) {
    const fs = require('fs').promises;
    const path = require('path');
    
    // Create audit directory if it doesn't exist
    await fs.mkdir(this.config.auditPath, { recursive: true });
    
    // Create date-based subdirectory
    const date = new Date().toISOString().split('T')[0];
    const dateDir = path.join(this.config.auditPath, date);
    await fs.mkdir(dateDir, { recursive: true });
    
    // Write audit record
    const filename = `anonymization-audit-${auditId}.json`;
    const filepath = path.join(dateDir, filename);
    
    await fs.writeFile(filepath, typeof recordData === 'string' ? recordData : JSON.stringify(recordData, null, 2));
  }

  /**
   * Store audit record to database (placeholder)
   */
  async storeToDatabase(auditRecord) {
    // Implementation would depend on database choice
    // This is a placeholder for database storage
    console.log('Database storage not implemented yet');
    throw new Error('Database audit storage not implemented');
  }

  /**
   * Store audit record to SIEM (placeholder)
   */
  async storeToSIEM(auditRecord) {
    // Implementation would depend on SIEM system
    // This is a placeholder for SIEM integration
    console.log('SIEM storage not implemented yet');
    throw new Error('SIEM audit storage not implemented');
  }

  /**
   * Generate anonymization compliance report
   */
  async generateComplianceReport(startDate, endDate, options = {}) {
    const auditRecords = await this.retrieveAuditRecords(startDate, endDate);
    
    const report = {
      reportId: uuidv4(),
      generatedAt: new Date().toISOString(),
      period: {
        startDate: startDate,
        endDate: endDate
      },
      summary: {
        totalOperations: auditRecords.length,
        successfulOperations: 0,
        failedOperations: 0,
        hipaaCompliantOperations: 0,
        gdprCompliantOperations: 0
      },
      compliance: {
        hipaa: {
          compliantPercentage: 0,
          commonViolations: [],
          riskAssessment: 'low'
        },
        gdpr: {
          compliantPercentage: 0,
          dataMinimizationCompliance: 0,
          rightToErasureCompliance: 0
        }
      },
      operations: [],
      recommendations: []
    };
    
    // Analyze audit records
    for (const record of auditRecords) {
      if (record.validation.phiRemoved) {
        report.summary.successfulOperations++;
      } else {
        report.summary.failedOperations++;
      }
      
      if (record.compliance.hipaaCompliant) {
        report.summary.hipaaCompliantOperations++;
      }
      
      if (record.compliance.gdprCompliant) {
        report.summary.gdprCompliantOperations++;
      }
      
      // Add operation summary to report
      report.operations.push({
        auditId: record.auditId,
        timestamp: record.timestamp,
        policyUsed: record.policy.name,
        success: record.validation.phiRemoved,
        hipaaCompliant: record.compliance.hipaaCompliant,
        gdprCompliant: record.compliance.gdprCompliant,
        errorsCount: record.validation.errors.length,
        warningsCount: record.validation.warnings.length
      });
    }
    
    // Calculate compliance percentages
    if (auditRecords.length > 0) {
      report.compliance.hipaa.compliantPercentage = 
        (report.summary.hipaaCompliantOperations / auditRecords.length) * 100;
      report.compliance.gdpr.compliantPercentage = 
        (report.summary.gdprCompliantOperations / auditRecords.length) * 100;
    }
    
    // Generate recommendations
    if (report.summary.failedOperations > 0) {
      report.recommendations.push('Review failed anonymization operations and update policies');
    }
    
    if (report.compliance.hipaa.compliantPercentage < 100) {
      report.recommendations.push('Review HIPAA compliance issues and strengthen anonymization policies');
    }
    
    return report;
  }

  /**
   * Retrieve audit records for a date range
   */
  async retrieveAuditRecords(startDate, endDate) {
    // Implementation depends on storage type
    switch (this.config.storageType) {
      case 'file':
        return await this.retrieveFromFiles(startDate, endDate);
      case 'database':
        return await this.retrieveFromDatabase(startDate, endDate);
      case 'siem':
        return await this.retrieveFromSIEM(startDate, endDate);
      default:
        throw new Error(`Unsupported audit storage type: ${this.config.storageType}`);
    }
  }

  /**
   * Retrieve audit records from files
   */
  async retrieveFromFiles(startDate, endDate) {
    const fs = require('fs').promises;
    const path = require('path');
    const records = [];
    
    try {
      // Get all date directories in range
      const start = new Date(startDate);
      const end = new Date(endDate);
      const current = new Date(start);
      
      while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        const dateDir = path.join(this.config.auditPath, dateStr);
        
        try {
          const files = await fs.readdir(dateDir);
          
          for (const file of files) {
            if (file.startsWith('anonymization-audit-') && file.endsWith('.json')) {
              const filepath = path.join(dateDir, file);
              const recordData = await fs.readFile(filepath, 'utf8');
              
              let record;
              if (this.config.encryptAuditLogs) {
                record = JSON.parse(this.decryptAuditData(JSON.parse(recordData)));
              } else {
                record = JSON.parse(recordData);
              }
              
              records.push(record);
            }
          }
        } catch (error) {
          // Directory might not exist for this date, continue
          console.log(`No audit records found for date: ${dateStr}`);
        }
        
        current.setDate(current.getDate() + 1);
      }
      
    } catch (error) {
      console.error('Error retrieving audit records from files:', error);
      throw error;
    }
    
    return records;
  }

  /**
   * Decrypt audit data
   */
  decryptAuditData(encryptedData) {
    const decipher = crypto.createDecipher('aes-256-cbc', this.config.encryptionKey);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Retrieve audit records from database (placeholder)
   */
  async retrieveFromDatabase(startDate, endDate) {
    throw new Error('Database audit retrieval not implemented');
  }

  /**
   * Retrieve audit records from SIEM (placeholder)
   */
  async retrieveFromSIEM(startDate, endDate) {
    throw new Error('SIEM audit retrieval not implemented');
  }

  /**
   * Verify audit record integrity
   */
  verifyAuditIntegrity(auditRecord, anonymizationResult) {
    const calculatedHash = this.calculateIntegrityHash(anonymizationResult);
    return auditRecord.integrityHash === calculatedHash;
  }
}

module.exports = AnonymizationAudit;