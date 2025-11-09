/**
 * Data Retention Management Routes
 * API endpoints for HIPAA compliance data retention
 */

const express = require('express');
const router = express.Router();
const dataRetentionService = require('../services/data-retention-service');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

/**
 * Get retention policy summary
 * GET /api/data-retention/policies
 */
router.get('/policies', authenticate, requireRole(['admin', 'compliance_officer']), async (req, res) => {
  try {
    const policies = dataRetentionService.getRetentionPolicySummary();

    res.json({
      success: true,
      policies
    });
  } catch (error) {
    console.error('Failed to get retention policies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get retention policies'
    });
  }
});

/**
 * Get archive statistics
 * GET /api/data-retention/archives/statistics
 */
router.get('/archives/statistics', authenticate, requireRole(['admin', 'compliance_officer']), async (req, res) => {
  try {
    const statistics = await dataRetentionService.getArchiveStatistics();

    res.json({
      success: true,
      statistics
    });
  } catch (error) {
    console.error('Failed to get archive statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get archive statistics'
    });
  }
});

/**
 * Archive audit logs
 * POST /api/data-retention/archive/audit-logs
 * Body: { startDate, endDate }
 */
router.post('/archive/audit-logs', authenticate, requireRole(['admin', 'compliance_officer']), async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }

    const result = await dataRetentionService.archiveAuditLogs(startDate, endDate);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Failed to archive audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to archive audit logs'
    });
  }
});

/**
 * Archive PHI access logs
 * POST /api/data-retention/archive/phi-access-logs
 * Body: { startDate, endDate }
 */
router.post('/archive/phi-access-logs', authenticate, requireRole(['admin', 'compliance_officer']), async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }

    const result = await dataRetentionService.archivePHIAccessLogs(startDate, endDate);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Failed to archive PHI access logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to archive PHI access logs'
    });
  }
});

/**
 * Archive notifications
 * POST /api/data-retention/archive/notifications
 * Body: { startDate, endDate }
 */
router.post('/archive/notifications', authenticate, requireRole(['admin', 'compliance_officer']), async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }

    const result = await dataRetentionService.archiveNotifications(startDate, endDate);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Failed to archive notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to archive notifications'
    });
  }
});

/**
 * Archive export history
 * POST /api/data-retention/archive/export-history
 * Body: { startDate, endDate }
 */
router.post('/archive/export-history', authenticate, requireRole(['admin', 'compliance_officer']), async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }

    const result = await dataRetentionService.archiveExportHistory(startDate, endDate);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Failed to archive export history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to archive export history'
    });
  }
});

/**
 * Delete expired data
 * DELETE /api/data-retention/expired/:dataType
 */
router.delete('/expired/:dataType', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { dataType } = req.params;

    const validDataTypes = ['auditLogs', 'phiAccessLogs', 'notifications', 'exportHistory', 'sessions'];
    if (!validDataTypes.includes(dataType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid data type. Must be one of: ${validDataTypes.join(', ')}`
      });
    }

    const result = await dataRetentionService.deleteExpiredData(dataType);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Failed to delete expired data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete expired data'
    });
  }
});

/**
 * Run automated archival process
 * POST /api/data-retention/run-archival
 */
router.post('/run-archival', authenticate, requireRole(['admin', 'compliance_officer']), async (req, res) => {
  try {
    const results = await dataRetentionService.runAutomatedArchival();

    res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Failed to run automated archival:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run automated archival'
    });
  }
});

/**
 * Calculate expiration date for data
 * GET /api/data-retention/expiration/:dataType
 */
router.get('/expiration/:dataType', authenticate, requireRole(['admin', 'compliance_officer']), async (req, res) => {
  try {
    const { dataType } = req.params;
    const createdDate = req.query.createdDate ? new Date(req.query.createdDate) : new Date();

    const expirationDate = dataRetentionService.calculateExpirationDate(dataType, createdDate);
    const retentionDays = dataRetentionService.getRetentionPolicy(dataType);

    res.json({
      success: true,
      dataType,
      createdDate,
      expirationDate,
      retentionDays,
      retentionYears: (retentionDays / 365).toFixed(2)
    });
  } catch (error) {
    console.error('Failed to calculate expiration date:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate expiration date'
    });
  }
});

module.exports = router;
