const express = require('express');
const router = express.Router();
const PriorAuthorization = require('../models/PriorAuthorization');
const priorAuthAutomation = require('../services/prior-auth-automation');
const { authenticate } = require('../middleware/authMiddleware');

/**
 * Prior Authorization API Routes
 */

// Create new prior authorization request
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      patientID,
      patientName,
      dateOfBirth,
      insuranceProvider,
      insurancePolicyNumber,
      studyInstanceUID,
      procedureCode,
      procedureDescription,
      modality,
      bodyPart,
      diagnosis,
      clinicalIndication,
      urgency,
      approvedUnits
    } = req.body;

    // Generate authorization number
    const authNumber = `PA-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create authorization request
    const priorAuth = new PriorAuthorization({
      authorizationNumber: authNumber,
      patientID,
      patientName,
      dateOfBirth,
      insuranceProvider,
      insurancePolicyNumber,
      studyInstanceUID,
      procedureCode,
      procedureDescription,
      modality,
      bodyPart,
      diagnosis,
      clinicalIndication,
      urgency: urgency || 'routine',
      approvedUnits: approvedUnits || 1,
      createdBy: req.user?.email || 'system'
    });

    // Run automated checks
    const automationResult = await priorAuthAutomation.runAutomatedChecks(priorAuth);
    priorAuth.automatedChecks = automationResult.checks;

    // Try auto-approval
    const autoApproved = await priorAuthAutomation.autoApprove(priorAuth);

    if (!autoApproved) {
      // Set to in_review if not auto-approved
      priorAuth.status = 'in_review';
      await priorAuth.save();
    }

    res.json({
      success: true,
      data: priorAuth,
      automation: {
        recommendation: automationResult.recommendation,
        confidence: automationResult.confidence,
        autoApproved
      }
    });

  } catch (error) {
    console.error('Error creating prior authorization:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get all prior authorizations with filters
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, patientID, urgency, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (patientID) query.patientID = patientID;
    if (urgency) query.urgency = urgency;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [authorizations, total] = await Promise.all([
      PriorAuthorization.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      PriorAuthorization.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: authorizations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching prior authorizations:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get specific prior authorization
router.get('/:id', authenticate, async (req, res) => {
  try {
    const priorAuth = await PriorAuthorization.findById(req.params.id);

    if (!priorAuth) {
      return res.status(404).json({
        success: false,
        message: 'Prior authorization not found'
      });
    }

    res.json({
      success: true,
      data: priorAuth
    });

  } catch (error) {
    console.error('Error fetching prior authorization:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Approve prior authorization
router.post('/:id/approve', authenticate, async (req, res) => {
  try {
    const { reviewNotes, approvedUnits, expirationDays = 90 } = req.body;

    const priorAuth = await PriorAuthorization.findById(req.params.id);

    if (!priorAuth) {
      return res.status(404).json({
        success: false,
        message: 'Prior authorization not found'
      });
    }

    priorAuth.status = 'approved';
    priorAuth.approvalDate = new Date();
    priorAuth.expirationDate = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);
    priorAuth.reviewedBy = req.user?.email || 'system';
    priorAuth.reviewNotes = reviewNotes;
    
    if (approvedUnits) {
      priorAuth.approvedUnits = approvedUnits;
    }

    await priorAuth.save();

    res.json({
      success: true,
      data: priorAuth,
      message: 'Prior authorization approved'
    });

  } catch (error) {
    console.error('Error approving prior authorization:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Deny prior authorization
router.post('/:id/deny', authenticate, async (req, res) => {
  try {
    const { denialReason, reviewNotes } = req.body;

    if (!denialReason) {
      return res.status(400).json({
        success: false,
        message: 'Denial reason is required'
      });
    }

    const priorAuth = await PriorAuthorization.findById(req.params.id);

    if (!priorAuth) {
      return res.status(404).json({
        success: false,
        message: 'Prior authorization not found'
      });
    }

    priorAuth.status = 'denied';
    priorAuth.denialReason = denialReason;
    priorAuth.reviewedBy = req.user?.email || 'system';
    priorAuth.reviewNotes = reviewNotes;

    await priorAuth.save();

    res.json({
      success: true,
      data: priorAuth,
      message: 'Prior authorization denied'
    });

  } catch (error) {
    console.error('Error denying prior authorization:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get prior authorizations by patient
router.get('/patient/:patientID', authenticate, async (req, res) => {
  try {
    const authorizations = await PriorAuthorization.find({
      patientID: req.params.patientID
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: authorizations
    });

  } catch (error) {
    console.error('Error fetching patient authorizations:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Run automated checks on existing authorization
router.post('/:id/check', authenticate, async (req, res) => {
  try {
    const priorAuth = await PriorAuthorization.findById(req.params.id);

    if (!priorAuth) {
      return res.status(404).json({
        success: false,
        message: 'Prior authorization not found'
      });
    }

    const result = await priorAuthAutomation.runAutomatedChecks(priorAuth);

    priorAuth.automatedChecks = result.checks;
    await priorAuth.save();

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error running automated checks:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Add note to prior authorization
router.post('/:id/notes', authenticate, async (req, res) => {
  try {
    const { note } = req.body;

    if (!note) {
      return res.status(400).json({
        success: false,
        message: 'Note text is required'
      });
    }

    const priorAuth = await PriorAuthorization.findById(req.params.id);

    if (!priorAuth) {
      return res.status(404).json({
        success: false,
        message: 'Prior authorization not found'
      });
    }

    if (!priorAuth.notes) {
      priorAuth.notes = [];
    }

    priorAuth.notes.push({
      text: note,
      createdBy: req.user?.email || 'system',
      createdAt: new Date()
    });

    await priorAuth.save();

    res.json({
      success: true,
      data: priorAuth,
      message: 'Note added successfully'
    });

  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Upload document to prior authorization
router.post('/:id/documents', authenticate, async (req, res) => {
  try {
    const priorAuth = await PriorAuthorization.findById(req.params.id);

    if (!priorAuth) {
      return res.status(404).json({
        success: false,
        message: 'Prior authorization not found'
      });
    }

    // For now, just track document metadata
    // In production, you'd integrate with file storage service
    if (!priorAuth.documents) {
      priorAuth.documents = [];
    }

    priorAuth.documents.push({
      filename: req.body.filename || 'document.pdf',
      uploadedAt: new Date(),
      uploadedBy: req.user?.email || 'system'
    });

    await priorAuth.save();

    res.json({
      success: true,
      data: priorAuth,
      message: 'Document uploaded successfully'
    });

  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get dashboard statistics
router.get('/stats/dashboard', authenticate, async (req, res) => {
  try {
    const [
      total,
      pending,
      approved,
      denied,
      inReview,
      autoApproved
    ] = await Promise.all([
      PriorAuthorization.countDocuments(),
      PriorAuthorization.countDocuments({ status: 'pending' }),
      PriorAuthorization.countDocuments({ status: 'approved' }),
      PriorAuthorization.countDocuments({ status: 'denied' }),
      PriorAuthorization.countDocuments({ status: 'in_review' }),
      PriorAuthorization.countDocuments({
        status: 'approved',
        reviewNotes: /auto-approved/i
      })
    ]);

    const autoApprovalRate = total > 0 ? ((autoApproved / total) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      data: {
        total,
        pending,
        approved,
        denied,
        inReview,
        autoApproved,
        autoApprovalRate: parseFloat(autoApprovalRate)
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
