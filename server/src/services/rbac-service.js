const fs = require('fs').promises;
const path = require('path');

class RBACService {
  constructor(configPath = null) {
    this.configPath = configPath || path.join(__dirname, '../config/rbac-config.json');
    this.roles = new Map();
    this.permissions = new Map();
    this.userRoles = new Map(); // In production, this should be stored in database
    
    this.initializeDefaultRoles();
  }

  async initialize() {
    try {
      await this.loadConfiguration();
    } catch (error) {
      console.warn('RBAC configuration not found, using defaults:', error.message);
      await this.saveConfiguration(); // Create default config file
    }
  }

  initializeDefaultRoles() {
    // Define default permissions
    const permissions = {
      // System permissions
      'system:read': 'View system information',
      'system:write': 'Modify system configuration',
      'system:admin': 'Full system administration',
      
      // User management permissions
      'users:read': 'View user information',
      'users:write': 'Create and modify users',
      'users:delete': 'Delete users',
      
      // DICOM permissions
      'dicom:read': 'View DICOM studies and images',
      'dicom:write': 'Upload and modify DICOM data',
      'dicom:delete': 'Delete DICOM studies',
      'dicom:anonymize': 'Anonymize DICOM data',
      
      // Audit permissions
      'audit:read': 'View audit logs',
      'audit:export': 'Export audit logs',
      
      // Monitoring permissions
      'monitoring:read': 'View monitoring data and metrics',
      'monitoring:write': 'Configure monitoring and alerts',
      
      // Secrets management permissions
      'secrets:read': 'View secret configurations',
      'secrets:write': 'Modify secrets',
      
      // Backup permissions
      'backup:read': 'View backup status',
      'backup:write': 'Create and manage backups',
      'backup:restore': 'Restore from backups'
    };

    // Store permissions
    Object.entries(permissions).forEach(([key, description]) => {
      this.permissions.set(key, { name: key, description });
    });

    // Define default roles
    const roles = {
      admin: {
        name: 'Administrator',
        description: 'Full system access with all permissions',
        permissions: Array.from(this.permissions.keys()),
        inherits: []
      },
      operator: {
        name: 'Operator',
        description: 'Operational access for day-to-day management',
        permissions: [
          'system:read',
          'dicom:read',
          'dicom:write',
          'dicom:anonymize',
          'monitoring:read',
          'backup:read',
          'audit:read'
        ],
        inherits: []
      },
      radiologist: {
        name: 'Radiologist',
        description: 'Clinical access for viewing and working with DICOM data',
        permissions: [
          'dicom:read',
          'dicom:write',
          'monitoring:read'
        ],
        inherits: []
      },
      readonly: {
        name: 'Read Only',
        description: 'Read-only access to system and DICOM data',
        permissions: [
          'system:read',
          'dicom:read',
          'monitoring:read',
          'audit:read'
        ],
        inherits: []
      },
      auditor: {
        name: 'Auditor',
        description: 'Access to audit logs and compliance data',
        permissions: [
          'audit:read',
          'audit:export',
          'monitoring:read',
          'system:read'
        ],
        inherits: []
      }
    };

    // Store roles
    Object.entries(roles).forEach(([key, role]) => {
      this.roles.set(key, { ...role, id: key });
    });
  }

  async loadConfiguration() {
    try {
      const configData = await fs.readFile(this.configPath, 'utf8');
      const config = JSON.parse(configData);
      
      // Load permissions
      if (config.permissions) {
        config.permissions.forEach(permission => {
          this.permissions.set(permission.name, permission);
        });
      }
      
      // Load roles
      if (config.roles) {
        config.roles.forEach(role => {
          this.roles.set(role.id, role);
        });
      }
      
      console.log('RBAC configuration loaded successfully');
    } catch (error) {
      throw new Error(`Failed to load RBAC configuration: ${error.message}`);
    }
  }

  async saveConfiguration() {
    try {
      const config = {
        permissions: Array.from(this.permissions.values()),
        roles: Array.from(this.roles.values()),
        lastUpdated: new Date().toISOString()
      };
      
      // Ensure config directory exists
      const configDir = path.dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });
      
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
      console.log('RBAC configuration saved successfully');
    } catch (error) {
      throw new Error(`Failed to save RBAC configuration: ${error.message}`);
    }
  }

  // Role management
  createRole(roleData) {
    const { id, name, description, permissions = [], inherits = [] } = roleData;
    
    if (this.roles.has(id)) {
      throw new Error(`Role '${id}' already exists`);
    }
    
    // Validate permissions exist
    const invalidPermissions = permissions.filter(p => !this.permissions.has(p));
    if (invalidPermissions.length > 0) {
      throw new Error(`Invalid permissions: ${invalidPermissions.join(', ')}`);
    }
    
    // Validate inherited roles exist
    const invalidRoles = inherits.filter(r => !this.roles.has(r));
    if (invalidRoles.length > 0) {
      throw new Error(`Invalid inherited roles: ${invalidRoles.join(', ')}`);
    }
    
    const role = {
      id,
      name,
      description,
      permissions,
      inherits,
      createdAt: new Date().toISOString()
    };
    
    this.roles.set(id, role);
    return role;
  }

  updateRole(roleId, updates) {
    const role = this.roles.get(roleId);
    if (!role) {
      throw new Error(`Role '${roleId}' not found`);
    }
    
    // Validate permissions if being updated
    if (updates.permissions) {
      const invalidPermissions = updates.permissions.filter(p => !this.permissions.has(p));
      if (invalidPermissions.length > 0) {
        throw new Error(`Invalid permissions: ${invalidPermissions.join(', ')}`);
      }
    }
    
    // Validate inherited roles if being updated
    if (updates.inherits) {
      const invalidRoles = updates.inherits.filter(r => !this.roles.has(r));
      if (invalidRoles.length > 0) {
        throw new Error(`Invalid inherited roles: ${invalidRoles.join(', ')}`);
      }
    }
    
    const updatedRole = {
      ...role,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    this.roles.set(roleId, updatedRole);
    return updatedRole;
  }

  deleteRole(roleId) {
    if (!this.roles.has(roleId)) {
      throw new Error(`Role '${roleId}' not found`);
    }
    
    // Check if role is being used by any users
    const usersWithRole = Array.from(this.userRoles.entries())
      .filter(([userId, roles]) => roles.includes(roleId));
    
    if (usersWithRole.length > 0) {
      throw new Error(`Cannot delete role '${roleId}': still assigned to ${usersWithRole.length} user(s)`);
    }
    
    return this.roles.delete(roleId);
  }

  getRole(roleId) {
    return this.roles.get(roleId);
  }

  getAllRoles() {
    return Array.from(this.roles.values());
  }

  // Permission management
  createPermission(permissionData) {
    const { name, description } = permissionData;
    
    if (this.permissions.has(name)) {
      throw new Error(`Permission '${name}' already exists`);
    }
    
    const permission = {
      name,
      description,
      createdAt: new Date().toISOString()
    };
    
    this.permissions.set(name, permission);
    return permission;
  }

  getAllPermissions() {
    return Array.from(this.permissions.values());
  }

  // User role assignment
  assignRoleToUser(userId, roleId) {
    if (!this.roles.has(roleId)) {
      throw new Error(`Role '${roleId}' not found`);
    }
    
    const userRoles = this.userRoles.get(userId) || [];
    if (!userRoles.includes(roleId)) {
      userRoles.push(roleId);
      this.userRoles.set(userId, userRoles);
    }
    
    return userRoles;
  }

  removeRoleFromUser(userId, roleId) {
    const userRoles = this.userRoles.get(userId) || [];
    const updatedRoles = userRoles.filter(r => r !== roleId);
    
    if (updatedRoles.length === 0) {
      this.userRoles.delete(userId);
    } else {
      this.userRoles.set(userId, updatedRoles);
    }
    
    return updatedRoles;
  }

  getUserRoles(userId) {
    return this.userRoles.get(userId) || [];
  }

  setUserRoles(userId, roleIds) {
    // Validate all roles exist
    const invalidRoles = roleIds.filter(r => !this.roles.has(r));
    if (invalidRoles.length > 0) {
      throw new Error(`Invalid roles: ${invalidRoles.join(', ')}`);
    }
    
    this.userRoles.set(userId, roleIds);
    return roleIds;
  }

  // Permission checking
  getUserPermissions(userId) {
    const userRoles = this.getUserRoles(userId);
    const permissions = new Set();
    
    // Collect permissions from all user roles (including inherited)
    const processRole = (roleId) => {
      const role = this.roles.get(roleId);
      if (!role) return;
      
      // Add direct permissions
      role.permissions.forEach(p => permissions.add(p));
      
      // Process inherited roles
      role.inherits.forEach(inheritedRoleId => {
        processRole(inheritedRoleId);
      });
    };
    
    userRoles.forEach(processRole);
    
    return Array.from(permissions);
  }

  hasPermission(userId, permission) {
    const userPermissions = this.getUserPermissions(userId);
    return userPermissions.includes(permission);
  }

  hasAnyPermission(userId, permissions) {
    const userPermissions = this.getUserPermissions(userId);
    return permissions.some(p => userPermissions.includes(p));
  }

  hasAllPermissions(userId, permissions) {
    const userPermissions = this.getUserPermissions(userId);
    return permissions.every(p => userPermissions.includes(p));
  }

  // Middleware functions
  requirePermission(permission) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!this.hasPermission(req.user.id, permission)) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: permission,
          userPermissions: this.getUserPermissions(req.user.id)
        });
      }
      
      next();
    };
  }

  requireAnyPermission(permissions) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!this.hasAnyPermission(req.user.id, permissions)) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: `Any of: ${permissions.join(', ')}`,
          userPermissions: this.getUserPermissions(req.user.id)
        });
      }
      
      next();
    };
  }

  requireAllPermissions(permissions) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!this.hasAllPermissions(req.user.id, permissions)) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: `All of: ${permissions.join(', ')}`,
          userPermissions: this.getUserPermissions(req.user.id)
        });
      }
      
      next();
    };
  }

  requireRole(roleId) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const userRoles = this.getUserRoles(req.user.id);
      if (!userRoles.includes(roleId)) {
        return res.status(403).json({ 
          error: 'Insufficient role',
          required: roleId,
          userRoles
        });
      }
      
      next();
    };
  }
}

module.exports = RBACService;