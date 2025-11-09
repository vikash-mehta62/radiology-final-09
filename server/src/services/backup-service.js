const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const winston = require('winston');
const SecretManager = require('./secret-manager');

/**
 * BackupService - Automated backup service for Orthanc database
 * Implements daily full backups and hourly incremental backups with encryption
 */
class BackupService {
  constructor(config = {}) {
    this.config = {
      orthancDbPath: config.orthancDbPath || '/var/lib/orthanc/db',
      backupBasePath: config.backupBasePath || '/var/backups/orthanc',
      encryptionEnabled: config.encryptionEnabled !== false,
      retentionDays: config.retentionDays || 30,
      fullBackupHour: config.fullBackupHour || 2, // 2 AM
      incrementalIntervalHours: config.incrementalIntervalHours || 1,
      compressionLevel: config.compressionLevel || 6,
      maxBackupSize: config.maxBackupSize || '10GB',
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
          filename: path.join(this.config.backupBasePath, 'logs', 'backup.log') 
        }),
        new winston.transports.Console()
      ]
    });

    this.isRunning = false;
    this.scheduledJobs = new Map();
  }

  /**
   * Initialize backup service and create necessary directories
   */
  async initialize() {
    try {
      // Create backup directories
      await this.ensureDirectories();
      
      // Validate Orthanc database path
      await this.validateOrthancDatabase();
      
      // Initialize encryption if enabled
      if (this.config.encryptionEnabled) {
        await this.initializeEncryption();
      }

      this.logger.info('BackupService initialized successfully', {
        config: {
          orthancDbPath: this.config.orthancDbPath,
          backupBasePath: this.config.backupBasePath,
          encryptionEnabled: this.config.encryptionEnabled,
          retentionDays: this.config.retentionDays
        }
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to initialize BackupService', { error: error.message });
      throw error;
    }
  }

  /**
   * Start the backup service with scheduled jobs
   */
  async start() {
    if (this.isRunning) {
      this.logger.warn('BackupService is already running');
      return;
    }

    try {
      await this.initialize();
      
      // Schedule full backup daily
      this.scheduleFullBackup();
      
      // Schedule incremental backups hourly
      this.scheduleIncrementalBackup();
      
      this.isRunning = true;
      this.logger.info('BackupService started successfully');
    } catch (error) {
      this.logger.error('Failed to start BackupService', { error: error.message });
      throw error;
    }
  }

  /**
   * Stop the backup service and clear scheduled jobs
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    // Clear all scheduled jobs
    for (const [jobName, intervalId] of this.scheduledJobs) {
      clearInterval(intervalId);
      this.logger.info(`Stopped scheduled job: ${jobName}`);
    }
    this.scheduledJobs.clear();

    this.isRunning = false;
    this.logger.info('BackupService stopped');
  }

  /**
   * Create a full backup of the Orthanc database
   */
  async createFullBackup() {
    const backupId = this.generateBackupId('full');
    const backupPath = path.join(this.config.backupBasePath, 'full', backupId);

    try {
      this.logger.info('Starting full backup', { backupId, backupPath });

      // Create backup directory
      await fs.mkdir(backupPath, { recursive: true });

      // Create database backup
      const dbBackupPath = await this.backupDatabase(backupPath, 'full');
      
      // Create metadata file
      const metadata = await this.createBackupMetadata('full', backupId, dbBackupPath);
      await fs.writeFile(
        path.join(backupPath, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
      );

      // Encrypt backup if enabled
      if (this.config.encryptionEnabled) {
        await this.encryptBackup(backupPath);
      }

      // Verify backup integrity
      const verification = await this.verifyBackupIntegrity(backupPath);
      if (!verification.valid) {
        throw new Error(`Backup verification failed: ${verification.error}`);
      }

      this.logger.info('Full backup completed successfully', {
        backupId,
        backupPath,
        size: verification.size,
        checksum: verification.checksum
      });

      // Clean up old backups
      await this.cleanupOldBackups('full');

      return {
        backupId,
        backupPath,
        type: 'full',
        size: verification.size,
        checksum: verification.checksum,
        encrypted: this.config.encryptionEnabled,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Full backup failed', { 
        backupId, 
        error: error.message,
        stack: error.stack 
      });
      
      // Clean up failed backup
      try {
        await fs.rmdir(backupPath, { recursive: true });
      } catch (cleanupError) {
        this.logger.error('Failed to cleanup failed backup', { 
          backupPath, 
          error: cleanupError.message 
        });
      }
      
      throw error;
    }
  }

  /**
   * Create an incremental backup of the Orthanc database
   */
  async createIncrementalBackup() {
    const backupId = this.generateBackupId('incremental');
    const backupPath = path.join(this.config.backupBasePath, 'incremental', backupId);

    try {
      this.logger.info('Starting incremental backup', { backupId, backupPath });

      // Find the last backup (full or incremental) for reference
      const lastBackup = await this.findLastBackup();
      if (!lastBackup) {
        this.logger.warn('No previous backup found, creating full backup instead');
        return await this.createFullBackup();
      }

      // Create backup directory
      await fs.mkdir(backupPath, { recursive: true });

      // Create incremental database backup
      const dbBackupPath = await this.backupDatabase(backupPath, 'incremental', lastBackup);
      
      // Create metadata file
      const metadata = await this.createBackupMetadata('incremental', backupId, dbBackupPath, lastBackup);
      await fs.writeFile(
        path.join(backupPath, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
      );

      // Encrypt backup if enabled
      if (this.config.encryptionEnabled) {
        await this.encryptBackup(backupPath);
      }

      // Verify backup integrity
      const verification = await this.verifyBackupIntegrity(backupPath);
      if (!verification.valid) {
        throw new Error(`Backup verification failed: ${verification.error}`);
      }

      this.logger.info('Incremental backup completed successfully', {
        backupId,
        backupPath,
        size: verification.size,
        checksum: verification.checksum,
        basedOn: lastBackup.backupId
      });

      // Clean up old backups
      await this.cleanupOldBackups('incremental');

      return {
        backupId,
        backupPath,
        type: 'incremental',
        size: verification.size,
        checksum: verification.checksum,
        encrypted: this.config.encryptionEnabled,
        timestamp: new Date().toISOString(),
        basedOn: lastBackup.backupId
      };

    } catch (error) {
      this.logger.error('Incremental backup failed', { 
        backupId, 
        error: error.message,
        stack: error.stack 
      });
      
      // Clean up failed backup
      try {
        await fs.rmdir(backupPath, { recursive: true });
      } catch (cleanupError) {
        this.logger.error('Failed to cleanup failed backup', { 
          backupPath, 
          error: cleanupError.message 
        });
      }
      
      throw error;
    }
  }

  /**
   * Backup the Orthanc database using appropriate method
   */
  async backupDatabase(backupPath, type, lastBackup = null) {
    const dbBackupFile = path.join(backupPath, 'orthanc-db.tar.gz');
    
    try {
      // For SQLite database, we can use file copy with compression
      // For PostgreSQL, we would use pg_dump
      const dbFiles = await this.getOrthancDatabaseFiles();
      
      if (type === 'full') {
        await this.createCompressedArchive(dbFiles, dbBackupFile);
      } else {
        // For incremental, only backup files modified since last backup
        const modifiedFiles = await this.getModifiedFiles(dbFiles, lastBackup.timestamp);
        await this.createCompressedArchive(modifiedFiles, dbBackupFile);
      }

      return dbBackupFile;
    } catch (error) {
      this.logger.error('Database backup failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get list of Orthanc database files
   */
  async getOrthancDatabaseFiles() {
    try {
      const files = [];
      const entries = await fs.readdir(this.config.orthancDbPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(this.config.orthancDbPath, entry.name);
        if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          files.push({
            path: fullPath,
            relativePath: entry.name,
            size: stats.size,
            mtime: stats.mtime
          });
        }
      }
      
      return files;
    } catch (error) {
      this.logger.error('Failed to get database files', { error: error.message });
      throw error;
    }
  }

  /**
   * Get files modified since a specific timestamp
   */
  async getModifiedFiles(files, sinceTimestamp) {
    const since = new Date(sinceTimestamp);
    return files.filter(file => file.mtime > since);
  }

  /**
   * Create compressed archive of files
   */
  async createCompressedArchive(files, outputPath) {
    return new Promise((resolve, reject) => {
      const tar = spawn('tar', [
        '-czf', outputPath,
        '-C', this.config.orthancDbPath,
        ...files.map(f => f.relativePath)
      ]);

      let stderr = '';
      tar.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      tar.on('close', (code) => {
        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`tar command failed with code ${code}: ${stderr}`));
        }
      });

      tar.on('error', reject);
    });
  }

  /**
   * Create backup metadata
   */
  async createBackupMetadata(type, backupId, dbBackupPath, lastBackup = null) {
    const stats = await fs.stat(dbBackupPath);
    
    return {
      backupId,
      type,
      timestamp: new Date().toISOString(),
      size: stats.size,
      checksum: await this.calculateFileChecksum(dbBackupPath),
      orthancDbPath: this.config.orthancDbPath,
      encrypted: this.config.encryptionEnabled,
      compressionLevel: this.config.compressionLevel,
      basedOn: lastBackup ? lastBackup.backupId : null,
      version: '1.0'
    };
  }

  /**
   * Calculate file checksum
   */
  async calculateFileChecksum(filePath) {
    const hash = crypto.createHash('sha256');
    const data = await fs.readFile(filePath);
    hash.update(data);
    return hash.digest('hex');
  }

  /**
   * Encrypt backup directory
   */
  async encryptBackup(backupPath) {
    try {
      const encryptionKey = await this.secretManager.getSecret('backup-encryption-key');
      if (!encryptionKey) {
        throw new Error('Backup encryption key not found in secret manager');
      }

      // Encrypt all files in the backup directory
      const files = await fs.readdir(backupPath);
      for (const file of files) {
        const filePath = path.join(backupPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile() && !file.endsWith('.enc')) {
          await this.encryptFile(filePath, encryptionKey);
          // Remove original unencrypted file
          await fs.unlink(filePath);
        }
      }

      this.logger.info('Backup encrypted successfully', { backupPath });
    } catch (error) {
      this.logger.error('Backup encryption failed', { 
        backupPath, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Encrypt a single file
   */
  async encryptFile(filePath, encryptionKey) {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, encryptionKey);
    
    const input = await fs.readFile(filePath);
    const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
    const authTag = cipher.getAuthTag();
    
    const encryptedData = Buffer.concat([iv, authTag, encrypted]);
    await fs.writeFile(`${filePath}.enc`, encryptedData);
  }

  /**
   * Verify backup integrity
   */
  async verifyBackupIntegrity(backupPath) {
    try {
      const metadataPath = path.join(backupPath, 'metadata.json');
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
      
      // Find the database backup file (encrypted or not)
      const files = await fs.readdir(backupPath);
      const dbFile = files.find(f => f.startsWith('orthanc-db.tar.gz'));
      
      if (!dbFile) {
        return { valid: false, error: 'Database backup file not found' };
      }

      const dbFilePath = path.join(backupPath, dbFile);
      const stats = await fs.stat(dbFilePath);
      
      // Verify file size matches metadata
      if (stats.size !== metadata.size) {
        return { 
          valid: false, 
          error: `File size mismatch: expected ${metadata.size}, got ${stats.size}` 
        };
      }

      // Verify checksum if not encrypted
      if (!this.config.encryptionEnabled) {
        const actualChecksum = await this.calculateFileChecksum(dbFilePath);
        if (actualChecksum !== metadata.checksum) {
          return { 
            valid: false, 
            error: `Checksum mismatch: expected ${metadata.checksum}, got ${actualChecksum}` 
          };
        }
      }

      return { 
        valid: true, 
        size: stats.size, 
        checksum: metadata.checksum 
      };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Find the most recent backup
   */
  async findLastBackup() {
    try {
      const backups = [];
      
      // Check full backups
      const fullBackupDir = path.join(this.config.backupBasePath, 'full');
      try {
        const fullBackups = await fs.readdir(fullBackupDir);
        for (const backup of fullBackups) {
          const metadataPath = path.join(fullBackupDir, backup, 'metadata.json');
          try {
            const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
            backups.push(metadata);
          } catch (e) {
            // Skip invalid backups
          }
        }
      } catch (e) {
        // Full backup directory doesn't exist yet
      }

      // Check incremental backups
      const incBackupDir = path.join(this.config.backupBasePath, 'incremental');
      try {
        const incBackups = await fs.readdir(incBackupDir);
        for (const backup of incBackups) {
          const metadataPath = path.join(incBackupDir, backup, 'metadata.json');
          try {
            const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
            backups.push(metadata);
          } catch (e) {
            // Skip invalid backups
          }
        }
      } catch (e) {
        // Incremental backup directory doesn't exist yet
      }

      if (backups.length === 0) {
        return null;
      }

      // Sort by timestamp and return the most recent
      backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      return backups[0];
    } catch (error) {
      this.logger.error('Failed to find last backup', { error: error.message });
      return null;
    }
  }

  /**
   * Clean up old backups based on retention policy
   */
  async cleanupOldBackups(type) {
    try {
      const backupDir = path.join(this.config.backupBasePath, type);
      const backups = await fs.readdir(backupDir);
      
      const backupMetadata = [];
      for (const backup of backups) {
        const metadataPath = path.join(backupDir, backup, 'metadata.json');
        try {
          const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
          metadata.path = path.join(backupDir, backup);
          backupMetadata.push(metadata);
        } catch (e) {
          // Skip invalid backups
        }
      }

      // Sort by timestamp (oldest first)
      backupMetadata.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // Remove backups older than retention period
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      for (const backup of backupMetadata) {
        const backupDate = new Date(backup.timestamp);
        if (backupDate < cutoffDate) {
          await fs.rmdir(backup.path, { recursive: true });
          this.logger.info('Removed old backup', { 
            backupId: backup.backupId, 
            timestamp: backup.timestamp 
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to cleanup old backups', { 
        type, 
        error: error.message 
      });
    }
  }

  /**
   * Schedule full backup job
   */
  scheduleFullBackup() {
    const scheduleFullBackup = () => {
      const now = new Date();
      const scheduledTime = new Date();
      scheduledTime.setHours(this.config.fullBackupHour, 0, 0, 0);
      
      // If scheduled time has passed today, schedule for tomorrow
      if (scheduledTime <= now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }
      
      const delay = scheduledTime.getTime() - now.getTime();
      
      setTimeout(async () => {
        try {
          await this.createFullBackup();
        } catch (error) {
          this.logger.error('Scheduled full backup failed', { error: error.message });
        }
        
        // Schedule next full backup
        scheduleFullBackup();
      }, delay);
      
      this.logger.info('Full backup scheduled', { 
        scheduledTime: scheduledTime.toISOString() 
      });
    };

    scheduleFullBackup();
  }

  /**
   * Schedule incremental backup job
   */
  scheduleIncrementalBackup() {
    const intervalMs = this.config.incrementalIntervalHours * 60 * 60 * 1000;
    
    const intervalId = setInterval(async () => {
      try {
        await this.createIncrementalBackup();
      } catch (error) {
        this.logger.error('Scheduled incremental backup failed', { error: error.message });
      }
    }, intervalMs);

    this.scheduledJobs.set('incremental-backup', intervalId);
    this.logger.info('Incremental backup scheduled', { 
      intervalHours: this.config.incrementalIntervalHours 
    });
  }

  /**
   * Generate unique backup ID
   */
  generateBackupId(type) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = crypto.randomBytes(4).toString('hex');
    return `${type}-${timestamp}-${random}`;
  }

  /**
   * Ensure required directories exist
   */
  async ensureDirectories() {
    const dirs = [
      this.config.backupBasePath,
      path.join(this.config.backupBasePath, 'full'),
      path.join(this.config.backupBasePath, 'incremental'),
      path.join(this.config.backupBasePath, 'logs')
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  /**
   * Validate Orthanc database path exists
   */
  async validateOrthancDatabase() {
    try {
      const stats = await fs.stat(this.config.orthancDbPath);
      if (!stats.isDirectory()) {
        throw new Error(`Orthanc database path is not a directory: ${this.config.orthancDbPath}`);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Orthanc database path does not exist: ${this.config.orthancDbPath}`);
      }
      throw error;
    }
  }

  /**
   * Initialize encryption components
   */
  async initializeEncryption() {
    try {
      // Ensure encryption key exists in secret manager
      let encryptionKey = await this.secretManager.getSecret('backup-encryption-key');
      if (!encryptionKey) {
        // Generate new encryption key
        encryptionKey = crypto.randomBytes(32).toString('hex');
        await this.secretManager.setSecret('backup-encryption-key', encryptionKey);
        this.logger.info('Generated new backup encryption key');
      }
    } catch (error) {
      this.logger.error('Failed to initialize encryption', { error: error.message });
      throw error;
    }
  }

  /**
   * Get backup service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      scheduledJobs: Array.from(this.scheduledJobs.keys()),
      config: {
        orthancDbPath: this.config.orthancDbPath,
        backupBasePath: this.config.backupBasePath,
        encryptionEnabled: this.config.encryptionEnabled,
        retentionDays: this.config.retentionDays,
        fullBackupHour: this.config.fullBackupHour,
        incrementalIntervalHours: this.config.incrementalIntervalHours
      }
    };
  }
}

module.exports = BackupService;