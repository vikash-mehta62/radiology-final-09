const multer = require('multer');
const { getPacsUploadService } = require('../services/pacs-upload-service');
const { getMetricsCollector } = require('../services/metrics-collector');

/**
 * PACS Upload Controller - Handles DICOM file uploads with real-time PACS processing
 * Provides immediate availability for viewing after upload
 */
class PacsUploadController {
  constructor() {
    try {
      this.pacsUploadService = getPacsUploadService();
      this.metricsCollector = getMetricsCollector();
    } catch (error) {
      console.error('Failed to initialize PACS Upload Controller:', error.message);
      this.initializationError = error.message;
    }
    
    // Configure multer for DICOM file uploads
    this.upload = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 500 * 1024 * 1024, // 500MB max file size
        files: 10 // Max 10 files per upload
      },
      fileFilter: (req, file, cb) => {
        // Accept DICOM files and common medical imaging formats
        const allowedMimeTypes = [
          'application/dicom',
          'application/octet-stream',
          'image/dicom',
          'image/dcm',
          'application/x-dcm',
          'application/x-dicom'
        ];
        
        const allowedExtensions = ['.dcm', '.dicom', '.dic'];
        const hasValidExtension = allowedExtensions.some(ext => 
          file.originalname.toLowerCase().endsWith(ext)
        );
        
        // Accept if mime type matches OR has valid extension OR no extension (let Orthanc validate)
        if (allowedMimeTypes.includes(file.mimetype) || hasValidExtension || !file.originalname.includes('.')) {
          console.log(`✅ Accepting file: ${file.originalname} (${file.mimetype})`);
          cb(null, true);
        } else {
          console.log(`❌ Rejecting file: ${file.originalname} (${file.mimetype})`);
          cb(new Error(`File type not supported: ${file.mimetype}. Please upload DICOM files (.dcm, .dicom, or .dic)`), false);
        }
      }
    });
  }

  /**
   * Check environment configuration
   * @private
   */
  checkEnvironmentConfiguration() {
    const errors = [];

    if (!process.env.ORTHANC_URL) {
      errors.push('ORTHANC_URL environment variable is not set');
    }

    if (!process.env.ORTHANC_USERNAME) {
      errors.push('ORTHANC_USERNAME environment variable is not set');
    }

    if (!process.env.ORTHANC_PASSWORD) {
      errors.push('ORTHANC_PASSWORD environment variable is not set');
    }

    if (!process.env.MONGODB_URI) {
      errors.push('MONGODB_URI environment variable is not set');
    }

    if (this.initializationError) {
      errors.push(`Service initialization failed: ${this.initializationError}`);
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Upload single DICOM file to PACS with real-time processing
   * POST /api/pacs/upload
   */
  async uploadSingle(req, res) {
    const timer = this.metricsCollector.startTimer('pacs_upload_request');
    
    try {
      // Check environment configuration first
      const configCheck = this.checkEnvironmentConfiguration();
      if (!configCheck.valid) {
        timer.end({ status: 'error' });
        return res.status(500).json({
          success: false,
          message: 'PACS upload service is not properly configured',
          errors: configCheck.errors,
          hint: 'Please check your .env file for ORTHANC_URL, ORTHANC_USERNAME, and ORTHANC_PASSWORD'
        });
      }

      console.log('📥 Received upload request:', {
        hasFile: !!req.file,
        headers: req.headers,
        bodyKeys: Object.keys(req.body || {}),
        fileFieldName: req.file ? 'dicom' : 'missing'
      });

      if (!req.file) {
        timer.end({ status: 'error' });
        return res.status(400).json({
          success: false,
          message: 'No DICOM file provided',
          hint: 'Please upload a DICOM file (.dcm, .dicom, or .dic)',
          debug: {
            receivedFields: Object.keys(req.body || {}),
            expectedField: 'dicom'
          }
        });
      }

      const { buffer, originalname, size, mimetype } = req.file;
      
      console.log(`📤 Processing PACS upload:`, {
        filename: originalname,
        size: `${(size / 1024 / 1024).toFixed(2)} MB`,
        mimetype: mimetype,
        bufferLength: buffer.length
      });
      
      // Upload and process through PACS
      const result = await this.pacsUploadService.uploadAndProcess(
        buffer, 
        originalname,
        {
          enableRealTimeProcessing: true,
          clientInfo: {
            userAgent: req.get('User-Agent'),
            ip: req.ip
          }
        }
      );
      
      timer.end({ status: result.success ? 'success' : 'error' });
      
      if (result.success) {
        // Record successful upload
        this.metricsCollector.recordInstanceProcessing('pacs_upload', 'success');
        
        console.log('✅ PACS upload successful:', {
          studyUID: result.studyInstanceUID,
          frames: result.totalFrames
        });
        
        res.json({
          success: true,
          message: result.message,
          data: {
            studyInstanceUID: result.studyInstanceUID,
            totalFrames: result.totalFrames,
            readyForViewing: result.readyForViewing,
            uploadStats: {
              filename: originalname,
              fileSize: size,
              processingTime: timer.duration,
              instancesCreated: result.processing.instances.length
            },
            viewingInfo: {
              studyUrl: `/api/dicom/studies/${result.studyInstanceUID}`,
              frameUrl: `/api/dicom/studies/${result.studyInstanceUID}/frames/{frameIndex}`,
              totalFrames: result.totalFrames,
              canViewImmediately: true
            }
          }
        });
      } else {
        // Record failed upload
        this.metricsCollector.recordInstanceProcessing('pacs_upload', 'error');
        
        console.error('❌ PACS upload failed:', result.error);
        
        res.status(500).json({
          success: false,
          message: result.message,
          error: result.error
        });
      }
      
    } catch (error) {
      timer.end({ status: 'error' });
      console.error('❌ PACS upload controller error:', error);
      
      this.metricsCollector.recordInstanceProcessing('pacs_upload', 'error');
      
      res.status(500).json({
        success: false,
        message: 'Upload processing failed',
        error: error.message,
        hint: 'Check if the file is a valid DICOM format'
      });
    }
  }

  /**
   * Upload multiple DICOM files to PACS with batch processing
   * POST /api/pacs/upload/batch
   */
  async uploadBatch(req, res) {
    const timer = this.metricsCollector.startTimer('pacs_batch_upload');
    
    try {
      if (!req.files || req.files.length === 0) {
        timer.end({ status: 'error' });
        return res.status(400).json({
          success: false,
          message: 'No DICOM files provided'
        });
      }

      console.log(`Processing batch PACS upload: ${req.files.length} files`);
      
      // Process files in parallel (with concurrency limit)
      const concurrencyLimit = 3; // Process max 3 files simultaneously
      const results = [];
      
      for (let i = 0; i < req.files.length; i += concurrencyLimit) {
        const batch = req.files.slice(i, i + concurrencyLimit);
        
        const batchPromises = batch.map(async (file) => {
          try {
            const result = await this.pacsUploadService.uploadAndProcess(
              file.buffer,
              file.originalname,
              { enableRealTimeProcessing: true }
            );
            
            return {
              filename: file.originalname,
              ...result
            };
          } catch (error) {
            return {
              filename: file.originalname,
              success: false,
              error: error.message
            };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }
      
      // Summarize results
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      timer.end({ status: failed.length === 0 ? 'success' : 'partial' });
      
      res.json({
        success: true,
        message: `Batch upload completed: ${successful.length} successful, ${failed.length} failed`,
        data: {
          totalFiles: req.files.length,
          successful: successful.length,
          failed: failed.length,
          results: results,
          readyStudies: successful.map(r => ({
            studyInstanceUID: r.studyInstanceUID,
            totalFrames: r.totalFrames,
            filename: r.filename
          }))
        }
      });
      
    } catch (error) {
      timer.end({ status: 'error' });
      console.error('PACS batch upload error:', error.message);
      
      res.status(500).json({
        success: false,
        message: 'Batch upload failed',
        error: error.message
      });
    }
  }

  /**
   * Get upload progress/status
   * GET /api/pacs/upload/status
   */
  async getUploadStatus(req, res) {
    try {
      const isConnected = await this.pacsUploadService.testConnection();
      const stats = this.pacsUploadService.getUploadStats();
      
      res.json({
        success: true,
        data: {
          pacsConnected: isConnected,
          uploadStats: stats,
          capabilities: {
            maxFileSize: '500MB',
            maxFiles: 10,
            supportedFormats: ['.dcm', '.dicom', '.dic'],
            realTimeProcessing: true,
            immediateViewing: true
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Test PACS upload connectivity
   * GET /api/pacs/upload/test
   */
  async testUploadConnection(req, res) {
    try {
      const isConnected = await this.pacsUploadService.testConnection();
      
      res.json({
        success: true,
        data: {
          connected: isConnected,
          message: isConnected ? 'PACS upload service is ready' : 'PACS connection failed',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

// Export singleton instance
const pacsUploadController = new PacsUploadController();

module.exports = {
  uploadSingle: pacsUploadController.uploadSingle.bind(pacsUploadController),
  uploadBatch: pacsUploadController.uploadBatch.bind(pacsUploadController),
  getUploadStatus: pacsUploadController.getUploadStatus.bind(pacsUploadController),
  testUploadConnection: pacsUploadController.testUploadConnection.bind(pacsUploadController),
  uploadMiddleware: () => pacsUploadController.upload
};