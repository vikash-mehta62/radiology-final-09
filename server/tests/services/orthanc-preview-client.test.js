const axios = require('axios');
const { OrthancPreviewClient, getOrthancPreviewClient } = require('../../src/services/orthanc-preview-client');
const { getMetricsCollector } = require('../../src/services/metrics-collector');

// Mock dependencies
jest.mock('axios');
jest.mock('../../src/services/metrics-collector');

describe('OrthancPreviewClient', () => {
  let client;
  let mockAxiosInstance;
  let mockMetricsCollector;
  let mockTimer;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock timer
    mockTimer = { end: jest.fn() };
    
    // Mock metrics collector
    mockMetricsCollector = {
      startTimer: jest.fn().mockReturnValue(mockTimer),
      recordInstanceProcessing: jest.fn()
    };
    getMetricsCollector.mockReturnValue(mockMetricsCollector);
    
    // Mock axios instance
    mockAxiosInstance = {
      get: jest.fn()
    };
    axios.create.mockReturnValue(mockAxiosInstance);
    
    // Create client instance
    client = new OrthancPreviewClient({
      orthancUrl: 'http://test-orthanc:8042',
      orthancUsername: 'test-user',
      orthancPassword: 'test-pass',
      timeout: 5000,
      retryAttempts: 2,
      retryDelay: 100
    });
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const defaultClient = new OrthancPreviewClient();
      
      expect(defaultClient.config.orthancUrl).toBe('http://69.62.70.102:8042');
      expect(defaultClient.config.orthancUsername).toBe('orthanc');
      expect(defaultClient.config.orthancPassword).toBe('orthanc');
      expect(defaultClient.config.timeout).toBe(30000);
      expect(defaultClient.config.retryAttempts).toBe(3);
      expect(defaultClient.config.enableFallback).toBe(true);
    });

    it('should initialize with custom configuration', () => {
      expect(client.config.orthancUrl).toBe('http://test-orthanc:8042');
      expect(client.config.orthancUsername).toBe('test-user');
      expect(client.config.orthancPassword).toBe('test-pass');
      expect(client.config.timeout).toBe(5000);
      expect(client.config.retryAttempts).toBe(2);
    });

    it('should create axios instance with correct configuration', () => {
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'http://test-orthanc:8042',
        timeout: 5000,
        auth: {
          username: 'test-user',
          password: 'test-pass'
        }
      });
    });
  });

  describe('generatePreview', () => {
    it('should generate preview successfully for first frame', async () => {
      const mockPngBuffer = Buffer.from('mock-png-data');
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: mockPngBuffer
      });

      const result = await client.generatePreview('test-instance-id');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/instances/test-instance-id/preview',
        {
          responseType: 'arraybuffer',
          headers: { 'Accept': 'image/png' }
        }
      );
      expect(result).toEqual(mockPngBuffer);
      expect(mockMetricsCollector.recordInstanceProcessing).toHaveBeenCalledWith('preview_generation', 'success');
      expect(mockTimer.end).toHaveBeenCalledWith({ status: 'success' });
    });

    it('should generate preview successfully for specific frame', async () => {
      const mockPngBuffer = Buffer.from('mock-png-data');
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: mockPngBuffer
      });

      const result = await client.generatePreview('test-instance-id', 5);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/instances/test-instance-id/frames/5/preview',
        {
          responseType: 'arraybuffer',
          headers: { 'Accept': 'image/png' }
        }
      );
      expect(result).toEqual(mockPngBuffer);
    });

    it('should generate preview with quality option', async () => {
      const mockPngBuffer = Buffer.from('mock-png-data');
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: mockPngBuffer
      });

      await client.generatePreview('test-instance-id', 0, { quality: 80 });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/instances/test-instance-id/preview?quality=80',
        {
          responseType: 'arraybuffer',
          headers: { 'Accept': 'image/png' }
        }
      );
    });

    it('should throw error for invalid instanceId', async () => {
      await expect(client.generatePreview('')).rejects.toThrow('Invalid instanceId provided');
      await expect(client.generatePreview(null)).rejects.toThrow('Invalid instanceId provided');
      await expect(client.generatePreview(123)).rejects.toThrow('Invalid instanceId provided');
    });

    it('should throw error for invalid frameIndex', async () => {
      await expect(client.generatePreview('test-id', -1)).rejects.toThrow('Invalid frameIndex provided');
      await expect(client.generatePreview('test-id', 1.5)).rejects.toThrow('Invalid frameIndex provided');
    });

    it('should retry on server errors', async () => {
      mockAxiosInstance.get
        .mockRejectedValueOnce(new Error('Server error'))
        .mockResolvedValue({
          status: 200,
          data: Buffer.from('mock-png-data')
        });

      const result = await client.generatePreview('test-instance-id');

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
      expect(result).toEqual(Buffer.from('mock-png-data'));
    });

    it('should not retry on client errors', async () => {
      const clientError = new Error('Client error');
      clientError.response = { status: 404 };
      mockAxiosInstance.get.mockRejectedValue(clientError);

      await expect(client.generatePreview('test-instance-id')).rejects.toThrow('Client error');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
    });

    it('should generate fallback preview when Orthanc fails and fallback is enabled', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Orthanc error'));

      const result = await client.generatePreview('test-instance-id');

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
      expect(mockMetricsCollector.recordInstanceProcessing).toHaveBeenCalledWith('preview_generation', 'error');
    });

    it('should throw error when Orthanc fails and fallback is disabled', async () => {
      client.config.enableFallback = false;
      mockAxiosInstance.get.mockRejectedValue(new Error('Orthanc error'));

      await expect(client.generatePreview('test-instance-id')).rejects.toThrow('Failed to generate preview for instance test-instance-id: Orthanc error');
    });
  });

  describe('getInstanceMetadata', () => {
    it('should retrieve and parse instance metadata successfully', async () => {
      const mockOrthancTags = {
        StudyInstanceUID: '1.2.3.4.5',
        SeriesInstanceUID: '1.2.3.4.6',
        SOPInstanceUID: '1.2.3.4.7',
        TransferSyntaxUID: '1.2.840.10008.1.2.1',
        Rows: '512',
        Columns: '512',
        NumberOfFrames: '10',
        SamplesPerPixel: '1',
        BitsAllocated: '16',
        PhotometricInterpretation: 'MONOCHROME2'
      };

      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: mockOrthancTags
      });

      const result = await client.getInstanceMetadata('test-instance-id');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/instances/test-instance-id/simplified-tags');
      expect(result).toEqual({
        StudyInstanceUID: '1.2.3.4.5',
        SeriesInstanceUID: '1.2.3.4.6',
        SOPInstanceUID: '1.2.3.4.7',
        TransferSyntaxUID: '1.2.840.10008.1.2.1',
        Rows: 512,
        Columns: 512,
        NumberOfFrames: 10,
        SamplesPerPixel: 1,
        BitsAllocated: 16,
        BitsStored: 16,
        HighBit: 7,
        PixelRepresentation: 0,
        PhotometricInterpretation: 'MONOCHROME2',
        PlanarConfiguration: 0,
        WindowCenter: '',
        WindowWidth: '',
        RescaleIntercept: 0,
        RescaleSlope: 1,
        InstanceNumber: 1
      });
    });

    it('should handle metadata retrieval errors', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      await expect(client.getInstanceMetadata('test-instance-id')).rejects.toThrow('Failed to retrieve instance metadata: Network error');
      expect(mockTimer.end).toHaveBeenCalledWith({ status: 'error' });
    });
  });

  describe('checkCompressionSupport', () => {
    it('should identify compressed JPEG syntax', async () => {
      const mockMetadata = {
        TransferSyntaxUID: '1.2.840.10008.1.2.4.50' // JPEG Baseline
      };
      
      jest.spyOn(client, 'getInstanceMetadata').mockResolvedValue(mockMetadata);

      const result = await client.checkCompressionSupport('test-instance-id');

      expect(result).toEqual({
        isCompressed: true,
        transferSyntax: '1.2.840.10008.1.2.4.50',
        compressionType: 'JPEG Baseline',
        supported: true
      });
    });

    it('should identify uncompressed syntax', async () => {
      const mockMetadata = {
        TransferSyntaxUID: '1.2.840.10008.1.2.1' // Explicit VR Little Endian
      };
      
      jest.spyOn(client, 'getInstanceMetadata').mockResolvedValue(mockMetadata);

      const result = await client.checkCompressionSupport('test-instance-id');

      expect(result).toEqual({
        isCompressed: false,
        transferSyntax: '1.2.840.10008.1.2.1',
        compressionType: 'Uncompressed',
        supported: true
      });
    });

    it('should handle metadata errors gracefully', async () => {
      jest.spyOn(client, 'getInstanceMetadata').mockRejectedValue(new Error('Metadata error'));

      const result = await client.checkCompressionSupport('test-instance-id');

      expect(result).toEqual({
        isCompressed: false,
        transferSyntax: 'unknown',
        compressionType: 'unknown',
        supported: false,
        error: 'Metadata error'
      });
    });
  });

  describe('testConnection', () => {
    it('should return true for successful connection', async () => {
      mockAxiosInstance.get.mockResolvedValue({ status: 200 });

      const result = await client.testConnection();

      expect(result).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/system');
    });

    it('should return false for failed connection', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Connection failed'));

      const result = await client.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('singleton factory', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = getOrthancPreviewClient();
      const instance2 = getOrthancPreviewClient();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(OrthancPreviewClient);
    });
  });

  describe('compression detection', () => {
    it('should correctly identify all supported compressed syntaxes', () => {
      const compressedSyntaxes = [
        '1.2.840.10008.1.2.4.50',  // JPEG Baseline
        '1.2.840.10008.1.2.4.51',  // JPEG Extended
        '1.2.840.10008.1.2.4.57',  // JPEG Lossless
        '1.2.840.10008.1.2.4.70',  // JPEG Lossless P14
        '1.2.840.10008.1.2.4.80',  // JPEG-LS Lossless
        '1.2.840.10008.1.2.4.81',  // JPEG-LS Lossy
        '1.2.840.10008.1.2.4.90',  // JPEG 2000 Lossless
        '1.2.840.10008.1.2.4.91',  // JPEG 2000
        '1.2.840.10008.1.2.4.92',  // JPEG 2000 MC Lossless
        '1.2.840.10008.1.2.4.93',  // JPEG 2000 MC
        '1.2.840.10008.1.2.5'      // RLE Lossless
      ];

      compressedSyntaxes.forEach(syntax => {
        expect(client.isCompressedSyntax(syntax)).toBe(true);
      });
    });

    it('should correctly identify uncompressed syntaxes', () => {
      const uncompressedSyntaxes = [
        '1.2.840.10008.1.2',       // Implicit VR Little Endian
        '1.2.840.10008.1.2.1',     // Explicit VR Little Endian
        '1.2.840.10008.1.2.2'      // Explicit VR Big Endian
      ];

      uncompressedSyntaxes.forEach(syntax => {
        expect(client.isCompressedSyntax(syntax)).toBe(false);
      });
    });
  });
});