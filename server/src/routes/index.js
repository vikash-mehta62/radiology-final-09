const express = require('express');
const { auditMiddleware, auditAction, auditLogger } = require('../middleware/auditMiddleware');
const { getRoot } = require('../controllers/healthController');
const { getStudies, getStudy, getStudyMetadata } = require('../controllers/studyController');
const { getFrame } = require('../controllers/instanceController');
const { getFrame: getFrameOrthanc, getInstanceMetadata, checkOrthancHealth } = require('../controllers/orthancInstanceController');
const { getDICOMMigrationService } = require('../services/dicom-migration-service');
const { uploadMiddleware, handleUpload } = require('../controllers/uploadController');
const { uploadZipStudy, getZipUploadInfo, testZipUpload, uploadMiddleware: zipUploadMiddleware } = require('../controllers/zipUploadController');
const { getPatients, getPatientStudies, createPatient } = require('../controllers/patientController');
const { authenticate } = require('../middleware/authMiddleware');
const authRoutes = require('./auth');
const secretsRoutes = require('./secrets');
const anonymizationRoutes = require('./anonymization');
const metricsRoutes = require('./metrics');
const healthRoutes = require('./health');
const alertsRoutes = require('./alerts');
const rbacRoutes = require('./rbac');
const adminActionRoutes = require('./admin-actions');
const migrationRoutes = require('./migration');
const pacsRoutes = require('./pacs');
const viewerSelectionRoutes = require('./viewer-selection');
const signatureRoutes = require('./signature');
const fdaSignaturesRoutes = require('./signatures'); // FDA 21 CFR Part 11 compliant signatures
// AI routes - MedSigLIP + MedGemma integration
const aiAnalysisRoutes = require('./aiAnalysis');
const systemMonitoringRoutes = require('./system-monitoring');
const usersRoutes = require('./users');
const superAdminRoutes = require('./superadmin');
const publicRoutes = require('./public');
const exportRoutes = require('./export');
const followUpRoutes = require('./follow-ups');
const worklistRoutes = require('./worklist');
const priorAuthRoutes = require('./prior-authorization');
const notificationsRoutes = require('./notifications');
const mfaRoutes = require('./mfa');
const phiAuditRoutes = require('./phi-audit');
const ipWhitelistRoutes = require('./ip-whitelist');
const dataRetentionRoutes = require('./data-retention');
const billingRoutes = require('./billing');
const fhirRoutes = require('./fhir');

const router = express.Router();

// Apply audit middleware to all routes
router.use(auditMiddleware({
  excludePaths: ['/health', '/metrics'],
  logBody: true
}));

// Health (Public - no auth required)
router.get('/', getRoot);

// PACS Upload Interface (Protected - requires authentication)
router.get('/pacs-upload', authenticate, (req, res) => {
  res.sendFile('pacs-upload.html', { root: './public' });
});

// Orthanc Viewer Interface (Protected - requires authentication)
router.get('/viewer', authenticate, (req, res) => {
  res.sendFile('orthanc-viewer.html', { root: './public' });
});

// Patients (Protected - requires authentication)
router.get('/api/patients', authenticate, getPatients);
router.get('/api/patients/:patientID/studies', authenticate, getPatientStudies);
router.post('/api/patients', authenticate, express.json(), createPatient);

// DICOM Studies (Protected - requires authentication)
router.get('/api/dicom/studies',authenticate,  getStudies);
router.get('/api/dicom/studies/:studyUid', 
   
  auditAction('study.view', (req) => ({ studyInstanceUID: req.params.studyUid })),
  getStudy
);
router.get('/api/dicom/studies/:studyUid/metadata',  getStudyMetadata);

// Frames - with migration support (Protected - requires authentication)
// New endpoint: Series-specific frames
router.get('/api/dicom/studies/:studyUid/series/:seriesUid/frames/:frameIndex', async (req, res) => {
  console.log('🎯 SERIES-SPECIFIC ROUTE HIT:', {
    studyUid: req.params.studyUid,
    seriesUid: req.params.seriesUid,
    frameIndex: req.params.frameIndex
  });
  
  const migrationService = getDICOMMigrationService({
    enableOrthancPreview: process.env.ENABLE_ORTHANC_PREVIEW !== 'false',
    migrationPercentage: parseInt(process.env.ORTHANC_MIGRATION_PERCENTAGE) || 100
  });
  
  return await migrationService.getFrameWithMigration(req, res, getFrame);
});

// Legacy endpoint: Study-level frames (for backward compatibility)
router.get('/api/dicom/studies/:studyUid/frames/:frameIndex',  async (req, res) => {
  console.log('⚠️ LEGACY ROUTE HIT (no series filter):', {
    studyUid: req.params.studyUid,
    frameIndex: req.params.frameIndex
  });
  
  const migrationService = getDICOMMigrationService({
    enableOrthancPreview: process.env.ENABLE_ORTHANC_PREVIEW !== 'false',
    migrationPercentage: parseInt(process.env.ORTHANC_MIGRATION_PERCENTAGE) || 100
  });
  
  return await migrationService.getFrameWithMigration(req, res, getFrame);
});

// Orthanc-specific endpoints (Protected - requires authentication)
router.get('/api/dicom/instances/:instanceId/metadata', authenticate, getInstanceMetadata);
router.get('/api/dicom/orthanc/health', authenticate, checkOrthancHealth);

// Upload (Protected - requires authentication)
router.post('/api/dicom/upload', 
  authenticate, 
  uploadMiddleware(), 
  auditAction('dicom.upload', (req, res, data) => ({ 
    studyInstanceUID: data.data?.studyInstanceUID,
    fileSize: req.file?.size 
  })),
  handleUpload
);

// ZIP Upload - Upload entire ZIP as single DICOM study (Protected - requires authentication)
router.post('/api/dicom/upload/zip', authenticate, zipUploadMiddleware().single('file'), uploadZipStudy);
router.get('/api/dicom/upload/zip/info', authenticate, getZipUploadInfo);
router.post('/api/dicom/upload/zip/test', authenticate, zipUploadMiddleware().single('file'), testZipUpload);

// Auth
router.use('/auth', authRoutes);

// RBAC
router.use('/api/rbac', rbacRoutes);

// Admin Actions
router.use('/api/admin-actions', adminActionRoutes);

// Secrets management
router.use('/api/secrets', secretsRoutes);

// Anonymization
router.use('/api/anonymization', anonymizationRoutes);

// Metrics
router.use('/metrics', metricsRoutes);

// Health checks
router.use('/health', healthRoutes);

// Alerts
router.use('/alerts', alertsRoutes);

// Migration (Protected - requires authentication)
router.use('/api/migration', authenticate, migrationRoutes);

// PACS Integration (Protected - requires authentication)
router.use('/api/pacs', authenticate, pacsRoutes);

// Orthanc Webhook (Auto-sync when files uploaded to Orthanc)
// Note: Webhooks use webhook security middleware, not JWT auth
const orthancWebhookRoutes = require('./orthanc-webhook');
router.use('/api', orthancWebhookRoutes);

// Orthanc Viewer API - Direct access to Orthanc for UI display (Protected - requires authentication)
const orthancViewController = require('../controllers/orthancViewController');
router.get('/api/viewer/orthanc/studies', authenticate, orthancViewController.getAllStudies);
router.get('/api/viewer/orthanc/studies/search', authenticate, orthancViewController.searchStudies);
router.get('/api/viewer/orthanc/studies/:studyId', authenticate, orthancViewController.getStudy);
router.get('/api/viewer/orthanc/series/:seriesId', authenticate, orthancViewController.getSeries);
router.get('/api/viewer/orthanc/stats', authenticate, orthancViewController.getStats);

// Unified Viewer API - Shows both Orthanc + Database data (Protected - requires authentication)
const unifiedViewController = require('../controllers/unifiedViewController');
router.get('/api/viewer/studies', authenticate, unifiedViewController.getAllStudies);
router.get('/api/viewer/studies/search', authenticate, unifiedViewController.searchStudies);
router.get('/api/viewer/studies/:studyId', authenticate, unifiedViewController.getStudy);
router.get('/api/viewer/stats', authenticate, unifiedViewController.getStats);

// Viewer Selection Sync API - Selection synchronization for measurements and annotations
router.use('/api/viewer', viewerSelectionRoutes);

// 🎯 UNIFIED REPORTING SYSTEM - Single consolidated route for all reporting
const unifiedReportsRoutes = require('./reports-unified');
router.use('/api/reports', unifiedReportsRoutes);

// Signature Upload API - Upload signatures to filesystem
router.use('/api/signature', signatureRoutes);

// FDA Digital Signatures API - FDA 21 CFR Part 11 compliant digital signatures
router.use('/api/signatures', fdaSignaturesRoutes);

// AI Analysis API - MedSigLIP detection + MedGemma reporting
router.use('/api/ai', authenticate, aiAnalysisRoutes);

// System Monitoring API - Machine statistics and system health
router.use('/api/monitoring', systemMonitoringRoutes);

// User Management API - CRUD operations for users
router.use('/api/users', usersRoutes);

// Super Admin API - Dashboard, analytics, and contact requests
router.use('/api/superadmin', superAdminRoutes);

// Public API - No authentication required
router.use('/api/public', publicRoutes);

// Export API - Data export with DICOM files
router.use('/api/export', exportRoutes);

// Follow-up Management API - Patient follow-up tracking and automation
router.use('/api/follow-ups', followUpRoutes);

// Worklist Management API - Study worklist and workflow management
router.use('/api/worklist', worklistRoutes);

// Prior Authorization API - Insurance authorization management and automation
router.use('/api/prior-auth', priorAuthRoutes);

// Critical Notifications API - Real-time critical finding notifications with escalation
router.use('/api/notifications', notificationsRoutes);

// MFA API - Multi-factor authentication
router.use('/api/mfa', mfaRoutes);

// PHI Audit API - HIPAA compliance audit logs
router.use('/api/phi-audit', phiAuditRoutes);

// IP Whitelist API - IP access control
router.use('/api/ip-whitelist', ipWhitelistRoutes);

// Data Retention API - HIPAA data retention management
router.use('/api/data-retention', dataRetentionRoutes);

// Billing API - Medical billing and coding
router.use('/api/billing', billingRoutes);

// FHIR API - HL7 FHIR R4 export for healthcare interoperability
router.use('/api/fhir', fhirRoutes);

module.exports = router;