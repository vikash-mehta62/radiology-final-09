const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const BackupService = require('../src/services/backup-service');
const BackupVerification = require('../src/services/backup-verification');
const DisasterRecovery = require('../src/services/disaster-recovery');

// Mock external dependencies
jest.mock('../src/services/secret-manager', () => {
  return jest.fn().mockImplementation(() => ({
    getSecret: jest.fn().mockResolvedValue('mock-secret-value'),
    setSecret: jest.fn().mockResolvedValue(true),
    testConnection: jest.fn().mockResolvedValue(true)
  }));
});

jest.mock('child_process');

// Mock fetch for disaster recovery tests
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ status: 'ok' })
  })
);

const { spawn } = require('child_process');

describe('Backup and Recovery Tests', () => {
  let testConfig;
  let backupService;
  let backupVerification;
  let disasterRecovery;
  let testPaths;

  beforeAll(async () => {
    // Setup test directories
    testPaths = {
      orthancDb: path.join(__dirname, 'temp', 'orthanc-db'),
      backupBase: path.join(__dirname, 'temp', 'backups'),
      testRestore: path.join(__dirname, 'temp', 'restore-test'),
      recoveryWorkspace: path.join(__dirname, 'temp', 'recovery')
    };

    // Create test directories
    for (const testPath of Object.values(testPaths)) {
      await fs.mkdir(testPath, { recursive: true });
    }

    // Create test configuration
    testConfig = {
      orthancDbPath: testPaths.orthancDb,
      backupBasePath: testPaths.backupBase,
      testRestorePath: testPaths.testRestore,
      recoveryWorkspace: testPaths.recoveryWorkspace,
      encryptionEnabled: false, // Disable encryption for easier testing
      retentionDays: 7,
      fullBackupHour: 2,
      incrementalIntervalHours: 1,
      rtoTargetMinutes: 30,
      rpoTargetHours: 1,
      verificationScheduleHours: 24
    };

    // Initialize services
    backupService = new BackupService(testConfig);
    backupVerification = new BackupVerification(testConfig);
    disasterRecovery = new DisasterRecovery(testConfig);
  });

  afterAll(async () => {
    // Cleanup test directories
    try {
      await fs.rm(path.join(__dirname, 'temp'), { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Create mock Orthanc database files
    await createMockOrthancDatabase();
    
    // Mock spawn for tar commands
    spawn.mockImplementation((command, args) => {
      const mockProcess = {
        on: jest.fn(),
        stderr: { on: jest.fn() }
      };

      // Simulate successful tar operations
      setTimeout(async () => {
        if (command === 'tar' && args.includes('-czf')) {
          // Create mock compressed file for backup creation
          const outputFile = args[args.indexOf('-czf') + 1];
          const mockData = 'mock-compressed-data-' + Date.now();
          await fs.writeFile(outputFile, mockData).catch(() => {});
        }
        mockProcess.on.mock.calls.forEach(([event, callback]) => {
          if (event === 'close') callback(0);
        });
      }, 10);

      return mockProcess;
    });

    // Mock the backup verification to return consistent results
    if (backupService) {
      backupService.verifyBackupIntegrity = jest.fn().mockResolvedValue({
        valid: true,
        size: 20,
        checksum: 'mock-checksum'
      });
    }
  });

  afterEach(async () => {
    // Stop services if running
    if (backupService && backupService.isRunning) {
      await backupService.stop();
    }
    if (backupVerification && backupVerification.isRunning) {
      await backupVerification.stop();
    }

    // Clear test directories
    await clearTestDirectories();
    
    jest.clearAllMocks();
  });

  describe('Backup Creation Tests', () => {
    test('should create full backup successfully', async () => {
      await backupService.initialize();

      const backup = await backupService.createFullBackup();

      expect(backup).toMatchObject({
        type: 'full',
        encrypted: false
      });
      expect(backup.backupId).toMatch(/^full-/);
      expect(backup.backupPath).toBeTruthy();
      expect(backup.size).toBeGreaterThan(0);
      expect(backup.checksum).toBeTruthy();
      expect(backup.timestamp).toBeTruthy();

      // Verify backup directory structure
      const backupExists = await fs.access(backup.backupPath).then(() => true).catch(() => false);
      expect(backupExists).toBe(true);

      const metadataExists = await fs.access(path.join(backup.backupPath, 'metadata.json')).then(() => true).catch(() => false);
      expect(metadataExists).toBe(true);
    });

    test('should create incremental backup successfully', async () => {
      await backupService.initialize();

      // Create a full backup first
      const fullBackup = await backupService.createFullBackup();
      
      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 100));

      const incrementalBackup = await backupService.createIncrementalBackup();

      expect(incrementalBackup).toMatchObject({
        type: 'incremental',
        encrypted: false
      });
      expect(incrementalBackup.backupId).toMatch(/^incremental-/);
      expect(incrementalBackup.basedOn).toBe(fullBackup.backupId);
    });

    test('should create full backup when no previous backup exists for incremental', async () => {
      await backupService.initialize();

      const backup = await backupService.createIncrementalBackup();

      // Should fallback to full backup
      expect(backup.type).toBe('full');
      expect(backup.backupId).toMatch(/^full-/);
    });

    test('should handle backup creation failure gracefully', async () => {
      await backupService.initialize();

      // Mock tar command to fail
      spawn.mockImplementation(() => {
        const mockProcess = {
          on: jest.fn(),
          stderr: { on: jest.fn() }
        };

        setTimeout(() => {
          mockProcess.stderr.on.mock.calls.forEach(([event, callback]) => {
            if (event === 'data') callback(Buffer.from('tar: error'));
          });
          mockProcess.on.mock.calls.forEach(([event, callback]) => {
            if (event === 'close') callback(1);
          });
        }, 10);

        return mockProcess;
      });

      await expect(backupService.createFullBackup()).rejects.toThrow();
    });

    test('should validate backup integrity during creation', async () => {
      await backupService.initialize();

      const backup = await backupService.createFullBackup();

      // Verify backup integrity was checked
      expect(backup.checksum).toBeTruthy();
      expect(backup.size).toBeGreaterThan(0);
    });
  });

  describe('Backup Verification Tests', () => {
    test('should verify backup integrity successfully', async () => {
      await backupService.initialize();
      await backupVerification.initialize();

      // Create a backup to verify
      const backup = await backupService.createFullBackup();

      const verification = await backupVerification.verifyBackupIntegrity(backup.backupPath);

      expect(verification.valid).toBe(true);
      expect(verification.checks.metadata.valid).toBe(true);
      expect(verification.checks.fileIntegrity.valid).toBe(true);
      expect(verification.checks.completeness.valid).toBe(true);
    });

    test('should detect corrupted backup metadata', async () => {
      await backupService.initialize();
      await backupVerification.initialize();

      // Create a backup
      const backup = await backupService.createFullBackup();

      // Corrupt the metadata
      const metadataPath = path.join(backup.backupPath, 'metadata.json');
      await fs.writeFile(metadataPath, 'invalid json');

      await expect(backupVerification.verifyBackupIntegrity(backup.backupPath))
        .rejects.toThrow(/Failed to load backup metadata/);
    });

    test('should detect missing backup files', async () => {
      await backupService.initialize();
      await backupVerification.initialize();

      // Create a backup
      const backup = await backupService.createFullBackup();

      // Remove the backup file
      const backupFile = path.join(backup.backupPath, 'orthanc-db.tar.gz');
      await fs.unlink(backupFile);

      // Don't use the mocked verification for this test
      backupService.verifyBackupIntegrity = BackupService.prototype.verifyBackupIntegrity;

      await expect(backupVerification.verifyBackupIntegrity(backup.backupPath))
        .rejects.toThrow(/File integrity check failed.*Backup file not found/);
    });

    test('should verify all backups and generate report', async () => {
      await backupService.initialize();
      await backupVerification.initialize();

      // Create multiple backups
      const backup1 = await backupService.createFullBackup();
      await new Promise(resolve => setTimeout(resolve, 100));
      const backup2 = await backupService.createIncrementalBackup();

      const report = await backupVerification.verifyAllBackups();

      expect(report.summary.totalBackups).toBe(2);
      expect(report.summary.validBackups).toBe(2);
      expect(report.summary.invalidBackups).toBe(0);
      expect(report.summary.validityRate).toBe('100.00');
      expect(report.results).toHaveLength(2);
    });

    test('should perform restore test with RTO/RPO validation', async () => {
      await backupService.initialize();
      await backupVerification.initialize();

      // Create a small backup for restore testing
      const backup = await backupService.createFullBackup();

      // Mock the backup to be small enough for restore testing
      const metadata = JSON.parse(await fs.readFile(path.join(backup.backupPath, 'metadata.json'), 'utf8'));
      metadata.size = 1024; // 1KB - small enough for testing
      await fs.writeFile(path.join(backup.backupPath, 'metadata.json'), JSON.stringify(metadata, null, 2));

      // Create the actual backup file for the test
      const backupFile = path.join(backup.backupPath, 'orthanc-db.tar.gz');
      await fs.writeFile(backupFile, 'mock-backup-data');

      // Mock the extraction to succeed
      const originalExtractBackup = backupVerification.extractBackup;
      backupVerification.extractBackup = jest.fn().mockResolvedValue('/mock/extract/path');
      
      const originalVerifyExtractedData = backupVerification.verifyExtractedData;
      backupVerification.verifyExtractedData = jest.fn().mockResolvedValue({
        valid: true,
        size: 100,
        fileCount: 2
      });

      const originalSimulateDatabaseRestore = backupVerification.simulateDatabaseRestore;
      backupVerification.simulateDatabaseRestore = jest.fn().mockResolvedValue({
        success: true,
        dbFiles: 1
      });

      try {
        const restoreTest = await backupVerification.testRestore(backup.backupPath, metadata);

        expect(restoreTest.success).toBe(true);
        expect(restoreTest.skipped).toBe(false);
        expect(restoreTest.duration).toBeGreaterThan(0);
        expect(typeof restoreTest.rtoCompliant).toBe('boolean');
        expect(typeof restoreTest.rpoCompliant).toBe('boolean');
      } finally {
        // Restore original methods
        backupVerification.extractBackup = originalExtractBackup;
        backupVerification.verifyExtractedData = originalVerifyExtractedData;
        backupVerification.simulateDatabaseRestore = originalSimulateDatabaseRestore;
      }
    });
  });

  describe('Backup Retention Tests', () => {
    test('should enforce retention policy and remove old backups', async () => {
      await backupVerification.initialize();

      // Create mock backup metadata
      const oldTimestamp = new Date();
      oldTimestamp.setDate(oldTimestamp.getDate() - (testConfig.retentionDays + 1));
      
      const recentTimestamp = new Date();

      const oldBackupMetadata = {
        backupId: 'old-backup-123',
        type: 'full',
        timestamp: oldTimestamp.toISOString(),
        size: 20,
        checksum: 'mock-checksum'
      };

      const recentBackupMetadata = {
        backupId: 'recent-backup-456',
        type: 'full',
        timestamp: recentTimestamp.toISOString(),
        size: 20,
        checksum: 'mock-checksum'
      };

      // Mock the discoverBackups method to return our test backups
      const originalDiscoverBackups = backupVerification.discoverBackups;
      backupVerification.discoverBackups = jest.fn().mockResolvedValue([
        {
          path: '/mock/old/backup/path',
          metadata: oldBackupMetadata,
          type: 'full'
        },
        {
          path: '/mock/recent/backup/path',
          metadata: recentBackupMetadata,
          type: 'full'
        }
      ]);

      // Mock the getBackupSize method
      const originalGetBackupSize = backupVerification.getBackupSize;
      backupVerification.getBackupSize = jest.fn().mockResolvedValue(1024);

      // Mock fs.rm to simulate successful removal
      const originalFsRm = fs.rm;
      fs.rm = jest.fn().mockResolvedValue();

      try {
        const retentionResult = await backupVerification.enforceRetentionPolicy();

        expect(retentionResult.removedCount).toBe(1);
        expect(retentionResult.retentionDays).toBe(testConfig.retentionDays);
        expect(retentionResult.totalSizeRemoved).toBe(1024);

        // Verify the removal was attempted for the old backup
        expect(fs.rm).toHaveBeenCalledWith('/mock/old/backup/path', { recursive: true, force: true });
      } finally {
        backupVerification.discoverBackups = originalDiscoverBackups;
        backupVerification.getBackupSize = originalGetBackupSize;
        fs.rm = originalFsRm;
      }
    });

    test('should not remove backups within retention period', async () => {
      await backupService.initialize();
      await backupVerification.initialize();

      // Create recent backup
      const backup = await backupService.createFullBackup();

      const retentionResult = await backupVerification.enforceRetentionPolicy();

      expect(retentionResult.removedCount).toBe(0);

      // Verify backup still exists
      const backupExists = await fs.access(backup.backupPath).then(() => true).catch(() => false);
      expect(backupExists).toBe(true);
    });

    test('should handle retention policy errors gracefully', async () => {
      await backupVerification.initialize();

      // Mock fs.rm to fail
      const originalRm = fs.rm;
      fs.rm = jest.fn().mockRejectedValue(new Error('Permission denied'));

      try {
        const retentionResult = await backupVerification.enforceRetentionPolicy();
        expect(retentionResult.removedCount).toBe(0);
      } finally {
        fs.rm = originalRm;
      }
    });
  });

  describe('Disaster Recovery Tests', () => {
    test('should execute complete disaster recovery procedure', async () => {
      await disasterRecovery.initialize();

      // Create a backup to recover from
      await backupService.initialize();
      const backup = await backupService.createFullBackup();

      // Mock service management commands
      mockServiceCommands();

      const recoveryResult = await disasterRecovery.executeDisasterRecovery({
        backupId: backup.backupId
      });

      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.recoveryId).toBeTruthy();
      expect(recoveryResult.duration).toBeGreaterThan(0);
      expect(recoveryResult.checkpoints).toHaveLength(9); // All phases completed
      expect(typeof recoveryResult.rtoCompliant).toBe('boolean');
    });

    test('should validate RTO compliance during recovery', async () => {
      await disasterRecovery.initialize();

      // Create a backup
      await backupService.initialize();
      const backup = await backupService.createFullBackup();

      // Mock service commands with delays to test RTO
      mockServiceCommands(100); // Add 100ms delay to each operation

      const recoveryResult = await disasterRecovery.executeDisasterRecovery({
        backupId: backup.backupId
      });

      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.duration).toBeGreaterThan(0);
      
      // Check if recovery time meets RTO target (30 minutes = 1,800,000 ms)
      const rtoTargetMs = testConfig.rtoTargetMinutes * 60 * 1000;
      expect(recoveryResult.rtoCompliant).toBe(recoveryResult.duration <= rtoTargetMs);
    });

    test('should validate RPO compliance during backup selection', async () => {
      await disasterRecovery.initialize();

      // Create a backup with known timestamp
      await backupService.initialize();
      const backup = await backupService.createFullBackup();

      // Modify backup timestamp to test RPO compliance
      const metadataPath = path.join(backup.backupPath, 'metadata.json');
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
      
      // Set backup timestamp to be within RPO target
      const recentTimestamp = new Date();
      recentTimestamp.setMinutes(recentTimestamp.getMinutes() - 30); // 30 minutes ago
      metadata.timestamp = recentTimestamp.toISOString();
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      mockServiceCommands();

      const recoveryResult = await disasterRecovery.executeDisasterRecovery({
        backupId: backup.backupId
      });

      expect(recoveryResult.success).toBe(true);
      
      // Find the backup selection checkpoint
      const backupSelectionCheckpoint = recoveryResult.checkpoints.find(
        cp => cp.phase === 'backup-selection'
      );
      expect(backupSelectionCheckpoint.result.rpoCompliant).toBe(true);
    });

    test('should handle disaster recovery failure and execute rollback', async () => {
      await disasterRecovery.initialize();

      // Create a backup
      await backupService.initialize();
      const backup = await backupService.createFullBackup();

      // Clear previous mock calls
      spawn.mockClear();

      // Mock service commands to fail during service restart
      mockServiceCommands(0, true); // Fail service operations

      await expect(disasterRecovery.executeDisasterRecovery({
        backupId: backup.backupId
      })).rejects.toThrow();

      // Verify rollback was attempted - check for any systemctl command (stop or start)
      const systemctlCalls = spawn.mock.calls.filter(call => 
        call[0] === 'systemctl'
      );
      expect(systemctlCalls.length).toBeGreaterThan(0);
    });

    test('should assess disaster situation correctly', async () => {
      await disasterRecovery.initialize();

      // Create a backup for assessment
      await backupService.initialize();
      await backupService.createFullBackup();

      mockServiceCommands();

      // Execute just the assessment phase
      const assessment = await disasterRecovery.assessDisasterSituation();

      expect(assessment).toMatchObject({
        timestamp: expect.any(String),
        services: expect.any(Object),
        database: expect.any(Object),
        backups: expect.any(Object),
        network: expect.any(Object)
      });

      expect(assessment.services.orthanc).toBeDefined();
      expect(assessment.services.bridge).toBeDefined();
      expect(assessment.database.accessible).toBeDefined();
      expect(assessment.backups.available).toBeGreaterThan(0);
    });

    test('should validate recovered system functionality', async () => {
      await disasterRecovery.initialize();

      // Mock validation methods to return successful results
      disasterRecovery.validateOrthancFunctionality = jest.fn().mockResolvedValue({ valid: true });
      disasterRecovery.validateBridgeFunctionality = jest.fn().mockResolvedValue({ valid: true });
      disasterRecovery.validateDatabaseFunctionality = jest.fn().mockResolvedValue({ valid: true });
      disasterRecovery.validateConnectivity = jest.fn().mockResolvedValue({ valid: true });

      const validation = await disasterRecovery.validateRecoveredSystem();

      expect(validation.orthanc.valid).toBe(true);
      expect(validation.bridge.valid).toBe(true);
      expect(validation.database.valid).toBe(true);
      expect(validation.connectivity.valid).toBe(true);
    });

    test('should handle system validation failures', async () => {
      await disasterRecovery.initialize();

      // Mock validation methods to return failures
      disasterRecovery.validateOrthancFunctionality = jest.fn().mockResolvedValue({ 
        valid: false, 
        error: 'Orthanc not responding' 
      });
      disasterRecovery.validateBridgeFunctionality = jest.fn().mockResolvedValue({ valid: true });
      disasterRecovery.validateDatabaseFunctionality = jest.fn().mockResolvedValue({ valid: true });
      disasterRecovery.validateConnectivity = jest.fn().mockResolvedValue({ valid: true });

      await expect(disasterRecovery.validateRecoveredSystem())
        .rejects.toThrow(/System validation failed.*Orthanc not responding/);
    });
  });

  describe('Service Integration Tests', () => {
    test('should start and stop backup service correctly', async () => {
      expect(backupService.isRunning).toBe(false);

      await backupService.start();
      expect(backupService.isRunning).toBe(true);

      await backupService.stop();
      expect(backupService.isRunning).toBe(false);
    });

    test('should start and stop backup verification service correctly', async () => {
      expect(backupVerification.isRunning).toBe(false);

      await backupVerification.start();
      expect(backupVerification.isRunning).toBe(true);

      await backupVerification.stop();
      expect(backupVerification.isRunning).toBe(false);
    });

    test('should get service status information', async () => {
      const backupStatus = backupService.getStatus();
      expect(backupStatus).toMatchObject({
        isRunning: expect.any(Boolean),
        scheduledJobs: expect.any(Array),
        config: expect.any(Object)
      });

      const verificationStatus = backupVerification.getStatus();
      expect(verificationStatus).toMatchObject({
        isRunning: expect.any(Boolean),
        verificationCount: expect.any(Number),
        config: expect.any(Object)
      });

      const recoveryStatus = disasterRecovery.getStatus();
      expect(recoveryStatus).toMatchObject({
        isRecovering: expect.any(Boolean),
        config: expect.any(Object)
      });
    });
  });

  // Helper functions
  async function createMockOrthancDatabase() {
    // Create mock database files
    const dbFiles = [
      'orthanc.db',
      'orthanc.db-shm',
      'orthanc.db-wal',
      'index'
    ];

    for (const file of dbFiles) {
      const filePath = path.join(testPaths.orthancDb, file);
      await fs.writeFile(filePath, `mock-${file}-content-${Date.now()}`);
    }
  }

  async function clearTestDirectories() {
    for (const testPath of Object.values(testPaths)) {
      try {
        const files = await fs.readdir(testPath);
        for (const file of files) {
          const filePath = path.join(testPath, file);
          const stats = await fs.stat(filePath);
          if (stats.isDirectory()) {
            await fs.rm(filePath, { recursive: true, force: true });
          } else {
            await fs.unlink(filePath);
          }
        }
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  }

  function mockServiceCommands(delay = 0, shouldFail = false) {
    const originalSpawn = spawn;
    
    spawn.mockImplementation((command, args) => {
      const mockProcess = {
        on: jest.fn(),
        stderr: { on: jest.fn() }
      };

      setTimeout(() => {
        if (command === 'systemctl') {
          const exitCode = shouldFail ? 1 : 0;
          mockProcess.on.mock.calls.forEach(([event, callback]) => {
            if (event === 'close') callback(exitCode);
          });
        } else if (command === 'tar') {
          // Handle tar commands for backup/restore operations
          if (args.includes('-czf')) {
            // Create backup
            const outputFile = args[args.indexOf('-czf') + 1];
            fs.writeFile(outputFile, 'mock-compressed-data').catch(() => {});
          } else if (args.includes('-xzf')) {
            // Extract backup - create some mock extracted files
            const extractDir = args[args.indexOf('-C') + 1];
            fs.mkdir(extractDir, { recursive: true })
              .then(() => fs.writeFile(path.join(extractDir, 'orthanc.db'), 'mock-db-content'))
              .catch(() => {});
          }
          
          const exitCode = shouldFail ? 1 : 0;
          mockProcess.on.mock.calls.forEach(([event, callback]) => {
            if (event === 'close') callback(exitCode);
          });
        }
      }, delay);

      return mockProcess;
    });
  }
});