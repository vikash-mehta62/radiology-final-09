const RBACService = require('../services/rbac-service');

class RBACController {
  constructor() {
    this.rbacService = new RBACService();
    this.initialize();
  }

  async initialize() {
    try {
      await this.rbacService.initialize();
      console.log('RBAC service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize RBAC service:', error);
    }
  }

  // Role management endpoints
  getRoles = async (req, res) => {
    try {
      const roles = this.rbacService.getAllRoles();
      res.json({
        success: true,
        roles
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get roles' });
    }
  };

  getRole = async (req, res) => {
    try {
      const { roleId } = req.params;
      const role = this.rbacService.getRole(roleId);
      
      if (!role) {
        return res.status(404).json({ error: 'Role not found' });
      }
      
      res.json({
        success: true,
        role
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get role' });
    }
  };

  createRole = async (req, res) => {
    try {
      const roleData = req.body;
      const role = this.rbacService.createRole(roleData);
      
      // Save configuration
      await this.rbacService.saveConfiguration();
      
      res.status(201).json({
        success: true,
        role
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };

  updateRole = async (req, res) => {
    try {
      const { roleId } = req.params;
      const updates = req.body;
      
      const role = this.rbacService.updateRole(roleId, updates);
      
      // Save configuration
      await this.rbacService.saveConfiguration();
      
      res.json({
        success: true,
        role
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };

  deleteRole = async (req, res) => {
    try {
      const { roleId } = req.params;
      const deleted = this.rbacService.deleteRole(roleId);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Role not found' });
      }
      
      // Save configuration
      await this.rbacService.saveConfiguration();
      
      res.json({
        success: true,
        message: 'Role deleted successfully'
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };

  // Permission management endpoints
  getPermissions = async (req, res) => {
    try {
      const permissions = this.rbacService.getAllPermissions();
      res.json({
        success: true,
        permissions
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get permissions' });
    }
  };

  createPermission = async (req, res) => {
    try {
      const permissionData = req.body;
      const permission = this.rbacService.createPermission(permissionData);
      
      // Save configuration
      await this.rbacService.saveConfiguration();
      
      res.status(201).json({
        success: true,
        permission
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };

  // User role assignment endpoints
  getUserRoles = async (req, res) => {
    try {
      const { userId } = req.params;
      const roles = this.rbacService.getUserRoles(userId);
      const permissions = this.rbacService.getUserPermissions(userId);
      
      res.json({
        success: true,
        userId,
        roles,
        permissions
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get user roles' });
    }
  };

  assignRoleToUser = async (req, res) => {
    try {
      const { userId, roleId } = req.params;
      const roles = this.rbacService.assignRoleToUser(userId, roleId);
      
      res.json({
        success: true,
        userId,
        roles,
        message: `Role '${roleId}' assigned to user '${userId}'`
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };

  removeRoleFromUser = async (req, res) => {
    try {
      const { userId, roleId } = req.params;
      const roles = this.rbacService.removeRoleFromUser(userId, roleId);
      
      res.json({
        success: true,
        userId,
        roles,
        message: `Role '${roleId}' removed from user '${userId}'`
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };

  setUserRoles = async (req, res) => {
    try {
      const { userId } = req.params;
      const { roles } = req.body;
      
      if (!Array.isArray(roles)) {
        return res.status(400).json({ error: 'Roles must be an array' });
      }
      
      const updatedRoles = this.rbacService.setUserRoles(userId, roles);
      
      res.json({
        success: true,
        userId,
        roles: updatedRoles,
        message: `Roles updated for user '${userId}'`
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };

  // Permission checking endpoints
  checkUserPermission = async (req, res) => {
    try {
      const { userId, permission } = req.params;
      const hasPermission = this.rbacService.hasPermission(userId, permission);
      
      res.json({
        success: true,
        userId,
        permission,
        hasPermission
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to check permission' });
    }
  };

  checkCurrentUserPermission = async (req, res) => {
    try {
      const { permission } = req.params;
      const hasPermission = this.rbacService.hasPermission(req.user.id, permission);
      
      res.json({
        success: true,
        userId: req.user.id,
        permission,
        hasPermission
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to check permission' });
    }
  };

  getCurrentUserPermissions = async (req, res) => {
    try {
      const roles = this.rbacService.getUserRoles(req.user.id);
      const permissions = this.rbacService.getUserPermissions(req.user.id);
      
      res.json({
        success: true,
        userId: req.user.id,
        roles,
        permissions
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get user permissions' });
    }
  };

  // Get RBAC service instance for middleware
  getRBACService() {
    return this.rbacService;
  }
}

module.exports = new RBACController();