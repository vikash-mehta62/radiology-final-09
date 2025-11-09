const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireMFA } = require('../middleware/mfa-middleware');
const { rateLimit } = require('../middleware/session-middleware');

// Export patient data with all studies and DICOM files
// GET /api/export/patient/:patientID?includeImages=true&format=zip
// Requirements: 12.1-12.12
router.get(
  '/patient/:patientID',
  rateLimit({ maxRequests: 10, windowMs: 60000 }), // 10 exports per minute
  authenticate,
  exportController.exportPatientData
);

// Export single study data with DICOM files
// GET /api/export/study/:studyUID?includeImages=true&format=zip
// Requirements: 12.1-12.12
router.get(
  '/study/:studyUID',
  rateLimit({ maxRequests: 20, windowMs: 60000 }), // 20 exports per minute
  authenticate,
  exportController.exportStudyData
);

// Export all data (bulk export) - admin only
// GET /api/export/all?includeImages=false
// Requires MFA for sensitive bulk export
// Requirements: 12.1-12.12
router.get(
  '/all',
  rateLimit({ maxRequests: 2, windowMs: 300000 }), // 2 exports per 5 minutes
  authenticate,
  requireMFA(),
  exportController.exportAllData
);

module.exports = router;
