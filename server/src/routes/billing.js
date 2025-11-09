const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const { authenticate } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authenticate);

// AI Suggestions
router.post('/suggest-codes', billingController.suggestBillingCodes);

// Superbill CRUD
router.post('/superbills', billingController.createSuperbill);
router.get('/superbills/:id', billingController.getSuperbill);
router.get('/superbills/study/:studyInstanceUID', billingController.getSuperbillsByStudy);
router.put('/superbills/:id', billingController.updateSuperbill);
router.post('/superbills/:id/approve', billingController.approveSuperbill);

// Export
router.get('/superbills/:id/export/pdf', billingController.exportSuperbillPDF);

// Code Search
router.get('/codes/cpt/search', billingController.searchCPTCodes);
router.get('/codes/icd10/search', billingController.searchICD10Codes);

module.exports = router;
