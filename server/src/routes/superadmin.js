const express = require('express');
const router = express.Router();
const superAdminController = require('../controllers/superAdminController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// All routes require super admin role
router.use(authenticate);
router.use(requireRole(['system:admin', 'super_admin']));

// Dashboard
router.get('/dashboard/stats', superAdminController.getDashboardStats);
router.get('/analytics/system', superAdminController.getSystemAnalytics);
router.get('/analytics/hospital', superAdminController.getHospitalAnalytics);

// Hospitals Management
router.get('/hospitals', superAdminController.getHospitalsList);

// Contact Requests
router.get('/contact-requests', superAdminController.getContactRequests);
router.put('/contact-requests/:id', superAdminController.updateContactRequest);
router.post('/contact-requests/:id/notes', superAdminController.addRequestNote);

module.exports = router;
