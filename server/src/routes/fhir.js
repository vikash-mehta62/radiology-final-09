const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const fhirService = require('../services/fhir-service');
const Report = require('../models/Report');

/**
 * FHIR Export Routes
 * HL7 FHIR R4 DiagnosticReport export functionality
 */

/**
 * Export single report as FHIR DiagnosticReport
 * GET /api/fhir/reports/:reportId
 */
router.get('/reports/:reportId', authenticate, async (req, res) => {
  try {
    const { reportId } = req.params;
    
    console.log(`🔷 FHIR export requested for report: ${reportId}`);

    // Export report as FHIR DiagnosticReport
    const fhirReport = await fhirService.exportReport(reportId);

    res.json({
      success: true,
      data: fhirReport,
      format: 'FHIR R4 DiagnosticReport'
    });

  } catch (error) {
    console.error('❌ FHIR export failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Export report as FHIR Bundle (includes Patient, ImagingStudy, DiagnosticReport)
 * GET /api/fhir/reports/:reportId/bundle
 */
router.get('/reports/:reportId/bundle', authenticate, async (req, res) => {
  try {
    const { reportId } = req.params;
    
    console.log(`📦 FHIR Bundle export requested for report: ${reportId}`);

    // Export report as FHIR Bundle
    const fhirBundle = await fhirService.exportReportBundle(reportId);

    res.json({
      success: true,
      data: fhirBundle,
      format: 'FHIR R4 Bundle'
    });

  } catch (error) {
    console.error('❌ FHIR Bundle export failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Download FHIR report as JSON file
 * GET /api/fhir/reports/:reportId/download
 */
router.get('/reports/:reportId/download', authenticate, async (req, res) => {
  try {
    const { reportId } = req.params;
    const { format = 'report' } = req.query; // 'report' or 'bundle'
    
    console.log(`⬇️ FHIR download requested: ${reportId} (${format})`);

    let fhirData;
    let filename;

    if (format === 'bundle') {
      fhirData = await fhirService.exportReportBundle(reportId);
      filename = `fhir-bundle-${reportId}.json`;
    } else {
      fhirData = await fhirService.exportReport(reportId);
      filename = `fhir-report-${reportId}.json`;
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'application/fhir+json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    res.json(fhirData);

  } catch (error) {
    console.error('❌ FHIR download failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Push FHIR report to external FHIR server
 * POST /api/fhir/reports/:reportId/push
 * Body: { serverUrl: 'https://fhir-server.example.com' }
 */
router.post('/reports/:reportId/push', authenticate, async (req, res) => {
  try {
    const { reportId } = req.params;
    const { serverUrl, format = 'report' } = req.body;

    if (!serverUrl) {
      return res.status(400).json({
        success: false,
        error: 'FHIR server URL is required'
      });
    }

    console.log(`🚀 Pushing FHIR report to: ${serverUrl}`);

    let fhirData;
    if (format === 'bundle') {
      fhirData = await fhirService.exportReportBundle(reportId);
    } else {
      fhirData = await fhirService.exportReport(reportId);
    }

    // Push to FHIR server
    const result = await fhirService.pushToFHIRServer(fhirData, serverUrl);

    res.json({
      success: true,
      message: 'FHIR report pushed successfully',
      serverUrl,
      resourceId: result.id,
      resourceType: result.resourceType
    });

  } catch (error) {
    console.error('❌ FHIR push failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get FHIR export status for a report
 * GET /api/fhir/reports/:reportId/status
 */
router.get('/reports/:reportId/status', authenticate, async (req, res) => {
  try {
    const { reportId } = req.params;

    // Check if report exists and is ready for export
    const report = await Report.findOne({ reportId }).lean();

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    // Check export readiness
    const readiness = {
      reportExists: true,
      hasFindings: !!(report.findings || report.findingsText),
      hasImpression: !!report.impression,
      isSigned: !!report.signedAt,
      status: report.status,
      canExport: false,
      warnings: []
    };

    // Determine if report can be exported
    if (!readiness.hasFindings) {
      readiness.warnings.push('Report has no findings');
    }
    if (!readiness.hasImpression) {
      readiness.warnings.push('Report has no impression');
    }
    if (!readiness.isSigned) {
      readiness.warnings.push('Report is not signed');
    }

    readiness.canExport = readiness.hasFindings && readiness.hasImpression;

    res.json({
      success: true,
      reportId,
      readiness
    });

  } catch (error) {
    console.error('❌ FHIR status check failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Batch export multiple reports as FHIR Bundle
 * POST /api/fhir/reports/batch-export
 * Body: { reportIds: ['RPT-123', 'RPT-456'] }
 */
router.post('/reports/batch-export', authenticate, async (req, res) => {
  try {
    const { reportIds } = req.body;

    if (!reportIds || !Array.isArray(reportIds) || reportIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'reportIds array is required'
      });
    }

    console.log(`📦 Batch FHIR export for ${reportIds.length} reports`);

    const results = [];
    const errors = [];

    for (const reportId of reportIds) {
      try {
        const fhirReport = await fhirService.exportReport(reportId);
        results.push({
          reportId,
          success: true,
          data: fhirReport
        });
      } catch (error) {
        errors.push({
          reportId,
          success: false,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      total: reportIds.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors
    });

  } catch (error) {
    console.error('❌ Batch FHIR export failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
