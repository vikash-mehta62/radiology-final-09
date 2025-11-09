/**
 * Anonymization API Routes
 * 
 * Provides REST API endpoints for anonymization operations,
 * policy management, and compliance reporting.
 */

const express = require('express');
const router = express.Router();

/**
 * Anonymize DICOM metadata
 */
router.post('/anonymize', async (req, res) => {
  try {
    const { dicomMetadata, policyName, context } = req.body;
    
    if (!dicomMetadata) {
      return res.status(400).json({
        success: false,
        error: 'DICOM metadata is required'
      });
    }
    
    const anonymizationService = req.app.locals.anonymizationService;
    if (!anonymizationService) {
      return res.status(500).json({
        success: false,
        error: 'Anonymization service not available'
      });
    }
    
    const result = await anonymizationService.anonymizeDicomMetadata(dicomMetadata, {
      policyName,
      userId: req.user?.id || 'anonymous',
      sessionId: req.sessionID,
      ...context
    });
    
    res.json({
      success: result.success,
      anonymizedMetadata: result.anonymizedMetadata,
      policy: result.policy,
      validation: result.validation,
      audit: result.audit
    });
    
  } catch (error) {
    console.error('Anonymization error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get available policies
 */
router.get('/policies', async (req, res) => {
  try {
    const anonymizationService = req.app.locals.anonymizationService;
    if (!anonymizationService) {
      return res.status(500).json({
        success: false,
        error: 'Anonymization service not available'
      });
    }
    
    const policies = anonymizationService.getAvailablePolicies();
    
    res.json({
      success: true,
      policies: policies.map(policy => ({
        id: policy.id,
        name: policy.name,
        version: policy.version,
        description: policy.description,
        approved: policy.approval.approved,
        approvedBy: policy.approval.approvedBy,
        approvedAt: policy.approval.approvedAt,
        status: policy.metadata.status
      }))
    });
    
  } catch (error) {
    console.error('Error getting policies:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Create new policy
 */
router.post('/policies', async (req, res) => {
  try {
    const { name, description, tags } = req.body;
    
    if (!name || !description || !tags) {
      return res.status(400).json({
        success: false,
        error: 'Name, description, and tags are required'
      });
    }
    
    const anonymizationService = req.app.locals.anonymizationService;
    if (!anonymizationService) {
      return res.status(500).json({
        success: false,
        error: 'Anonymization service not available'
      });
    }
    
    const policy = await anonymizationService.createPolicy({
      name,
      description,
      tags
    }, req.user?.id || 'anonymous');
    
    res.status(201).json({
      success: true,
      policy: {
        id: policy.id,
        name: policy.name,
        version: policy.version,
        description: policy.description,
        status: policy.metadata.status,
        createdBy: policy.metadata.createdBy,
        createdAt: policy.metadata.createdAt
      }
    });
    
  } catch (error) {
    console.error('Error creating policy:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get pending approvals
 */
router.get('/approvals', async (req, res) => {
  try {
    const anonymizationService = req.app.locals.anonymizationService;
    if (!anonymizationService) {
      return res.status(500).json({
        success: false,
        error: 'Anonymization service not available'
      });
    }
    
    const pendingApprovals = anonymizationService.getPendingApprovals();
    
    res.json({
      success: true,
      approvals: pendingApprovals
    });
    
  } catch (error) {
    console.error('Error getting pending approvals:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Approve policy
 */
router.post('/approvals/:approvalId/approve', async (req, res) => {
  try {
    const { approvalId } = req.params;
    const { comments } = req.body;
    
    const anonymizationService = req.app.locals.anonymizationService;
    if (!anonymizationService) {
      return res.status(500).json({
        success: false,
        error: 'Anonymization service not available'
      });
    }
    
    const result = await anonymizationService.approvePolicy(
      approvalId,
      req.user?.id || 'anonymous',
      comments
    );
    
    res.json({
      success: true,
      approved: result.approved,
      policy: result.policy ? {
        id: result.policy.id,
        name: result.policy.name,
        status: result.policy.metadata.status,
        approved: result.policy.approval.approved
      } : null
    });
    
  } catch (error) {
    console.error('Error approving policy:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Generate compliance report
 */
router.post('/reports/compliance', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date and end date are required'
      });
    }
    
    const anonymizationService = req.app.locals.anonymizationService;
    if (!anonymizationService) {
      return res.status(500).json({
        success: false,
        error: 'Anonymization service not available'
      });
    }
    
    const report = await anonymizationService.generateComplianceReport(startDate, endDate);
    
    res.json({
      success: true,
      report
    });
    
  } catch (error) {
    console.error('Error generating compliance report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get service status
 */
router.get('/status', async (req, res) => {
  try {
    const anonymizationService = req.app.locals.anonymizationService;
    if (!anonymizationService) {
      return res.status(500).json({
        success: false,
        error: 'Anonymization service not available'
      });
    }
    
    const status = anonymizationService.getStatus();
    const health = await anonymizationService.healthCheck();
    
    res.json({
      success: true,
      status,
      health
    });
    
  } catch (error) {
    console.error('Error getting service status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Emergency activate policy
 */
router.post('/policies/:policyId/emergency-activate', async (req, res) => {
  try {
    const { policyId } = req.params;
    const { justification } = req.body;
    
    if (!justification) {
      return res.status(400).json({
        success: false,
        error: 'Justification is required for emergency activation'
      });
    }
    
    const anonymizationService = req.app.locals.anonymizationService;
    if (!anonymizationService) {
      return res.status(500).json({
        success: false,
        error: 'Anonymization service not available'
      });
    }
    
    const policy = await anonymizationService.emergencyActivatePolicy(
      policyId,
      req.user?.id || 'anonymous',
      justification
    );
    
    res.json({
      success: true,
      policy: {
        id: policy.id,
        name: policy.name,
        status: policy.metadata.status,
        approved: policy.approval.approved,
        emergencyActivation: policy.metadata.emergencyActivation
      }
    });
    
  } catch (error) {
    console.error('Error emergency activating policy:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;