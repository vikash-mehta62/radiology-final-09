const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const worklistService = require('../services/worklist-service');
const AuthenticationService = require('../services/authentication-service');

const authService = new AuthenticationService();

// All routes require authentication
router.use(  authService.authenticationMiddleware(),
);

/**
 * GET /api/worklist
 * Get worklist items with filters
 * // ✅ WORKLIST EMPTY FIX: Safe defaults & tenant-correct queries
 */
router.get('/', async (req, res) => {
  try {
    const {
      status,
      priority,
      assignedTo,
      hasCriticalFindings,
      startDate,
      endDate,
      limit,
      skip
    } = req.query;
    
    // ✅ WORKLIST EMPTY FIX: Enforce hospitalId from JWT; bypass only for superadmin
    const userRole = req.user.role || req.user.roles?.[0];
    const isSuperAdmin = userRole === 'superadmin' || userRole === 'system:admin';
    const hospitalId = req.user.hospitalId || req.user._id;
    
    if (!hospitalId && !isSuperAdmin) {
      return res.status(403).json({
        success: false,
        error: 'MISSING_TENANT',
        message: 'Hospital ID is required. Please contact your administrator.'
      });
    }
    
    // ✅ WORKLIST EMPTY FIX: Default date range = last 90 days unless from/to provided
    const now = new Date();
    const defaultStartDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    
    const filters = {
      hospitalId: isSuperAdmin ? undefined : hospitalId,
      // ✅ WORKLIST EMPTY FIX: If status missing → treat as ALL (no filter by status)
      status: status && status !== 'all' && status !== 'ALL' ? status : undefined,
      priority: priority && priority !== 'all' && priority !== 'ALL' ? priority : undefined,
      assignedTo,
      hasCriticalFindings: hasCriticalFindings === 'true',
      startDate: startDate || defaultStartDate.toISOString(),
      endDate: endDate || now.toISOString(),
      limit: parseInt(limit) || 100,
      skip: parseInt(skip) || 0
    };
    
    const items = await worklistService.getWorklist(filters);
    
    res.json({
      success: true,
      count: items.length,
      items
    });
  } catch (error) {
    console.error('Error fetching worklist:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch worklist',
      message: error.message
    });
  }
});

/**
 * GET /api/worklist/debug
 * Debug endpoint to see what's in the database
 */
router.get('/debug', async (req, res) => {
  try {
    const WorklistItem = require('../models/WorklistItem');
    
    // Get ALL worklist items (no filters)
    const allItems = await WorklistItem.find({}).lean();
    
    // Get user info
    const userRole = req.user.role || req.user.roles?.[0];
    const hospitalId = req.user.hospitalId || req.user._id;
    
    // Get items that match user's hospitalId
    const userItems = await WorklistItem.find({ hospitalId }).lean();
    
    // Get items with null hospitalId
    const nullItems = await WorklistItem.find({ 
      $or: [
        { hospitalId: null },
        { hospitalId: { $exists: false } }
      ]
    }).lean();
    
    res.json({
      success: true,
      debug: {
        user: {
          username: req.user.username,
          role: userRole,
          hospitalId: hospitalId,
          userId: req.user._id
        },
        counts: {
          total: allItems.length,
          matchingHospitalId: userItems.length,
          withNullHospitalId: nullItems.length
        },
        allItems: allItems.map(item => ({
          studyInstanceUID: item.studyInstanceUID,
          patientID: item.patientID,
          hospitalId: item.hospitalId,
          status: item.status,
          reportStatus: item.reportStatus,
          createdAt: item.createdAt
        })),
        userItems: userItems.map(item => ({
          studyInstanceUID: item.studyInstanceUID,
          patientID: item.patientID,
          hospitalId: item.hospitalId,
          status: item.status
        }))
      }
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/worklist/stats
 * Get worklist statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId || req.user._id;
    const stats = await worklistService.getStatistics(hospitalId);
    
    res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    console.error('Error fetching worklist stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
});

/**
 * POST /api/worklist
 * Create worklist item
 */
router.post('/', async (req, res) => {
  try {
    const { studyInstanceUID, priority, assignedTo, scheduledFor } = req.body;
    
    if (!studyInstanceUID) {
      return res.status(400).json({
        success: false,
        error: 'studyInstanceUID is required'
      });
    }
    
    const hospitalId = req.user.hospitalId || req.user._id;
    
    const item = await worklistService.createWorklistItem(studyInstanceUID, {
      hospitalId,
      priority,
      assignedTo,
      scheduledFor
    });
    
    res.json({
      success: true,
      item
    });
  } catch (error) {
    console.error('Error creating worklist item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create worklist item',
      message: error.message
    });
  }
});

/**
 * PUT /api/worklist/:studyInstanceUID/status
 * Update worklist item status
 */
router.put('/:studyInstanceUID/status', async (req, res) => {
  try {
    const { studyInstanceUID } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'status is required'
      });
    }
    
    const item = await worklistService.updateStatus(
      studyInstanceUID,
      status,
      req.user._id
    );
    
    res.json({
      success: true,
      item
    });
  } catch (error) {
    console.error('Error updating worklist status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update status',
      message: error.message
    });
  }
});

/**
 * PUT /api/worklist/:studyInstanceUID/assign
 * Assign study to radiologist
 */
router.put('/:studyInstanceUID/assign', async (req, res) => {
  try {
    const { studyInstanceUID } = req.params;
    const { userId } = req.body;
    
    const item = await worklistService.assignStudy(
      studyInstanceUID,
      userId || req.user._id
    );
    
    res.json({
      success: true,
      item
    });
  } catch (error) {
    console.error('Error assigning study:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign study',
      message: error.message
    });
  }
});

/**
 * PUT /api/worklist/:studyInstanceUID/critical
 * Mark study as critical
 */
router.put('/:studyInstanceUID/critical', async (req, res) => {
  try {
    const { studyInstanceUID } = req.params;
    const { notifiedTo } = req.body;
    
    const item = await worklistService.markCritical(
      studyInstanceUID,
      notifiedTo || []
    );
    
    res.json({
      success: true,
      item
    });
  } catch (error) {
    console.error('Error marking critical:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark as critical',
      message: error.message
    });
  }
});

/**
 * POST /api/worklist/force-create-test
 * Force create a worklist item for testing (TEMPORARY DEBUG ENDPOINT)
 */
router.post('/force-create-test', async (req, res) => {
  try {
    const WorklistItem = require('../models/WorklistItem');
    const Study = require('../models/Study');
    
    const hospitalId = req.user.hospitalId || req.user._id;
    
    // Get the first study
    const study = await Study.findOne({});
    
    if (!study) {
      return res.json({
        success: false,
        message: 'No studies found in database'
      });
    }
    
    // Force create worklist item
    const worklistItem = await WorklistItem.create({
      studyInstanceUID: study.studyInstanceUID,
      patientID: study.patientID,
      hospitalId: hospitalId,
      status: 'pending',
      priority: 'routine',
      reportStatus: 'none',
      scheduledFor: new Date()
    });
    
    res.json({
      success: true,
      message: 'Force created worklist item',
      worklistItem: {
        _id: worklistItem._id,
        studyInstanceUID: worklistItem.studyInstanceUID,
        hospitalId: worklistItem.hospitalId,
        status: worklistItem.status
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

/**
 * POST /api/worklist/sync
 * Sync worklist from studies
 * // ✅ WORKLIST EMPTY FIX: Create WorklistItem for any study without a worklist row
 */
router.post('/sync', async (req, res) => {
  try {
    const userRole = req.user.role || req.user.roles?.[0];
    const isSuperAdmin = userRole === 'superadmin' || userRole === 'system:admin';
    const hospitalId = req.user.hospitalId || req.user._id;
    
    console.log('🔄 Sync started by user:', req.user.username, 'hospitalId:', hospitalId);
    
    // ✅ WORKLIST EMPTY FIX: Sync creates worklist items for studies without them
    const Study = require('../models/Study');
    const WorklistItem = require('../models/WorklistItem');
    const StructuredReport = require('../models/StructuredReport');
    
    // ✅ FIX: Get ALL studies first, then filter by hospitalId OR null
    const studyQuery = isSuperAdmin ? {} : {
      $or: [
        { hospitalId: hospitalId },
        { hospitalId: null },
        { hospitalId: { $exists: false } }
      ]
    };
    const studies = await Study.find(studyQuery);
    
    console.log(`📋 Found ${studies.length} studies to sync`);
    console.log(`📋 First study:`, studies[0] ? {
      studyInstanceUID: studies[0].studyInstanceUID,
      patientID: studies[0].patientID,
      hospitalId: studies[0].hospitalId
    } : 'none');
    
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let fixed = 0; // Count of items with missing hospitalId that we fixed
    
    for (const study of studies) {
      try {
        // Check if worklist item exists
        let worklistItem = await WorklistItem.findOne({ 
          studyInstanceUID: study.studyInstanceUID 
        });
        
        if (!worklistItem) {
          // ✅ WORKLIST EMPTY FIX: Create with status='PENDING', priority='ROUTINE', reportStatus='NONE'
          worklistItem = await WorklistItem.create({
            studyInstanceUID: study.studyInstanceUID,
            patientID: study.patientID,
            hospitalId: study.hospitalId || hospitalId,
            status: 'pending',
            priority: 'routine',
            reportStatus: 'none',
            scheduledFor: study.studyDate ? new Date(study.studyDate) : new Date()
          });
          created++;
          console.log(`✅ Created worklist item for study: ${study.studyInstanceUID}`);
        } else {
          // ✅ FIX: Update hospitalId if it's missing or null
          let needsUpdate = false;
          
          if (!worklistItem.hospitalId) {
            worklistItem.hospitalId = study.hospitalId || hospitalId;
            needsUpdate = true;
            fixed++;
            console.log(`🔧 Fixed missing hospitalId for study: ${study.studyInstanceUID}`);
          }
          
          // ✅ WORKLIST EMPTY FIX: Check if report exists and update status accordingly
          const report = await StructuredReport.findOne({ 
            studyInstanceUID: study.studyInstanceUID 
          }).sort({ reportDate: -1 });
          
          if (report) {
            let newStatus = worklistItem.status;
            let newReportStatus = worklistItem.reportStatus;
            
            // ✅ WORKLIST EMPTY FIX: Update based on report status
            if (report.reportStatus === 'draft') {
              newStatus = 'in_progress';
              newReportStatus = 'draft';
            } else if (report.reportStatus === 'final' && !report.signedAt) {
              newStatus = 'completed';
              newReportStatus = 'finalized';
            } else if (report.signedAt) {
              newStatus = 'completed';
              newReportStatus = 'finalized';
            }
            
            if (newStatus !== worklistItem.status || newReportStatus !== worklistItem.reportStatus) {
              worklistItem.status = newStatus;
              worklistItem.reportStatus = newReportStatus;
              worklistItem.reportId = report._id.toString();
              needsUpdate = true;
            }
          }
          
          if (needsUpdate) {
            await worklistItem.save();
            updated++;
          } else {
            skipped++;
          }
        }
      } catch (itemError) {
        console.error(`❌ Failed to sync study ${study.studyInstanceUID}:`, itemError.message);
        skipped++;
      }
    }
    
    // ✅ WORKLIST EMPTY FIX: Return counts {created, updated, skipped, total}
    res.json({
      success: true,
      created,
      updated,
      skipped,
      fixed,
      total: studies.length,
      message: `Sync complete: ${created} created, ${updated} updated, ${fixed} fixed, ${skipped} skipped`
    });
  } catch (error) {
    console.error('❌ Error syncing worklist:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync worklist',
      message: error.message
    });
  }
});

module.exports = router;
