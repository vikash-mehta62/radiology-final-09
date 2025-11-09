const StructuredReport = require('../models/StructuredReport');
const Study = require('../models/Study');
const Patient = require('../models/Patient');

/**
 * Create or update a structured report
 */
exports.saveReport = async (req, res) => {
  try {
    const {
      studyInstanceUID,
      patientID,
      reportId,
      reportStatus,
      radiologistSignature,
      findings,
      measurements,
      annotations,
      clinicalHistory,
      technique,
      comparison,
      findingsText,
      impression,
      recommendations,
      keyImages,
      tags,
      priority
    } = req.body;

    // Get user info from authenticated session
    const userId = req.user?.id || req.user?._id;
    const radiologistName = req.user ? `${req.user.firstName} ${req.user.lastName}` : 'Unknown';

    if (!studyInstanceUID) {
      return res.status(400).json({
        success: false,
        error: 'studyInstanceUID is required'
      });
    }

    // Fetch study and patient details
    const study = await Study.findOne({ studyInstanceUID });
    
    // Get patient ID from request or from study
    let finalPatientID = patientID;
    if (!finalPatientID && study) {
      finalPatientID = study.patientID;
      console.log('📋 Patient ID extracted from study:', finalPatientID);
    }
    
    if (!finalPatientID) {
      return res.status(400).json({
        success: false,
        error: 'patientID is required and could not be determined from study'
      });
    }
    
    const patient = await Patient.findOne({ patientID: finalPatientID });

    let report;

    if (reportId) {
      // Update existing report
      report = await StructuredReport.findOne({ reportId });
      
      if (!report) {
        return res.status(404).json({
          success: false,
          error: 'Report not found'
        });
      }

      // Track revision history
      if (report.reportStatus !== reportStatus) {
        report.revisionHistory.push({
          revisedBy: radiologistName,
          revisedAt: new Date(),
          changes: `Status changed from ${report.reportStatus} to ${reportStatus}`,
          previousStatus: report.reportStatus
        });
      }

      // Update fields
      Object.assign(report, {
        reportStatus,
        radiologistSignature,
        findings: findings || report.findings,
        measurements: measurements || report.measurements,
        annotations: annotations || report.annotations,
        clinicalHistory: clinicalHistory || report.clinicalHistory,
        technique: technique || report.technique,
        comparison: comparison || report.comparison,
        findingsText: findingsText || report.findingsText,
        impression: impression || report.impression,
        recommendations: recommendations || report.recommendations,
        keyImages: keyImages || report.keyImages,
        tags: tags || report.tags,
        priority: priority || report.priority,
        version: report.version + 1
      });

      // Set signed timestamp if status is final
      if (reportStatus === 'final' && !report.signedAt) {
        report.signedAt = new Date();
      }

    } else {
      // Create new report
      report = new StructuredReport({
        studyInstanceUID,
        patientID: finalPatientID,
        patientName: patient?.patientName || study?.patientName,
        patientBirthDate: patient?.birthDate || study?.patientBirthDate,
        patientSex: patient?.sex || study?.patientSex,
        studyDate: study?.studyDate,
        studyTime: study?.studyTime,
        studyDescription: study?.studyDescription,
        modality: study?.modality,
        radiologistId: userId,
        radiologistName,
        radiologistSignature,
        reportStatus: reportStatus || 'draft',
        findings: findings || [],
        measurements: measurements || [],
        annotations: annotations || [],
        clinicalHistory,
        technique,
        comparison,
        findingsText,
        impression,
        recommendations,
        keyImages: keyImages || [],
        tags: tags || [],
        priority: priority || 'routine'
      });

      if (reportStatus === 'final') {
        report.signedAt = new Date();
      }
    }

    await report.save();

    res.json({
      success: true,
      data: report,
      message: reportId ? 'Report updated successfully' : 'Report created successfully'
    });

  } catch (error) {
    console.error('Error saving structured report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save report',
      details: error.message
    });
  }
};

/**
 * Get reports for a specific study
 */
exports.getReportsByStudy = async (req, res) => {
  try {
    const { studyInstanceUID } = req.params;
    const { status } = req.query;

    const query = { studyInstanceUID };
    if (status) {
      query.reportStatus = status;
    }

    const reports = await StructuredReport.find(query)
      .populate('radiologistId', 'firstName lastName email')
      .sort({ reportDate: -1 });

    res.json({
      success: true,
      data: reports,
      count: reports.length
    });

  } catch (error) {
    console.error('Error fetching reports by study:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reports',
      details: error.message
    });
  }
};

/**
 * Get reports for a specific patient
 */
exports.getReportsByPatient = async (req, res) => {
  try {
    const { patientID } = req.params;
    const { status, limit = 50 } = req.query;

    const query = { patientID };
    if (status) {
      query.reportStatus = status;
    }

    const reports = await StructuredReport.find(query)
      .populate('radiologistId', 'firstName lastName email')
      .sort({ reportDate: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: reports,
      count: reports.length
    });

  } catch (error) {
    console.error('Error fetching reports by patient:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reports',
      details: error.message
    });
  }
};

/**
 * Get a specific report by ID
 */
exports.getReportById = async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await StructuredReport.findOne({ reportId })
      .populate('radiologistId', 'firstName lastName email');

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch report',
      details: error.message
    });
  }
};

/**
 * Get reports by radiologist
 */
exports.getReportsByRadiologist = async (req, res) => {
  try {
    const radiologistId = req.user?.id || req.user?._id;
    const { status, limit = 50 } = req.query;

    const query = { radiologistId };
    if (status) {
      query.reportStatus = status;
    }

    const reports = await StructuredReport.find(query)
      .sort({ reportDate: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: reports,
      count: reports.length
    });

  } catch (error) {
    console.error('Error fetching radiologist reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reports',
      details: error.message
    });
  }
};

/**
 * Delete a report (soft delete by changing status to cancelled)
 */
exports.deleteReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const radiologistName = req.user ? `${req.user.firstName} ${req.user.lastName}` : 'Unknown';

    const report = await StructuredReport.findOne({ reportId });

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    // Soft delete: change status to cancelled
    report.reportStatus = 'cancelled';
    report.revisionHistory.push({
      revisedBy: radiologistName,
      revisedAt: new Date(),
      changes: 'Report cancelled',
      previousStatus: report.reportStatus
    });

    await report.save();

    res.json({
      success: true,
      message: 'Report cancelled successfully'
    });

  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete report',
      details: error.message
    });
  }
};

/**
 * Export report as JSON
 */
exports.exportReport = async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await StructuredReport.findOne({ reportId })
      .populate('radiologistId', 'firstName lastName email')
      .lean();

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    console.error('Error exporting report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export report',
      details: error.message
    });
  }
};

/**
 * Get report statistics
 */
exports.getReportStats = async (req, res) => {
  try {
    const radiologistId = req.user?.id || req.user?._id;

    const stats = await StructuredReport.aggregate([
      { $match: { radiologistId: radiologistId } },
      {
        $group: {
          _id: '$reportStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalReports = await StructuredReport.countDocuments({ radiologistId });

    res.json({
      success: true,
      data: {
        total: totalReports,
        byStatus: stats.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
    });

  } catch (error) {
    console.error('Error fetching report stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      details: error.message
    });
  }
};
