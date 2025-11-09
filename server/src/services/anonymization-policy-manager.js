/**
 * Anonymization Policy Management Service
 * 
 * Provides policy configuration interface, versioning, and approval workflow
 * for anonymization policies. Implements policy rollback and emergency procedures
 * to ensure compliance with healthcare regulatory requirements.
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class AnonymizationPolicyManager {
  constructor(config = {}) {
    this.config = {
      // Policy storage configuration
      storageType: config.storageType || 'file', // 'file', 'database'
      policyPath: config.policyPath || './config/anonymization-policies',
      backupPath: config.backupPath || './config/anonymization-policies/backups',
      requireApproval: config.requireApproval !== false, // Default to true
      approvalWorkflow: config.approvalWorkflow || 'dual', // 'single', 'dual', 'committee'
      emergencyBypass: config.emergencyBypass || false,
      auditEnabled: config.auditEnabled !== false, // Default to true
      ...config
    };
    
    this.policies = new Map();
    this.approvalQueue = new Map();
    this.auditLog = [];
    
    this.validateConfiguration();
  }

  /**
   * Validate policy manager configuration
   */
  validateConfiguration() {
    const validWorkflows = ['single', 'dual', 'committee'];
    if (!validWorkflows.includes(this.config.approvalWorkflow)) {
      throw new Error(`Invalid approval workflow: ${this.config.approvalWorkflow}`);
    }
  }

  /**
   * Initialize policy manager and load existing policies
   */
  async initialize() {
    await this.loadPolicies();
    console.log(`Policy manager initialized with ${this.policies.size} policies`);
  }

  /**
   * Create a new anonymization policy
   */
  async createPolicy(policyData, createdBy) {
    const policy = {
      id: uuidv4(),
      name: policyData.name,
      version: '1.0',
      description: policyData.description,
      tags: this.validateTagConfiguration(policyData.tags),
      metadata: {
        createdBy: createdBy,
        createdAt: new Date().toISOString(),
        modifiedBy: createdBy,
        modifiedAt: new Date().toISOString(),
        status: 'draft'
      },
      approval: {
        required: this.config.requireApproval,
        approved: false,
        approvedBy: [],
        approvedAt: null,
        approvalWorkflow: this.config.approvalWorkflow,
        approvalHistory: []
      },
      compliance: {
        hipaaReviewed: false,
        gdprReviewed: false,
        clinicalReviewed: false,
        legalReviewed: false,
        reviewComments: []
      }
    };
    
    // Validate policy structure
    this.validatePolicy(policy);
    
    // Store policy
    await this.storePolicy(policy);
    this.policies.set(policy.id, policy);
    
    // Add to audit log
    this.addAuditEntry('policy_created', {
      policyId: policy.id,
      policyName: policy.name,
      createdBy: createdBy
    });
    
    // Submit for approval if required
    if (this.config.requireApproval) {
      await this.submitForApproval(policy.id, createdBy);
    }
    
    return policy;
  }

  /**
   * Update an existing policy (creates new version)
   */
  async updatePolicy(policyId, updates, updatedBy) {
    const existingPolicy = this.policies.get(policyId);
    if (!existingPolicy) {
      throw new Error(`Policy not found: ${policyId}`);
    }
    
    // Create new version
    const newVersion = this.incrementVersion(existingPolicy.version);
    const updatedPolicy = {
      ...existingPolicy,
      ...updates,
      id: uuidv4(), // New ID for new version
      version: newVersion,
      metadata: {
        ...existingPolicy.metadata,
        modifiedBy: updatedBy,
        modifiedAt: new Date().toISOString(),
        status: 'draft',
        previousVersion: existingPolicy.id
      },
      approval: {
        ...existingPolicy.approval,
        approved: false,
        approvedBy: [],
        approvedAt: null,
        approvalHistory: []
      }
    };
    
    // Validate updated policy
    if (updates.tags) {
      updatedPolicy.tags = this.validateTagConfiguration(updates.tags);
    }
    this.validatePolicy(updatedPolicy);
    
    // Store updated policy
    await this.storePolicy(updatedPolicy);
    this.policies.set(updatedPolicy.id, updatedPolicy);
    
    // Mark previous version as superseded
    existingPolicy.metadata.status = 'superseded';
    existingPolicy.metadata.supersededBy = updatedPolicy.id;
    await this.storePolicy(existingPolicy);
    
    // Add to audit log
    this.addAuditEntry('policy_updated', {
      policyId: updatedPolicy.id,
      policyName: updatedPolicy.name,
      previousVersion: existingPolicy.id,
      updatedBy: updatedBy
    });
    
    // Submit for approval if required
    if (this.config.requireApproval) {
      await this.submitForApproval(updatedPolicy.id, updatedBy);
    }
    
    return updatedPolicy;
  }

  /**
   * Submit policy for approval
   */
  async submitForApproval(policyId, submittedBy) {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }
    
    if (policy.metadata.status !== 'draft') {
      throw new Error(`Policy ${policyId} is not in draft status`);
    }
    
    const approvalRequest = {
      id: uuidv4(),
      policyId: policyId,
      submittedBy: submittedBy,
      submittedAt: new Date().toISOString(),
      workflow: this.config.approvalWorkflow,
      status: 'pending',
      approvals: [],
      rejections: [],
      comments: []
    };
    
    this.approvalQueue.set(approvalRequest.id, approvalRequest);
    
    // Update policy status
    policy.metadata.status = 'pending_approval';
    await this.storePolicy(policy);
    
    // Add to audit log
    this.addAuditEntry('policy_submitted_for_approval', {
      policyId: policyId,
      approvalRequestId: approvalRequest.id,
      submittedBy: submittedBy
    });
    
    return approvalRequest;
  }

  /**
   * Approve a policy
   */
  async approvePolicy(approvalRequestId, approvedBy, comments = '') {
    const approvalRequest = this.approvalQueue.get(approvalRequestId);
    if (!approvalRequest) {
      throw new Error(`Approval request not found: ${approvalRequestId}`);
    }
    
    const policy = this.policies.get(approvalRequest.policyId);
    if (!policy) {
      throw new Error(`Policy not found: ${approvalRequest.policyId}`);
    }
    
    // Check if already approved by this person
    if (approvalRequest.approvals.some(approval => approval.approvedBy === approvedBy)) {
      throw new Error(`Policy already approved by ${approvedBy}`);
    }
    
    // Add approval
    const approval = {
      approvedBy: approvedBy,
      approvedAt: new Date().toISOString(),
      comments: comments
    };
    
    approvalRequest.approvals.push(approval);
    
    // Check if approval is complete based on workflow
    const isApprovalComplete = this.checkApprovalComplete(approvalRequest);
    
    if (isApprovalComplete) {
      // Mark policy as approved
      policy.approval.approved = true;
      policy.approval.approvedBy = approvalRequest.approvals.map(a => a.approvedBy);
      policy.approval.approvedAt = new Date().toISOString();
      policy.approval.approvalHistory = [...approvalRequest.approvals];
      policy.metadata.status = 'approved';
      
      // Remove from approval queue
      this.approvalQueue.delete(approvalRequestId);
      
      // Add to audit log
      this.addAuditEntry('policy_approved', {
        policyId: policy.id,
        approvalRequestId: approvalRequestId,
        approvedBy: policy.approval.approvedBy
      });
    }
    
    await this.storePolicy(policy);
    
    return {
      approved: isApprovalComplete,
      policy: policy,
      approvalRequest: approvalRequest
    };
  }

  /**
   * Reject a policy
   */
  async rejectPolicy(approvalRequestId, rejectedBy, reason) {
    const approvalRequest = this.approvalQueue.get(approvalRequestId);
    if (!approvalRequest) {
      throw new Error(`Approval request not found: ${approvalRequestId}`);
    }
    
    const policy = this.policies.get(approvalRequest.policyId);
    if (!policy) {
      throw new Error(`Policy not found: ${approvalRequest.policyId}`);
    }
    
    // Add rejection
    const rejection = {
      rejectedBy: rejectedBy,
      rejectedAt: new Date().toISOString(),
      reason: reason
    };
    
    approvalRequest.rejections.push(rejection);
    approvalRequest.status = 'rejected';
    
    // Mark policy as rejected
    policy.metadata.status = 'rejected';
    
    // Remove from approval queue
    this.approvalQueue.delete(approvalRequestId);
    
    // Add to audit log
    this.addAuditEntry('policy_rejected', {
      policyId: policy.id,
      approvalRequestId: approvalRequestId,
      rejectedBy: rejectedBy,
      reason: reason
    });
    
    await this.storePolicy(policy);
    
    return {
      policy: policy,
      approvalRequest: approvalRequest
    };
  }

  /**
   * Emergency policy activation (bypasses approval)
   */
  async emergencyActivatePolicy(policyId, activatedBy, justification) {
    if (!this.config.emergencyBypass) {
      throw new Error('Emergency policy activation is not enabled');
    }
    
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }
    
    // Create emergency activation record
    const emergencyActivation = {
      id: uuidv4(),
      policyId: policyId,
      activatedBy: activatedBy,
      activatedAt: new Date().toISOString(),
      justification: justification,
      requiresPostApproval: true
    };
    
    // Mark policy as emergency approved
    policy.approval.approved = true;
    policy.approval.approvedBy = [activatedBy];
    policy.approval.approvedAt = new Date().toISOString();
    policy.metadata.status = 'emergency_approved';
    policy.metadata.emergencyActivation = emergencyActivation;
    
    await this.storePolicy(policy);
    
    // Add to audit log
    this.addAuditEntry('policy_emergency_activated', {
      policyId: policyId,
      activatedBy: activatedBy,
      justification: justification
    });
    
    return policy;
  }

  /**
   * Rollback to previous policy version
   */
  async rollbackPolicy(policyId, rolledBackBy, reason) {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }
    
    if (!policy.metadata.previousVersion) {
      throw new Error(`No previous version available for policy: ${policyId}`);
    }
    
    const previousPolicy = this.policies.get(policy.metadata.previousVersion);
    if (!previousPolicy) {
      throw new Error(`Previous policy version not found: ${policy.metadata.previousVersion}`);
    }
    
    // Create rollback version
    const rollbackPolicy = {
      ...previousPolicy,
      id: uuidv4(),
      version: this.incrementVersion(policy.version),
      metadata: {
        ...previousPolicy.metadata,
        modifiedBy: rolledBackBy,
        modifiedAt: new Date().toISOString(),
        status: 'approved', // Assume rollback to approved version
        rollbackFrom: policyId,
        rollbackReason: reason
      }
    };
    
    // Store rollback policy
    await this.storePolicy(rollbackPolicy);
    this.policies.set(rollbackPolicy.id, rollbackPolicy);
    
    // Mark current policy as rolled back
    policy.metadata.status = 'rolled_back';
    policy.metadata.rolledBackBy = rolledBackBy;
    policy.metadata.rolledBackAt = new Date().toISOString();
    policy.metadata.rollbackReason = reason;
    await this.storePolicy(policy);
    
    // Add to audit log
    this.addAuditEntry('policy_rolled_back', {
      policyId: policyId,
      rollbackPolicyId: rollbackPolicy.id,
      rolledBackBy: rolledBackBy,
      reason: reason
    });
    
    return rollbackPolicy;
  }

  /**
   * Get active policies
   */
  getActivePolicies() {
    return Array.from(this.policies.values())
      .filter(policy => policy.metadata.status === 'approved' || policy.metadata.status === 'emergency_approved');
  }

  /**
   * Get policy by ID
   */
  getPolicy(policyId) {
    return this.policies.get(policyId);
  }

  /**
   * Get policy by name (latest version)
   */
  getPolicyByName(policyName) {
    const policies = Array.from(this.policies.values())
      .filter(policy => policy.name === policyName)
      .sort((a, b) => this.compareVersions(b.version, a.version));
    
    return policies[0] || null;
  }

  /**
   * List all policies
   */
  listPolicies(filter = {}) {
    let policies = Array.from(this.policies.values());
    
    if (filter.status) {
      policies = policies.filter(policy => policy.metadata.status === filter.status);
    }
    
    if (filter.approved !== undefined) {
      policies = policies.filter(policy => policy.approval.approved === filter.approved);
    }
    
    return policies;
  }

  /**
   * Get pending approvals
   */
  getPendingApprovals() {
    return Array.from(this.approvalQueue.values());
  }

  /**
   * Validate tag configuration
   */
  validateTagConfiguration(tags) {
    const requiredTagTypes = ['remove', 'pseudonymize', 'preserve'];
    
    for (const tagType of requiredTagTypes) {
      if (!tags[tagType] || !Array.isArray(tags[tagType])) {
        throw new Error(`Invalid or missing tag type: ${tagType}`);
      }
    }
    
    // Validate DICOM tag format
    const tagRegex = /^\([0-9A-Fa-f]{4},[0-9A-Fa-f]{4}\)$/;
    const allTags = [
      ...tags.remove,
      ...tags.pseudonymize,
      ...tags.preserve
    ];
    
    for (const tag of allTags) {
      if (!tagRegex.test(tag)) {
        throw new Error(`Invalid DICOM tag format: ${tag}`);
      }
    }
    
    // Check for tag conflicts
    const removeSet = new Set(tags.remove);
    const pseudonymizeSet = new Set(tags.pseudonymize);
    const preserveSet = new Set(tags.preserve);
    
    // Check for overlaps
    for (const tag of tags.pseudonymize) {
      if (removeSet.has(tag)) {
        throw new Error(`Tag ${tag} cannot be both removed and pseudonymized`);
      }
    }
    
    for (const tag of tags.preserve) {
      if (removeSet.has(tag) || pseudonymizeSet.has(tag)) {
        throw new Error(`Tag ${tag} cannot be preserved and also removed/pseudonymized`);
      }
    }
    
    return tags;
  }

  /**
   * Validate policy structure
   */
  validatePolicy(policy) {
    const requiredFields = ['id', 'name', 'version', 'description', 'tags', 'metadata', 'approval'];
    
    for (const field of requiredFields) {
      if (!policy[field]) {
        throw new Error(`Policy missing required field: ${field}`);
      }
    }
    
    // Validate tags
    this.validateTagConfiguration(policy.tags);
  }

  /**
   * Check if approval is complete based on workflow
   */
  checkApprovalComplete(approvalRequest) {
    switch (this.config.approvalWorkflow) {
      case 'single':
        return approvalRequest.approvals.length >= 1;
      case 'dual':
        return approvalRequest.approvals.length >= 2;
      case 'committee':
        return approvalRequest.approvals.length >= 3;
      default:
        return false;
    }
  }

  /**
   * Increment version number
   */
  incrementVersion(version) {
    const parts = version.split('.');
    const major = parseInt(parts[0]);
    const minor = parseInt(parts[1] || 0);
    
    return `${major}.${minor + 1}`;
  }

  /**
   * Compare version numbers
   */
  compareVersions(version1, version2) {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }
    
    return 0;
  }

  /**
   * Add audit entry
   */
  addAuditEntry(action, details) {
    if (!this.config.auditEnabled) return;
    
    const entry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      action: action,
      details: details
    };
    
    this.auditLog.push(entry);
    
    // Keep only last 1000 entries in memory
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-1000);
    }
  }

  /**
   * Get audit log
   */
  getAuditLog(limit = 100) {
    return this.auditLog.slice(-limit);
  }

  /**
   * Store policy (implementation depends on storage type)
   */
  async storePolicy(policy) {
    switch (this.config.storageType) {
      case 'file':
        await this.storePolicyToFile(policy);
        break;
      case 'database':
        await this.storePolicyToDatabase(policy);
        break;
      default:
        throw new Error(`Unsupported storage type: ${this.config.storageType}`);
    }
  }

  /**
   * Store policy to file
   */
  async storePolicyToFile(policy) {
    const fs = require('fs').promises;
    const path = require('path');
    
    // Create policy directory if it doesn't exist
    await fs.mkdir(this.config.policyPath, { recursive: true });
    
    // Store policy
    const filename = `policy-${policy.id}.json`;
    const filepath = path.join(this.config.policyPath, filename);
    
    await fs.writeFile(filepath, JSON.stringify(policy, null, 2));
    
    // Create backup
    await this.backupPolicy(policy);
  }

  /**
   * Store policy to database (placeholder)
   */
  async storePolicyToDatabase(policy) {
    // Implementation would depend on database choice
    throw new Error('Database policy storage not implemented');
  }

  /**
   * Backup policy
   */
  async backupPolicy(policy) {
    const fs = require('fs').promises;
    const path = require('path');
    
    // Create backup directory if it doesn't exist
    await fs.mkdir(this.config.backupPath, { recursive: true });
    
    // Create timestamped backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `policy-${policy.id}-${timestamp}.json`;
    const filepath = path.join(this.config.backupPath, filename);
    
    await fs.writeFile(filepath, JSON.stringify(policy, null, 2));
  }

  /**
   * Load policies from storage
   */
  async loadPolicies() {
    switch (this.config.storageType) {
      case 'file':
        await this.loadPoliciesFromFiles();
        break;
      case 'database':
        await this.loadPoliciesFromDatabase();
        break;
      default:
        throw new Error(`Unsupported storage type: ${this.config.storageType}`);
    }
  }

  /**
   * Load policies from files
   */
  async loadPoliciesFromFiles() {
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      // Create policy directory if it doesn't exist
      await fs.mkdir(this.config.policyPath, { recursive: true });
      
      const files = await fs.readdir(this.config.policyPath);
      
      for (const file of files) {
        if (file.startsWith('policy-') && file.endsWith('.json')) {
          const filepath = path.join(this.config.policyPath, file);
          const policyData = await fs.readFile(filepath, 'utf8');
          const policy = JSON.parse(policyData);
          
          this.policies.set(policy.id, policy);
        }
      }
      
    } catch (error) {
      console.error('Error loading policies from files:', error);
      throw error;
    }
  }

  /**
   * Load policies from database (placeholder)
   */
  async loadPoliciesFromDatabase() {
    // Implementation would depend on database choice
    throw new Error('Database policy loading not implemented');
  }
}

module.exports = AnonymizationPolicyManager;