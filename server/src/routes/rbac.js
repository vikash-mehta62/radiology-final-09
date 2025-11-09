const express = require('express');
const router = express.Router();
const rbacController = require('../controllers/rbacController');
const AuthenticationService = require('../services/authentication-service');

// Initialize authentication service for middleware
const authService = new AuthenticationService();

// Get RBAC service for permission middleware
const rbacService = rbacController.getRBACService();

// Role management routes (admin only)
router.get('/roles', 
  authService.authenticationMiddleware(),
  rbacService.requirePermission('system:admin'),
  rbacController.getRoles
);

router.get('/roles/:roleId', 
  authService.authenticationMiddleware(),
  rbacService.requirePermission('system:admin'),
  rbacController.getRole
);

router.post('/roles', 
  authService.authenticationMiddleware(),
  rbacService.requirePermission('system:admin'),
  rbacController.createRole
);

router.put('/roles/:roleId', 
  authService.authenticationMiddleware(),
  rbacService.requirePermission('system:admin'),
  rbacController.updateRole
);

router.delete('/roles/:roleId', 
  authService.authenticationMiddleware(),
  rbacService.requirePermission('system:admin'),
  rbacController.deleteRole
);

// Permission management routes (admin only)
router.get('/permissions', 
  authService.authenticationMiddleware(),
  rbacService.requirePermission('system:admin'),
  rbacController.getPermissions
);

router.post('/permissions', 
  authService.authenticationMiddleware(),
  rbacService.requirePermission('system:admin'),
  rbacController.createPermission
);

// User role assignment routes (admin and user management permissions)
router.get('/users/:userId/roles', 
  authService.authenticationMiddleware(),
  rbacService.requireAnyPermission(['users:read', 'system:admin']),
  rbacController.getUserRoles
);

router.post('/users/:userId/roles/:roleId', 
  authService.authenticationMiddleware(),
  rbacService.requireAnyPermission(['users:write', 'system:admin']),
  rbacController.assignRoleToUser
);

router.delete('/users/:userId/roles/:roleId', 
  authService.authenticationMiddleware(),
  rbacService.requireAnyPermission(['users:write', 'system:admin']),
  rbacController.removeRoleFromUser
);

router.put('/users/:userId/roles', 
  authService.authenticationMiddleware(),
  rbacService.requireAnyPermission(['users:write', 'system:admin']),
  rbacController.setUserRoles
);

// Permission checking routes
router.get('/users/:userId/permissions/:permission', 
  authService.authenticationMiddleware(),
  rbacService.requireAnyPermission(['users:read', 'system:admin']),
  rbacController.checkUserPermission
);

// Current user permission routes (accessible to authenticated users)
router.get('/me/permissions/:permission', 
  authService.authenticationMiddleware(),
  rbacController.checkCurrentUserPermission
);

router.get('/me/permissions', 
  authService.authenticationMiddleware(),
  rbacController.getCurrentUserPermissions
);

module.exports = router;