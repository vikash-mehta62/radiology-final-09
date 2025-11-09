const axios = require('axios');
const { getMetricsCollector } = require('./metrics-collector');

/**
 * OrthancPreviewClient - Handles image preview generation using Orthanc REST API
 * Replaces Node.js DICOM decoding with Orthanc's native preview endpoints
 * Supports all compressed DICOM syntaxes through Orthanc's built-in decoders
 */
class OrthancPreviewClient {
  constructor(config = {}) {
    this.config = {
      orthancUrl: config.orthancUrl || process.env.ORTHANC_URL || 'http://69.62.70.102:8042',
      orthancUsername: config.orthancUsername || process.env.ORTHANC_USERNAME || 'orthanc',
      orthancPassword: config.orthancPassword || process.env.ORTHANC_PASSWORD || 'orthanc',
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
      enableFallback: config.enableFallback !== false, // Default to true
      ...config
    };

    this.metricsCollector = getMetricsCollector();
    this.axiosInstance = axios.create({
      baseURL: this.config.orthancUrl,
      timeout: this.config.timeout,
      auth: {
        username: this.config.orthancUsername,
        password: this.config.orthancPassword
      }
    });
  }

  /**
   * Generate PNG preview for a DICOM instance using Orthanc preview endpoint
   * @param {string} instanceId - Orthanc instance ID
   * @param {number} frameIndex - Frame index (0-based)
   * @param {Object} options - Preview options
   * @returns {Promise<Buffer>} PNG image buffer
   */
  async generatePreview(instanceId, frameIndex = 0, options = {}) {
    const timer = this.metricsCollector.startTimer('orthanc_preview_generation');

    // Validate inputs first (before try-catch to avoid fallback)
    if (!instanceId || typeof instanceId !== 'string') {
      timer.end({ status: 'error' });
      throw new Error('Invalid instanceId provided');
    }

    if (frameIndex < 0 || !Number.isInteger(frameIndex)) {
      timer.end({ status: 'error' });
      throw new Error('Invalid frameIndex provided');
    }

    try {
      // Auto-detect if we should use 'rendered' endpoint for color images or compressed formats
      if (!options.useRendered) {
        try {
          const metadata = await this.getInstanceMetadata(instanceId);
          const samplesPerPixel = parseInt(metadata.SamplesPerPixel) || 1;
          const photometric = (metadata.PhotometricInterpretation || '').toUpperCase();
          const transferSyntax = metadata.TransferSyntaxUID || '';
          const modality = (metadata.Modality || '').toUpperCase();
          
          // Check if compressed (JPEG, MPEG, etc.)
          const isCompressed = this.isCompressedSyntax(transferSyntax);
          
          // Use 'rendered' endpoint for:
          // 1. Color images (RGB, YBR, PALETTE)
          // 2. Compressed formats (JPEG, MPEG, RLE)
          // 3. Ultrasound/Echocardiogram (US modality - often compressed video)
          // 4. Secondary Capture (SC - often JPEG compressed)
          if (samplesPerPixel === 3 || 
              photometric.includes('RGB') || 
              photometric.includes('YBR') || 
              photometric.includes('PALETTE') ||
              isCompressed ||
              modality === 'US' ||
              modality === 'SC') {
            console.log(`🎨 Special format detected (modality: ${modality}, ${photometric}, ${samplesPerPixel} samples, compressed: ${isCompressed}) - using 'rendered' endpoint`);
            options.useRendered = true;
          }
        } catch (metaError) {
          console.warn('Failed to check image type, defaulting to rendered endpoint for safety:', metaError.message);
          // Default to 'rendered' on error for better compatibility
          options.useRendered = true;
        }
      }

      // Build preview URL with options
      const previewUrl = this.buildPreviewUrl(instanceId, frameIndex, options);

      // Attempt to generate preview with retry logic
      const pngBuffer = await this.executeWithRetry(async () => {
        const response = await this.axiosInstance.get(previewUrl, {
          responseType: 'arraybuffer',
          headers: {
            'Accept': 'image/png'
          }
        });

        if (response.status !== 200) {
          throw new Error(`Orthanc preview request failed with status ${response.status}`);
        }

        return Buffer.from(response.data);
      }, timer);

      // Record successful preview generation
      this.metricsCollector.recordInstanceProcessed('preview_generation', 'success');
      timer.end({ status: 'success' });

      return pngBuffer;

    } catch (error) {
      // Try 'rendered' endpoint as fallback if 'preview' failed and we haven't tried it yet
      if (!options.useRendered && !options.triedRendered) {
        console.warn(`Preview endpoint failed, trying 'rendered' endpoint for color support...`);
        options.useRendered = true;
        options.triedRendered = true;
        return this.generatePreview(instanceId, frameIndex, options);
      }

      // Check if this is a client error that was already handled in retry logic
      if (error.response && error.response.status >= 400 && error.response.status < 500) {
        // Client error was already recorded in executeWithRetry, just rethrow
        throw error;
      }

      // Record failed preview generation for server errors
      this.metricsCollector.recordInstanceProcessed('preview_generation', 'error');
      timer.end({ status: 'error' });

      // Handle fallback if enabled (only for server errors)
      if (this.config.enableFallback) {
        console.warn(`Orthanc preview failed for instance ${instanceId}, frame ${frameIndex}:`, error.message);
        return this.generateFallbackPreview(options);
      }

      throw new Error(`Failed to generate preview for instance ${instanceId}: ${error.message}`);
    }
  }

  /**
   * Get instance metadata from Orthanc
   * @param {string} instanceId - Orthanc instance ID
   * @returns {Promise<Object>} Instance metadata
   */
  async getInstanceMetadata(instanceId) {
    const timer = this.metricsCollector.startTimer('orthanc_metadata_retrieval');

    try {
      const response = await this.axiosInstance.get(`/instances/${instanceId}/simplified-tags`);

      if (response.status !== 200) {
        throw new Error(`Failed to retrieve metadata with status ${response.status}`);
      }

      const metadata = this.parseInstanceMetadata(response.data);
      timer.end({ status: 'success' });

      return metadata;

    } catch (error) {
      timer.end({ status: 'error' });
      throw new Error(`Failed to retrieve instance metadata: ${error.message}`);
    }
  }

  /**
   * Check if instance supports compressed syntaxes
   * @param {string} instanceId - Orthanc instance ID
   * @returns {Promise<Object>} Compression support info
   */
  async checkCompressionSupport(instanceId) {
    try {
      const metadata = await this.getInstanceMetadata(instanceId);
      const transferSyntax = metadata.TransferSyntaxUID || '';

      return {
        isCompressed: this.isCompressedSyntax(transferSyntax),
        transferSyntax,
        compressionType: this.getCompressionType(transferSyntax),
        supported: true // Orthanc handles all standard compressed syntaxes
      };

    } catch (error) {
      return {
        isCompressed: false,
        transferSyntax: 'unknown',
        compressionType: 'unknown',
        supported: false,
        error: error.message
      };
    }
  }

  /**
   * Build preview URL with options
   * @private
   */
  buildPreviewUrl(instanceId, frameIndex, options) {
    // Use 'rendered' endpoint for:
    // - Color images (RGB, YBR, PALETTE)
    // - Compressed formats (JPEG, MPEG, RLE)
    // - Ultrasound/Echocardiogram (US modality)
    // Use 'preview' endpoint for grayscale uncompressed images (faster)
    const endpoint = options.useRendered ? 'rendered' : 'preview';
    let url = `/instances/${instanceId}/frames/${frameIndex}/${endpoint}`;

    // Add query parameters for preview options
    const params = new URLSearchParams();

    if (options.quality && options.quality >= 1 && options.quality <= 100) {
      params.append('quality', options.quality.toString());
    }

    // Always return unsupported image as fallback
    params.append('returnUnsupportedImage', 'true');

    const queryString = params.toString();
    return queryString ? `${url}?${queryString}` : url;
  }

  /**
   * Execute function with retry logic
   * @private
   */
  async executeWithRetry(fn, timer) {
    let lastError;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Don't retry on client errors (4xx) - throw immediately without fallback
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          // Record error and rethrow without fallback
          this.metricsCollector.recordInstanceProcessed('preview_generation', 'error');
          timer.end({ status: 'error' });
          throw error;
        }

        // Wait before retry (except on last attempt)
        if (attempt < this.config.retryAttempts) {
          await this.delay(this.config.retryDelay * attempt);
        }
      }
    }

    throw lastError;
  }

  /**
   * Parse instance metadata from Orthanc response
   * @private
   */
  parseInstanceMetadata(orthancTags) {
    return {
      StudyInstanceUID: orthancTags.StudyInstanceUID || '',
      SeriesInstanceUID: orthancTags.SeriesInstanceUID || '',
      SOPInstanceUID: orthancTags.SOPInstanceUID || '',
      TransferSyntaxUID: orthancTags.TransferSyntaxUID || '',
      Rows: parseInt(orthancTags.Rows) || 0,
      Columns: parseInt(orthancTags.Columns) || 0,
      NumberOfFrames: parseInt(orthancTags.NumberOfFrames) || 1,
      SamplesPerPixel: parseInt(orthancTags.SamplesPerPixel) || 1,
      BitsAllocated: parseInt(orthancTags.BitsAllocated) || 8,
      BitsStored: parseInt(orthancTags.BitsStored) || parseInt(orthancTags.BitsAllocated) || 8,
      HighBit: parseInt(orthancTags.HighBit) || 7,
      PixelRepresentation: parseInt(orthancTags.PixelRepresentation) || 0,
      PhotometricInterpretation: orthancTags.PhotometricInterpretation || 'MONOCHROME2',
      PlanarConfiguration: parseInt(orthancTags.PlanarConfiguration) || 0,
      WindowCenter: orthancTags.WindowCenter || '',
      WindowWidth: orthancTags.WindowWidth || '',
      RescaleIntercept: parseFloat(orthancTags.RescaleIntercept) || 0,
      RescaleSlope: parseFloat(orthancTags.RescaleSlope) || 1,
      InstanceNumber: parseInt(orthancTags.InstanceNumber) || 1
    };
  }

  /**
   * Check if transfer syntax is compressed
   * @private
   */
  isCompressedSyntax(transferSyntax) {
    const compressedSyntaxes = [
      '1.2.840.10008.1.2.4.50',  // JPEG Baseline (Process 1)
      '1.2.840.10008.1.2.4.51',  // JPEG Extended (Process 2 & 4)
      '1.2.840.10008.1.2.4.57',  // JPEG Lossless, Non-Hierarchical (Process 14)
      '1.2.840.10008.1.2.4.70',  // JPEG Lossless, Non-Hierarchical, First-Order Prediction
      '1.2.840.10008.1.2.4.80',  // JPEG-LS Lossless Image Compression
      '1.2.840.10008.1.2.4.81',  // JPEG-LS Lossy (Near-Lossless) Image Compression
      '1.2.840.10008.1.2.4.90',  // JPEG 2000 Image Compression (Lossless Only)
      '1.2.840.10008.1.2.4.91',  // JPEG 2000 Image Compression
      '1.2.840.10008.1.2.4.92',  // JPEG 2000 Part 2 Multi-component Image Compression (Lossless Only)
      '1.2.840.10008.1.2.4.93',  // JPEG 2000 Part 2 Multi-component Image Compression
      '1.2.840.10008.1.2.5',     // RLE Lossless
    ];

    return compressedSyntaxes.includes(transferSyntax);
  }

  /**
   * Get compression type from transfer syntax
   * @private
   */
  getCompressionType(transferSyntax) {
    const compressionMap = {
      '1.2.840.10008.1.2.4.50': 'JPEG Baseline',
      '1.2.840.10008.1.2.4.51': 'JPEG Extended',
      '1.2.840.10008.1.2.4.57': 'JPEG Lossless',
      '1.2.840.10008.1.2.4.70': 'JPEG Lossless P14',
      '1.2.840.10008.1.2.4.80': 'JPEG-LS Lossless',
      '1.2.840.10008.1.2.4.81': 'JPEG-LS Lossy',
      '1.2.840.10008.1.2.4.90': 'JPEG 2000 Lossless',
      '1.2.840.10008.1.2.4.91': 'JPEG 2000',
      '1.2.840.10008.1.2.4.92': 'JPEG 2000 MC Lossless',
      '1.2.840.10008.1.2.4.93': 'JPEG 2000 MC',
      '1.2.840.10008.1.2.5': 'RLE Lossless'
    };

    return compressionMap[transferSyntax] || 'Uncompressed';
  }

  /**
   * Generate fallback preview when Orthanc preview fails
   * @private
   */
  generateFallbackPreview(options = {}) {
    const { PNG } = require('pngjs');

    const width = options.width || 256;
    const height = options.height || 256;

    const png = new PNG({ width, height });

    // Generate a simple pattern to indicate fallback
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (width * y + x) << 2;

        // Create a checkerboard pattern
        const checker = ((x >> 4) + (y >> 4)) & 1;
        const gray = checker ? 200 : 150;

        png.data[idx] = gray;     // R
        png.data[idx + 1] = gray; // G
        png.data[idx + 2] = gray; // B
        png.data[idx + 3] = 255;  // A
      }
    }

    return PNG.sync.write(png);
  }

  /**
   * Test connectivity to Orthanc server
   * @returns {Promise<boolean>} Connection status
   */
  async testConnection() {
    try {
      const response = await this.axiosInstance.get('/system');
      return response.status === 200;
    } catch (error) {
      console.warn('Orthanc connectivity test failed:', error.message);
      return false;
    }
  }

  /**
   * Utility delay function
   * @private
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
let orthancPreviewClientInstance = null;

/**
 * Get singleton instance of OrthancPreviewClient
 * @param {Object} config - Configuration options
 * @returns {OrthancPreviewClient} Singleton instance
 */
function getOrthancPreviewClient(config = {}) {
  if (!orthancPreviewClientInstance) {
    orthancPreviewClientInstance = new OrthancPreviewClient(config);
  }
  return orthancPreviewClientInstance;
}

module.exports = { OrthancPreviewClient, getOrthancPreviewClient };