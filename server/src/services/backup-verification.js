const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const winston = require('winston');
const SecretManager = require('./secret-manager');

/**
 * BackupVerification - Service for backup integrity checking and restore testing
 * Implements automated restore testing with RTO/RPO verification and retention policy enforcement
 */
class BackupVerification {
  constructor(config = {}) {
    this.config = {
      backupBasePath: config.backupBasePath || '/var/backups/orthanc',
      testRestorePath: config.testRestorePath || '/tmp/orthanc-restore-test',
      orthancDbPath: config.orthancDbPath || '/var/lib/orthanc/db',
      rtoTargetMinutes: config.rtoTargetMinutes || 30, // Recovery Time Objective
      rpoTargetHours: config.rpoTargetHours || 1, // Recovery Point Objective
      retentionDays: config.retentionDays || 30,
      verificationScheduleHours: config.verificationScheduleHours || 24,
      maxRestoreTestSize: config.maxRestoreTestSize || '1GB',
      ...config
    };

    this.secretManager = new SecretManager();
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ 
          filename: path.join(this.config.backupBasePath, 'logs', 'verification.log') 
        }),
        new winston.transports.Console()
      ]
    });

    this.isRunning = false;
    this.verificationResults = new Map();
  }

  /**
   * Initialize backup verification service
   */
  async initialize() {
    try {
      // Ensure test restore directory exists
      await fs.mkdir(this.config.testRestorePath, { recursive: true });
      
      // Ensure logs directory exists
      await fs.mkdir(path.join(this.config.backupBasePath, 'logs'), { recursive: true });

      this.logger.info('BackupVerification initialized successfully', {
        config: {
          backupBasePath: this.config.backupBasePath,
          testRestorePath: this.config.testRestorePath,
          rtoTargetMinutes: this.config.rtoTargetMinutes,
          rpoTargetHours: this.config.rpoTargetHours
        }
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to initialize BackupVerification', { error: error.message });
      throw error;
    }
  }

  /**
   * Start the verification service with scheduled jobs
   */
  async start() {
    if (this.isRunning) {
      this.logger.warn('BackupVerification is already running');
      return;
    }

    try {
      await this.initialize();
      
      // Schedule periodic verification
      this.scheduleVerification();
      
      this.isRunning = true;
      this.logger.info('BackupVerification started successfully');
    } catch (error) {
      this.logger.error('Failed to start BackupVerification', { error: error.message });
      throw error;
    }
  }

  /**
   * Stop the verification service
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    if (this.verificationInterval) {
      clearInterval(this.verificationInterval);
    }

    this.isRunning = false;
    this.logger.info('BackupVerification stopped');
  }

  /**
   * Verify backup integrity for a specific backup
   */
  async verifyBackupIntegrity(backupPath) {
    const verificationId = this.generateVerificationId();
    const startTime = Date.now();

    try {
      this.logger.info('Starting backup integrity verification', { 
        verificationId, 
        backupPath 
      });

      // Load backup metadata
      const metadata = await this.loadBackupMetadata(backupPath);
      
      // Verify metadata structure
      const metadataValidation = this.validateMetadata(metadata);
      if (!metadataValidation.valid) {
        throw new Error(`Invalid metadata: ${metadataValidation.error}`);
      }

      // Verify file integrity
      const fileIntegrity = await this.verifyFileIntegrity(backupPath, metadata);
      if (!fileIntegrity.valid) {
        throw new Error(`File integrity check failed: ${fileIntegrity.error}`);
      }

      // Verify backup completeness
      const completeness = await this.verifyBackupCompleteness(backupPath, metadata);
      if (!completeness.valid) {
        throw new Error(`Backup completeness check failed: ${completeness.error}`);
      }

      // Test restore if backup is small enough
      let restoreTest = { skipped: true, reason: 'Size limit exceeded' };
      if (metadata.size <= this.parseSize(this.config.maxRestoreTestSize)) {
        restoreTest = await this.testRestore(backupPath, metadata);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      const result = {
        verificationId,
        backupPath,
        backupId: metadata.backupId,
        timestamp: new Date().toISOString(),
        duration,
        valid: true,
        checks: {
          metadata: metadataValidation,
          fileIntegrity,
          completeness,
          restoreTest
        }
      };

      this.verificationResults.set(verificationId, result);
      
      this.logger.info('Backup integrity verification completed successfully', {
        verificationId,
        backupId: metadata.backupId,
        duration,
        restoreTested: !restoreTest.skipped
      });

      return result;

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      const result = {
        verificationId,
        backupPath,
        timestamp: new Date().toISOString(),
        duration,
        valid: false,
        error: error.message,
        checks: {}
      };

      this.verificationResults.set(verificationId, result);
      
      this.logger.error('Backup integrity verification failed', {
        verificationId,
        backupPath,
        error: error.message,
        duration
      });

      throw error;
    }
  }

  /**
   * Test restore functionality with RTO/RPO verification
   */
  async testRestore(backupPath, metadata) {
    const restoreId = this.generateRestoreId();
    const restoreStartTime = Date.now();

    try {
      this.logger.info('Starting restore test', { restoreId, backupId: metadata.backupId });

      // Clean test restore directory
      await this.cleanTestRestoreDirectory();

      // Decrypt backup if encrypted
      let workingBackupPath = backupPath;
      if (metadata.encrypted) {
        workingBackupPath = await this.decryptBackupForTest(backupPath);
      }

      // Extract backup
      const extractedPath = await this.extractBackup(workingBackupPath, metadata);

      // Verify extracted data
      const extractionVerification = await this.verifyExtractedData(extractedPath, metadata);
      if (!extractionVerification.valid) {
        throw new Error(`Extraction verification failed: ${extractionVerification.error}`);
      }

      // Simulate database restoration
      const dbRestoreResult = await this.simulateDatabaseRestore(extractedPath);
      if (!dbRestoreResult.success) {
        throw new Error(`Database restore simulation failed: ${dbRestoreResult.error}`);
      }

      const restoreEndTime = Date.now();
      const restoreDuration = restoreEndTime - restoreStartTime;

      // Verify RTO compliance
      const rtoCompliant = restoreDuration <= (this.config.rtoTargetMinutes * 60 * 1000);
      
      // Verify RPO compliance (check backup age)
      const backupAge = Date.now() - new Date(metadata.timestamp).getTime();
      const rpoCompliant = backupAge <= (this.config.rpoTargetHours * 60 * 60 * 1000);

      // Clean up test files
      await this.cleanupTestFiles(workingBackupPath, extractedPath);

      const result = {
        restoreId,
        success: true,
        duration: restoreDuration,
        rtoCompliant,
        rpoCompliant,
        rtoTargetMs: this.config.rtoTargetMinutes * 60 * 1000,
        rpoTargetMs: this.config.rpoTargetHours * 60 * 60 * 1000,
        backupAge,
        extractedSize: extractionVerification.size,
        skipped: false
      };

      this.logger.info('Restore test completed successfully', {
        restoreId,
        backupId: metadata.backupId,
        duration: restoreDuration,
        rtoCompliant,
        rpoCompliant
      });

      return result;

    } catch (error) {
      const restoreEndTime = Date.now();
      const restoreDuration = restoreEndTime - restoreStartTime;

      this.logger.error('Restore test failed', {
        restoreId,
        backupId: metadata.backupId,
        error: error.message,
        duration: restoreDuration
      });

      return {
        restoreId,
        success: false,
        error: error.message,
        duration: restoreDuration,
        skipped: false
      };
    }
  }

  /**
   * Verify all available backups
   */
  async verifyAllBackups() {
    const verificationResults = [];

    try {
      const backups = await this.discoverBackups();
      
      this.logger.info('Starting verification of all backups', { 
        backupCount: backups.length 
      });

      for (const backup of backups) {
        try {
          const result = await this.verifyBackupIntegrity(backup.path);
          verificationResults.push(result);
        } catch (error) {
          verificationResults.push({
            backupPath: backup.path,
            valid: false,
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      }

      // Generate verification report
      const report = this.generateVerificationReport(verificationResults);
      await this.saveVerificationReport(report);

      this.logger.info('Completed verification of all backups', {
        totalBackups: backups.length,
        validBackups: verificationResults.filter(r => r.valid).length,
        invalidBackups: verificationResults.filter(r => !r.valid).length
      });

      return report;

    } catch (error) {
      this.logger.error('Failed to verify all backups', { error: error.message });
      throw error;
    }
  }

  /**
   * Enforce backup retention policy
   */
  async enforceRetentionPolicy() {
    try {
      this.logger.info('Starting retention policy enforcement', {
        retentionDays: this.config.retentionDays
      });

      const backups = await this.discoverBackups();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      let removedCount = 0;
      let totalSizeRemoved = 0;

      for (const backup of backups) {
        const backupDate = new Date(backup.metadata.timestamp);
        
        if (backupDate < cutoffDate) {
          try {
            const backupSize = await this.getBackupSize(backup.path);
            await fs.rmdir(backup.path, { recursive: true });
            
            removedCount++;
            totalSizeRemoved += backupSize;
            
            this.logger.info('Removed expired backup', {
              backupId: backup.metadata.backupId,
              backupDate: backup.metadata.timestamp,
              size: backupSize
            });
          } catch (error) {
            this.logger.error('Failed to remove expired backup', {
              backupPath: backup.path,
              error: error.message
            });
          }
        }
      }

      this.logger.info('Retention policy enforcement completed', {
        removedCount,
        totalSizeRemoved,
        retentionDays: this.config.retentionDays
      });

      return {
        removedCount,
        totalSizeRemoved,
        retentionDays: this.config.retentionDays
      };

    } catch (error) {
      this.logger.error('Failed to enforce retention policy', { error: error.message });
      throw error;
    }
  }

  /**
   * Load backup metadata from backup directory
   */
  async loadBackupMetadata(backupPath) {
    const metadataPath = path.join(backupPath, 'metadata.json');
    
    try {
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      return JSON.parse(metadataContent);
    } catch (error) {
      throw new Error(`Failed to load backup metadata: ${error.message}`);
    }
  }

  /**
   * Validate backup metadata structure
   */
  validateMetadata(metadata) {
    const requiredFields = ['backupId', 'type', 'timestamp', 'size', 'checksum'];
    
    for (const field of requiredFields) {
      if (!metadata[field]) {
        return { valid: false, error: `Missing required field: ${field}` };
      }
    }

    // Validate timestamp format
    if (isNaN(Date.parse(metadata.timestamp))) {
      return { valid: false, error: 'Invalid timestamp format' };
    }

    // Validate backup type
    if (!['full', 'incremental'].includes(metadata.type)) {
      return { valid: false, error: 'Invalid backup type' };
    }

    return { valid: true };
  }

  /**
   * Verify file integrity using checksums
   */
  async verifyFileIntegrity(backupPath, metadata) {
    try {
      // Find the main backup file
      const files = await fs.readdir(backupPath);
      const backupFile = files.find(f => f.startsWith('orthanc-db.tar.gz'));
      
      if (!backupFile) {
        return { valid: false, error: 'Backup file not found' };
      }

      const backupFilePath = path.join(backupPath, backupFile);
      const stats = await fs.stat(backupFilePath);

      // Verify file size
      if (stats.size !== metadata.size) {
        return { 
          valid: false, 
          error: `File size mismatch: expected ${metadata.size}, got ${stats.size}` 
        };
      }

      // Verify checksum if not encrypted
      if (!metadata.encrypted) {
        const actualChecksum = await this.calculateFileChecksum(backupFilePath);
        if (actualChecksum !== metadata.checksum) {
          return { 
            valid: false, 
            error: `Checksum mismatch: expected ${metadata.checksum}, got ${actualChecksum}` 
          };
        }
      }

      return { valid: true, size: stats.size, checksum: metadata.checksum };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Verify backup completeness
   */
  async verifyBackupCompleteness(backupPath, metadata) {
    try {
      const requiredFiles = ['metadata.json'];
      
      // Add expected backup file
      if (metadata.encrypted) {
        requiredFiles.push('orthanc-db.tar.gz.enc');
      } else {
        requiredFiles.push('orthanc-db.tar.gz');
      }

      const files = await fs.readdir(backupPath);
      
      for (const requiredFile of requiredFiles) {
        if (!files.includes(requiredFile)) {
          return { valid: false, error: `Missing required file: ${requiredFile}` };
        }
      }

      return { valid: true, files: files.length };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Decrypt backup for testing purposes
   */
  async decryptBackupForTest(backupPath) {
    try {
      const encryptionKey = await this.secretManager.getSecret('backup-encryption-key');
      if (!encryptionKey) {
        throw new Error('Backup encryption key not found');
      }

      const testBackupPath = path.join(this.config.testRestorePath, 'decrypted');
      await fs.mkdir(testBackupPath, { recursive: true });

      // Decrypt all encrypted files
      const files = await fs.readdir(backupPath);
      for (const file of files) {
        if (file.endsWith('.enc')) {
          const encryptedPath = path.join(backupPath, file);
          const decryptedPath = path.join(testBackupPath, file.replace('.enc', ''));
          await this.decryptFile(encryptedPath, decryptedPath, encryptionKey);
        } else {
          // Copy non-encrypted files
          const sourcePath = path.join(backupPath, file);
          const destPath = path.join(testBackupPath, file);
          await fs.copyFile(sourcePath, destPath);
        }
      }

      return testBackupPath;
    } catch (error) {
      throw new Error(`Failed to decrypt backup for test: ${error.message}`);
    }
  }

  /**
   * Decrypt a single file
   */
  async decryptFile(encryptedPath, decryptedPath, encryptionKey) {
    const algorithm = 'aes-256-gcm';
    const encryptedData = await fs.readFile(encryptedPath);
    
    const iv = encryptedData.slice(0, 16);
    const authTag = encryptedData.slice(16, 32);
    const encrypted = encryptedData.slice(32);
    
    const decipher = crypto.createDecipher(algorithm, encryptionKey);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    await fs.writeFile(decryptedPath, decrypted);
  }

  /**
   * Extract backup archive
   */
  async extractBackup(backupPath, metadata) {
    const extractPath = path.join(this.config.testRestorePath, 'extracted');
    await fs.mkdir(extractPath, { recursive: true });

    const backupFile = path.join(backupPath, 'orthanc-db.tar.gz');
    
    return new Promise((resolve, reject) => {
      const tar = spawn('tar', ['-xzf', backupFile, '-C', extractPath]);

      let stderr = '';
      tar.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      tar.on('close', (code) => {
        if (code === 0) {
          resolve(extractPath);
        } else {
          reject(new Error(`tar extraction failed with code ${code}: ${stderr}`));
        }
      });

      tar.on('error', reject);
    });
  }

  /**
   * Verify extracted data integrity
   */
  async verifyExtractedData(extractedPath, metadata) {
    try {
      const files = await fs.readdir(extractedPath, { recursive: true });
      
      if (files.length === 0) {
        return { valid: false, error: 'No files extracted' };
      }

      // Calculate total size of extracted files
      let totalSize = 0;
      for (const file of files) {
        const filePath = path.join(extractedPath, file);
        const stats = await fs.stat(filePath);
        if (stats.isFile()) {
          totalSize += stats.size;
        }
      }

      return { valid: true, size: totalSize, fileCount: files.length };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Simulate database restore process
   */
  async simulateDatabaseRestore(extractedPath) {
    try {
      // Check for expected database files
      const files = await fs.readdir(extractedPath);
      const dbFiles = files.filter(f => 
        f.endsWith('.db') || 
        f.endsWith('.sqlite') || 
        f.includes('orthanc')
      );

      if (dbFiles.length === 0) {
        return { success: false, error: 'No database files found in backup' };
      }

      // Simulate database file validation
      for (const dbFile of dbFiles) {
        const dbPath = path.join(extractedPath, dbFile);
        const stats = await fs.stat(dbPath);
        
        if (stats.size === 0) {
          return { success: false, error: `Database file is empty: ${dbFile}` };
        }
      }

      return { success: true, dbFiles: dbFiles.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Discover all available backups
   */
  async discoverBackups() {
    const backups = [];
    const backupTypes = ['full', 'incremental'];

    for (const type of backupTypes) {
      const typeDir = path.join(this.config.backupBasePath, type);
      
      try {
        const backupDirs = await fs.readdir(typeDir);
        
        for (const backupDir of backupDirs) {
          const backupPath = path.join(typeDir, backupDir);
          const metadataPath = path.join(backupPath, 'metadata.json');
          
          try {
            const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
            backups.push({
              path: backupPath,
              metadata,
              type
            });
          } catch (e) {
            // Skip invalid backups
            this.logger.warn('Skipping invalid backup', { backupPath, error: e.message });
          }
        }
      } catch (e) {
        // Directory doesn't exist or is inaccessible
        this.logger.warn(`Backup type directory not accessible: ${typeDir}`);
      }
    }

    return backups.sort((a, b) => new Date(b.metadata.timestamp) - new Date(a.metadata.timestamp));
  }

  /**
   * Generate verification report
   */
  generateVerificationReport(verificationResults) {
    const totalBackups = verificationResults.length;
    const validBackups = verificationResults.filter(r => r.valid).length;
    const invalidBackups = totalBackups - validBackups;
    
    const rtoCompliantTests = verificationResults
      .filter(r => r.checks?.restoreTest && !r.checks.restoreTest.skipped)
      .filter(r => r.checks.restoreTest.rtoCompliant).length;
    
    const rpoCompliantTests = verificationResults
      .filter(r => r.checks?.restoreTest && !r.checks.restoreTest.skipped)
      .filter(r => r.checks.restoreTest.rpoCompliant).length;

    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalBackups,
        validBackups,
        invalidBackups,
        validityRate: totalBackups > 0 ? (validBackups / totalBackups * 100).toFixed(2) : 0,
        rtoCompliantTests,
        rpoCompliantTests
      },
      config: {
        rtoTargetMinutes: this.config.rtoTargetMinutes,
        rpoTargetHours: this.config.rpoTargetHours,
        retentionDays: this.config.retentionDays
      },
      results: verificationResults
    };
  }

  /**
   * Save verification report
   */
  async saveVerificationReport(report) {
    const reportPath = path.join(
      this.config.backupBasePath, 
      'logs', 
      `verification-report-${new Date().toISOString().split('T')[0]}.json`
    );
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    this.logger.info('Verification report saved', { reportPath });
  }

  /**
   * Schedule periodic verification
   */
  scheduleVerification() {
    const intervalMs = this.config.verificationScheduleHours * 60 * 60 * 1000;
    
    this.verificationInterval = setInterval(async () => {
      try {
        await this.verifyAllBackups();
        await this.enforceRetentionPolicy();
      } catch (error) {
        this.logger.error('Scheduled verification failed', { error: error.message });
      }
    }, intervalMs);

    this.logger.info('Verification scheduled', { 
      intervalHours: this.config.verificationScheduleHours 
    });
  }

  /**
   * Utility methods
   */
  generateVerificationId() {
    return `verify-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }

  generateRestoreId() {
    return `restore-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }

  async calculateFileChecksum(filePath) {
    const hash = crypto.createHash('sha256');
    const data = await fs.readFile(filePath);
    hash.update(data);
    return hash.digest('hex');
  }

  async getBackupSize(backupPath) {
    let totalSize = 0;
    const files = await fs.readdir(backupPath, { recursive: true });
    
    for (const file of files) {
      const filePath = path.join(backupPath, file);
      const stats = await fs.stat(filePath);
      if (stats.isFile()) {
        totalSize += stats.size;
      }
    }
    
    return totalSize;
  }

  parseSize(sizeStr) {
    const units = { B: 1, KB: 1024, MB: 1024**2, GB: 1024**3, TB: 1024**4 };
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*([KMGT]?B)$/i);
    if (!match) return 0;
    return parseFloat(match[1]) * (units[match[2].toUpperCase()] || 1);
  }

  async cleanTestRestoreDirectory() {
    try {
      await fs.rmdir(this.config.testRestorePath, { recursive: true });
      await fs.mkdir(this.config.testRestorePath, { recursive: true });
    } catch (error) {
      // Directory might not exist, which is fine
    }
  }

  async cleanupTestFiles(...paths) {
    for (const testPath of paths) {
      if (testPath && testPath.includes('test')) {
        try {
          await fs.rmdir(testPath, { recursive: true });
        } catch (error) {
          this.logger.warn('Failed to cleanup test files', { testPath, error: error.message });
        }
      }
    }
  }

  /**
   * Get verification service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      verificationCount: this.verificationResults.size,
      config: {
        rtoTargetMinutes: this.config.rtoTargetMinutes,
        rpoTargetHours: this.config.rpoTargetHours,
        retentionDays: this.config.retentionDays,
        verificationScheduleHours: this.config.verificationScheduleHours
      }
    };
  }
}

module.exports = BackupVerification;