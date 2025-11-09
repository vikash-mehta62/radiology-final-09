const express = require('express');
const router = express.Router();
const followUpController = require('../controllers/followUpController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authenticate);

// Statistics
router.get('/statistics', followUpController.getStatistics);

// Overdue and upcoming
router.get('/overdue', followUpController.getOverdue);
router.get('/upcoming', followUpController.getUpcoming);

// Generate from report
router.post('/generate/:reportId', 
  requireRole(['radiologist', 'admin', 'super_admin']),
  followUpController.generateFromReport
);

// Get recommendations
router.get('/recommendations/:reportId',
  followUpController.getRecommendations
);

// CRUD operations
router.route('/')
  .get(followUpController.getFollowUps)
  .post(requireRole(['radiologist', 'admin', 'super_admin']), followUpController.createFollowUp);

router.route('/:id')
  .get(followUpController.getFollowUp)
  .put(requireRole(['radiologist', 'admin', 'super_admin']), followUpController.updateFollowUp)
  .delete(requireRole(['admin', 'super_admin']), followUpController.deleteFollowUp);

// Actions
router.post('/:id/schedule',
  requireRole(['radiologist', 'admin', 'super_admin']),
  followUpController.scheduleFollowUp
);

router.post('/:id/complete',
  requireRole(['radiologist', 'admin', 'super_admin']),
  followUpController.completeFollowUp
);

router.post('/:id/notes',
  followUpController.addNote
);

module.exports = router;
