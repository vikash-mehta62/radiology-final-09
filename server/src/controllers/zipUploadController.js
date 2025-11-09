const multer = require('multer');
const { getZipDicomService } = require('../services/zip-dicom-service');
const { getMetricsCollector } = require('../services/metrics-collector');

/**
 * ZIP Upload Controller - Handles ZIP files containing DICOM studies
 * Groups all DICOM files under unified StudyInstanceUID for proper 3D reconstruction
 */
class ZipUploadController {
  constructor() {
    this.zipDicomService = getZipDicomService();
    this.metricsCollector = getMetricsCollector();

    // Configure multer for ZIP uploads
    this.upload = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 2 * 1024 * 1024 * 1024, // 2GB max file size for ZIP
        files: 1 // One ZIP at a time
      },
      fileFilter: (req, file, cb) => {
        // Accept ZIP files only
        const allowedMimeTypes = [
          'application/zip',
          'application/x-zip-compressed',
          'application/x-zip'
        ];

        const allowedExtensions = ['.zip'];
        const hasValidExtension = allowedExtensions.some(ext =>
          file.originalname.toLowerCase().endsWith(ext)
        );

        // Reject known non-ZIP formats
        const rejectedExtensions = ['.rar', '.7z', '.tar', '.gz', '.tgz', '.bz2'];
        const hasRejectedExtension = rejectedExtensions.some(ext =>
          file.originalname.toLowerCase().endsWith(ext)
        );

        if (hasRejectedExtension) {
          const ext = rejectedExtensions.find(ext => file.originalname.toLowerCase().endsWith(ext));
          cb(new Error(`${ext.toUpperCase()} files are not supported. Please convert to ZIP format.`), false);
        } else if (allowedMimeTypes.includes(file.mimetype) || hasValidExtension) {
          cb(null, true);
        } else {
          cb(new Error('Only ZIP files are allowed. Please upload a .zip file.'), false);
        }
      }
    });
  }

  /**
   * Upload ZIP file containing DICOM study
   * POST /api/dicom/upload/zip
   */
  async uploadZipStudy(req, res) {
    const timer = this.metricsCollector.startTimer('zip_upload_request');

    try {
      if (!req.file) {
        timer.end({ status: 'error' });
        return res.status(400).json({
          success: false,
          message: 'No ZIP file provided',
          hint: 'Please upload a ZIP file containing DICOM files'
        });
      }

      const { buffer, originalname, size } = req.file;

      console.log(`Processing ZIP upload: ${originalname} (${(size / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`Buffer info: isBuffer=${Buffer.isBuffer(buffer)}, length=${buffer?.length}`);

      // Validate buffer
      if (!buffer || !Buffer.isBuffer(buffer)) {
        timer.end({ status: 'error' });
        return res.status(400).json({
          success: false,
          message: 'Invalid file buffer',
          hint: 'The uploaded file could not be read properly'
        });
      }

      // Check file size
      if (buffer.length === 0) {
        timer.end({ status: 'error' });
        return res.status(400).json({
          success: false,
          message: 'Empty file uploaded',
          hint: 'The ZIP file appears to be empty'
        });
      }

      // Process options from request body
      const options = {
        forceUnifiedStudy: req.body?.forceUnifiedStudy === 'true' || req.body?.forceUnifiedStudy === true,
        patientID: req.body?.patientID,
        patientName: req.body?.patientName
      };

      // Process ZIP file
      const result = await this.zipDicomService.processZipStudy(
        buffer,
        originalname,
        options
      );

      timer.end({ status: result.success ? 'success' : 'error' });

      if (result.success) {
        this.metricsCollector.recordInstanceProcessed('success', 'zip_upload');

        res.json({
          success: true,
          message: result.message,
          data: {
            studyInstanceUID: result.studyInstanceUID,
            studyDescription: result.studyDescription,
            totalSeries: result.totalSeries,
            totalInstances: result.totalInstances,
            totalFrames: result.totalFrames,
            series: result.series,
            readyForViewing: result.readyForViewing,
            uploadStats: {
              filename: originalname,
              fileSize: size,
              processingTime: timer.duration
            },
            viewingInfo: {
              studyUrl: `/api/dicom/studies/${result.studyInstanceUID}`,
              frameUrl: `/api/dicom/studies/${result.studyInstanceUID}/frames/{frameIndex}`,
              totalFrames: result.totalFrames,
              canViewImmediately: true,
              supports3D: true
            }
          }
        });
      } else {
        this.metricsCollector.recordInstanceProcessed('error', 'zip_upload');

        res.status(500).json({
          success: false,
          message: result.message || 'ZIP processing failed',
          error: result.error
        });
      }

    } catch (error) {
      timer.end({ status: 'error' });
      console.error('ZIP upload controller error:', error);

      this.metricsCollector.recordInstanceProcessed('error', 'zip_upload');

      res.status(500).json({
        success: false,
        message: 'ZIP upload processing failed',
        error: error.message,
        hint: 'Ensure the ZIP contains valid DICOM files (.dcm)'
      });
    }
  }

  /**
   * Get ZIP upload capabilities
   * GET /api/dicom/upload/zip/info
   */
  async getZipUploadInfo(req, res) {
    try {
      res.json({
        success: true,
        data: {
          capabilities: {
            maxFileSize: '2GB',
            supportedFormats: ['.zip'],
            features: [
              'Unified study grouping',
              'Multi-series support',
              'Automatic 3D reconstruction',
              'Slice ordering by InstanceNumber and ImagePositionPatient',
              'Immediate viewing after upload'
            ]
          },
          usage: {
            endpoint: 'POST /api/dicom/upload/zip',
            contentType: 'multipart/form-data',
            fieldName: 'file',
            optionalFields: {
              forceUnifiedStudy: 'boolean - Force all DICOM files into single study',
              patientID: 'string - Override patient ID',
              patientName: 'string - Override patient name'
            }
          },
          troubleshooting: {
            'Invalid ZIP format': 'Ensure the file is a valid ZIP archive',
            'No DICOM files found': 'ZIP must contain .dcm, .dicom, or .dic files',
            'File too large': 'Maximum size is 2GB',
            'Empty file': 'ZIP file appears to be empty or corrupted'
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
   * Test ZIP file upload (diagnostic endpoint)
   * POST /api/dicom/upload/zip/test
   */
  async testZipUpload(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file provided',
          test: 'file_upload'
        });
      }

      const { buffer, originalname, size, mimetype } = req.file;

      // Test 1: Buffer validation
      const bufferValid = Buffer.isBuffer(buffer);
      const bufferSize = buffer?.length || 0;

      // Test 2: ZIP signature check
      let zipSignature = 'N/A';
      let isValidZip = false;
      if (buffer && buffer.length >= 4) {
        zipSignature = buffer.toString('hex', 0, 4);
        isValidZip = zipSignature === '504b0304' || zipSignature === '504b0506';
      }

      // Test 3: Try to extract
      let extractionTest = 'Not attempted';
      let fileCount = 0;
      try {
        const AdmZip = require('adm-zip');
        const zip = new AdmZip(buffer);
        const entries = zip.getEntries();
        fileCount = entries.length;
        extractionTest = 'Success';
      } catch (extractError) {
        extractionTest = `Failed: ${extractError.message}`;
      }

      res.json({
        success: true,
        message: 'ZIP upload diagnostic test',
        tests: {
          fileReceived: true,
          filename: originalname,
          size: size,
          mimetype: mimetype,
          bufferValid: bufferValid,
          bufferSize: bufferSize,
          zipSignature: zipSignature,
          isValidZip: isValidZip,
          extractionTest: extractionTest,
          fileCount: fileCount
        },
        recommendation: isValidZip
          ? 'ZIP file appears valid. Try the regular upload endpoint.'
          : 'ZIP file appears invalid. Please check the file is a valid ZIP archive.'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
        test: 'diagnostic'
      });
    }
  }
}

// Export singleton instance
const zipUploadController = new ZipUploadController();

module.exports = {
  uploadZipStudy: zipUploadController.uploadZipStudy.bind(zipUploadController),
  getZipUploadInfo: zipUploadController.getZipUploadInfo.bind(zipUploadController),
  testZipUpload: zipUploadController.testZipUpload.bind(zipUploadController),
  uploadMiddleware: () => zipUploadController.upload
};
