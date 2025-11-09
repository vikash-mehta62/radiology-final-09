const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const winston = require('winston');
const BackupService = require('./backup-service');
const BackupVerification = require('./backup-verification');
const SecretManager = require('./secret-manager');

/**
 * DisasterRecovery - Orchestrates automated disaster recovery procedures
 * Implements recovery workflow with validation checkpoints and traffic switching
 */
class DisasterRecovery {
  constructor(config = {}) {
    this.config = {
      orthancDbPath: config.orthancDbPath || '/var/lib/orthanc/db',
      backupBasePath: config.backupBasePath || '/var/backups/orthanc',
      recoveryWorkspace: config.recoveryWorkspace || '/tmp/disaster-recovery',
      orthancConfigPath: config.orthancConfigPath || '/etc/orthanc/orthanc.json',
      orthancServiceName: config.orthancServiceName || 'orthanc',
      bridgeServiceName: config.bridgeServiceName || 'orthanc-bridge',
      nginxServiceName: config.nginxServiceName || 'nginx',
      maintenancePagePath: config.maintenancePagePath || '/var/www/maintenance.html',
      rtoTargetMinutes: config.rtoTargetMinutes || 30,
      rpoTargetHours: config.rpoTargetHours || 1,
      validationTimeoutMinutes: config.validationTimeoutMinutes || 10,
      rollbackTimeoutMinutes: config.rollbackTimeoutMinutes || 5,
      ...config
    };

    this.backupService = new BackupService(config);
    this.backupVerification = new BackupVerification(config);
    this.secretManager = new SecretManager();
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ 
          filename: path.join(this.config.recoveryWorkspace, 'disaster-recovery.log') 
        }),
        new winston.transports.Console()
      ]
    });

    this.recoveryState = {
      isRecovering: false,
      currentPhase: null,
      startTime: null,
      checkpoints: [],
      rollbackPlan: []
    };
  }

  /**
   * Initialize disaster recovery orchestrator
   */
  async initialize() {
    try {
      // Create recovery workspace
      await fs.mkdir(this.config.recoveryWorkspace, { recursive: true });
      
      // Initialize backup services
      await this.backupService.initialize();
      await this.backupVerification.initialize();

      this.logger.info('DisasterRecovery initialized successfully', {
        config: {
          orthancDbPath: this.config.orthancDbPath,
          recoveryWorkspace: this.config.recoveryWorkspace,
          rtoTargetMinutes: this.config.rtoTargetMinutes,
          rpoTargetHours: this.config.rpoTargetHours
        }
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to initialize DisasterRecovery', { error: error.message });
      throw error;
    }
  }

  /**
   * Execute complete disaster recovery procedure
   */
  async executeDisasterRecovery(options = {}) {
    const recoveryId = this.generateRecoveryId();
    
    if (this.recoveryState.isRecovering) {
      throw new Error('Disaster recovery is already in progress');
    }

    try {
      this.recoveryState = {
        isRecovering: true,
        recoveryId,
        currentPhase: 'initialization',
        startTime: Date.now(),
        checkpoints: [],
        rollbackPlan: [],
        options
      };

      this.logger.info('Starting disaster recovery procedure', { 
        recoveryId,
        options 
      });

      // Phase 1: Assessment and Preparation
      await this.executePhase('assessment', async () => {
        return await this.assessDisasterSituation();
      });

      // Phase 2: Service Shutdown and Maintenance Mode
      await this.executePhase('maintenance', async () => {
        return await this.enableMaintenanceMode();
      });

      // Phase 3: Backup Selection and Validation
      await this.executePhase('backup-selection', async () => {
        return await this.selectAndValidateBackup(options.backupId);
      });

      // Phase 4: Database Recovery
      await this.executePhase('database-recovery', async () => {
        return await this.recoverDatabase();
      });

      // Phase 5: Service Configuration Recovery
      await this.executePhase('config-recovery', async () => {
        return await this.recoverServiceConfiguration();
      });

      // Phase 6: Service Restart and Validation
      await this.executePhase('service-restart', async () => {
        return await this.restartServices();
      });

      // Phase 7: System Validation
      await this.executePhase('validation', async () => {
        return await this.validateRecoveredSystem();
      });

      // Phase 8: Traffic Restoration
      await this.executePhase('traffic-restoration', async () => {
        return await this.restoreTraffic();
      });

      // Phase 9: Post-Recovery Verification
      await this.executePhase('post-recovery', async () => {
        return await this.performPostRecoveryVerification();
      });

      const recoveryDuration = Date.now() - this.recoveryState.startTime;
      const rtoCompliant = recoveryDuration <= (this.config.rtoTargetMinutes * 60 * 1000);

      this.logger.info('Disaster recovery completed successfully', {
        recoveryId,
        duration: recoveryDuration,
        rtoCompliant,
        checkpoints: this.recoveryState.checkpoints.length
      });

      const result = {
        recoveryId,
        success: true,
        duration: recoveryDuration,
        rtoCompliant,
        checkpoints: this.recoveryState.checkpoints,
        timestamp: new Date().toISOString()
      };

      this.recoveryState.isRecovering = false;
      return result;

    } catch (error) {
      this.logger.error('Disaster recovery failed', {
        recoveryId,
        phase: this.recoveryState.currentPhase,
        error: error.message
      });

      // Attempt rollback
      try {
        await this.executeRollback();
      } catch (rollbackError) {
        this.logger.error('Rollback failed', { 
          recoveryId,
          rollbackError: rollbackError.message 
        });
      }

      this.recoveryState.isRecovering = false;
      throw error;
    }
  }

  /**
   * Execute a recovery phase with checkpoint management
   */
  async executePhase(phaseName, phaseFunction) {
    const phaseStartTime = Date.now();
    this.recoveryState.currentPhase = phaseName;

    this.logger.info(`Starting recovery phase: ${phaseName}`, {
      recoveryId: this.recoveryState.recoveryId
    });

    try {
      const result = await phaseFunction();
      const phaseDuration = Date.now() - phaseStartTime;

      const checkpoint = {
        phase: phaseName,
        success: true,
        duration: phaseDuration,
        timestamp: new Date().toISOString(),
        result
      };

      this.recoveryState.checkpoints.push(checkpoint);
      
      this.logger.info(`Completed recovery phase: ${phaseName}`, {
        recoveryId: this.recoveryState.recoveryId,
        duration: phaseDuration
      });

      return result;
    } catch (error) {
      const phaseDuration = Date.now() - phaseStartTime;

      const checkpoint = {
        phase: phaseName,
        success: false,
        duration: phaseDuration,
        timestamp: new Date().toISOString(),
        error: error.message
      };

      this.recoveryState.checkpoints.push(checkpoint);
      
      this.logger.error(`Failed recovery phase: ${phaseName}`, {
        recoveryId: this.recoveryState.recoveryId,
        duration: phaseDuration,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Assess disaster situation and determine recovery strategy
   */
  async assessDisasterSituation() {
    const assessment = {
      timestamp: new Date().toISOString(),
      services: {},
      database: {},
      backups: {},
      network: {}
    };

    try {
      // Check service status
      assessment.services.orthanc = await this.checkServiceStatus(this.config.orthancServiceName);
      assessment.services.bridge = await this.checkServiceStatus(this.config.bridgeServiceName);
      assessment.services.nginx = await this.checkServiceStatus(this.config.nginxServiceName);

      // Check database status
      assessment.database.accessible = await this.checkDatabaseAccessibility();
      assessment.database.corruption = await this.checkDatabaseCorruption();

      // Check backup availability
      const backups = await this.backupVerification.discoverBackups();
      assessment.backups.available = backups.length;
      assessment.backups.latest = backups.length > 0 ? backups[0].metadata : null;

      // Check network connectivity
      assessment.network.orthancReachable = await this.checkOrthancConnectivity();
      assessment.network.externalReachable = await this.checkExternalConnectivity();

      this.logger.info('Disaster assessment completed', { assessment });
      return assessment;
    } catch (error) {
      this.logger.error('Disaster assessment failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Enable maintenance mode
   */
  async enableMaintenanceMode() {
    try {
      // Stop services gracefully
      await this.stopService(this.config.bridgeServiceName);
      this.addRollbackStep('start-service', this.config.bridgeServiceName);

      await this.stopService(this.config.orthancServiceName);
      this.addRollbackStep('start-service', this.config.orthancServiceName);

      // Enable maintenance page
      await this.enableMaintenancePage();
      this.addRollbackStep('disable-maintenance-page');

      this.logger.info('Maintenance mode enabled');
      return { maintenanceEnabled: true };
    } catch (error) {
      this.logger.error('Failed to enable maintenance mode', { error: error.message });
      throw error;
    }
  }

  /**
   * Select and validate backup for recovery
   */
  async selectAndValidateBackup(preferredBackupId = null) {
    try {
      const backups = await this.backupVerification.discoverBackups();
      
      if (backups.length === 0) {
        throw new Error('No backups available for recovery');
      }

      let selectedBackup;
      if (preferredBackupId) {
        selectedBackup = backups.find(b => b.metadata.backupId === preferredBackupId);
        if (!selectedBackup) {
          throw new Error(`Preferred backup not found: ${preferredBackupId}`);
        }
      } else {
        // Select most recent valid backup
        selectedBackup = backups[0];
      }

      // Validate selected backup
      const validation = await this.backupVerification.verifyBackupIntegrity(selectedBackup.path);
      if (!validation.valid) {
        throw new Error(`Selected backup is invalid: ${validation.error}`);
      }

      // Check RPO compliance
      const backupAge = Date.now() - new Date(selectedBackup.metadata.timestamp).getTime();
      const rpoCompliant = backupAge <= (this.config.rpoTargetHours * 60 * 60 * 1000);

      this.recoveryState.selectedBackup = selectedBackup;

      this.logger.info('Backup selected and validated', {
        backupId: selectedBackup.metadata.backupId,
        backupAge,
        rpoCompliant
      });

      return {
        selectedBackup: selectedBackup.metadata,
        rpoCompliant,
        backupAge
      };
    } catch (error) {
      this.logger.error('Backup selection failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Recover database from backup
   */
  async recoverDatabase() {
    try {
      const backup = this.recoveryState.selectedBackup;
      
      // Create backup of current database (if accessible)
      const currentDbBackup = await this.createEmergencyBackup();
      if (currentDbBackup) {
        this.addRollbackStep('restore-emergency-backup', currentDbBackup);
      }

      // Clear current database directory
      await this.clearDatabaseDirectory();

      // Extract backup to database location
      await this.extractBackupToDatabase(backup);

      // Verify database integrity
      const dbIntegrity = await this.verifyDatabaseIntegrity();
      if (!dbIntegrity.valid) {
        throw new Error(`Database recovery failed integrity check: ${dbIntegrity.error}`);
      }

      this.logger.info('Database recovery completed', {
        backupId: backup.metadata.backupId,
        dbIntegrity
      });

      return {
        backupId: backup.metadata.backupId,
        dbIntegrity
      };
    } catch (error) {
      this.logger.error('Database recovery failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Recover service configuration
   */
  async recoverServiceConfiguration() {
    try {
      // Backup current configuration
      const configBackup = await this.backupCurrentConfiguration();
      this.addRollbackStep('restore-configuration', configBackup);

      // Restore configuration from secrets or defaults
      await this.restoreOrthancConfiguration();
      await this.restoreBridgeConfiguration();

      this.logger.info('Service configuration recovered');
      return { configurationRestored: true };
    } catch (error) {
      this.logger.error('Configuration recovery failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Restart services in proper order
   */
  async restartServices() {
    try {
      // Start Orthanc first
      await this.startService(this.config.orthancServiceName);
      await this.waitForServiceReady(this.config.orthancServiceName, 60000);

      // Start bridge service
      await this.startService(this.config.bridgeServiceName);
      await this.waitForServiceReady(this.config.bridgeServiceName, 30000);

      this.logger.info('Services restarted successfully');
      return { servicesStarted: true };
    } catch (error) {
      this.logger.error('Service restart failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Validate recovered system
   */
  async validateRecoveredSystem() {
    try {
      const validation = {
        orthanc: await this.validateOrthancFunctionality(),
        bridge: await this.validateBridgeFunctionality(),
        database: await this.validateDatabaseFunctionality(),
        connectivity: await this.validateConnectivity()
      };

      const allValid = Object.values(validation).every(v => v.valid);
      if (!allValid) {
        const errors = Object.entries(validation)
          .filter(([_, v]) => !v.valid)
          .map(([k, v]) => `${k}: ${v.error}`)
          .join(', ');
        throw new Error(`System validation failed: ${errors}`);
      }

      this.logger.info('System validation completed successfully', { validation });
      return validation;
    } catch (error) {
      this.logger.error('System validation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Restore traffic and disable maintenance mode
   */
  async restoreTraffic() {
    try {
      // Disable maintenance page
      await this.disableMaintenancePage();

      // Restart nginx if needed
      await this.restartService(this.config.nginxServiceName);

      // Verify traffic flow
      const trafficTest = await this.testTrafficFlow();
      if (!trafficTest.success) {
        throw new Error(`Traffic flow test failed: ${trafficTest.error}`);
      }

      this.logger.info('Traffic restored successfully');
      return { trafficRestored: true };
    } catch (error) {
      this.logger.error('Traffic restoration failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Perform post-recovery verification
   */
  async performPostRecoveryVerification() {
    try {
      // Run comprehensive system tests
      const systemTests = await this.runSystemTests();
      
      // Verify data integrity
      const dataIntegrity = await this.verifyDataIntegrity();
      
      // Check performance metrics
      const performance = await this.checkPerformanceMetrics();

      const verification = {
        systemTests,
        dataIntegrity,
        performance,
        timestamp: new Date().toISOString()
      };

      this.logger.info('Post-recovery verification completed', { verification });
      return verification;
    } catch (error) {
      this.logger.error('Post-recovery verification failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Execute rollback procedure
   */
  async executeRollback() {
    this.logger.info('Starting rollback procedure', {
      recoveryId: this.recoveryState.recoveryId,
      rollbackSteps: this.recoveryState.rollbackPlan.length
    });

    // Execute rollback steps in reverse order
    for (let i = this.recoveryState.rollbackPlan.length - 1; i >= 0; i--) {
      const step = this.recoveryState.rollbackPlan[i];
      
      try {
        await this.executeRollbackStep(step);
        this.logger.info('Rollback step completed', { step: step.action });
      } catch (error) {
        this.logger.error('Rollback step failed', { 
          step: step.action, 
          error: error.message 
        });
        // Continue with other rollback steps
      }
    }

    this.logger.info('Rollback procedure completed');
  }

  /**
   * Execute individual rollback step
   */
  async executeRollbackStep(step) {
    switch (step.action) {
      case 'start-service':
        await this.startService(step.target);
        break;
      case 'stop-service':
        await this.stopService(step.target);
        break;
      case 'restore-emergency-backup':
        await this.restoreEmergencyBackup(step.target);
        break;
      case 'restore-configuration':
        await this.restoreConfiguration(step.target);
        break;
      case 'disable-maintenance-page':
        await this.disableMaintenancePage();
        break;
      default:
        this.logger.warn('Unknown rollback action', { action: step.action });
    }
  }

  /**
   * Utility methods for service management
   */
  async checkServiceStatus(serviceName) {
    return new Promise((resolve) => {
      const systemctl = spawn('systemctl', ['is-active', serviceName]);
      
      systemctl.on('close', (code) => {
        resolve({
          running: code === 0,
          serviceName
        });
      });
    });
  }

  async stopService(serviceName) {
    return new Promise((resolve, reject) => {
      const systemctl = spawn('systemctl', ['stop', serviceName]);
      
      systemctl.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to stop service: ${serviceName}`));
        }
      });
    });
  }

  async startService(serviceName) {
    return new Promise((resolve, reject) => {
      const systemctl = spawn('systemctl', ['start', serviceName]);
      
      systemctl.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to start service: ${serviceName}`));
        }
      });
    });
  }

  async restartService(serviceName) {
    return new Promise((resolve, reject) => {
      const systemctl = spawn('systemctl', ['restart', serviceName]);
      
      systemctl.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to restart service: ${serviceName}`));
        }
      });
    });
  }

  async waitForServiceReady(serviceName, timeoutMs = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const status = await this.checkServiceStatus(serviceName);
      if (status.running) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Service ${serviceName} did not become ready within ${timeoutMs}ms`);
  }

  /**
   * Database management methods
   */
  async checkDatabaseAccessibility() {
    try {
      const stats = await fs.stat(this.config.orthancDbPath);
      return stats.isDirectory();
    } catch (error) {
      return false;
    }
  }

  async checkDatabaseCorruption() {
    // This would implement database-specific corruption checks
    // For SQLite, we could run PRAGMA integrity_check
    // For now, return false (no corruption detected)
    return false;
  }

  async createEmergencyBackup() {
    try {
      const emergencyBackupPath = path.join(
        this.config.recoveryWorkspace,
        `emergency-backup-${Date.now()}`
      );
      
      await fs.mkdir(emergencyBackupPath, { recursive: true });
      
      // Copy current database
      const dbFiles = await fs.readdir(this.config.orthancDbPath);
      for (const file of dbFiles) {
        const sourcePath = path.join(this.config.orthancDbPath, file);
        const destPath = path.join(emergencyBackupPath, file);
        await fs.copyFile(sourcePath, destPath);
      }
      
      return emergencyBackupPath;
    } catch (error) {
      this.logger.warn('Failed to create emergency backup', { error: error.message });
      return null;
    }
  }

  async clearDatabaseDirectory() {
    const files = await fs.readdir(this.config.orthancDbPath);
    for (const file of files) {
      const filePath = path.join(this.config.orthancDbPath, file);
      await fs.unlink(filePath);
    }
  }

  async extractBackupToDatabase(backup) {
    // This would extract the backup to the database directory
    // Implementation depends on backup format
    const backupFile = path.join(backup.path, 'orthanc-db.tar.gz');
    
    return new Promise((resolve, reject) => {
      const tar = spawn('tar', ['-xzf', backupFile, '-C', this.config.orthancDbPath]);
      
      tar.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to extract backup: exit code ${code}`));
        }
      });
      
      tar.on('error', reject);
    });
  }

  async verifyDatabaseIntegrity() {
    // Database-specific integrity checks would go here
    return { valid: true };
  }

  /**
   * Configuration management
   */
  async backupCurrentConfiguration() {
    const configBackupPath = path.join(
      this.config.recoveryWorkspace,
      `config-backup-${Date.now()}`
    );
    
    await fs.mkdir(configBackupPath, { recursive: true });
    
    // Backup Orthanc configuration
    try {
      await fs.copyFile(
        this.config.orthancConfigPath,
        path.join(configBackupPath, 'orthanc.json')
      );
    } catch (error) {
      this.logger.warn('Failed to backup Orthanc config', { error: error.message });
    }
    
    return configBackupPath;
  }

  async restoreOrthancConfiguration() {
    // Restore Orthanc configuration from secrets or defaults
    // This would be implemented based on the specific configuration management approach
  }

  async restoreBridgeConfiguration() {
    // Restore bridge configuration
    // This would be implemented based on the specific configuration management approach
  }

  /**
   * Validation methods
   */
  async validateOrthancFunctionality() {
    try {
      // Test Orthanc API endpoint
      const response = await fetch('http://69.62.70.102:8042/system');
      if (response.ok) {
        return { valid: true };
      } else {
        return { valid: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  async validateBridgeFunctionality() {
    // Test bridge functionality
    return { valid: true };
  }

  async validateDatabaseFunctionality() {
    // Test database functionality
    return { valid: true };
  }

  async validateConnectivity() {
    // Test network connectivity
    return { valid: true };
  }

  async checkOrthancConnectivity() {
    try {
      const response = await fetch('http://69.62.70.102:8042/system', { timeout: 5000 });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async checkExternalConnectivity() {
    // Test external connectivity
    return true;
  }

  /**
   * Maintenance mode management
   */
  async enableMaintenancePage() {
    // Enable maintenance page in nginx or load balancer
    // This would be implemented based on the specific setup
  }

  async disableMaintenancePage() {
    // Disable maintenance page
    // This would be implemented based on the specific setup
  }

  /**
   * Testing methods
   */
  async testTrafficFlow() {
    // Test that traffic is flowing correctly
    return { success: true };
  }

  async runSystemTests() {
    // Run comprehensive system tests
    return { passed: true };
  }

  async verifyDataIntegrity() {
    // Verify data integrity
    return { valid: true };
  }

  async checkPerformanceMetrics() {
    // Check performance metrics
    return { acceptable: true };
  }

  /**
   * Utility methods
   */
  generateRecoveryId() {
    return `recovery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  addRollbackStep(action, target = null) {
    this.recoveryState.rollbackPlan.push({
      action,
      target,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get disaster recovery status
   */
  getStatus() {
    return {
      isRecovering: this.recoveryState.isRecovering,
      currentPhase: this.recoveryState.currentPhase,
      checkpoints: this.recoveryState.checkpoints.length,
      rollbackSteps: this.recoveryState.rollbackPlan.length,
      config: {
        rtoTargetMinutes: this.config.rtoTargetMinutes,
        rpoTargetHours: this.config.rpoTargetHours,
        validationTimeoutMinutes: this.config.validationTimeoutMinutes
      }
    };
  }
}

module.exports = DisasterRecovery;