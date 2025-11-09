const express = require('express');
const router = express.Router();
const adminActionController = require('../controllers/adminActionController');
const AuthenticationService = require('../services/authentication-service');
const rbacController = require('../controllers/rbacController');

// Initialize authentication service for middleware
const authService = new AuthenticationService();

// Get RBAC service for permission middleware
const rbacService = rbacController.getRBACService();

// Action reporting routes (admin and auditor access)
router.get('/reports', 
  authService.authenticationMiddleware(),
  rbacService.requireAnyPermission(['audit:read', 'system:admin']),
  adminActionController.getActionReport
);

router.get('/users/:userId/summary', 
  authService.authenticationMiddleware(),
  rbacService.requireAnyPermission(['audit:read', 'users:read', 'system:admin']),
  adminActionController.getUserActionSummary
);

router.get('/me/summary', 
  authService.authenticationMiddleware(),
  adminActionController.getCurrentUserActionSummary
);

// Session management routes (admin only)
router.get('/sessions', 
  authService.authenticationMiddleware(),
  rbacService.requirePermission('system:admin'),
  adminActionController.getActiveSessions
);

router.delete('/sessions/:sessionId', 
  authService.authenticationMiddleware(),
  rbacService.requirePermission('system:admin'),
  adminActionController.endSession
);

// Audit export routes (auditor and admin access)
router.get('/export', 
  authService.authenticationMiddleware(),
  rbacService.requireAnyPermission(['audit:export', 'system:admin']),
  adminActionController.exportAuditTrail
);

// Statistics routes (admin and auditor access)
router.get('/statistics', 
  authService.authenticationMiddleware(),
  rbacService.requireAnyPermission(['audit:read', 'system:admin']),
  adminActionController.getActionStatistics
);

module.exports = router;