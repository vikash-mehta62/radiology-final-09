const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ExportSession = require('../models/ExportSession');
const dicomSRService = require('./dicom-sr-service');
const fhirService = require('./fhir-service');
const pdfService = require('./pdf-service');
const auditService = require('./audit-service');

/**
 * Export Service
 * Manages report export operations with async processing and status tracking
 * Supports DICOM SR, FHIR, and PDF export formats
 */

class ExportService {
  constructor() {
    // Export directory
    this.exportDir = process.env.EXPORT_DIR || path.join(__dirname, '../../exports');
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    
    // Ensure export directory exists
    this.initializeExportDirectory();
  }

  /**
   * Initialize export directory
   */
  async initializeExportDirectory() {
    try {
      await fs.mkdir(this.exportDir, { recursive: true });
      console.log(`📁 Export directory initialized: ${this.exportDir}`);
    } catch (error) {
      console.error('Failed to create export directory:', error);
    }
  }

  /**
   * Initiate export operation
   * @param {string} reportId - Report ID to export
   * @param {string} format - Export format (dicom-sr, fhir, pdf)
   * @param {string} userId - User ID initiating export
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Export session
   */
  async initiateExport(reportId, format, userId, metadata = {}) {
    try {
      console.log(`🚀 Initiating ${format} export for report: ${reportId}`);

      // Validate format
      if (!['dicom-sr', 'fhir', 'pdf'].includes(format)) {
        throw new Error(`Invalid export format: ${format}`);
      }

      // Create export session
      const exportSession = new ExportSession({
        reportId,
        userId,
        format,
        status: 'initiated',
        progress: 0,
        metadata: {
          ...metadata,
          ipAddress: metadata.ipAddress || 'unknown',
          userAgent: metadata.userAgent || 'unknown'
        }
      });

      await exportSession.save();

      // Start async export processing
      this.processExport(exportSession._id.toString()).catch(error => {
        console.error(`Export processing failed for session ${exportSession._id}:`, error);
      });

      console.log(`✅ Export session created: ${exportSession._id}`);
      return exportSession;

    } catch (error) {
      console.error('Failed to initiate export:', error);
      throw error;
    }
  }

  /**
   * Process export asynchronously
   * @param {string} exportSessionId - Export session ID
   */
  async processExport(exportSessionId) {
    let exportSession = null;

    try {
      // Get export session
      exportSession = await ExportSession.findById(exportSessionId);
      if (!exportSession) {
        throw new Error(`Export session not found: ${exportSessionId}`);
      }

      // Start processing
      await exportSession.start();
      console.log(`⚙️ Processing export: ${exportSession.format} for report ${exportSession.reportId}`);

      // Update progress
      await exportSession.updateProgress(10);

      // Generate export based on format
      let fileBuffer;
      let fileExtension;
      let contentType;

      switch (exportSession.format) {
        case 'dicom-sr':
          await exportSession.updateProgress(30);
          fileBuffer = await dicomSRService.exportReport(exportSession.reportId);
          fileExtension = 'dcm';
          contentType = 'application/dicom';
          await exportSession.updateProgress(80);
          break;

        case 'fhir':
          await exportSession.updateProgress(30);
          const fhirResource = await fhirService.exportReport(exportSession.reportId);
          fileBuffer = Buffer.from(JSON.stringify(fhirResource, null, 2), 'utf-8');
          fileExtension = 'json';
          contentType = 'application/fhir+json';
          await exportSession.updateProgress(80);
          break;

        case 'pdf':
          await exportSession.updateProgress(30);
          fileBuffer = await pdfService.exportReport(exportSession.reportId, {
            includeImages: exportSession.metadata?.exportOptions?.includeImages !== false
          });
          fileExtension = 'pdf';
          contentType = 'application/pdf';
          await exportSession.updateProgress(80);
          break;

        default:
          throw new Error(`Unsupported export format: ${exportSession.format}`);
      }

      // Validate export
      await exportSession.updateProgress(85);
      const validationResult = await this.validateExport(fileBuffer, exportSession.format);
      
      exportSession.validationResults = validationResult;
      await exportSession.save();

      if (!validationResult.valid) {
        throw new Error(`Export validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Save file
      await exportSession.updateProgress(90);
      const fileName = `${exportSession.reportId}_${Date.now()}.${fileExtension}`;
      const filePath = path.join(this.exportDir, fileName);
      
      await fs.writeFile(filePath, fileBuffer);

      // Generate download URL
      const fileUrl = `${this.baseUrl}/api/reports/export/download/${exportSession._id}`;

      // Complete export
      await exportSession.complete(fileUrl, fileName, fileBuffer.length);
      exportSession.filePath = filePath;
      await exportSession.save();

      // Log audit event
      await auditService.logExport({
        exportId: exportSession._id.toString(),
        reportId: exportSession.reportId,
        userId: exportSession.userId.toString(),
        format: exportSession.format,
        status: 'completed',
        fileSize: fileBuffer.length,
        timestamp: new Date()
      });

      console.log(`✅ Export completed successfully: ${exportSession._id}`);

    } catch (error) {
      console.error(`❌ Export processing failed:`, error);

      if (exportSession) {
        await exportSession.fail(error.message, {
          stack: error.stack,
          timestamp: new Date()
        });

        // Log audit event for failure
        await auditService.logExport({
          exportId: exportSession._id.toString(),
          reportId: exportSession.reportId,
          userId: exportSession.userId.toString(),
          format: exportSession.format,
          status: 'failed',
          error: error.message,
          timestamp: new Date()
        });
      }

      throw error;
    }
  }

  /**
   * Get export status
   * @param {string} exportSessionId - Export session ID
   * @returns {Promise<Object>} Export session
   */
  async getExportStatus(exportSessionId) {
    try {
      const exportSession = await ExportSession.findById(exportSessionId)
        .populate('userId', 'username email')
        .lean();

      if (!exportSession) {
        throw new Error(`Export session not found: ${exportSessionId}`);
      }

      return {
        id: exportSession._id,
        reportId: exportSession.reportId,
        format: exportSession.format,
        status: exportSession.status,
        progress: exportSession.progress,
        fileUrl: exportSession.fileUrl,
        fileName: exportSession.fileName,
        fileSize: exportSession.fileSize,
        error: exportSession.error,
        validationResults: exportSession.validationResults,
        createdAt: exportSession.createdAt,
        completedAt: exportSession.completedAt,
        processingTime: exportSession.processingTime,
        user: exportSession.userId
      };

    } catch (error) {
      console.error('Failed to get export status:', error);
      throw error;
    }
  }

  /**
   * Download export file
   * @param {string} exportSessionId - Export session ID
   * @returns {Promise<Object>} File data and metadata
   */
  async downloadExport(exportSessionId) {
    try {
      const exportSession = await ExportSession.findById(exportSessionId);

      if (!exportSession) {
        throw new Error(`Export session not found: ${exportSessionId}`);
      }

      if (exportSession.status !== 'completed') {
        throw new Error(`Export is not completed. Current status: ${exportSession.status}`);
      }

      if (!exportSession.filePath) {
        throw new Error('Export file path not found');
      }

      // Read file
      const fileBuffer = await fs.readFile(exportSession.filePath);

      // Determine content type
      const contentTypeMap = {
        'dicom-sr': 'application/dicom',
        'fhir': 'application/fhir+json',
        'pdf': 'application/pdf'
      };

      return {
        buffer: fileBuffer,
        fileName: exportSession.fileName,
        contentType: contentTypeMap[exportSession.format] || 'application/octet-stream',
        fileSize: exportSession.fileSize
      };

    } catch (error) {
      console.error('Failed to download export:', error);
      throw error;
    }
  }

  /**
   * Get export history
   * @param {string} userId - User ID (optional)
   * @param {string} format - Export format filter (optional)
   * @param {number} limit - Result limit
   * @returns {Promise<Array>} Export sessions
   */
  async getExportHistory(userId = null, format = null, limit = 50) {
    try {
      const query = {};

      if (userId) {
        query.userId = userId;
      }

      if (format) {
        query.format = format;
      }

      const exportSessions = await ExportSession.find(query)
        .populate('userId', 'username email')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      return exportSessions.map(session => ({
        id: session._id,
        reportId: session.reportId,
        format: session.format,
        status: session.status,
        progress: session.progress,
        fileUrl: session.fileUrl,
        fileName: session.fileName,
        fileSize: session.fileSize,
        error: session.error,
        createdAt: session.createdAt,
        completedAt: session.completedAt,
        processingTime: session.processingTime,
        user: session.userId
      }));

    } catch (error) {
      console.error('Failed to get export history:', error);
      throw error;
    }
  }

  /**
   * Validate export file
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} format - Export format
   * @returns {Promise<Object>} Validation result
   */
  async validateExport(fileBuffer, format) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    try {
      // Basic validation
      if (!fileBuffer || fileBuffer.length === 0) {
        result.valid = false;
        result.errors.push('Export file is empty');
        return result;
      }

      // Format-specific validation
      switch (format) {
        case 'dicom-sr':
          // Validate DICOM structure
          if (fileBuffer.length < 100) {
            result.warnings.push('DICOM file seems too small');
          }
          break;

        case 'fhir':
          // Validate JSON structure
          try {
            const fhirResource = JSON.parse(fileBuffer.toString('utf-8'));
            if (!fhirResource.resourceType) {
              result.errors.push('Missing FHIR resourceType');
              result.valid = false;
            }
            if (fhirResource.resourceType === 'DiagnosticReport') {
              if (!fhirResource.status) {
                result.errors.push('Missing FHIR status');
                result.valid = false;
              }
              if (!fhirResource.code) {
                result.errors.push('Missing FHIR code');
                result.valid = false;
              }
            }
          } catch (error) {
            result.errors.push('Invalid JSON format');
            result.valid = false;
          }
          break;

        case 'pdf':
          // Validate PDF header
          const pdfHeader = fileBuffer.slice(0, 5).toString('utf-8');
          if (!pdfHeader.startsWith('%PDF-')) {
            result.errors.push('Invalid PDF header');
            result.valid = false;
          }
          break;

        default:
          result.warnings.push('No validation rules for this format');
      }

      // Size validation
      const maxSize = 50 * 1024 * 1024; // 50 MB
      if (fileBuffer.length > maxSize) {
        result.warnings.push('Export file is very large');
      }

    } catch (error) {
      result.valid = false;
      result.errors.push(`Validation error: ${error.message}`);
    }

    return result;
  }

  /**
   * Retry failed export
   * @param {string} exportSessionId - Export session ID
   * @returns {Promise<Object>} Updated export session
   */
  async retryExport(exportSessionId) {
    try {
      const exportSession = await ExportSession.findById(exportSessionId);

      if (!exportSession) {
        throw new Error(`Export session not found: ${exportSessionId}`);
      }

      if (exportSession.status !== 'failed') {
        throw new Error(`Cannot retry export with status: ${exportSession.status}`);
      }

      // Retry export
      await exportSession.retry();

      // Start processing again
      this.processExport(exportSession._id.toString()).catch(error => {
        console.error(`Export retry failed for session ${exportSession._id}:`, error);
      });

      return exportSession;

    } catch (error) {
      console.error('Failed to retry export:', error);
      throw error;
    }
  }

  /**
   * Delete export file
   * @param {string} exportSessionId - Export session ID
   */
  async deleteExport(exportSessionId) {
    try {
      const exportSession = await ExportSession.findById(exportSessionId);

      if (!exportSession) {
        throw new Error(`Export session not found: ${exportSessionId}`);
      }

      // Delete file if exists
      if (exportSession.filePath) {
        try {
          await fs.unlink(exportSession.filePath);
          console.log(`🗑️ Deleted export file: ${exportSession.filePath}`);
        } catch (error) {
          console.warn('Failed to delete export file:', error.message);
        }
      }

      // Delete session record
      await ExportSession.findByIdAndDelete(exportSessionId);

      console.log(`✅ Export session deleted: ${exportSessionId}`);

    } catch (error) {
      console.error('Failed to delete export:', error);
      throw error;
    }
  }

  /**
   * Clean up old exports
   * @param {number} daysOld - Delete exports older than this many days
   */
  async cleanupOldExports(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const oldExports = await ExportSession.find({
        createdAt: { $lt: cutoffDate },
        status: 'completed'
      });

      console.log(`🧹 Cleaning up ${oldExports.length} old exports...`);

      for (const exportSession of oldExports) {
        await this.deleteExport(exportSession._id.toString());
      }

      console.log(`✅ Cleanup completed: ${oldExports.length} exports deleted`);

    } catch (error) {
      console.error('Failed to cleanup old exports:', error);
      throw error;
    }
  }

  /**
   * Get export statistics
   * @param {string} userId - User ID (optional)
   * @returns {Promise<Object>} Export statistics
   */
  async getExportStatistics(userId = null) {
    try {
      const match = userId ? { userId } : {};

      const stats = await ExportSession.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$format',
            total: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            failed: {
              $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
            },
            avgProcessingTime: { $avg: '$processingTime' },
            totalFileSize: { $sum: '$fileSize' }
          }
        }
      ]);

      return stats;

    } catch (error) {
      console.error('Failed to get export statistics:', error);
      throw error;
    }
  }
}

module.exports = new ExportService();
