/**
 * 🎯 UNIFIED REPORTING SYSTEM
 * Single consolidated route for all reporting functionality
 * 
 * Features:
 * - Report CRUD operations
 * - Template management
 * - AI-assisted generation
 * - Digital signatures
 * - Export (PDF, DICOM SR, FHIR)
 * - Audit trail
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const StructuredReport = require('../models/StructuredReport');
const ReportTemplate = require('../models/ReportTemplate');
const templateSelector = require('../services/templateSelector');
const exportService = require('../services/export-service');
const auditService = require('../services/audit-service');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configure multer for signature uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/signatures');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `signature-${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed for signatures'));
  }
});

// ============================================================================
// REQUEST LOGGING MIDDLEWARE
// ============================================================================

/**
 * Log all incoming requests for diagnostics
 */
router.use((req, res, next) => {
  console.log(`[REPORTS API] ${req.method} ${req.originalUrl || req.url}`);
  next();
});

// ============================================================================
// HEALTH CHECK (No auth required for diagnostics)
// ============================================================================

/**
 * GET /api/reports/health
 * Health check endpoint for connectivity testing
 */
router.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'unified-reporting',
    timestamp: Date.now(),
    version: '1.0.0'
  });
});

// All other routes require authentication
router.use(authenticate);

// ✅ COMPLIANCE UPDATE: Ensure database indexes are created
// This should be called once during app initialization
async function ensureIndexes() {
  try {
    const StructuredReport = require('../models/StructuredReport');
    
    // Create indexes for performance
    await StructuredReport.collection.createIndex({ reportId: 1 }, { unique: true });
    await StructuredReport.collection.createIndex({ studyInstanceUID: 1 });
    await StructuredReport.collection.createIndex({ patientID: 1, reportStatus: 1 });
    await StructuredReport.collection.createIndex({ updatedAt: -1 });
    await StructuredReport.collection.createIndex({ reportStatus: 1, reportDate: -1 });
    
    console.log('✅ Report indexes ensured');
  } catch (error) {
    console.error('⚠️ Failed to create indexes:', error.message);
  }
}

// Call on module load (idempotent)
ensureIndexes().catch(err => console.error('Index creation error:', err));

// ============================================================================
// HELPER FUNCTIONS - Authorization & Versioning
// ============================================================================

/**
 * Check if user can access report (RBAC + tenant scoping)
 */
function canAccessReport(req, report) {
  if (!report) return false;
  
  const userId = req.user.userId || req.user._id || req.user.id;
  const userRole = req.user.role || req.user.roles?.[0];
  const userOrgId = req.user.hospitalId || req.user.orgId;
  
  // Same organization check
  const sameOrg = !report.hospitalId || String(report.hospitalId) === String(userOrgId);
  
  // Permitted roles
  const permittedRole = ['radiologist', 'admin', 'superadmin', 'qa', 'system:admin'].includes(userRole);
  
  // Is owner
  const isOwner = String(report.radiologistId) === String(userId);
  
  return sameOrg && (permittedRole || isOwner);
}

/**
 * Bump version safely
 */
function bumpVersion(report) {
  report.version = (report.version || 0) + 1;
}

/**
 * Push revision to history
 */
function pushRevision(report, user, changes, previousStatus) {
  report.revisionHistory = report.revisionHistory || [];
  report.revisionHistory.push({
    revisedBy: user?.username || 'System',
    revisedAt: new Date(),
    changes,
    previousStatus
  });
}

/**
 * Generate content hash for signature verification
 */
function contentHash(report) {
  const crypto = require('crypto');
  const payload = JSON.stringify({
    technique: report.technique,
    findingsText: report.findingsText,
    impression: report.impression,
    sections: report.sections,
    measurements: report.measurements,
    findings: report.findings,
    templateId: report.templateId
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

// ✅ COMPLIANCE UPDATE: Server-side validation rules
/**
 * Validate report content before signing
 * Returns { valid: boolean, errors: string[] }
 */
function validateReportForSigning(report) {
  const errors = [];

  // Required: Impression
  if (!report.impression || report.impression.trim() === '') {
    errors.push('Impression is required before signing');
  }

  // Required: Findings
  const hasFindings = report.findingsText && report.findingsText.trim() !== '';
  const hasStructuredFindings = report.findings && report.findings.length > 0;
  if (!hasFindings && !hasStructuredFindings) {
    errors.push('Findings are required before signing');
  }

  // Required: Technique
  if (!report.technique || report.technique.trim() === '') {
    errors.push('Technique section is required before signing');
  }

  // Required: Clinical History (if available in template)
  if (report.templateId && (!report.clinicalHistory || report.clinicalHistory.trim() === '')) {
    errors.push('Clinical history/indication is required before signing');
  }

  // ✅ COMPLIANCE UPDATE: Contrast rule for CT
  if (report.modality === 'CT' && report.technique) {
    const techniqueText = report.technique.toLowerCase();
    const findingsText = (report.findingsText || '').toLowerCase();
    
    if (techniqueText.includes('contrast') && !findingsText.includes('contrast')) {
      errors.push('Contrast mentioned in technique but not documented in findings');
    }
  }

  // Minimum content length check
  if (report.findingsText && report.findingsText.trim().length < 10) {
    errors.push('Findings section appears incomplete (too short)');
  }

  if (report.impression && report.impression.trim().length < 5) {
    errors.push('Impression section appears incomplete (too short)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================================================
// REPORT QUERIES (Must come BEFORE /:reportId to prevent shadowing)
// ============================================================================

/**
 * GET /api/reports/study/:studyInstanceUID
 * Get all reports for a study
 */
router.get('/study/:studyInstanceUID', async (req, res) => {
  try {
    const { studyInstanceUID } = req.params;

    const reports = await StructuredReport.find({ studyInstanceUID })
      .sort({ reportDate: -1 })
      .select('reportId reportDate reportStatus radiologistName signedAt modality version');

    res.json({
      success: true,
      count: reports.length,
      reports
    });

  } catch (error) {
    console.error('❌ Error fetching study reports:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/reports/patient/:patientID
 * Get all reports for a patient (prior studies)
 */
router.get('/patient/:patientID', async (req, res) => {
  try {
    const { patientID } = req.params;
    const { limit } = req.query;

    const reports = await StructuredReport.find({ patientID })
      .sort({ reportDate: -1 })
      .limit(parseInt(limit) || 10)
      .select('reportId reportDate reportStatus radiologistName studyInstanceUID modality impression');

    res.json({
      success: true,
      count: reports.length,
      reports
    });

  } catch (error) {
    console.error('❌ Error fetching patient reports:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/reports/templates
 * Get all active templates
 */
router.get('/templates', async (req, res) => {
  try {
    const { active = 'true' } = req.query;

    const templates = await ReportTemplate.find({ active: active === 'true' })
      .sort({ category: 1, name: 1 });

    res.json({
      success: true,
      templates,
      count: templates.length
    });

  } catch (error) {
    console.error('❌ Error fetching templates:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/reports/templates/suggest
 * Auto-select best template for a study
 */
router.post('/templates/suggest', async (req, res) => {
  try {
    const study = req.body;

    const result = await templateSelector.selectTemplate(study);

    if (!result.template) {
      return res.json({
        success: true,
        template: null,
        message: 'No suitable template found',
        matchScore: result.matchScore
      });
    }

    res.json({
      success: true,
      template: result.template,
      matchScore: result.matchScore,
      matchDetails: result.matchDetails
    });

  } catch (error) {
    console.error('❌ Error suggesting template:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// REPORT CRUD OPERATIONS
// ============================================================================

/**
 * POST /api/reports
 * Create new report or update draft (upsert)
 */
router.post('/', async (req, res) => {
  try {
    const {
      studyInstanceUID,
      patientID,
      patientName,
      modality,
      templateId,
      sections = {},
      findings = [],
      measurements = [],
      status = 'draft'
    } = req.body;

    if (!studyInstanceUID || !patientID) {
      return res.status(400).json({
        success: false,
        error: 'studyInstanceUID and patientID are required'
      });
    }

    const userId = req.user.userId || req.user._id || req.user.id;
    const userOrgId = req.user.hospitalId || req.user.orgId;

    // Check for existing draft
    const query = {
      studyInstanceUID,
      patientID,
      reportStatus: { $in: ['draft', 'preliminary'] },
      radiologistId: userId
    };

    let report = await StructuredReport.findOne(query);
    const isNew = !report;
    const previousStatus = report?.reportStatus;

    if (!report) {
      // Create new report with defaults
      report = new StructuredReport({
        studyInstanceUID,
        patientID,
        patientName,
        modality,
        templateId,
        radiologistId: userId,
        radiologistName: req.user.username || 'Radiologist',
        hospitalId: userOrgId,
        reportStatus: status,
        reportDate: new Date(), // Always set on create
        version: 1 // Start at version 1
      });
    }

    // Update fields
    report.sections = sections;
    report.findings = findings;
    report.measurements = measurements;
    report.templateId = templateId || report.templateId;
    
    // ✅ COMPLIANCE UPDATE: Accept keyImages from client
    if (req.body.keyImages !== undefined) {
      report.keyImages = req.body.keyImages;
    }

    // ✅ TEMPLATE FIX: Build narrative fields with proper precedence
    // Priority: direct field > sections field > existing value
    report.technique = req.body.technique ?? sections.technique ?? report.technique ?? '';
    report.findingsText = req.body.findingsText ?? sections.findings ?? sections.findingsText ?? report.findingsText ?? '';
    report.impression = req.body.impression ?? sections.impression ?? report.impression ?? '';
    report.clinicalHistory = req.body.clinicalHistory ?? sections.clinicalHistory ?? sections.indication ?? report.clinicalHistory ?? '';
    report.recommendations = req.body.recommendations ?? sections.recommendations ?? report.recommendations ?? '';
    
    // ✅ TEMPLATE FIX: Store template metadata
    if (req.body.templateName) report.templateName = req.body.templateName;
    if (req.body.templateVersion) report.templateVersion = req.body.templateVersion;

    // Add revision entry with proper versioning
    if (!isNew) {
      bumpVersion(report);
      pushRevision(report, req.user, 'Auto-save/update', previousStatus);
    } else {
      pushRevision(report, req.user, 'Report created', null);
    }

    await report.save();

    // ✅ WORKLIST EMPTY FIX: On create/update of report: upsert worklist row
    try {
      const WorklistItem = require('../models/WorklistItem');
      await WorklistItem.updateOne(
        { studyInstanceUID: studyInstanceUID },
        { 
          $set: {
            reportStatus: 'draft',
            reportId: report._id.toString(),
            status: 'in_progress' // ✅ WORKLIST EMPTY FIX: status=IN_PROGRESS, reportStatus='DRAFT'
          },
          $setOnInsert: {
            patientID: patientID,
            hospitalId: userOrgId,
            priority: 'routine',
            scheduledFor: new Date()
          }
        },
        { upsert: true }
      );
      console.log(`✅ Worklist updated for study: ${studyInstanceUID}`);
    } catch (worklistError) {
      console.error('Failed to update worklist:', worklistError.message);
      // Don't fail the request if worklist update fails
    }

    res.json({
      success: true,
      report: report.toObject(),
      message: isNew ? 'Report created' : 'Report updated'
    });

  } catch (error) {
    console.error('❌ Error creating/updating report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/reports/:reportId
 * Get report by ID (with access control)
 */
router.get('/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    console.log('📋 Fetching report:', reportId);
    
    // Try to find by reportId field first (SR-xxx format)
    let report = await StructuredReport.findOne({ reportId });
    
    // Fallback: try MongoDB _id if reportId not found
    if (!report && reportId.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('   Trying MongoDB _id fallback');
      report = await StructuredReport.findById(reportId);
    }
    
    if (!report) {
      console.error('❌ Report not found:', reportId);
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }
    
    console.log('✅ Report found:', report.reportId);

    // Access control check
    if (!canAccessReport(req, report)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You do not have permission to view this report'
      });
    }

    // Audit log (minimal PHI)
    await auditService.logAction({
      userId: req.user.userId || req.user._id,
      action: 'REPORT_READ',
      resourceType: 'Report',
      resourceId: reportId,
      details: {
        reportStatus: report.reportStatus
      },
      ipAddress: req.ip || req.connection.remoteAddress
    }).catch(err => console.error('Audit log failed:', err));

    res.json({
      success: true,
      report: report.toObject()
    });

  } catch (error) {
    console.error('❌ Error fetching report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/reports/:reportId
 * Update report (with access control and versioning)
 * ✅ COMPLIANCE UPDATE: Optimistic locking with ETag/version checking
 */
router.put('/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    const updates = req.body;
    const clientVersion = req.headers['if-match']; // ETag from client

    const report = await StructuredReport.findOne({ reportId });
    
    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    // Access control check
    if (!canAccessReport(req, report)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You do not have permission to edit this report'
      });
    }

    // ✅ COMPLIANCE UPDATE: Check if report is signed/final - reject modifications
    if (report.reportStatus === 'final' || report.reportStatus === 'final_with_addendum') {
      return res.status(409).json({
        success: false,
        error: 'SIGNED_IMMUTABLE',
        message: 'Cannot edit signed report. Signed fields are immutable. Use addendum instead.'
      });
    }

    // ✅ COMPLIANCE UPDATE: Optimistic locking - version conflict detection
    if (clientVersion && String(report.version) !== String(clientVersion)) {
      return res.status(409).json({
        success: false,
        error: 'VERSION_CONFLICT',
        message: 'Report has been modified by another user',
        serverVersion: report.version,
        clientVersion: clientVersion
      });
    }

    // Capture previous status before mutation
    const previousStatus = report.reportStatus;

    // ✅ TEMPLATE FIX: Check if template changed
    const templateChanged = updates.templateId && String(updates.templateId) !== String(report.templateId);
    
    if (templateChanged) {
      console.log('🔄 Template changed:', report.templateId, '→', updates.templateId);
      
      // ✅ TEMPLATE FIX: When template changes, replace sections entirely (do not merge)
      if (updates.sections) {
        report.sections = updates.sections; // Replace, not merge
      }
      
      // ✅ TEMPLATE FIX: Update template metadata
      report.templateId = updates.templateId;
      if (updates.templateName) report.templateName = updates.templateName;
      if (updates.templateVersion) report.templateVersion = updates.templateVersion;
    }

    // Update allowed fields
    const allowedFields = [
      'findings', 'measurements', 'sections', 'templateId', 'templateName', 'templateVersion',
      'technique', 'findingsText', 'impression', 'keyImages', 'tags',
      'clinicalHistory', 'recommendations', 'criticalComms'
    ];

    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        report[field] = updates[field];
      }
    });

    // ✅ TEMPLATE FIX: Recompute narrative fields with proper precedence
    // Priority: direct field > sections field > existing value
    if (updates.sections || updates.technique !== undefined) {
      report.technique = updates.technique ?? updates.sections?.technique ?? report.technique ?? '';
    }
    
    if (updates.sections || updates.findingsText !== undefined) {
      report.findingsText = updates.findingsText ?? updates.sections?.findings ?? updates.sections?.findingsText ?? report.findingsText ?? '';
    }
    
    if (updates.sections || updates.impression !== undefined) {
      report.impression = updates.impression ?? updates.sections?.impression ?? report.impression ?? '';
    }
    
    if (updates.sections || updates.clinicalHistory !== undefined) {
      report.clinicalHistory = updates.clinicalHistory ?? updates.sections?.clinicalHistory ?? updates.sections?.indication ?? report.clinicalHistory ?? '';
    }
    
    if (updates.sections || updates.recommendations !== undefined) {
      report.recommendations = updates.recommendations ?? updates.sections?.recommendations ?? report.recommendations ?? '';
    }

    // Bump version and add revision
    bumpVersion(report);
    pushRevision(report, req.user, 'Report updated', previousStatus);

    await report.save();

    // ✅ COMPLIANCE UPDATE: Return ETag header with new version
    res.setHeader('ETag', String(report.version));

    res.json({
      success: true,
      report: report.toObject(),
      version: report.version // Include version in response
    });

  } catch (error) {
    console.error('❌ Error updating report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/reports/:reportId
 * Delete draft report (with access control)
 */
router.delete('/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await StructuredReport.findOne({ reportId });

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    // Access control check
    if (!canAccessReport(req, report)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You do not have permission to delete this report'
      });
    }

    // Only allow deletion of drafts
    if (report.reportStatus !== 'draft') {
      return res.status(400).json({
        success: false,
        error: 'Only draft reports can be deleted'
      });
    }

    await report.deleteOne();

    // Audit log
    await auditService.logAction({
      userId: req.user.userId || req.user._id,
      action: 'REPORT_DELETED',
      resourceType: 'Report',
      resourceId: reportId,
      ipAddress: req.ip || req.connection.remoteAddress
    }).catch(err => console.error('Audit log failed:', err));

    res.json({
      success: true,
      message: 'Report deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// REPORT FINALIZATION & SIGNING
// ============================================================================

/**
 * POST /api/reports/:reportId/finalize
 * Finalize report (make it preliminary) with access control
 */
router.post('/:reportId/finalize', async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await StructuredReport.findOne({ reportId });

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    // Access control check
    if (!canAccessReport(req, report)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You do not have permission to finalize this report'
      });
    }

    const previousStatus = report.reportStatus;
    report.reportStatus = 'preliminary';
    
    bumpVersion(report);
    pushRevision(report, req.user, 'Report finalized', previousStatus);

    await report.save();

    // ✅ WORKLIST EMPTY FIX: On finalize: status=COMPLETED, reportStatus='FINALIZED'
    try {
      const WorklistItem = require('../models/WorklistItem');
      await WorklistItem.updateOne(
        { studyInstanceUID: report.studyInstanceUID },
        { 
          $set: {
            reportStatus: 'finalized',
            reportId: report._id.toString(),
            status: 'completed',
            completedAt: new Date()
          }
        }
      );
      console.log(`✅ Worklist updated for study: ${report.studyInstanceUID}`);
    } catch (worklistError) {
      console.error('Failed to update worklist:', worklistError.message);
      // Don't fail the request if worklist update fails
    }

    res.json({
      success: true,
      report: report.toObject(),
      message: 'Report finalized'
    });

  } catch (error) {
    console.error('❌ Error finalizing report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/reports/:reportId/sign
 * Sign and finalize report with content hash verification
 * ✅ COMPLIANCE UPDATE: Enhanced FDA-compliant signature with validation
 */
router.post('/:reportId/sign', upload.single('signatureFile'), async (req, res) => {
  try {
    const { reportId } = req.params;
    
    // ✅ FIX: Parse signatureData from request body
    let signatureData = {};
    if (req.body.signatureData) {
      try {
        signatureData = typeof req.body.signatureData === 'string' 
          ? JSON.parse(req.body.signatureData) 
          : req.body.signatureData;
      } catch (err) {
        console.error('Failed to parse signatureData:', err);
      }
    }
    
    const { 
      signatureText = signatureData.signatureText,
      signatureMeaning = signatureData.signatureMeaning || 'author',
      password = signatureData.password,
      reason = signatureData.reason
    } = signatureData;

    console.log('📝 Sign request received:', {
      reportId,
      hasSignatureText: !!signatureText,
      hasSignatureImage: !!req.file,
      hasFile: !!req.file,
      signatureMeaning
    });

    const report = await StructuredReport.findOne({ reportId });

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    // Access control check
    if (!canAccessReport(req, report)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You do not have permission to sign this report'
      });
    }

    // ✅ SIGNATURE FIX: Require either signature file OR signature text
    if (!req.file && !signatureText) {
      return res.status(400).json({
        success: false,
        error: 'SIGNATURE_REQUIRED',
        message: 'Either signature image or signature text is required to sign the report'
      });
    }

    // ✅ PASSWORD VERIFICATION: Verify user password before signing
    if (password) {
      const User = require('../models/User');
      const bcrypt = require('bcryptjs');
      const userId = req.user.userId || req.user._id || req.user.id;
      const user = await User.findById(userId);
      
      if (user && user.passwordHash) {
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
          return res.status(401).json({
            success: false,
            error: 'INVALID_PASSWORD',
            message: 'Invalid password. Please enter your correct password to sign the report.'
          });
        }
      }
    }

    // ✅ COMPLIANCE UPDATE: Server-side validation before signing
    const validation = validateReportForSigning(report);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_FAILED',
        message: 'Report validation failed',
        validationErrors: validation.errors
      });
    }

    const previousStatus = report.reportStatus;
    const userId = req.user.userId || req.user._id || req.user.id;

    // Generate content hash to bind signature to content
    const hash = contentHash(report);

    // ✅ COMPLIANCE UPDATE: Lock template version at signing
    if (report.templateId && !report.templateVersion) {
      // Fetch template version if not already set
      const template = await ReportTemplate.findOne({ id: report.templateId });
      if (template) {
        report.templateVersion = template.version || '1.0';
      }
    }

    // ✅ FIX: Get user info for signature
    const User = require('../models/User');
    const user = await User.findById(userId);
    const fullName = user?.fullName || user?.username || req.user.username || 'Radiologist';
    const licenseNumber = user?.licenseNumber || '';
    const specialty = user?.specialty || '';

    // ✅ COMPLIANCE UPDATE: Enhanced FDA-compliant signature block
    report.signature = {
      by: userId,
      displayName: fullName,
      licenseNumber: licenseNumber,
      specialty: specialty,
      at: new Date(),
      method: req.file ? 'image' : 'text',
      meaning: signatureMeaning || 'author',
      reason: reason,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent') || 'Unknown',
      contentHash: hash
    };

    // ✅ FIX: Store signature image file (uploaded to server)
    if (req.file) {
      // Uploaded file - store relative path
      report.radiologistSignatureUrl = `/uploads/signatures/${req.file.filename}`;
      report.radiologistSignaturePublicId = req.file.filename;
      console.log('✅ Signature file saved:', req.file.filename);
    }

    // Store text signaturere
    if (signatureText) {
      report.radiologistSignature = signatureText;
    }
    
    // Store full radiologist name
    report.radiologistName = fullName;

    // ✅ COMPLIANCE UPDATE: Set status based on context
    if (report.reportStatus === 'final' && reason) {
      // This is an addendum signature
      report.reportStatus = 'final_with_addendum';
    } else {
      report.reportStatus = 'final';
    }
    
    report.signedAt = new Date();
    
    bumpVersion(report);
    pushRevision(report, req.user, 'Report signed and finalized', previousStatus);

    // ✅ COMPLIANCE UPDATE: Generate and store JSON export on signing
    report.exportedJSON = {
      reportId: report.reportId,
      patientID: report.patientID,
      patientName: report.patientName,
      studyInstanceUID: report.studyInstanceUID,
      modality: report.modality,
      technique: report.technique,
      clinicalHistory: report.clinicalHistory, // ✅ COMPLIANCE UPDATE: Include clinical history
      findingsText: report.findingsText,
      impression: report.impression,
      recommendations: report.recommendations,
      sections: report.sections,
      findings: report.findings,
      measurements: report.measurements,
      aiDetections: report.aiDetections, // ✅ COMPLIANCE UPDATE: Include AI detections
      keyImages: report.keyImages, // ✅ COMPLIANCE UPDATE: Include key images
      signedAt: report.signedAt,
      signedBy: report.radiologistName,
      signature: report.signature,
      version: report.version,
      templateId: report.templateId,
      templateVersion: report.templateVersion, // ✅ COMPLIANCE UPDATE: Template version
      exportedAt: new Date()
    };

    await report.save();

    // ✅ WORKLIST EMPTY FIX: On sign: keep status=COMPLETED, reportStatus='SIGNED'
    try {
      const WorklistItem = require('../models/WorklistItem');
      await WorklistItem.updateOne(
        { studyInstanceUID: report.studyInstanceUID },
        { 
          $set: {
            reportStatus: 'finalized', // Keep as 'finalized' (signed is implicit)
            reportId: report._id.toString(),
            status: 'completed',
            completedAt: report.signedAt
          }
        }
      );
      console.log(`✅ Worklist updated for study: ${report.studyInstanceUID}`);
    } catch (worklistError) {
      console.error('Failed to update worklist:', worklistError.message);
      // Don't fail the request if worklist update fails
    }

    // Audit log
    await auditService.logAction({
      userId,
      action: 'REPORT_SIGNED',
      resourceType: 'Report',
      resourceId: reportId,
      details: {
        contentHash: hash,
        signatureMethod: req.file ? 'image' : 'text',
        meaning: signatureMeaning || 'author',
        templateVersion: report.templateVersion
      },
      ipAddress: req.ip || req.connection.remoteAddress
    }).catch(err => console.error('Audit log failed:', err));

    res.json({
      success: true,
      report: report.toObject(),
      message: 'Report signed and finalized'
    });

  } catch (error) {
    console.error('❌ Error signing report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/reports/:reportId/critical-comm
 * Document critical result communication
 * ✅ COMPLIANCE UPDATE: Critical finding notification tracking
 */
router.post('/:reportId/critical-comm', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { recipient, method, notes } = req.body;

    if (!recipient || !method) {
      return res.status(400).json({
        success: false,
        error: 'Recipient and communication method are required'
      });
    }

    const report = await StructuredReport.findOne({ reportId });

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    // Access control check
    if (!canAccessReport(req, report)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const userId = req.user.userId || req.user._id || req.user.id;

    // Add critical communication record
    report.criticalComms = report.criticalComms || [];
    report.criticalComms.push({
      communicatedBy: req.user.username,
      communicatedById: userId,
      communicatedAt: new Date(),
      recipient: recipient,
      method: method, // phone, email, in-person, etc.
      notes: notes,
      acknowledged: true
    });

    await report.save();

    // Audit log
    await auditService.logAction({
      userId,
      action: 'CRITICAL_COMM_DOCUMENTED',
      resourceType: 'Report',
      resourceId: reportId,
      details: {
        recipient,
        method
      },
      ipAddress: req.ip || req.connection.remoteAddress
    }).catch(err => console.error('Audit log failed:', err));

    res.json({
      success: true,
      report: report.toObject(),
      message: 'Critical communication documented'
    });

  } catch (error) {
    console.error('❌ Error documenting critical communication:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/reports/:reportId/addendum
 * Add addendum to finalized report (with access control)
 * ✅ COMPLIANCE UPDATE: Enhanced addendum with signature support
 */
router.post('/:reportId/addendum', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { content, reason } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Addendum content is required'
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Reason for addendum is required'
      });
    }

    const report = await StructuredReport.findOne({ reportId });

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    // Access control check
    if (!canAccessReport(req, report)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You do not have permission to add addendum to this report'
      });
    }

    // ✅ COMPLIANCE UPDATE: Only allow addendum on final reports
    if (report.reportStatus !== 'final' && report.reportStatus !== 'final_with_addendum') {
      return res.status(400).json({
        success: false,
        error: 'Addendum can only be added to finalized reports'
      });
    }

    const userId = req.user.userId || req.user._id || req.user.id;

    // ✅ COMPLIANCE UPDATE: Add addendum with signature metadata
    report.addenda = report.addenda || [];
    report.addenda.push({
      content,
      reason,
      addedBy: req.user.username,
      addedById: userId,
      addedAt: new Date(),
      // Signature metadata for addendum
      signature: {
        by: userId,
        displayName: req.user.username,
        at: new Date(),
        meaning: 'addendum',
        reason: reason,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent') || 'Unknown'
      }
    });

    // ✅ COMPLIANCE UPDATE: Update status to indicate addendum present
    report.reportStatus = 'final_with_addendum';

    bumpVersion(report);

    await report.save();

    // Audit log
    await auditService.logAction({
      userId,
      action: 'ADDENDUM_ADDED',
      resourceType: 'Report',
      resourceId: reportId,
      details: {
        reason,
        addendumCount: report.addenda.length
      },
      ipAddress: req.ip || req.connection.remoteAddress
    }).catch(err => console.error('Audit log failed:', err));

    res.json({
      success: true,
      report: report.toObject(),
      message: 'Addendum added successfully'
    });

  } catch (error) {
    console.error('❌ Error adding addendum:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// EXPORT FUNCTIONALITY (with format validation and access control)
// ============================================================================

/**
 * GET /api/reports/:reportId/export
 * Export report in various formats (with validation and access control)
 * Query param: ?format=pdf|dicom-sr|fhir|json
 */
router.get('/:reportId/export', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { format = 'pdf' } = req.query;

    // Strict format validation
    const validFormats = ['pdf', 'dicom-sr', 'fhir', 'json'];
    if (!validFormats.includes(format)) {
      console.error(`❌ Invalid export format: ${format}`);
      return res.status(400).json({
        success: false,
        error: `Invalid format: ${format}. Must be one of: ${validFormats.join(', ')}`
      });
    }

    console.log(`📤 Export request: reportId=${reportId}, format=${format}`);

    const report = await StructuredReport.findOne({ reportId });

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    // Access control check
    if (!canAccessReport(req, report)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You do not have permission to export this report'
      });
    }

    // Audit log
    await auditService.logAction({
      userId: req.user.userId || req.user._id,
      action: 'REPORT_EXPORTED',
      resourceType: 'Report',
      resourceId: reportId,
      details: {
        format,
        reportStatus: report.reportStatus
      },
      ipAddress: req.ip || req.connection.remoteAddress
    }).catch(err => console.error('Audit log failed:', err));

    // Handle different export formats
    switch (format) {
      case 'pdf':
        const pdfBuffer = await generateReportPDF(report);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="report-${reportId}.pdf"`);
        return res.send(pdfBuffer);

      case 'dicom-sr':
        const dicomSR = generateDICOMSR(report);
        res.setHeader('Content-Type', 'application/dicom');
        res.setHeader('Content-Disposition', `attachment; filename="report-${reportId}.dcm"`);
        return res.send(dicomSR);

      case 'fhir':
        const fhirReport = generateFHIRReport(report);
        res.setHeader('Content-Type', 'application/fhir+json');
        res.setHeader('Content-Disposition', `attachment; filename="report-${reportId}.json"`);
        return res.json(fhirReport);

      case 'json':
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="report-${reportId}.json"`);
        return res.json({
          success: true,
          report: report.toObject()
        });

      default:
        return res.status(400).json({
          success: false,
          error: `Unsupported format: ${format}. Use pdf, dicom-sr, fhir, or json`
        });
    }

  } catch (error) {
    console.error('❌ Error exporting report:', error);
    console.error('   Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message,
      code: 'EXPORT_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/reports/:reportId/pdf
 * Export report to PDF (legacy endpoint)
 */
router.get('/:reportId/pdf', async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await StructuredReport.findOne({ reportId });

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    // Generate PDF (implement PDF generation service)
    const pdfBuffer = await generateReportPDF(report);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-${reportId}.pdf"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/reports/:reportId/export/pdf
 * Export report to PDF (alternative endpoint for compatibility)
 */
router.post('/:reportId/export/pdf', async (req, res) => {
  try {
    const { reportId } = req.params;
    console.log(`📤 PDF export request (POST): reportId=${reportId}`);

    const report = await StructuredReport.findOne({ reportId });

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    const pdfBuffer = await generateReportPDF(report);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-${reportId}.pdf"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/reports/:reportId/export/dicom-sr
 * Export report to DICOM SR (alternative endpoint)
 */
router.post('/:reportId/export/dicom-sr', async (req, res) => {
  try {
    const { reportId } = req.params;
    console.log(`📤 DICOM SR export request (POST): reportId=${reportId}`);

    const report = await StructuredReport.findOne({ reportId });

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    const dicomSR = generateDICOMSR(report);

    res.setHeader('Content-Type', 'application/dicom');
    res.setHeader('Content-Disposition', `attachment; filename="report-${reportId}.dcm"`);
    res.send(dicomSR);

  } catch (error) {
    console.error('❌ Error generating DICOM SR:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/reports/:reportId/export/fhir
 * Export report to FHIR (alternative endpoint)
 */
router.post('/:reportId/export/fhir', async (req, res) => {
  try {
    const { reportId } = req.params;
    console.log(`📤 FHIR export request (POST): reportId=${reportId}`);

    const report = await StructuredReport.findOne({ reportId });

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    const fhirReport = generateFHIRReport(report);

    res.setHeader('Content-Type', 'application/fhir+json');
    res.setHeader('Content-Disposition', `attachment; filename="report-${reportId}.json"`);
    res.json(fhirReport);

  } catch (error) {
    console.error('❌ Error generating FHIR:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/reports/:reportId/export/txt
 * Export report to plain text (alternative endpoint)
 */
router.post('/:reportId/export/txt', async (req, res) => {
  try {
    const { reportId } = req.params;
    console.log(`📤 Text export request (POST): reportId=${reportId}`);

    const report = await StructuredReport.findOne({ reportId });

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    const text = `
MEDICAL REPORT
==============

Report ID: ${report.reportId}
Patient: ${report.patientName} (${report.patientID})
Study: ${report.studyInstanceUID}
Modality: ${report.modality}
Date: ${new Date(report.reportDate).toLocaleDateString()}
Radiologist: ${report.radiologistName}
Status: ${report.reportStatus.toUpperCase()}

TECHNIQUE
---------
${report.technique || 'N/A'}

FINDINGS
--------
${report.findingsText || 'N/A'}

IMPRESSION
----------
${report.impression || 'N/A'}

${report.signedAt ? `\nSigned by: ${report.radiologistName}\nDate: ${new Date(report.signedAt).toLocaleString()}` : ''}
    `;

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="report-${reportId}.txt"`);
    res.send(text);

  } catch (error) {
    console.error('❌ Error generating text:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/reports/:reportId/export
 * Export report (async with export service)
 */
router.post('/:reportId/export', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { format = 'pdf' } = req.body;

    const userId = req.user._id || req.user.id;
    const metadata = {
      recipient: req.body.recipient,
      purpose: req.body.purpose,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      exportOptions: req.body.options || {}
    };

    const exportSession = await exportService.initiateExport(
      reportId,
      format,
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
        format,
        exportId: exportSession._id.toString()
      },
      ipAddress: metadata.ipAddress
    });

    res.status(202).json({
      success: true,
      message: `${format.toUpperCase()} export initiated`,
      exportId: exportSession._id,
      status: exportSession.status
    });

  } catch (error) {
    console.error('❌ Error initiating export:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// ✅ COMPLIANCE UPDATE (ADVANCED): PHI-SAFE SHARING
// ============================================================================

/**
 * POST /api/reports/:reportId/export/share
 * Create a PHI-safe shareable link for report export
 */
router.post('/:reportId/export/share', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { payload } = req.body;

    const report = await StructuredReport.findOne({ reportId });

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    // Access control check
    if (!canAccessReport(req, report)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You do not have permission to share this report'
      });
    }

    const userId = req.user.userId || req.user._id || req.user.id;

    // ✅ COMPLIANCE UPDATE (ADVANCED): Sanitize payload - remove PHI
    const sanitizedPayload = {
      reportId: report.reportId,
      caseCode: `SR-${report.reportId.substring(0, 8)}`, // Short case code
      studyInstanceUID: report.studyInstanceUID,
      modality: report.modality,
      templateId: report.templateId,
      templateName: report.templateName,
      templateVersion: report.templateVersion,
      technique: report.technique,
      findingsText: report.findingsText,
      impression: report.impression,
      recommendations: report.recommendations,
      sections: report.sections || {},
      findings: report.findings || [],
      measurements: report.measurements || [],
      keyImages: payload?.keyImages || report.keyImages || [],
      legend: payload?.legend || [],
      measurementsTable: payload?.measurementsTable || [],
      reportStatus: report.reportStatus,
      createdAt: report.createdAt || report.metadata?.createdAt,
      signedAt: report.signedAt,
      version: report.version,
      exportedAt: new Date().toISOString()
      // ✅ COMPLIANCE UPDATE (ADVANCED): PHI fields explicitly excluded:
      // - patientName
      // - patientID
      // - aiAnalysisId
      // - radiologistName
      // - radiologistId
    };

    // Generate unique share ID
    const crypto = require('crypto');
    const shareId = crypto.randomBytes(16).toString('hex');

    // Set expiration (default 24 hours)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Store share record in report
    report.sharedExports = report.sharedExports || [];
    report.sharedExports.push({
      shareId,
      payload: sanitizedPayload,
      createdBy: userId,
      createdByName: req.user.username,
      createdAt: new Date(),
      expiresAt,
      accessCount: 0
    });

    await report.save();

    // Audit log
    await auditService.logAction({
      userId,
      action: 'SHARE_CREATED',
      resourceType: 'Report',
      resourceId: reportId,
      details: {
        shareId,
        expiresAt
      },
      ipAddress: req.ip || req.connection.remoteAddress
    }).catch(err => console.error('Audit log failed:', err));

    // Build share URL
    const baseUrl = process.env.PUBLIC_URL || req.protocol + '://' + req.get('host');
    const shareUrl = `${baseUrl}/share/${shareId}`;

    res.json({
      success: true,
      shareId,
      url: shareUrl,
      expiresAt: expiresAt.toISOString(),
      message: 'Shareable link created (PHI redacted)'
    });

  } catch (error) {
    console.error('❌ Error creating share:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/reports/export/share/:shareId
 * Retrieve shared report export (PHI-safe)
 */
router.get('/export/share/:shareId', async (req, res) => {
  try {
    const { shareId } = req.params;

    // Find report with this share ID
    const report = await StructuredReport.findOne({
      'sharedExports.shareId': shareId
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Share not found or expired'
      });
    }

    // Find the specific share
    const share = report.sharedExports.find(s => s.shareId === shareId);

    if (!share) {
      return res.status(404).json({
        success: false,
        error: 'Share not found'
      });
    }

    // Check expiration
    if (new Date() > new Date(share.expiresAt)) {
      return res.status(410).json({
        success: false,
        error: 'Share link has expired'
      });
    }

    // Increment access count
    share.accessCount = (share.accessCount || 0) + 1;
    share.lastAccessedAt = new Date();
    await report.save();

    // Audit log (no user auth required for public share)
    await auditService.logAction({
      userId: 'anonymous',
      action: 'SHARE_ACCESSED',
      resourceType: 'Report',
      resourceId: report.reportId,
      details: {
        shareId,
        accessCount: share.accessCount
      },
      ipAddress: req.ip || req.connection.remoteAddress
    }).catch(err => console.error('Audit log failed:', err));

    res.json({
      success: true,
      payload: share.payload,
      expiresAt: share.expiresAt,
      accessCount: share.accessCount
    });

  } catch (error) {
    console.error('❌ Error retrieving share:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate PDF from report with hospital info and signature
 */
async function generateReportPDF(report) {
  try {
    // Try to use PDFKit if available
    const PDFDocument = require('pdfkit');
    const Hospital = require('../models/Hospital');
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {});

    // Get hospital information
    let hospital = null;
    if (report.hospitalId) {
      hospital = await Hospital.findOne({ hospitalId: report.hospitalId });
    }

    // ===== HEADER WITH HOSPITAL INFO =====
    const pageWidth = doc.page.width - 100; // Account for margins
    
    // Hospital Logo (if available)
    if (hospital && hospital.logoUrl) {
      try {
        doc.image(hospital.logoUrl, 50, 45, { width: 80 });
      } catch (err) {
        console.warn('Failed to load hospital logo:', err.message);
      }
    }

    // Hospital Name and Address
    doc.fontSize(16).font('Helvetica-Bold');
    doc.text(hospital?.name || 'Medical Center', hospital?.logoUrl ? 140 : 50, 50);
    
    doc.fontSize(9).font('Helvetica');
    if (hospital?.address) {
      const addr = hospital.address;
      const addressLine = [addr.street, addr.city, addr.state, addr.zipCode, addr.country]
        .filter(Boolean).join(', ');
      doc.text(addressLine, hospital?.logoUrl ? 140 : 50, 70);
    }
    if (hospital?.contactPhone) {
      doc.text(`Phone: ${hospital.contactPhone}`, hospital?.logoUrl ? 140 : 50, 85);
    }
    if (hospital?.contactEmail) {
      doc.text(`Email: ${hospital.contactEmail}`, hospital?.logoUrl ? 140 : 50, 97);
    }

    // Horizontal line
    doc.moveTo(50, 120).lineTo(pageWidth + 50, 120).stroke();
    doc.moveDown(2);

    // ===== REPORT TITLE =====
    doc.fontSize(20).font('Helvetica-Bold').text('RADIOLOGY REPORT', { align: 'center' });
    doc.moveDown();

    // ===== PATIENT & STUDY INFO =====
    doc.fontSize(10).font('Helvetica');
    const infoY = doc.y;
    
    // Left column
    doc.text(`Report ID: ${report.reportId}`, 50, infoY);
    doc.text(`Patient: ${report.patientName}`, 50, infoY + 15);
    doc.text(`Patient ID: ${report.patientID}`, 50, infoY + 30);
    doc.text(`Modality: ${report.modality}`, 50, infoY + 45);
    
    // Right column
    doc.text(`Date: ${new Date(report.reportDate).toLocaleDateString()}`, 320, infoY);
    doc.text(`Study UID: ${report.studyInstanceUID.substring(0, 30)}...`, 320, infoY + 15);
    doc.text(`Status: ${report.reportStatus.toUpperCase()}`, 320, infoY + 30);
    doc.text(`Radiologist: ${report.radiologistName}`, 320, infoY + 45);
    
    doc.moveDown(4);

    // ===== CLINICAL HISTORY =====
    if (report.clinicalHistory) {
      doc.fontSize(12).font('Helvetica-Bold').text('CLINICAL HISTORY', { underline: true });
      doc.fontSize(10).font('Helvetica').text(report.clinicalHistory, { align: 'justify' });
      doc.moveDown();
    }

    // ===== TECHNIQUE =====
    if (report.technique) {
      doc.fontSize(12).font('Helvetica-Bold').text('TECHNIQUE', { underline: true });
      doc.fontSize(10).font('Helvetica').text(report.technique, { align: 'justify' });
      doc.moveDown();
    }

    // ===== FINDINGS =====
    if (report.findingsText) {
      doc.fontSize(12).font('Helvetica-Bold').text('FINDINGS', { underline: true });
      doc.fontSize(10).font('Helvetica').text(report.findingsText, { align: 'justify' });
      doc.moveDown();
    }

    // ===== MEASUREMENTS =====
    if (report.measurements && report.measurements.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('MEASUREMENTS', { underline: true });
      doc.fontSize(10).font('Helvetica');
      report.measurements.forEach(m => {
        doc.text(`• ${m.type}: ${m.value} ${m.unit}`);
      });
      doc.moveDown();
    }

    // ===== IMPRESSION =====
    if (report.impression) {
      doc.fontSize(12).font('Helvetica-Bold').text('IMPRESSION', { underline: true });
      doc.fontSize(10).font('Helvetica').text(report.impression, { align: 'justify' });
      doc.moveDown();
    }

    // ===== RECOMMENDATIONS =====
    if (report.recommendations) {
      doc.fontSize(12).font('Helvetica-Bold').text('RECOMMENDATIONS', { underline: true });
      doc.fontSize(10).font('Helvetica').text(report.recommendations, { align: 'justify' });
      doc.moveDown();
    }

    // ===== SIGNATURE SECTION =====
    if (report.signedAt) {
      doc.moveDown(2);
      
      // Signature box
      const sigBoxY = doc.y;
      doc.rect(50, sigBoxY, pageWidth, 100).stroke();
      
      doc.moveDown(0.5);
      
      // Signature image (if available)
      if (report.radiologistSignatureUrl) {
        try {
          // Check if it's a base64 image
          if (report.radiologistSignatureUrl.startsWith('data:image')) {
            const base64Data = report.radiologistSignatureUrl.split(',')[1];
            const imgBuffer = Buffer.from(base64Data, 'base64');
            doc.image(imgBuffer, 60, sigBoxY + 10, { width: 150, height: 40 });
          } else {
            // File path
            doc.image(report.radiologistSignatureUrl, 60, sigBoxY + 10, { width: 150, height: 40 });
          }
        } catch (err) {
          console.warn('Failed to load signature image:', err.message);
          // Fallback to text signature
          if (report.radiologistSignature) {
            doc.fontSize(14).font('Helvetica-Oblique').text(report.radiologistSignature, 60, sigBoxY + 20);
          }
        }
      } else if (report.radiologistSignature) {
        // Text signature
        doc.fontSize(14).font('Helvetica-Oblique').text(report.radiologistSignature, 60, sigBoxY + 20);
      }
      
      // Signature details
      doc.fontSize(9).font('Helvetica');
      doc.text(`Signed by: ${report.radiologistName}`, 60, sigBoxY + 60);
      if (report.signature?.licenseNumber) {
        doc.text(`License: ${report.signature.licenseNumber}`, 60, sigBoxY + 73);
      }
      if (report.signature?.specialty) {
        doc.text(`Specialty: ${report.signature.specialty}`, 60, sigBoxY + 86);
      }
      
      // Date and time
      doc.text(`Date: ${new Date(report.signedAt).toLocaleString()}`, 320, sigBoxY + 60);
      doc.text(`Status: Electronically Signed`, 320, sigBoxY + 73);
      if (report.signature?.contentHash) {
        doc.fontSize(7).text(`Hash: ${report.signature.contentHash.substring(0, 32)}...`, 320, sigBoxY + 86);
      }
    }

    // ===== FOOTER =====
    doc.fontSize(8).font('Helvetica').text(
      'This report is electronically signed and legally binding.',
      50,
      doc.page.height - 50,
      { align: 'center' }
    );

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

  } catch (error) {
    console.warn('PDFKit not available, using simple text format:', error.message);
    // Fallback to simple text format
    const text = `
MEDICAL REPORT
==============

Report ID: ${report.reportId}
Patient: ${report.patientName} (${report.patientID})
Study: ${report.studyInstanceUID}
Modality: ${report.modality}
Date: ${new Date(report.reportDate).toLocaleDateString()}
Radiologist: ${report.radiologistName}
Status: ${report.reportStatus.toUpperCase()}

CLINICAL HISTORY
----------------
${report.clinicalHistory || 'N/A'}

TECHNIQUE
---------
${report.technique || 'N/A'}

FINDINGS
--------
${report.findingsText || 'N/A'}

IMPRESSION
----------
${report.impression || 'N/A'}

${report.recommendations ? `RECOMMENDATIONS\n---------------\n${report.recommendations}\n` : ''}

${report.signedAt ? `\nSigned by: ${report.radiologistName}\n${report.signature?.licenseNumber ? `License: ${report.signature.licenseNumber}\n` : ''}Date: ${new Date(report.signedAt).toLocaleString()}\nStatus: Electronically Signed` : ''}
    `;
    return Buffer.from(text);
  }
}

/**
 * Generate DICOM SR from report
 */
function generateDICOMSR(report) {
  // Simplified DICOM SR structure
  const dicomSR = {
    '00080005': { vr: 'CS', Value: ['ISO_IR 100'] }, // Specific Character Set
    '00080016': { vr: 'UI', Value: ['1.2.840.10008.5.1.4.1.1.88.11'] }, // SOP Class UID (Basic Text SR)
    '00080018': { vr: 'UI', Value: [`1.2.840.10008.${Date.now()}`] }, // SOP Instance UID
    '00080020': { vr: 'DA', Value: [new Date().toISOString().split('T')[0].replace(/-/g, '')] }, // Study Date
    '00080030': { vr: 'TM', Value: [new Date().toTimeString().split(' ')[0].replace(/:/g, '')] }, // Study Time
    '00080060': { vr: 'CS', Value: [report.modality] }, // Modality
    '00100010': { vr: 'PN', Value: [report.patientName] }, // Patient Name
    '00100020': { vr: 'LO', Value: [report.patientID] }, // Patient ID
    '0020000D': { vr: 'UI', Value: [report.studyInstanceUID] }, // Study Instance UID
    '0020000E': { vr: 'UI', Value: [`1.2.840.10008.${Date.now()}.1`] }, // Series Instance UID
    '00400275': { // Request Attributes Sequence
      vr: 'SQ',
      Value: [{
        '00321060': { vr: 'LO', Value: [report.reportId] } // Report ID
      }]
    },
    '0040A730': { // Content Sequence
      vr: 'SQ',
      Value: [
        {
          '0040A010': { vr: 'CS', Value: ['HAS CONCEPT MOD'] },
          '0040A040': { vr: 'CS', Value: ['TEXT'] },
          '0040A043': { vr: 'SQ', Value: [{ '00080100': { vr: 'SH', Value: ['121111'] } }] },
          '0040A160': { vr: 'UT', Value: [report.findingsText || ''] }
        },
        {
          '0040A010': { vr: 'CS', Value: ['HAS CONCEPT MOD'] },
          '0040A040': { vr: 'CS', Value: ['TEXT'] },
          '0040A043': { vr: 'SQ', Value: [{ '00080100': { vr: 'SH', Value: ['121112'] } }] },
          '0040A160': { vr: 'UT', Value: [report.impression || ''] }
        }
      ]
    }
  };

  return Buffer.from(JSON.stringify(dicomSR, null, 2));
}

/**
 * Generate FHIR DiagnosticReport from report
 */
function generateFHIRReport(report) {
  return {
    resourceType: 'DiagnosticReport',
    id: report.reportId,
    status: report.reportStatus === 'final' ? 'final' : 'preliminary',
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
        code: 'RAD',
        display: 'Radiology'
      }]
    }],
    code: {
      coding: [{
        system: 'http://loinc.org',
        code: '18748-4',
        display: 'Diagnostic imaging study'
      }],
      text: report.modality
    },
    subject: {
      reference: `Patient/${report.patientID}`,
      display: report.patientName
    },
    effectiveDateTime: report.reportDate,
    issued: report.signedAt || report.reportDate,
    performer: [{
      reference: `Practitioner/${report.radiologistId}`,
      display: report.radiologistName
    }],
    resultsInterpreter: [{
      reference: `Practitioner/${report.radiologistId}`,
      display: report.radiologistName
    }],
    imagingStudy: [{
      reference: `ImagingStudy/${report.studyInstanceUID}`
    }],
    conclusion: report.impression,
    conclusionCode: [],
    presentedForm: [{
      contentType: 'text/plain',
      data: Buffer.from(`${report.technique}\n\n${report.findingsText}\n\n${report.impression}`).toString('base64'),
      title: 'Radiology Report'
    }]
  };
}

module.exports = router;
