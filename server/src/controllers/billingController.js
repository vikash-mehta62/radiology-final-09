const Superbill = require('../models/Superbill');
const BillingCode = require('../models/BillingCode');
const DiagnosisCode = require('../models/DiagnosisCode');
const aiBillingService = require('../services/ai-billing-service');
const PDFDocument = require('pdfkit');

/**
 * Generate AI-powered billing code suggestions
 */
exports.suggestBillingCodes = async (req, res) => {
  try {
    const { reportData } = req.body;
    
    if (!reportData) {
      return res.status(400).json({
        success: false,
        error: 'Report data is required'
      });
    }
    
    // Get AI suggestions
    const suggestions = await aiBillingService.analyzeBillingCodes(reportData);
    
    res.json({
      success: true,
      suggestions,
      message: 'Billing codes suggested successfully'
    });
    
  } catch (error) {
    console.error('Error suggesting billing codes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to suggest billing codes',
      details: error.message
    });
  }
};

/**
 * Create superbill from report
 */
exports.createSuperbill = async (req, res) => {
  try {
    const {
      studyInstanceUID,
      reportId,
      patientInfo,
      insuranceInfo,
      providerInfo,
      cptCodes,
      icd10Codes,
      dateOfService,
      aiAnalysis
    } = req.body;
    
    // Validate required fields
    if (!studyInstanceUID || !patientInfo || !cptCodes || !icd10Codes) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    // Calculate total charges
    const totalCharges = cptCodes.reduce((sum, code) => {
      return sum + (code.charge || 0) * (code.units || 1);
    }, 0);
    
    // Create superbill
    const superbill = new Superbill({
      studyInstanceUID,
      reportId,
      patientID: patientInfo.patientID,
      patientName: patientInfo.patientName,
      patientDOB: patientInfo.patientDOB,
      patientSex: patientInfo.patientSex,
      insuranceProvider: insuranceInfo?.provider,
      insurancePolicyNumber: insuranceInfo?.policyNumber,
      insuranceGroupNumber: insuranceInfo?.groupNumber,
      subscriberName: insuranceInfo?.subscriberName,
      subscriberRelationship: insuranceInfo?.subscriberRelationship,
      renderingProviderNPI: providerInfo?.npi,
      renderingProviderName: providerInfo?.name,
      facilityNPI: providerInfo?.facilityNPI,
      facilityName: providerInfo?.facilityName,
      facilityAddress: providerInfo?.facilityAddress,
      dateOfService: dateOfService || new Date(),
      cptCodes,
      icd10Codes,
      totalCharges,
      aiAnalysis,
      status: 'draft',
      createdBy: req.user?._id,
      hospitalId: req.user?.hospitalId || req.user?._id
    });
    
    // Validate superbill
    const validation = validateSuperbill(superbill);
    superbill.validationErrors = validation.errors;
    superbill.validationWarnings = validation.warnings;
    superbill.isValid = validation.errors.length === 0;
    
    await superbill.save();
    
    res.json({
      success: true,
      superbill,
      validation,
      message: 'Superbill created successfully'
    });
    
  } catch (error) {
    console.error('Error creating superbill:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create superbill',
      details: error.message
    });
  }
};

/**
 * Get superbill by ID
 */
exports.getSuperbill = async (req, res) => {
  try {
    const { id } = req.params;
    
    const superbill = await Superbill.findById(id)
      .populate('createdBy', 'username email')
      .populate('approvedBy', 'username email');
    
    if (!superbill) {
      return res.status(404).json({
        success: false,
        error: 'Superbill not found'
      });
    }
    
    // Check authorization
    if (superbill.hospitalId.toString() !== req.user.hospitalId?.toString() && 
        superbill.hospitalId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this superbill'
      });
    }
    
    res.json({
      success: true,
      superbill
    });
    
  } catch (error) {
    console.error('Error fetching superbill:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch superbill',
      details: error.message
    });
  }
};

/**
 * Get superbills for a study
 */
exports.getSuperbillsByStudy = async (req, res) => {
  try {
    const { studyInstanceUID } = req.params;
    
    const superbills = await Superbill.find({
      studyInstanceUID,
      hospitalId: req.user.hospitalId || req.user._id
    })
    .sort({ createdAt: -1 })
    .populate('createdBy', 'username email')
    .populate('approvedBy', 'username email');
    
    res.json({
      success: true,
      superbills,
      count: superbills.length
    });
    
  } catch (error) {
    console.error('Error fetching superbills:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch superbills',
      details: error.message
    });
  }
};

/**
 * Update superbill
 */
exports.updateSuperbill = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const superbill = await Superbill.findById(id);
    
    if (!superbill) {
      return res.status(404).json({
        success: false,
        error: 'Superbill not found'
      });
    }
    
    // Check authorization
    if (superbill.hospitalId.toString() !== req.user.hospitalId?.toString() && 
        superbill.hospitalId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this superbill'
      });
    }
    
    // Update fields
    Object.keys(updates).forEach(key => {
      if (key !== '_id' && key !== 'superbillNumber' && key !== 'hospitalId') {
        superbill[key] = updates[key];
      }
    });
    
    // Recalculate total charges if CPT codes changed
    if (updates.cptCodes) {
      superbill.totalCharges = updates.cptCodes.reduce((sum, code) => {
        return sum + (code.charge || 0) * (code.units || 1);
      }, 0);
    }
    
    // Re-validate
    const validation = validateSuperbill(superbill);
    superbill.validationErrors = validation.errors;
    superbill.validationWarnings = validation.warnings;
    superbill.isValid = validation.errors.length === 0;
    
    await superbill.save();
    
    res.json({
      success: true,
      superbill,
      validation,
      message: 'Superbill updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating superbill:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update superbill',
      details: error.message
    });
  }
};

/**
 * Approve superbill
 */
exports.approveSuperbill = async (req, res) => {
  try {
    const { id } = req.params;
    
    const superbill = await Superbill.findById(id);
    
    if (!superbill) {
      return res.status(404).json({
        success: false,
        error: 'Superbill not found'
      });
    }
    
    // Validate before approval
    const validation = validateSuperbill(superbill);
    if (validation.errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot approve superbill with validation errors',
        validation
      });
    }
    
    superbill.status = 'approved';
    superbill.approvedBy = req.user._id;
    superbill.approvedAt = new Date();
    
    await superbill.save();
    
    res.json({
      success: true,
      superbill,
      message: 'Superbill approved successfully'
    });
    
  } catch (error) {
    console.error('Error approving superbill:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve superbill',
      details: error.message
    });
  }
};

/**
 * Export superbill as PDF
 */
exports.exportSuperbillPDF = async (req, res) => {
  try {
    const { id } = req.params;
    
    const superbill = await Superbill.findById(id);
    
    if (!superbill) {
      return res.status(404).json({
        success: false,
        error: 'Superbill not found'
      });
    }
    
    // Create PDF
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=superbill-${superbill.superbillNumber}.pdf`);
    
    doc.pipe(res);
    
    // Header
    doc.fontSize(20).text('SUPERBILL', { align: 'center' });
    doc.fontSize(10).text(`Superbill #: ${superbill.superbillNumber}`, { align: 'center' });
    doc.moveDown();
    
    // Facility Information
    doc.fontSize(12).text('FACILITY INFORMATION', { underline: true });
    doc.fontSize(10);
    doc.text(`Facility: ${superbill.facilityName || 'N/A'}`);
    doc.text(`NPI: ${superbill.facilityNPI || 'N/A'}`);
    doc.text(`Address: ${superbill.facilityAddress || 'N/A'}`);
    doc.moveDown();
    
    // Patient Information
    doc.fontSize(12).text('PATIENT INFORMATION', { underline: true });
    doc.fontSize(10);
    doc.text(`Name: ${superbill.patientName}`);
    doc.text(`ID: ${superbill.patientID}`);
    doc.text(`DOB: ${superbill.patientDOB || 'N/A'}`);
    doc.text(`Sex: ${superbill.patientSex || 'N/A'}`);
    doc.moveDown();
    
    // Insurance Information
    if (superbill.insuranceProvider) {
      doc.fontSize(12).text('INSURANCE INFORMATION', { underline: true });
      doc.fontSize(10);
      doc.text(`Provider: ${superbill.insuranceProvider}`);
      doc.text(`Policy #: ${superbill.insurancePolicyNumber || 'N/A'}`);
      doc.text(`Group #: ${superbill.insuranceGroupNumber || 'N/A'}`);
      doc.moveDown();
    }
    
    // Service Information
    doc.fontSize(12).text('SERVICE INFORMATION', { underline: true });
    doc.fontSize(10);
    doc.text(`Date of Service: ${new Date(superbill.dateOfService).toLocaleDateString()}`);
    doc.text(`Provider: ${superbill.renderingProviderName || 'N/A'}`);
    doc.text(`Provider NPI: ${superbill.renderingProviderNPI || 'N/A'}`);
    doc.moveDown();
    
    // CPT Codes
    doc.fontSize(12).text('PROCEDURE CODES (CPT)', { underline: true });
    doc.fontSize(10);
    superbill.cptCodes.forEach((code, index) => {
      doc.text(`${index + 1}. ${code.code} - ${code.description}`);
      if (code.modifiers && code.modifiers.length > 0) {
        doc.text(`   Modifiers: ${code.modifiers.join(', ')}`);
      }
      doc.text(`   Units: ${code.units || 1} | Charge: $${(code.charge || 0).toFixed(2)}`);
      if (code.aiSuggested) {
        doc.text(`   AI Suggested (Confidence: ${code.confidence}%)`, { color: 'blue' });
      }
    });
    doc.moveDown();
    
    // ICD-10 Codes
    doc.fontSize(12).text('DIAGNOSIS CODES (ICD-10)', { underline: true });
    doc.fontSize(10);
    superbill.icd10Codes.forEach((code, index) => {
      doc.text(`${index + 1}. ${code.code} - ${code.description}`);
      if (code.aiSuggested) {
        doc.text(`   AI Suggested (Confidence: ${code.confidence}%)`, { color: 'blue' });
      }
    });
    doc.moveDown();
    
    // Financial Summary
    doc.fontSize(12).text('FINANCIAL SUMMARY', { underline: true });
    doc.fontSize(10);
    doc.text(`Total Charges: $${superbill.totalCharges.toFixed(2)}`);
    if (superbill.expectedReimbursement) {
      doc.text(`Expected Reimbursement: $${superbill.expectedReimbursement.toFixed(2)}`);
    }
    if (superbill.patientResponsibility) {
      doc.text(`Patient Responsibility: $${superbill.patientResponsibility.toFixed(2)}`);
    }
    doc.moveDown();
    
    // Status
    doc.fontSize(12).text(`Status: ${superbill.status.toUpperCase()}`);
    
    // Footer
    doc.fontSize(8).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    
    doc.end();
    
    // Log export
    superbill.exportedFormats.push({
      format: 'pdf',
      exportedAt: new Date(),
      exportedBy: req.user._id
    });
    await superbill.save();
    
  } catch (error) {
    console.error('Error exporting superbill PDF:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export superbill',
      details: error.message
    });
  }
};

/**
 * Search billing codes (CPT)
 */
exports.searchCPTCodes = async (req, res) => {
  try {
    const { query, modality, limit = 20 } = req.query;
    
    const searchCriteria = {
      isActive: true,
      $or: [
        { cptCode: new RegExp(query, 'i') },
        { cptDescription: new RegExp(query, 'i') },
        { keywords: new RegExp(query, 'i') }
      ]
    };
    
    if (modality) {
      searchCriteria.modality = modality;
    }
    
    const codes = await BillingCode.find(searchCriteria)
      .limit(parseInt(limit))
      .sort({ cptCode: 1 });
    
    res.json({
      success: true,
      codes,
      count: codes.length
    });
    
  } catch (error) {
    console.error('Error searching CPT codes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search CPT codes',
      details: error.message
    });
  }
};

/**
 * Search diagnosis codes (ICD-10)
 */
exports.searchICD10Codes = async (req, res) => {
  try {
    const { query, category, limit = 20 } = req.query;
    
    const searchCriteria = {
      isActive: true,
      $or: [
        { icd10Code: new RegExp(query, 'i') },
        { icd10Description: new RegExp(query, 'i') },
        { keywords: new RegExp(query, 'i') }
      ]
    };
    
    if (category) {
      searchCriteria.category = category;
    }
    
    const codes = await DiagnosisCode.find(searchCriteria)
      .limit(parseInt(limit))
      .sort({ icd10Code: 1 });
    
    res.json({
      success: true,
      codes,
      count: codes.length
    });
    
  } catch (error) {
    console.error('Error searching ICD-10 codes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search ICD-10 codes',
      details: error.message
    });
  }
};

/**
 * Validate superbill
 */
function validateSuperbill(superbill) {
  const errors = [];
  const warnings = [];
  
  // Required fields
  if (!superbill.patientID) errors.push('Patient ID is required');
  if (!superbill.patientName) errors.push('Patient name is required');
  if (!superbill.dateOfService) errors.push('Date of service is required');
  if (!superbill.cptCodes || superbill.cptCodes.length === 0) {
    errors.push('At least one CPT code is required');
  }
  if (!superbill.icd10Codes || superbill.icd10Codes.length === 0) {
    errors.push('At least one ICD-10 code is required');
  }
  
  // Provider information
  if (!superbill.renderingProviderNPI) warnings.push('Provider NPI is missing');
  if (!superbill.facilityNPI) warnings.push('Facility NPI is missing');
  
  // Insurance information
  if (!superbill.insuranceProvider) warnings.push('Insurance provider is missing');
  
  // Code validation
  superbill.cptCodes.forEach((code, index) => {
    if (!code.code) errors.push(`CPT code #${index + 1} is missing code value`);
    if (!code.charge || code.charge <= 0) {
      warnings.push(`CPT code ${code.code} has no charge amount`);
    }
  });
  
  superbill.icd10Codes.forEach((code, index) => {
    if (!code.code) errors.push(`ICD-10 code #${index + 1} is missing code value`);
  });
  
  return { errors, warnings };
}

module.exports = exports;
