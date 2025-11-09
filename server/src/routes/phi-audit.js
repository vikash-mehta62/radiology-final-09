/**
 * PHI Access Audit Routes
 * API endpoints for HIPAA compliance reporting
 */

const express = require('express');
const router = express.Router();
const phiAccessLogger = require('../services/phi-access-logger');
const PHIAccessLog = require('../models/PHIAccessLog');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

/**
 * Get PHI access audit report
 * GET /api/phi-audit/report
 * Query params: userId, patientId, resourceType, action, startDate, endDate, limit
 */
router.get('/report', authenticate, requireRole(['admin', 'compliance_officer']), async (req, res) => {
  try {
    const filters = {
      userId: req.query.userId,
      patientId: req.query.patientId,
      resourceType: req.query.resourceType,
      action: req.query.action,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: parseInt(req.query.limit) || 1000
    };

    const report = await phiAccessLogger.generateAuditReport(filters);

    // Log this audit report access
    await phiAccessLogger.logAccess({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'view',
      resourceType: 'audit_report',
      resourceId: 'phi_access_report',
      patientId: filters.patientId || 'multiple',
      patientName: 'audit_report',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      sessionId: req.sessionId || 'unknown',
      purpose: 'operations',
      success: true,
      metadata: filters
    });

    res.json({
      success: true,
      count: report.length,
      filters,
      data: report
    });
  } catch (error) {
    console.error('Failed to generate audit report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate audit report'
    });
  }
});

/**
 * Get PHI access statistics
 * GET /api/phi-audit/statistics
 * Query params: startDate, endDate
 */
router.get('/statistics', authenticate, requireRole(['admin', 'compliance_officer']), async (req, res) => {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    const statistics = await phiAccessLogger.getAccessStatistics(filters);

    res.json({
      success: true,
      filters,
      statistics
    });
  } catch (error) {
    console.error('Failed to get access statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get access statistics'
    });
  }
});

/**
 * Get recent accesses by user
 * GET /api/phi-audit/user/:userId
 */
router.get('/user/:userId', authenticate, requireRole(['admin', 'compliance_officer']), async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 100;

    const accesses = await PHIAccessLog.getRecentAccessesByUser(userId, limit);

    res.json({
      success: true,
      userId,
      count: accesses.length,
      data: accesses
    });
  } catch (error) {
    console.error('Failed to get user accesses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user accesses'
    });
  }
});

/**
 * Get accesses for a patient
 * GET /api/phi-audit/patient/:patientId
 */
router.get('/patient/:patientId', authenticate, requireRole(['admin', 'compliance_officer', 'physician']), async (req, res) => {
  try {
    const { patientId } = req.params;
    const limit = parseInt(req.query.limit) || 100;

    const accesses = await PHIAccessLog.getAccessesByPatient(patientId, limit);

    // Log this patient audit access
    await phiAccessLogger.logAccess({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'view',
      resourceType: 'patient_audit',
      resourceId: patientId,
      patientId,
      patientName: 'audit_access',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      sessionId: req.sessionId || 'unknown',
      purpose: 'operations',
      success: true
    });

    res.json({
      success: true,
      patientId,
      count: accesses.length,
      data: accesses
    });
  } catch (error) {
    console.error('Failed to get patient accesses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get patient accesses'
    });
  }
});

/**
 * Get failed access attempts
 * GET /api/phi-audit/failed-accesses
 */
router.get('/failed-accesses', authenticate, requireRole(['admin', 'compliance_officer', 'security_officer']), async (req, res) => {
  try {
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const limit = parseInt(req.query.limit) || 100;

    const failedAccesses = await PHIAccessLog.getFailedAccesses(startDate, endDate, limit);

    res.json({
      success: true,
      count: failedAccesses.length,
      data: failedAccesses
    });
  } catch (error) {
    console.error('Failed to get failed accesses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get failed accesses'
    });
  }
});

/**
 * Get export operations
 * GET /api/phi-audit/exports
 */
router.get('/exports', authenticate, requireRole(['admin', 'compliance_officer']), async (req, res) => {
  try {
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const limit = parseInt(req.query.limit) || 100;

    const exports = await PHIAccessLog.getExportOperations(startDate, endDate, limit);

    res.json({
      success: true,
      count: exports.length,
      data: exports
    });
  } catch (error) {
    console.error('Failed to get export operations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get export operations'
    });
  }
});

/**
 * Detect unusual access patterns
 * GET /api/phi-audit/unusual-access/:userId
 */
router.get('/unusual-access/:userId', authenticate, requireRole(['admin', 'compliance_officer', 'security_officer']), async (req, res) => {
  try {
    const { userId } = req.params;
    const timeWindowMinutes = parseInt(req.query.timeWindow) || 60;

    const analysis = await phiAccessLogger.detectUnusualAccess(userId, timeWindowMinutes);

    res.json({
      success: true,
      userId,
      timeWindowMinutes,
      analysis
    });
  } catch (error) {
    console.error('Failed to detect unusual access:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to detect unusual access'
    });
  }
});

/**
 * Export audit report to CSV
 * GET /api/phi-audit/export-csv
 */
router.get('/export-csv', authenticate, requireRole(['admin', 'compliance_officer']), async (req, res) => {
  try {
    const filters = {
      userId: req.query.userId,
      patientId: req.query.patientId,
      resourceType: req.query.resourceType,
      action: req.query.action,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: parseInt(req.query.limit) || 10000
    };

    const report = await phiAccessLogger.generateAuditReport(filters);

    // Convert to CSV
    const csv = convertToCSV(report);

    // Log this export
    await phiAccessLogger.logAccess({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'export',
      resourceType: 'audit_report',
      resourceId: 'phi_access_report_csv',
      patientId: 'multiple',
      patientName: 'audit_report',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      sessionId: req.sessionId || 'unknown',
      purpose: 'operations',
      success: true,
      metadata: { format: 'csv', recordCount: report.length }
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="phi-audit-report-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Failed to export audit report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export audit report'
    });
  }
});

/**
 * Helper function to convert JSON to CSV
 */
function convertToCSV(data) {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]).filter(key => !key.includes('_encrypted'));
  const csvRows = [];

  // Add header row
  csvRows.push(headers.join(','));

  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value).replace(/"/g, '""');
      return `"${String(value).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

module.exports = router;
