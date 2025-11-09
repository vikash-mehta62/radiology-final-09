const Report = require('../models/Report');
const WorklistItem = require('../models/WorklistItem');
const Study = require('../models/Study');
const { v4: uuidv4 } = require('uuid');

class ReportService {
  
  /**
   * Create new report with mode support (manual, ai-assisted, ai-only)
   */
  async createReport(data) {
    const {
      studyInstanceUID,
      patientID,
      patientName,
      templateId,
      templateName,
      modality,
      createdBy,
      hospitalId,
      creationMode = 'manual', // NEW: manual, ai-assisted, ai-only
      aiAnalysisId = null,
      aiProvenance = null
    } = data;
    
    // Check if draft report already exists
    const existingDraft = await Report.findOne({
      studyInstanceUID,
      status: 'draft'
    });
    
    if (existingDraft) {
      return existingDraft;
    }
    
    // Prepare report data
    const reportData = {
      reportId: `RPT-${uuidv4()}`,
      studyInstanceUID,
      patientID,
      patientName,
      templateId,
      templateName,
      modality,
      createdBy,
      hospitalId,
      status: 'draft',
      creationMode, // NEW
      aiAnalysisId,
      aiProvenance
    };
    
    // If AI-assisted or AI-only, populate from AI analysis
    if ((creationMode === 'ai-assisted' || creationMode === 'ai-only') && aiAnalysisId) {
      const aiData = await this.loadAIAnalysis(aiAnalysisId);
      if (aiData) {
        Object.assign(reportData, this.populateFromAI(aiData));
      }
    }
    
    // Create new report
    const report = await Report.create(reportData);
    
    // Update worklist item
    await WorklistItem.findOneAndUpdate(
      { studyInstanceUID },
      { reportStatus: 'draft' }
    );
    
    // Audit trail
    await this.addAuditEntry(report._id, {
      actorId: createdBy,
      actionType: 'report.created',
      timestamp: new Date(),
      diffSnapshot: { creationMode, aiAnalysisId }
    });
    
    return report;
  }
  
  /**
   * Load AI analysis data - DISABLED (AI removed)
   */
  async loadAIAnalysis(analysisId) {
    console.warn('AI Analysis feature has been removed');
    return null;
    /* ORIGINAL CODE - COMMENTED OUT
    try {
      const AIAnalysis = require('../models/AIAnalysis');
      const analysis = await AIAnalysis.findOne({ analysisId });
      return analysis;
    } catch (error) {
      console.error('Failed to load AI analysis:', error);
      return null;
    }
    */
  }
  
  /**
   * Populate report fields from AI analysis
   */
  populateFromAI(aiAnalysis) {
    const populated = {
      aiModelsUsed: aiAnalysis.aiModels || [],
      aiProvenance: {
        modelName: aiAnalysis.aiModels?.[0] || 'Unknown',
        modelVersion: '1.0',
        requestId: aiAnalysis.analysisId,
        timestamp: aiAnalysis.analyzedAt,
        rawOutputHash: this.hashObject(aiAnalysis.results),
        rawOutput: aiAnalysis.results,
        confidence: aiAnalysis.results?.confidence || 0,
        processingTime: aiAnalysis.processingTime || 0
      }
    };
    
    // Extract findings
    if (aiAnalysis.results) {
      const results = aiAnalysis.results;
      
      if (results.findings) {
        populated.findings = results.findings;
        populated.findingsText = results.findings;
      }
      
      if (results.impression) {
        populated.impression = results.impression;
      }
      
      if (results.recommendations) {
        populated.recommendations = Array.isArray(results.recommendations) 
          ? results.recommendations.join('\n') 
          : results.recommendations;
      }
      
      // Structured findings
      if (results.detections) {
        populated.structuredFindings = results.detections.map((d, idx) => ({
          id: `ai-${idx}`,
          type: 'finding',
          category: 'ai-detected',
          description: d.description || d.label,
          severity: d.severity || 'mild',
          confidence: d.confidence,
          aiGenerated: true,
          frameIndex: aiAnalysis.frameIndex || 0
        }));
      }
    }
    
    return populated;
  }
  
  /**
   * Hash object for provenance tracking
   */
  hashObject(obj) {
    const crypto = require('crypto');
    const str = JSON.stringify(obj);
    return crypto.createHash('sha256').update(str).digest('hex');
  }
  
  /**
   * Add audit trail entry
   */
  async addAuditEntry(reportId, entry) {
    try {
      await Report.findByIdAndUpdate(reportId, {
        $push: {
          revisionHistory: {
            revisedBy: entry.actorId,
            revisedAt: entry.timestamp,
            changes: entry.actionType,
            actorId: entry.actorId,
            actionType: entry.actionType,
            diffSnapshot: entry.diffSnapshot
          }
        }
      });
    } catch (error) {
      console.error('Failed to add audit entry:', error);
    }
  }
  
  /**
   * Update report content
   */
  async updateReport(reportId, updates) {
    const report = await Report.findOne({ reportId });
    
    if (!report) {
      throw new Error('Report not found');
    }
    
    if (report.status === 'finalized') {
      throw new Error('Cannot update finalized report. Use addendum instead.');
    }
    
    // Update allowed fields
    const allowedFields = [
      'clinicalHistory',
      'technique',
      'findings',
      'impression',
      'recommendations',
      'structuredFindings',
      'keyImages',
      'aiAnalysisId',
      'aiModelsUsed'
    ];
    
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        report[field] = updates[field];
      }
    });
    
    await report.save();
    return report;
  }
  
  /**
   * Add key image to report
   */
  async addKeyImage(reportId, imageData) {
    const report = await Report.findOne({ reportId });
    
    if (!report) {
      throw new Error('Report not found');
    }
    
    report.keyImages.push({
      ...imageData,
      timestamp: new Date()
    });
    
    await report.save();
    return report;
  }
  
  /**
   * Finalize report
   */
  async finalizeReport(reportId, signatureData, userId) {
    const report = await Report.findOne({ reportId });
    
    if (!report) {
      throw new Error('Report not found');
    }
    
    if (report.status === 'finalized') {
      throw new Error('Report already finalized');
    }
    
    // Validate required fields
    if (!report.findings || !report.impression) {
      throw new Error('Findings and impression are required');
    }
    
    // Update report
    report.status = 'finalized';
    report.finalizedBy = userId;
    report.finalizedAt = new Date();
    
    if (signatureData) {
      report.signature = {
        type: signatureData.type || 'text',
        signedBy: signatureData.signedBy,
        signedAt: new Date(),
        credentials: signatureData.credentials
      };
    }
    
    await report.save();
    
    // Update worklist item
    await WorklistItem.findOneAndUpdate(
      { studyInstanceUID: report.studyInstanceUID },
      { 
        reportStatus: 'finalized',
        status: 'completed',
        completedAt: new Date()
      }
    );
    
    // Check for critical findings
    if (report.isCritical && !report.criticalNotifiedAt) {
      await this.notifyCriticalFindings(reportId);
    }
    
    return report;
  }
  
  /**
   * Add addendum to finalized report
   */
  async addAddendum(reportId, addendumData, userId) {
    const report = await Report.findOne({ reportId });
    
    if (!report) {
      throw new Error('Report not found');
    }
    
    if (report.status !== 'finalized') {
      throw new Error('Can only add addendum to finalized reports');
    }
    
    report.addenda.push({
      content: addendumData.content,
      addedBy: userId,
      addedAt: new Date(),
      reason: addendumData.reason
    });
    
    report.status = 'amended';
    await report.save();
    
    return report;
  }
  
  /**
   * Mark report as critical
   */
  async markCritical(reportId, notifyTo = []) {
    const report = await Report.findOne({ reportId });
    
    if (!report) {
      throw new Error('Report not found');
    }
    
    report.isCritical = true;
    await report.save();
    
    // Update worklist
    await WorklistItem.findOneAndUpdate(
      { studyInstanceUID: report.studyInstanceUID },
      { 
        hasCriticalFindings: true,
        priority: 'stat'
      }
    );
    
    // Send notifications
    if (notifyTo.length > 0) {
      await this.notifyCriticalFindings(reportId, notifyTo);
    }
    
    return report;
  }
  
  /**
   * Notify critical findings
   */
  async notifyCriticalFindings(reportId, recipients = []) {
    const report = await Report.findOne({ reportId });
    
    if (!report) {
      throw new Error('Report not found');
    }
    
    report.criticalNotifiedAt = new Date();
    report.criticalNotifiedTo = recipients;
    await report.save();
    
    // Update worklist
    await WorklistItem.findOneAndUpdate(
      { studyInstanceUID: report.studyInstanceUID },
      { criticalFindingsNotified: true }
    );
    
    // TODO: Send actual notifications (email, SMS, etc.)
    console.log(`🚨 Critical findings notified for report ${reportId} to:`, recipients);
    
    return report;
  }
  
  /**
   * Get reports for study
   */
  async getReportsByStudy(studyInstanceUID) {
    const reports = await Report.find({ studyInstanceUID })
      .populate('createdBy', 'username email')
      .populate('finalizedBy', 'username email')
      .sort({ createdAt: -1 })
      .lean();
    
    return reports;
  }
  
  /**
   * Get reports for patient
   */
  async getReportsByPatient(patientID, limit = 10) {
    const reports = await Report.find({ patientID, status: 'finalized' })
      .populate('createdBy', 'username email')
      .populate('finalizedBy', 'username email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    
    return reports;
  }
  
  /**
   * Get report by ID
   */
  async getReport(reportId) {
    const report = await Report.findOne({ reportId })
      .populate('createdBy', 'username email')
      .populate('finalizedBy', 'username email')
      .lean();
    
    return report;
  }
  
  /**
   * Delete draft report
   */
  async deleteDraft(reportId, userId) {
    const report = await Report.findOne({ reportId });
    
    if (!report) {
      throw new Error('Report not found');
    }
    
    if (report.status !== 'draft') {
      throw new Error('Can only delete draft reports');
    }
    
    if (report.createdBy.toString() !== userId.toString()) {
      throw new Error('Unauthorized to delete this report');
    }
    
    await Report.deleteOne({ reportId });
    
    // Update worklist
    await WorklistItem.findOneAndUpdate(
      { studyInstanceUID: report.studyInstanceUID },
      { reportStatus: 'none' }
    );
    
    return { success: true };
  }
  
  /**
   * Get report statistics
   */
  async getStatistics(hospitalId, dateRange = {}) {
    const query = hospitalId ? { hospitalId } : {};
    
    if (dateRange.start || dateRange.end) {
      query.createdAt = {};
      if (dateRange.start) query.createdAt.$gte = new Date(dateRange.start);
      if (dateRange.end) query.createdAt.$lte = new Date(dateRange.end);
    }
    
    const [
      total,
      draft,
      finalized,
      amended,
      critical,
      withAI,
      manual,
      aiAssisted,
      aiOnly
    ] = await Promise.all([
      Report.countDocuments(query),
      Report.countDocuments({ ...query, status: 'draft' }),
      Report.countDocuments({ ...query, status: { $in: ['finalized', 'final'] } }),
      Report.countDocuments({ ...query, status: 'amended' }),
      Report.countDocuments({ ...query, isCritical: true }),
      Report.countDocuments({ ...query, aiModelsUsed: { $exists: true, $ne: [] } }),
      Report.countDocuments({ ...query, creationMode: 'manual' }),
      Report.countDocuments({ ...query, creationMode: 'ai-assisted' }),
      Report.countDocuments({ ...query, creationMode: 'ai-only' })
    ]);
    
    return {
      total,
      byStatus: {
        draft,
        finalized,
        amended
      },
      byMode: {
        manual,
        aiAssisted,
        aiOnly
      },
      critical,
      aiAssisted: withAI,
      aiPercentage: total > 0 ? Math.round((withAI / total) * 100) : 0
    };
  }
  
  /**
   * Render report to PDF (industry-standard)
   */
  async renderToPDF(reportId) {
    const report = await Report.findOne({ reportId })
      .populate('createdBy', 'username email firstName lastName')
      .populate('finalizedBy', 'username email firstName lastName')
      .lean();
    
    if (!report) {
      throw new Error('Report not found');
    }
    
    const PDFDocument = require('pdfkit');
    const path = require('path');
    const fs = require('fs');
    
    // Create PDF directory if it doesn't exist
    const pdfDir = path.join(__dirname, '../../pdfs');
    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
    }
    
    const pdfPath = path.join(pdfDir, `${reportId}.pdf`);
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(pdfPath);
    
    doc.pipe(stream);
    
    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('MEDICAL IMAGING REPORT', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text(`Report ID: ${report.reportId}`, { align: 'center' });
    doc.text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1);
    
    // Patient Information
    doc.fontSize(14).font('Helvetica-Bold').text('PATIENT INFORMATION');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Patient Name: ${report.patientName || 'N/A'}`);
    doc.text(`Patient ID: ${report.patientID}`);
    doc.text(`Study UID: ${report.studyInstanceUID}`);
    doc.text(`Modality: ${report.modality || 'N/A'}`);
    doc.text(`Study Date: ${report.studyDate || 'N/A'}`);
    doc.moveDown(1);
    
    // Report Metadata
    doc.fontSize(14).font('Helvetica-Bold').text('REPORT METADATA');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Creation Mode: ${report.creationMode || 'manual'}`);
    doc.text(`Status: ${report.status}`);
    doc.text(`Created: ${new Date(report.createdAt).toLocaleString()}`);
    if (report.finalizedAt) {
      doc.text(`Finalized: ${new Date(report.finalizedAt).toLocaleString()}`);
    }
    doc.moveDown(1);
    
    // AI Provenance (if applicable)
    if (report.aiProvenance) {
      doc.fontSize(14).font('Helvetica-Bold').text('AI ANALYSIS PROVENANCE');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Model: ${report.aiProvenance.modelName}`);
      doc.text(`Version: ${report.aiProvenance.modelVersion}`);
      doc.text(`Request ID: ${report.aiProvenance.requestId}`);
      doc.text(`Confidence: ${(report.aiProvenance.confidence * 100).toFixed(1)}%`);
      doc.text(`Processing Time: ${report.aiProvenance.processingTime}ms`);
      doc.text(`Output Hash: ${report.aiProvenance.rawOutputHash?.substring(0, 16)}...`);
      doc.moveDown(1);
    }
    
    // Clinical History
    if (report.clinicalHistory) {
      doc.fontSize(14).font('Helvetica-Bold').text('CLINICAL HISTORY');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').text(report.clinicalHistory, { align: 'justify' });
      doc.moveDown(1);
    }
    
    // Technique
    if (report.technique) {
      doc.fontSize(14).font('Helvetica-Bold').text('TECHNIQUE');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').text(report.technique, { align: 'justify' });
      doc.moveDown(1);
    }
    
    // Findings
    doc.fontSize(14).font('Helvetica-Bold').text('FINDINGS');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text(report.findings || report.findingsText || 'No findings documented', { align: 'justify' });
    doc.moveDown(1);
    
    // Impression
    doc.fontSize(14).font('Helvetica-Bold').text('IMPRESSION');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text(report.impression || 'No impression documented', { align: 'justify' });
    doc.moveDown(1);
    
    // Recommendations
    if (report.recommendations) {
      doc.fontSize(14).font('Helvetica-Bold').text('RECOMMENDATIONS');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').text(report.recommendations, { align: 'justify' });
      doc.moveDown(1);
    }
    
    // Signature
    doc.fontSize(14).font('Helvetica-Bold').text('SIGNATURE');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Radiologist: ${report.radiologistName || report.createdBy?.username || 'N/A'}`);
    if (report.signedAt) {
      doc.text(`Signed: ${new Date(report.signedAt).toLocaleString()}`);
    }
    if (report.radiologistSignature || report.signature?.type) {
      doc.text(`Signature: ${report.radiologistSignature || report.signature.signedBy || 'Electronic'}`);
    }
    doc.moveDown(1);
    
    // Disclaimer
    doc.fontSize(12).font('Helvetica-Bold').text('DISCLAIMER', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica');
    if (report.creationMode === 'ai-assisted' || report.creationMode === 'ai-only') {
      doc.text(
        'This report was generated with AI assistance. All AI-generated content has been reviewed and verified by a qualified radiologist. ' +
        'AI systems are assistive tools and do not replace clinical judgment.',
        { align: 'justify' }
      );
    } else {
      doc.text(
        'This report represents the professional opinion of the interpreting radiologist based on the available imaging studies and clinical information.',
        { align: 'justify' }
      );
    }
    
    doc.end();
    
    return new Promise((resolve, reject) => {
      stream.on('finish', () => resolve(pdfPath));
      stream.on('error', reject);
    });
  }
}

module.exports = new ReportService();
