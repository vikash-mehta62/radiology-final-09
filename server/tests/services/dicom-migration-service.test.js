const { DICOMMigrationService, getDICOMMigrationService } = require('../../src/services/dicom-migration-service');
const { getOrthancPreviewClient } = require('../../src/services/orthanc-preview-client');
const { getMetricsCollector } = require('../../src/services/metrics-collector');
const Instance = require('../../src/models/Instance');

// Mock dependencies
jest.mock('../../src/services/orthanc-preview-client');
jest.mock('../../src/services/metrics-collector');
jest.mock('../../src/models/Instance');

describe('DICOMMigrationService', () => {
  let migrationService;
  let mockOrthancClient;
  let mockMetricsCollector;
  let mockTimer;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock timer
    mockTimer = { end: jest.fn() };
    
    // Mock metrics collector
    mockMetricsCollector = {
      startTimer: jest.fn().mockReturnValue(mockTimer),
      recordInstanceProcessing: jest.fn(),
      recordMigrationRequest: jest.fn(),
      recordMigrationPerformance: jest.fn()
    };
    getMetricsCollector.mockReturnValue(mockMetricsCollector);
    
    // Mock Orthanc client
    mockOrthancClient = {
      generatePreview: jest.fn(),
      getInstanceMetadata: jest.fn(),
      axiosInstance: {
        post: jest.fn()
      }
    };
    getOrthancPreviewClient.mockReturnValue(mockOrthancClient);
    
    // Create service instance
    migrationService = new DICOMMigrationService({
      enableOrthancPreview: true,
      migrationPercentage: 100,
      enablePerformanceComparison: false
    });
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const defaultService = new DICOMMigrationService();
      
      expect(defaultService.config.enableOrthancPreview).toBe(true);
      expect(defaultService.config.migrationPercentage).toBe(100);
      expect(defaultService.config.performanceThreshold).toBe(5000);
      expect(defaultService.config.enablePerformanceComparison).toBe(false);
    });

    it('should initialize with custom configuration', () => {
      const customService = new DICOMMigrationService({
        enableOrthancPreview: false,
        migrationPercentage: 50,
        performanceThreshold: 3000,
        enablePerformanceComparison: true
      });
      
      expect(customService.config.enableOrthancPreview).toBe(false);
      expect(customService.config.migrationPercentage).toBe(50);
      expect(customService.config.performanceThreshold).toBe(3000);
      expect(customService.config.enablePerformanceComparison).toBe(true);
    });
  });

  describe('shouldUseOrthancPreview', () => {
    it('should return false when Orthanc preview is disabled', () => {
      migrationService.config.enableOrthancPreview = false;
      
      const result = migrationService.shouldUseOrthancPreview();
      
      expect(result).toBe(false);
    });

    it('should return true when migration percentage is 100%', () => {
      migrationService.config.migrationPercentage = 100;
      
      const result = migrationService.shouldUseOrthancPreview();
      
      expect(result).toBe(true);
    });

    it('should respect instance-specific flag', () => {
      const context = {
        instance: { useOrthancPreview: false }
      };
      
      const result = migrationService.shouldUseOrthancPreview(context);
      
      expect(result).toBe(false);
    });

    it('should handle migration percentage correctly', () => {
      migrationService.config.migrationPercentage = 0;
      
      // Mock Math.random to return 0.5 (50%)
      jest.spyOn(Math, 'random').mockReturnValue(0.5);
      
      const result = migrationService.shouldUseOrthancPreview();
      
      expect(result).toBe(false);
      
      Math.random.mockRestore();
    });
  });

  describe('getFrameWithMigration', () => {
    let mockReq, mockRes, mockNodeFallback;

    beforeEach(() => {
      mockReq = {
        params: { studyUid: 'test-study', frameIndex: '0' },
        query: {}
      };
      mockRes = {
        setHeader: jest.fn(),
        end: jest.fn()
      };
      mockNodeFallback = jest.fn().mockResolvedValue('node-result');
    });

    it('should use Orthanc when shouldUseOrthancPreview returns true', async () => {
      jest.spyOn(migrationService, 'shouldUseOrthancPreview').mockReturnValue(true);
      jest.spyOn(migrationService, 'getFrameWithOrthanc').mockResolvedValue('orthanc-result');

      const result = await migrationService.getFrameWithMigration(mockReq, mockRes, mockNodeFallback);

      expect(migrationService.getFrameWithOrthanc).toHaveBeenCalledWith(mockReq, mockRes, mockNodeFallback);
      expect(mockNodeFallback).not.toHaveBeenCalled();
      expect(result).toBe('orthanc-result');
    });

    it('should use Node fallback when shouldUseOrthancPreview returns false', async () => {
      jest.spyOn(migrationService, 'shouldUseOrthancPreview').mockReturnValue(false);

      const result = await migrationService.getFrameWithMigration(mockReq, mockRes, mockNodeFallback);

      expect(mockNodeFallback).toHaveBeenCalledWith(mockReq, mockRes);
      expect(mockMetricsCollector.recordInstanceProcessing).toHaveBeenCalledWith('migration_routing', 'node_selected');
      expect(result).toBe('node-result');
    });

    it('should fallback to Node when Orthanc fails', async () => {
      jest.spyOn(migrationService, 'shouldUseOrthancPreview').mockReturnValue(true);
      jest.spyOn(migrationService, 'getFrameWithOrthanc').mockRejectedValue(new Error('Orthanc error'));

      const result = await migrationService.getFrameWithMigration(mockReq, mockRes, mockNodeFallback);

      expect(mockNodeFallback).toHaveBeenCalledWith(mockReq, mockRes);
      expect(mockMetricsCollector.recordInstanceProcessing).toHaveBeenCalledWith('orthanc_fallback', 'fallback_to_node');
      expect(result).toBe('node-result');
    });
  });

  describe('mapGlobalIndexToOrthancInstance', () => {
    it('should map frame index to correct Orthanc instance', async () => {
      const instances = [
        { _id: 'inst1', instanceNumber: 1, orthancInstanceId: 'orthanc-1' },
        { _id: 'inst2', instanceNumber: 2, orthancInstanceId: 'orthanc-2' }
      ];

      mockOrthancClient.getInstanceMetadata
        .mockResolvedValueOnce({ NumberOfFrames: 5 })
        .mockResolvedValueOnce({ NumberOfFrames: 3 });

      const result = await migrationService.mapGlobalIndexToOrthancInstance(instances, 6);

      expect(result).toEqual({
        orthancInstanceId: 'orthanc-2',
        localFrameIndex: 1,
        instance: instances[1]
      });
    });

    it('should resolve Orthanc instance ID when missing', async () => {
      const instances = [
        { _id: 'inst1', instanceNumber: 1, sopInstanceUID: 'sop-1' }
      ];

      jest.spyOn(migrationService, 'resolveOrthancInstanceId').mockResolvedValue('orthanc-resolved');
      mockOrthancClient.getInstanceMetadata.mockResolvedValue({ NumberOfFrames: 1 });
      Instance.updateOne.mockResolvedValue({});

      const result = await migrationService.mapGlobalIndexToOrthancInstance(instances, 0);

      expect(migrationService.resolveOrthancInstanceId).toHaveBeenCalledWith('sop-1');
      expect(Instance.updateOne).toHaveBeenCalledWith(
        { _id: 'inst1' },
        { $set: { orthancInstanceId: 'orthanc-resolved' } }
      );
      expect(result.orthancInstanceId).toBe('orthanc-resolved');
    });

    it('should skip instances that cannot be resolved', async () => {
      const instances = [
        { _id: 'inst1', instanceNumber: 1, sopInstanceUID: 'sop-1' },
        { _id: 'inst2', instanceNumber: 2, orthancInstanceId: 'orthanc-2' }
      ];

      jest.spyOn(migrationService, 'resolveOrthancInstanceId').mockResolvedValue(null);
      mockOrthancClient.getInstanceMetadata.mockResolvedValue({ NumberOfFrames: 1 });

      const result = await migrationService.mapGlobalIndexToOrthancInstance(instances, 0);

      expect(result).toEqual({
        orthancInstanceId: 'orthanc-2',
        localFrameIndex: 0,
        instance: instances[1]
      });
    });
  });

  describe('resolveOrthancInstanceId', () => {
    it('should resolve instance ID from SOP Instance UID', async () => {
      mockOrthancClient.axiosInstance.post.mockResolvedValue({
        data: ['orthanc-instance-id']
      });

      const result = await migrationService.resolveOrthancInstanceId('test-sop-uid');

      expect(mockOrthancClient.axiosInstance.post).toHaveBeenCalledWith('/tools/find', {
        Level: 'Instance',
        Query: {
          SOPInstanceUID: 'test-sop-uid'
        }
      });
      expect(result).toBe('orthanc-instance-id');
    });

    it('should return null when no instances found', async () => {
      mockOrthancClient.axiosInstance.post.mockResolvedValue({
        data: []
      });

      const result = await migrationService.resolveOrthancInstanceId('test-sop-uid');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockOrthancClient.axiosInstance.post.mockRejectedValue(new Error('Network error'));

      const result = await migrationService.resolveOrthancInstanceId('test-sop-uid');

      expect(result).toBeNull();
    });
  });

  describe('getMigrationStats', () => {
    it('should return current migration statistics', () => {
      const stats = migrationService.getMigrationStats();

      expect(stats).toEqual({
        config: {
          enableOrthancPreview: true,
          migrationPercentage: 100,
          performanceThreshold: 5000
        },
        timestamp: expect.any(String)
      });
    });
  });

  describe('updateConfig', () => {
    it('should update migration configuration', () => {
      migrationService.updateConfig({
        migrationPercentage: 50,
        enablePerformanceComparison: true
      });

      expect(migrationService.config.migrationPercentage).toBe(50);
      expect(migrationService.config.enablePerformanceComparison).toBe(true);
      expect(migrationService.config.enableOrthancPreview).toBe(true); // Should remain unchanged
    });
  });

  describe('singleton factory', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = getDICOMMigrationService();
      const instance2 = getDICOMMigrationService();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(DICOMMigrationService);
    });
  });
});