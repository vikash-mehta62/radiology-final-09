// ✅ WORKLIST EMPTY FIX: Updated imports
const WorklistItem = require('../models/WorklistItem');
const Study = require('../models/Study');
const StructuredReport = require('../models/StructuredReport');
const { getOrthancClient } = require('./unified-orthanc-service');

class WorklistService {
  
  /**
   * Get worklist items with filters
   */
  async getWorklist(filters = {}) {
    const {
      hospitalId,
      assignedTo,
      status,
      priority,
      hasCriticalFindings,
      startDate,
      endDate,
      limit = 100,
      skip = 0
    } = filters;
    
    const query = {};
    
    // ✅ WORKLIST EMPTY FIX: Handle hospitalId filtering - include items with null hospitalId for migration
    if (hospitalId) {
      query.$or = [
        { hospitalId: hospitalId },
        { hospitalId: null },
        { hospitalId: { $exists: false } }
      ];
    }
    if (assignedTo) query.assignedTo = assignedTo;
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (hasCriticalFindings !== undefined) query.hasCriticalFindings = hasCriticalFindings;
    
    // ✅ WORKLIST EMPTY FIX: Use updatedAt for date filtering instead of scheduledFor
    // This ensures recently created items show up even if study date is old
    if (startDate || endDate) {
      query.updatedAt = {};
      if (startDate) query.updatedAt.$gte = new Date(startDate);
      if (endDate) query.updatedAt.$lte = new Date(endDate);
    }
    
    // ✅ WORKLIST EMPTY FIX: Sort by updatedAt (newest first) instead of scheduledFor
    const items = await WorklistItem.find(query)
      .populate('assignedTo', 'username email')
      .sort({ priority: -1, updatedAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();
    
    // Enrich with study data and sync report status
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        const study = await Study.findOne({ studyInstanceUID: item.studyInstanceUID }).lean();
        
        // ✅ WORKLIST EMPTY FIX: Check for report and sync status
        const report = await StructuredReport.findOne({ studyInstanceUID: item.studyInstanceUID })
          .sort({ reportDate: -1 })
          .lean();
        
        let reportStatus = 'none';
        if (report) {
          // Map report status to worklist reportStatus
          if (report.reportStatus === 'draft') {
            reportStatus = 'draft';
          } else if (report.reportStatus === 'final' || report.signedAt) {
            reportStatus = 'finalized';
          }
          
          // Update worklist item if report status changed
          if (item.reportStatus !== reportStatus) {
            await WorklistItem.updateOne(
              { _id: item._id },
              { 
                reportStatus: reportStatus,
                reportId: report._id.toString()
              }
            );
          }
        }
        
        return {
          ...item,
          study: study || null,
          reportStatus: reportStatus
        };
      })
    );
    
    return enrichedItems;
  }
  
  /**
   * Create or update worklist item from study
   */
  async createWorklistItem(studyInstanceUID, options = {}) {
    const {
      hospitalId,
      priority = 'routine',
      assignedTo = null,
      scheduledFor = new Date()
    } = options;
    
    // Get study data
    const study = await Study.findOne({ studyInstanceUID });
    if (!study) {
      throw new Error('Study not found');
    }
    
    // Check if worklist item already exists
    let worklistItem = await WorklistItem.findOne({ studyInstanceUID });
    
    if (worklistItem) {
      // Update existing
      worklistItem.priority = priority;
      worklistItem.assignedTo = assignedTo;
      worklistItem.scheduledFor = scheduledFor;
      await worklistItem.save();
    } else {
      // Create new
      worklistItem = await WorklistItem.create({
        studyInstanceUID,
        patientID: study.patientID,
        hospitalId: hospitalId || study.hospitalId,
        priority,
        assignedTo,
        scheduledFor,
        status: 'pending'
      });
    }
    
    return worklistItem;
  }
  
  /**
   * Update worklist item status
   */
  async updateStatus(studyInstanceUID, status, userId = null) {
    const worklistItem = await WorklistItem.findOne({ studyInstanceUID });
    
    if (!worklistItem) {
      throw new Error('Worklist item not found');
    }
    
    worklistItem.status = status;
    
    if (status === 'in_progress' && !worklistItem.startedAt) {
      worklistItem.startedAt = new Date();
    }
    
    if (status === 'completed' && !worklistItem.completedAt) {
      worklistItem.completedAt = new Date();
    }
    
    await worklistItem.save();
    return worklistItem;
  }
  
  /**
   * Assign study to radiologist
   */
  async assignStudy(studyInstanceUID, userId) {
    const worklistItem = await WorklistItem.findOne({ studyInstanceUID });
    
    if (!worklistItem) {
      throw new Error('Worklist item not found');
    }
    
    worklistItem.assignedTo = userId;
    worklistItem.assignedAt = new Date();
    
    if (worklistItem.status === 'pending') {
      worklistItem.status = 'in_progress';
      worklistItem.startedAt = new Date();
    }
    
    await worklistItem.save();
    return worklistItem;
  }
  
  /**
   * Mark critical findings
   */
  async markCritical(studyInstanceUID, notifiedTo = []) {
    const worklistItem = await WorklistItem.findOne({ studyInstanceUID });
    
    if (!worklistItem) {
      throw new Error('Worklist item not found');
    }
    
    worklistItem.hasCriticalFindings = true;
    worklistItem.criticalFindingsNotified = notifiedTo.length > 0;
    worklistItem.priority = 'stat'; // Upgrade to STAT
    
    await worklistItem.save();
    
    // TODO: Send notifications
    
    return worklistItem;
  }
  
  /**
   * Get worklist statistics
   */
  async getStatistics(hospitalId) {
    const query = hospitalId ? { hospitalId } : {};
    
    const [
      total,
      pending,
      inProgress,
      completed,
      stat,
      urgent,
      critical
    ] = await Promise.all([
      WorklistItem.countDocuments(query),
      WorklistItem.countDocuments({ ...query, status: 'pending' }),
      WorklistItem.countDocuments({ ...query, status: 'in_progress' }),
      WorklistItem.countDocuments({ ...query, status: 'completed' }),
      WorklistItem.countDocuments({ ...query, priority: 'stat' }),
      WorklistItem.countDocuments({ ...query, priority: 'urgent' }),
      WorklistItem.countDocuments({ ...query, hasCriticalFindings: true, criticalFindingsNotified: false })
    ]);
    
    return {
      total,
      byStatus: {
        pending,
        inProgress,
        completed
      },
      byPriority: {
        stat,
        urgent,
        routine: total - stat - urgent
      },
      criticalUnnotified: critical
    };
  }
  
  /**
   * Auto-create worklist items from new studies
   */
  async syncFromStudies(hospitalId = null) {
    const query = hospitalId ? { hospitalId } : {};
    const studies = await Study.find(query).lean();
    
    let created = 0;
    let skipped = 0;
    let updated = 0;
    
    for (const study of studies) {
      const exists = await WorklistItem.findOne({ studyInstanceUID: study.studyInstanceUID });
      
      if (!exists) {
        try {
          await this.createWorklistItem(study.studyInstanceUID, {
            hospitalId: study.hospitalId,
            priority: 'routine'
          });
          created++;
        } catch (error) {
          console.error(`Failed to create worklist item for ${study.studyInstanceUID}:`, error.message);
          skipped++;
        }
      } else {
        // ✅ WORKLIST EMPTY FIX: Update existing worklist item with latest report status
        const report = await StructuredReport.findOne({ studyInstanceUID: study.studyInstanceUID })
          .sort({ reportDate: -1 })
          .lean();
        
        if (report) {
          let reportStatus = 'none';
          if (report.reportStatus === 'draft') {
            reportStatus = 'draft';
          } else if (report.reportStatus === 'final' || report.signedAt) {
            reportStatus = 'finalized';
          }
          
          await WorklistItem.updateOne(
            { studyInstanceUID: study.studyInstanceUID },
            { 
              reportStatus: reportStatus,
              reportId: report._id.toString()
            }
          );
          updated++;
        } else {
          skipped++;
        }
      }
    }
    
    return { created, skipped, updated, total: studies.length };
  }
}

module.exports = new WorklistService();
