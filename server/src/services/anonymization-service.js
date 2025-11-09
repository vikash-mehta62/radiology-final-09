/**
 * Anonymization Service Integration
 * 
 * Main service that integrates the anonymization engine, audit trail, and policy management
 * to provide a complete anonymization solution for the Orthanc bridge system.
 */

const AnonymizationEngine = require('./anonymization-engine');
const AnonymizationAudit = require('./anonymization-audit');
const AnonymizationPolicyManager = require('./anonymization-policy-manager');

class AnonymizationService {
  constructor(config = {}) {
    this.config = {
      // Engine configuration
      engine: config.engine || {},
      // Audit configuration
      audit: config.audit || {},
      // Policy manager configuration
      policyManager: config.policyManager || {},
      // Service configuration
      defaultPolicy: config.defaultPolicy || 'standard',
      requireApprovedPolicies: config.requireApprovedPolicies !== false,
      ...config
    };
    
    // Initialize components
    this.engine = null;
    this.audit = null;
    this.policyManager = null;
    
    this.initialized = false;
  }

  /**
   * Initialize the anonymization service
   */
  async initialize() {
    try {
      // Initialize policy manager first
      this.policyManager = new AnonymizationPolicyManager(this.config.policyManager);
      await this.policyManager.initialize();
      
      // Get active policies for engine configuration
      const activePolicies = this.policyManager.getActivePolicies();
      const policyConfig = {};
      
      for (const policy of activePolicies) {
        policyConfig[policy.name.toLowerCase().replace(/\s+/g, '-')] = {
          name: policy.name,
          version: policy.version,
          description: policy.description,
          approved: policy.approval.approved,
          approvedBy: policy.approval.approvedBy,
          approvedDate: policy.approval.approvedAt,
          tags: policy.tags
        };
      }
      
      // Initialize engine with active policies or default policies
      const engineConfig = {
        ...this.config.engine
      };
      
      // Use active policies or fall back to default policies from config
      if (Object.keys(policyConfig).length > 0) {
        engineConfig.policies = policyConfig;
      } else {
        // Use default policies from configuration
        engineConfig.policies = this.config.defaultPolicies || {};
      }
      
      this.engine = new AnonymizationEngine(engineConfig);
      
      // Initialize audit service
      this.audit = new AnonymizationAudit(this.config.audit);
      
      this.initialized = true;
      console.log('Anonymization service initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize anonymization service:', error);
      throw error;
    }
  }

  /**
   * Anonymize DICOM metadata with full audit trail
   */
  async anonymizeDicomMetadata(dicomMetadata, options = {}) {
    if (!this.initialized) {
      throw new Error('Anonymization service not initialized');
    }
    
    const context = {
      userId: options.userId || 'system',
      sessionId: options.sessionId,
      sourceSystem: options.sourceSystem || 'orthanc-bridge',
      correlationId: options.correlationId,
      studyInstanceUID: dicomMetadata['(0020,000D)'],
      seriesInstanceUID: dicomMetadata['(0020,000E)'],
      sopInstanceUID: dicomMetadata['(0008,0018)'],
      ...options.context
    };
    
    try {
      // Get policy to use
      const policyName = options.policyName || this.config.defaultPolicy;
      const policy = this.engine.getPolicy(policyName);
      
      // Check if policy is approved
      if (this.config.requireApprovedPolicies && !this.engine.isPolicyApproved(policyName)) {
        throw new Error(`Policy '${policyName}' is not approved for use`);
      }
      
      console.log(`Starting anonymization with policy: ${policyName}`);
      
      // Perform anonymization
      const anonymizationResult = await this.engine.anonymize(
        dicomMetadata, 
        policyName, 
        { allowUnapproved: !this.config.requireApprovedPolicies }
      );
      
      // Create audit record
      const auditRecord = await this.audit.createAuditRecord(anonymizationResult, context);
      
      // Return combined result
      return {
        success: anonymizationResult.validation.phiRemoved,
        anonymizedMetadata: anonymizationResult.anonymizedMetadata,
        originalMetadata: anonymizationResult.originalMetadata,
        policy: anonymizationResult.policy,
        operations: anonymizationResult.operations,
        validation: anonymizationResult.validation,
        audit: {
          auditId: auditRecord.auditId,
          timestamp: auditRecord.timestamp,
          compliance: auditRecord.compliance
        },
        context: context
      };
      
    } catch (error) {
      console.error('Anonymization failed:', error);
      
      // Create audit record for failure
      try {
        await this.audit.createAuditRecord({
          originalMetadata: dicomMetadata,
          anonymizedMetadata: null,
          policy: { name: options.policyName || this.config.defaultPolicy, version: 'unknown', applied: new Date().toISOString() },
          operations: [],
          validation: { phiRemoved: false, errors: [error.message], warnings: [] }
        }, { ...context, operationFailed: true });
      } catch (auditError) {
        console.error('Failed to create audit record for failed anonymization:', auditError);
      }
      
      throw error;
    }
  }

  /**
   * Create new anonymization policy
   */
  async createPolicy(policyData, createdBy) {
    if (!this.initialized) {
      throw new Error('Anonymization service not initialized');
    }
    
    return await this.policyManager.createPolicy(policyData, createdBy);
  }

  /**
   * Update existing policy
   */
  async updatePolicy(policyId, updates, updatedBy) {
    if (!this.initialized) {
      throw new Error('Anonymization service not initialized');
    }
    
    const result = await this.policyManager.updatePolicy(policyId, updates, updatedBy);
    
    // Refresh engine with updated policies if policy was approved
    if (result.approval.approved) {
      await this.refreshEngine();
    }
    
    return result;
  }

  /**
   * Approve policy
   */
  async approvePolicy(approvalRequestId, approvedBy, comments) {
    if (!this.initialized) {
      throw new Error('Anonymization service not initialized');
    }
    
    const result = await this.policyManager.approvePolicy(approvalRequestId, approvedBy, comments);
    
    // Refresh engine with newly approved policy
    if (result.approved) {
      await this.refreshEngine();
    }
    
    return result;
  }

  /**
   * Emergency activate policy
   */
  async emergencyActivatePolicy(policyId, activatedBy, justification) {
    if (!this.initialized) {
      throw new Error('Anonymization service not initialized');
    }
    
    const result = await this.policyManager.emergencyActivatePolicy(policyId, activatedBy, justification);
    
    // Refresh engine with emergency activated policy
    await this.refreshEngine();
    
    return result;
  }

  /**
   * Rollback policy
   */
  async rollbackPolicy(policyId, rolledBackBy, reason) {
    if (!this.initialized) {
      throw new Error('Anonymization service not initialized');
    }
    
    const result = await this.policyManager.rollbackPolicy(policyId, rolledBackBy, reason);
    
    // Refresh engine with rolled back policy
    await this.refreshEngine();
    
    return result;
  }

  /**
   * Get available policies
   */
  getAvailablePolicies() {
    if (!this.initialized) {
      throw new Error('Anonymization service not initialized');
    }
    
    return this.policyManager.listPolicies({ approved: true });
  }

  /**
   * Get pending approvals
   */
  getPendingApprovals() {
    if (!this.initialized) {
      throw new Error('Anonymization service not initialized');
    }
    
    return this.policyManager.getPendingApprovals();
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(startDate, endDate, options = {}) {
    if (!this.initialized) {
      throw new Error('Anonymization service not initialized');
    }
    
    return await this.audit.generateComplianceReport(startDate, endDate, options);
  }

  /**
   * Validate anonymization result
   */
  validateAnonymization(anonymizedMetadata, policyName) {
    if (!this.initialized) {
      throw new Error('Anonymization service not initialized');
    }
    
    const policy = this.engine.getPolicy(policyName);
    return this.engine.validateAnonymization(anonymizedMetadata, policy);
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      engine: this.engine ? 'ready' : 'not initialized',
      audit: this.audit ? 'ready' : 'not initialized',
      policyManager: this.policyManager ? 'ready' : 'not initialized',
      activePolicies: this.initialized ? this.policyManager.getActivePolicies().length : 0,
      pendingApprovals: this.initialized ? this.policyManager.getPendingApprovals().length : 0
    };
  }

  /**
   * Refresh engine with current active policies
   */
  async refreshEngine() {
    if (!this.initialized) {
      return;
    }
    
    try {
      // Get current active policies
      const activePolicies = this.policyManager.getActivePolicies();
      const policyConfig = {};
      
      for (const policy of activePolicies) {
        policyConfig[policy.name.toLowerCase().replace(/\s+/g, '-')] = {
          name: policy.name,
          version: policy.version,
          description: policy.description,
          approved: policy.approval.approved,
          approvedBy: policy.approval.approvedBy,
          approvedDate: policy.approval.approvedAt,
          tags: policy.tags
        };
      }
      
      // Reinitialize engine with updated policies
      this.engine = new AnonymizationEngine({
        ...this.config.engine,
        policies: policyConfig
      });
      
      console.log(`Engine refreshed with ${Object.keys(policyConfig).length} active policies`);
      
    } catch (error) {
      console.error('Failed to refresh anonymization engine:', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      components: {}
    };
    
    try {
      // Check initialization
      if (!this.initialized) {
        health.status = 'unhealthy';
        health.components.initialization = { status: 'failed', message: 'Service not initialized' };
        return health;
      }
      
      // Check engine
      try {
        const policies = this.engine.listPolicies();
        health.components.engine = { 
          status: 'healthy', 
          policies: policies.length,
          defaultPolicy: this.config.defaultPolicy
        };
      } catch (error) {
        health.status = 'degraded';
        health.components.engine = { status: 'failed', error: error.message };
      }
      
      // Check policy manager
      try {
        const activePolicies = this.policyManager.getActivePolicies();
        const pendingApprovals = this.policyManager.getPendingApprovals();
        health.components.policyManager = { 
          status: 'healthy',
          activePolicies: activePolicies.length,
          pendingApprovals: pendingApprovals.length
        };
      } catch (error) {
        health.status = 'degraded';
        health.components.policyManager = { status: 'failed', error: error.message };
      }
      
      // Check audit service
      try {
        // Simple check - audit service doesn't have a direct health check method
        health.components.audit = { 
          status: 'healthy',
          storageType: this.audit.config.storageType
        };
      } catch (error) {
        health.status = 'degraded';
        health.components.audit = { status: 'failed', error: error.message };
      }
      
    } catch (error) {
      health.status = 'unhealthy';
      health.error = error.message;
    }
    
    return health;
  }
}

module.exports = AnonymizationService;