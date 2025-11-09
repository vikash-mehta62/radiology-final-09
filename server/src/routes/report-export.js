const express = require('express');
const router = express.Router();
const exportService = require('../services/export-service');
const { authenticate } = require('../middleware/authMiddleware');
const auditService = require('../services/audit-service');

/**
 * Report Export Routes
 * Handles DICOM SR, FHIR, and PDF export operations
 */

/**
 * POST /api/reports/:id/export/dicom-sr
 * Initiate DICOM SR export for a report
 */
router.post(
  '/:id/export/dicom-sr',
  authenticate,
  async (req, res) => {
    try {
      const { id: reportId } = req.params;
      const userId = req.user._id || req.user.id;
      const metadata = {
        recipient: req.body.recipient,
        purpose: req.body.purpose,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        exportOptions: req.body.options || {}
      };

      console.log(`📋 DICOM SR export requested for report: ${reportId}`);

      const exportSession = await exportService.initiateExport(
        reportId,
        'dicom-sr',
        userId,
        metadata
      );

      // Log audit event
      await auditService.logAction({
        userId,
        action: 'EXPORT_INITIATED',
        resourceType: 'Report',
        resourceId: reportId,
        details: {
          format: 'dicom-sr',
          exportId: exportSession._id.toString()
        },
        ipAddress: metadata.ipAddress
      });

      res.status(202).json({
        success: true,
        message: 'DICOM SR export initiated',
        exportId: exportSession._id,
        status: exportSession.status,
        progress: exportSession.progress
      });

    } catch (error) {
      console.error('DICOM SR export error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to initiate DICOM SR export'
      });
    }
  }
);

/**
 * POST /api/reports/:id/export/fhir
 * Initiate FHIR export for a report
 */
router.post(
  '/:id/export/fhir',
  authenticate,
  async (req, res) => {
    try {
      const { id: reportId } = req.params;
      const userId = req.user._id || req.user.id;
      const metadata = {
        recipient: req.body.recipient,
        purpose: req.body.purpose,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        exportOptions: {
          ...req.body.options,
          includeBundle: req.body.includeBundle || false
        }
      };

      console.log(`🔷 FHIR export requested for report: ${reportId}`);

      const exportSession = await exportService.initiateExport(
        reportId,
        'fhir',
        userId,
        metadata
      );

      // Log audit event
      await auditService.logAction({
        userId,
        action: 'EXPORT_INITIATED',
        resourceType: 'Report',
        resourceId: reportId,
        details: {
          format: 'fhir',
          exportId: exportSession._id.toString(),
          includeBundle: metadata.exportOptions.includeBundle
        },
        ipAddress: metadata.ipAddress
      });

      res.status(202).json({
        success: true,
        message: 'FHIR export initiated',
        exportId: exportSession._id,
        status: exportSession.status,
        progress: exportSession.progress
      });

    } catch (error) {
      console.error('FHIR export error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to initiate FHIR export'
      });
    }
  }
);

/**
 * POST /api/reports/:id/export/pdf
 * Initiate PDF export for a report
 */
router.post(
  '/:id/export/pdf',
  authenticate,
  async (req, res) => {
    try {
      const { id: reportId } = req.params;
      const userId = req.user._id || req.user.id;
      const metadata = {
        recipient: req.body.recipient,
        purpose: req.body.purpose,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        exportOptions: {
          ...req.body.options,
          includeImages: req.body.includeImages !== false,
          pdfA: req.body.pdfA || false
        }
      };

      console.log(`📄 PDF export requested for report: ${reportId}`);

      const exportSession = await exportService.initiateExport(
        reportId,
        'pdf',
        userId,
        metadata
      );

      // Log audit event
      await auditService.logAction({
        userId,
        action: 'EXPORT_INITIATED',
        resourceType: 'Report',
        resourceId: reportId,
        details: {
          format: 'pdf',
          exportId: exportSession._id.toString(),
          includeImages: metadata.exportOptions.includeImages
        },
        ipAddress: metadata.ipAddress
      });

      res.status(202).json({
        success: true,
        message: 'PDF export initiated',
        exportId: exportSession._id,
        status: exportSession.status,
        progress: exportSession.progress
      });

    } catch (error) {
      console.error('PDF export error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to initiate PDF export'
      });
    }
  }
);

/**
 * GET /api/reports/export/status/:exportId
 * Get export status
 */
router.get(
  '/export/status/:exportId',
  authenticate,
  async (req, res) => {
    try {
      const { exportId } = req.params;

      const status = await exportService.getExportStatus(exportId);

      res.json({
        success: true,
        export: status
      });

    } catch (error) {
      console.error('Get export status error:', error);
      res.status(404).json({
        success: false,
        message: error.message || 'Export session not found'
      });
    }
  }
);

/**
 * GET /api/reports/export/download/:exportId
 * Download exported file
 */
router.get(
  '/export/download/:exportId',
  authenticate,
  async (req, res) => {
    try {
      const { exportId } = req.params;
      const userId = req.user._id || req.user.id;

      const fileData = await exportService.downloadExport(exportId);

      // Log audit event
      await auditService.logAction({
        userId,
        action: 'EXPORT_DOWNLOADED',
        resourceType: 'ExportSession',
        resourceId: exportId,
        details: {
          fileName: fileData.fileName,
          fileSize: fileData.fileSize
        },
        ipAddress: req.ip || req.connection.remoteAddress
      });

      // Set response headers
      res.setHeader('Content-Type', fileData.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileData.fileName}"`);
      res.setHeader('Content-Length', fileData.fileSize);

      // Send file
      res.send(fileData.buffer);

    } catch (error) {
      console.error('Download export error:', error);
      res.status(404).json({
        success: false,
        message: error.message || 'Failed to download export'
      });
    }
  }
);

/**
 * GET /api/reports/export/history
 * Get export history
 */
router.get(
  '/export/history',
  authenticate,
  async (req, res) => {
    try {
      const userId = req.query.userId || (req.user._id || req.user.id);
      const format = req.query.format;
      const limit = parseInt(req.query.limit) || 50;

      // Only allow users to see their own history unless admin
      const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
      const queryUserId = isAdmin && req.query.userId ? req.query.userId : userId;

      const history = await exportService.getExportHistory(
        queryUserId,
        format,
        limit
      );

      res.json({
        success: true,
        exports: history,
        count: history.length
      });

    } catch (error) {
      console.error('Get export history error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get export history'
      });
    }
  }
);

/**
 * POST /api/reports/export/retry/:exportId
 * Retry failed export
 */
router.post(
  '/export/retry/:exportId',
  authenticate,
  async (req, res) => {
    try {
      const { exportId } = req.params;
      const userId = req.user._id || req.user.id;

      const exportSession = await exportService.retryExport(exportId);

      // Log audit event
      await auditService.logAction({
        userId,
        action: 'EXPORT_RETRIED',
        resourceType: 'ExportSession',
        resourceId: exportId,
        details: {
          retryCount: exportSession.retryCount
        },
        ipAddress: req.ip || req.connection.remoteAddress
      });

      res.json({
        success: true,
        message: 'Export retry initiated',
        exportId: exportSession._id,
        status: exportSession.status,
        retryCount: exportSession.retryCount
      });

    } catch (error) {
      console.error('Retry export error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to retry export'
      });
    }
  }
);

/**
 * DELETE /api/reports/export/:exportId
 * Delete export
 */
router.delete(
  '/export/:exportId',
  authenticate,
  async (req, res) => {
    try {
      const { exportId } = req.params;
      const userId = req.user._id || req.user.id;

      await exportService.deleteExport(exportId);

      // Log audit event
      await auditService.logAction({
        userId,
        action: 'EXPORT_DELETED',
        resourceType: 'ExportSession',
        resourceId: exportId,
        ipAddress: req.ip || req.connection.remoteAddress
      });

      res.json({
        success: true,
        message: 'Export deleted successfully'
      });

    } catch (error) {
      console.error('Delete export error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to delete export'
      });
    }
  }
);

/**
 * GET /api/reports/export/statistics
 * Get export statistics
 */
router.get(
  '/export/statistics',
  authenticate,
  async (req, res) => {
    try {
      const userId = req.query.userId;
      
      // Only allow users to see their own stats unless admin
      const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
      const queryUserId = isAdmin && userId ? userId : (req.user._id || req.user.id);

      const statistics = await exportService.getExportStatistics(queryUserId);

      res.json({
        success: true,
        statistics
      });

    } catch (error) {
      console.error('Get export statistics error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get export statistics'
      });
    }
  }
);

/**
 * POST /api/reports/export/cleanup
 * Cleanup old exports (admin only)
 */
router.post(
  '/export/cleanup',
  authenticate,
  async (req, res) => {
    try {
      // Check admin permission
      const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      const daysOld = parseInt(req.body.daysOld) || 30;

      await exportService.cleanupOldExports(daysOld);

      // Log audit event
      await auditService.logAction({
        userId: req.user._id || req.user.id,
        action: 'EXPORT_CLEANUP',
        resourceType: 'ExportSession',
        details: {
          daysOld
        },
        ipAddress: req.ip || req.connection.remoteAddress
      });

      res.json({
        success: true,
        message: `Cleaned up exports older than ${daysOld} days`
      });

    } catch (error) {
      console.error('Cleanup exports error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to cleanup exports'
      });
    }
  }
);

module.exports = router;
