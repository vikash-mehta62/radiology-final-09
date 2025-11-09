const { MigrationValidationService, getMigrationValidationService } = require('../../src/services/migration-validation-service');
const { getOrthancPreviewClient } = require('../../src/services/orthanc-preview-client');
const { getDICOMMigrationService } = require('../../src/services/dicom-migration-service');
const { getMetricsCollector } = require('../../src/services/metrics-collector');

// Mock dependencies
jest.mock('../../src/services/orthanc-preview-client');
jest.mock('../../src/services/dicom-migration-service');
jest.mock('../../src/services/metrics-collector');

describe('MigrationValidationService', () => {
  let validationService;
  let mockOrthancClient;
  let mockMigrationService;
  let mockMetricsCollector;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Orthanc client
    mockOrthancClient = {
      testConnection: jest.fn(),
      generatePreview: jest.fn(),
      checkCompressionSupport: jest.fn(),
      axiosInstance: {
        get: jest.fn()
      },
      config: {
        orthancUrl: 'http://test-orthanc:8042'
      }
    };
    getOrthancPreviewClient.mockReturnValue(mockOrthancClient);
    
    // Mock migration service
    mockMigrationService = {
      shouldUseOrthancPreview: jest.fn(),
      updateConfig: jest.fn(),
      config: {
        enableOrthancPreview: true,
        migrationPercentage: 100
      }
    };
    getDICOMMigrationService.mockReturnValue(mockMigrationService);
    
    // Mock metrics collector
    mockMetricsCollector = {
      startTimer: jest.fn().mockReturnValue({ end: jest.fn() }),
      recordInstanceProcessing: jest.fn()
    };
    getMetricsCollector.mockReturnValue(mockMetricsCollector);
    
    // Create service instance
    validationService = new MigrationValidationService({
      validationTimeout: 5000,
      maxRetries: 2,
      performanceThreshold: 3000
    });
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const defaultService = new MigrationValidationService();
      
      expect(defaultService.config.validationTimeout).toBe(30000);
      expect(defaultService.config.maxRetries).toBe(3);
      expect(defaultService.config.performanceThreshold).toBe(5000);
      expect(defaultService.config.compressionTestSyntaxes).toContain('1.2.840.10008.1.2.4.50');
    });

    it('should initialize with custom configuration', () => {
      expect(validationService.config.validationTimeout).toBe(5000);
      expect(validationService.config.maxRetries).toBe(2);
      expect(validationService.config.performanceThreshold).toBe(3000);
    });
  });

  describe('testOrthancConnectivity', () => {
    it('should pass when Orthanc is fully accessible', async () => {
      mockOrthancClient.testConnection.mockResolvedValue(true);
      mockOrthancClient.axiosInstance.get
        .mockResolvedValueOnce({ data: { Version: '1.9.7' } }) // /system
        .mockResolvedValueOnce({ data: ['instance1', 'instance2'] }); // /instances

      const result = await validationService.testOrthancConnectivity();

      expect(result.status).toBe('passed');
      expect(result.score).toBe(100);
      expect(result.details.basicConnectivity.success).toBe(true);
      expect(result.details.systemInfo.success).toBe(true);
      expect(result.details.instanceListing.success).toBe(true);
    });

    it('should fail when Orthanc is not accessible', async () => {
      mockOrthancClient.testConnection.mockResolvedValue(false);

      const result = await validationService.testOrthancConnectivity();

      expect(result.status).toBe('failed');
      expect(result.score).toBe(0);
      expect(result.error).toContain('Orthanc server is not accessible');
    });

    it('should handle partial connectivity issues', async () => {
      mockOrthancClient.testConnection.mockResolvedValue(true);
      mockOrthancClient.axiosInstance.get
        .mockResolvedValueOnce({ data: { Version: '1.9.7' } }) // /system works
        .mockRejectedValueOnce(new Error('Instance listing failed')); // /instances fails

      const result = await validationService.testOrthancConnectivity();

      expect(result.status).toBe('passed');
      expect(result.details.systemInfo.success).toBe(true);
      expect(result.details.instanceListing.success).toBe(false);
    });
  });

  describe('testCompressionSupport', () => {
    const mockTestInstances = [
      { _id: 'inst1', orthancInstanceId: 'orthanc-1' }
    ];

    it('should test all compression syntaxes', async () => {
      jest.spyOn(validationService, 'testCompressionSyntax').mockResolvedValue({
        success: true,
        compressionInfo: { isCompressed: true },
        previewGenerated: true,
        duration: 100
      });

      const result = await validationService.testCompressionSupport(mockTestInstances);

      expect(result.status).toBe('passed');
      expect(result.score).toBe(100);
      expect(Object.keys(result.syntaxResults)).toContain('1.2.840.10008.1.2.4.50');
      expect(Object.keys(result.syntaxResults)).toContain('uncompressed');
    });

    it('should handle mixed success/failure results', async () => {
      jest.spyOn(validationService, 'testCompressionSyntax')
        .mockResolvedValueOnce({ success: true }) // First syntax passes
        .mockResolvedValueOnce({ success: false, error: 'Test error' }) // Second fails
        .mockResolvedValue({ success: true }); // Rest pass

      const result = await validationService.testCompressionSupport(mockTestInstances);

      expect(result.status).toBe('passed'); // Should still pass with 80%+ success rate
      expect(result.details.summary.failedTests).toBeGreaterThan(0);
    });
  });

  describe('testCompressionSyntax', () => {
    const mockTestInstances = [
      { _id: 'inst1', orthancInstanceId: 'orthanc-1' }
    ];

    it('should successfully test compression syntax', async () => {
      jest.spyOn(validationService, 'findTestInstanceWithSyntax').mockResolvedValue(mockTestInstances[0]);
      mockOrthancClient.checkCompressionSupport.mockResolvedValue({
        isCompressed: true,
        transferSyntax: '1.2.840.10008.1.2.4.50',
        compressionType: 'JPEG Baseline'
      });
      mockOrthancClient.generatePreview.mockResolvedValue(Buffer.alloc(1024));

      const result = await validationService.testCompressionSyntax('1.2.840.10008.1.2.4.50', mockTestInstances);

      expect(result.success).toBe(true);
      expect(result.compressionInfo.isCompressed).toBe(true);
      expect(result.previewGenerated).toBe(true);
      expect(typeof result.duration).toBe('number');
    });

    it('should handle missing test instance', async () => {
      jest.spyOn(validationService, 'findTestInstanceWithSyntax').mockResolvedValue(null);

      const result = await validationService.testCompressionSyntax('1.2.840.10008.1.2.4.50', []);

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.error).toContain('No test instance available');
    });

    it('should handle preview generation errors', async () => {
      jest.spyOn(validationService, 'findTestInstanceWithSyntax').mockResolvedValue(mockTestInstances[0]);
      mockOrthancClient.checkCompressionSupport.mockResolvedValue({ isCompressed: true });
      mockOrthancClient.generatePreview.mockRejectedValue(new Error('Preview generation failed'));

      const result = await validationService.testCompressionSyntax('1.2.840.10008.1.2.4.50', mockTestInstances);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Preview generation failed');
    });
  });

  describe('testFeatureFlags', () => {
    it('should test all feature flag scenarios', async () => {
      // Mock the shouldUseOrthancPreview calls in the expected order
      mockMigrationService.shouldUseOrthancPreview
        .mockReturnValueOnce(false) // globalDisable test
        .mockReturnValueOnce(false) // zeroPercent test  
        .mockReturnValueOnce(true)  // fullMigration test
        .mockReturnValueOnce(false); // instanceOverride test

      const result = await validationService.testFeatureFlags([]);

      expect(result.status).toBe('passed');
      expect(result.score).toBe(100);
      expect(result.flagTests.globalDisable.passed).toBe(true);
      expect(result.flagTests.zeroPercent.passed).toBe(true);
      expect(result.flagTests.fullMigration.passed).toBe(true);
      expect(result.flagTests.instanceOverride.passed).toBe(true);
    });

    it('should handle feature flag test failures', async () => {
      // Mock shouldUseOrthancPreview to return unexpected values
      mockMigrationService.shouldUseOrthancPreview
        .mockReturnValueOnce(true)  // Should be false when disabled
        .mockReturnValueOnce(false) // Correct
        .mockReturnValueOnce(true)  // Correct
        .mockReturnValueOnce(true); // Should be false with instance override

      const result = await validationService.testFeatureFlags([]);

      expect(result.score).toBeLessThan(100);
      expect(result.flagTests.globalDisable.passed).toBe(false);
      expect(result.flagTests.instanceOverride.passed).toBe(false);
    });
  });

  describe('testMigrationRollback', () => {
    it('should successfully test rollback functionality', async () => {
      const result = await validationService.testMigrationRollback([]);

      expect(result.status).toBe('passed');
      expect(result.score).toBe(100);
      expect(result.details.rollbackTest.success).toBe(true);
      expect(result.details.configRestore.success).toBe(true);
    });
  });

  describe('testErrorHandling', () => {
    it('should test error handling scenarios', async () => {
      mockOrthancClient.generatePreview
        .mockRejectedValueOnce(new Error('Invalid instance ID')) // Test 1
        .mockResolvedValueOnce(Buffer.alloc(256)) // Test 2 - fallback
        .mockRejectedValueOnce(new Error('Invalid frame index')); // Test 3

      const result = await validationService.testErrorHandling([]);

      expect(result.status).toBe('passed');
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.errorTests.invalidInstanceId.success).toBe(true);
      expect(result.errorTests.networkErrorFallback.success).toBe(true);
      expect(result.errorTests.invalidFrameIndex.success).toBe(true);
    });
  });

  describe('runValidation', () => {
    it('should run comprehensive validation successfully', async () => {
      // Mock all test methods to return successful results
      jest.spyOn(validationService, 'testOrthancConnectivity').mockResolvedValue({
        status: 'passed', score: 100
      });
      jest.spyOn(validationService, 'testCompressionSupport').mockResolvedValue({
        status: 'passed', score: 100
      });
      jest.spyOn(validationService, 'testFeatureFlags').mockResolvedValue({
        status: 'passed', score: 100
      });
      jest.spyOn(validationService, 'testMigrationRollback').mockResolvedValue({
        status: 'passed', score: 100
      });
      jest.spyOn(validationService, 'testErrorHandling').mockResolvedValue({
        status: 'passed', score: 100
      });

      const result = await validationService.runValidation({});

      expect(result.overall.status).toBe('passed');
      expect(result.overall.score).toBe(100);
      expect(result.validationId).toBeDefined();
      expect(result.tests.connectivity).toBeDefined();
      expect(result.tests.compressionSupport).toBeDefined();
      expect(result.tests.featureFlags).toBeDefined();
      expect(result.tests.rollback).toBeDefined();
      expect(result.tests.errorHandling).toBeDefined();
    });

    it('should handle validation failures gracefully', async () => {
      jest.spyOn(validationService, 'testOrthancConnectivity').mockRejectedValue(new Error('Validation error'));

      const result = await validationService.runValidation({});

      expect(result.overall.status).toBe('failed');
      expect(result.overall.score).toBe(0);
      expect(result.overall.error).toBe('Validation error');
    });
  });

  describe('singleton factory', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = getMigrationValidationService();
      const instance2 = getMigrationValidationService();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(MigrationValidationService);
    });
  });
});