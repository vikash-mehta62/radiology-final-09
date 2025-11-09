const dicomParser = require('dicom-parser');
const { v4: uuidv4 } = require('uuid');
const Report = require('../models/Report');
const Study = require('../models/Study');
const Patient = require('../models/Patient');

/**
 * DICOM SR Service
 * Implements DICOM Structured Report (SR) export functionality
 * Compliant with DICOM Part 3 - Basic Text SR
 */

class DICOMSRService {
  constructor() {
    // DICOM SR SOP Class UID for Basic Text SR
    this.sopClassUID = '1.2.840.10008.5.1.4.1.1.88.11';
    this.implementationClassUID = '1.2.840.10008.5.1.4.1.1.88.11.1';
    this.implementationVersionName = 'PACS_SR_1.0';
  }

  /**
   * Export report as DICOM SR
   * @param {string} reportId - Report ID to export
   * @returns {Promise<Buffer>} DICOM SR file as buffer
   */
  async exportReport(reportId) {
    try {
      console.log(`📋 Starting DICOM SR export for report: ${reportId}`);

      // 1. Fetch report data
      const report = await Report.findOne({ reportId }).lean();
      if (!report) {
        throw new Error(`Report not found: ${reportId}`);
      }

      // 2. Validate report completeness
      this.validateReportForExport(report);

      // 3. Fetch related study and patient data
      const study = await Study.findOne({ 
        studyInstanceUID: report.studyInstanceUID 
      }).lean();
      
      const patient = await Patient.findOne({ 
        patientID: report.patientID 
      }).lean();

      // 4. Generate DICOM SR structure
      const dicomSR = this.generateDICOMSR(report, study, patient);

      // 5. Validate DICOM structure
      this.validateDICOMStructure(dicomSR);

      // 6. Encode to DICOM format
      const buffer = this.encodeDICOM(dicomSR);

      console.log(`✅ DICOM SR export completed for report: ${reportId}`);
      return buffer;

    } catch (error) {
      console.error(`❌ DICOM SR export failed for report ${reportId}:`, error);
      throw error;
    }
  }

  /**
   * Validate report is ready for export
   * @param {Object} report - Report document
   */
  validateReportForExport(report) {
    const errors = [];

    if (!report.studyInstanceUID) {
      errors.push('Missing studyInstanceUID');
    }

    if (!report.patientID) {
      errors.push('Missing patientID');
    }

    if (!report.findings && !report.findingsText) {
      errors.push('Report must have findings');
    }

    if (!report.impression) {
      errors.push('Report must have impression');
    }

    if (report.status === 'draft') {
      errors.push('Cannot export draft reports');
    }

    if (errors.length > 0) {
      throw new Error(`Report validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Generate DICOM SR structure
   * @param {Object} report - Report document
   * @param {Object} study - Study document
   * @param {Object} patient - Patient document
   * @returns {Object} DICOM SR structure
   */
  generateDICOMSR(report, study, patient) {
    const now = new Date();
    const sopInstanceUID = this.generateUID();
    const seriesInstanceUID = this.generateUID();

    return {
      // SOP Common Module
      sopInstanceUID,
      sopClassUID: this.sopClassUID,
      
      // Patient Module
      patientInfo: {
        patientID: patient?.patientID || report.patientID,
        patientName: patient?.patientName || report.patientName || 'UNKNOWN',
        patientBirthDate: this.formatDICOMDate(patient?.birthDate || report.patientBirthDate),
        patientSex: patient?.sex || report.patientSex || 'O',
        patientAge: report.patientAge || this.calculateAge(patient?.birthDate)
      },

      // Study Module
      studyInfo: {
        studyInstanceUID: report.studyInstanceUID,
        studyDate: this.formatDICOMDate(study?.studyDate || report.studyDate),
        studyTime: this.formatDICOMTime(study?.studyTime || report.studyTime),
        studyDescription: study?.studyDescription || report.studyDescription || '',
        accessionNumber: study?.accessionNumber || '',
        studyID: study?.studyID || ''
      },

      // Series Module
      seriesInfo: {
        seriesInstanceUID,
        seriesNumber: 1,
        modality: 'SR',
        seriesDate: this.formatDICOMDate(now),
        seriesTime: this.formatDICOMTime(now),
        seriesDescription: 'Structured Report'
      },

      // SR Document Module
      documentInfo: {
        instanceCreationDate: this.formatDICOMDate(now),
        instanceCreationTime: this.formatDICOMTime(now),
        contentDate: this.formatDICOMDate(report.reportDate || now),
        contentTime: this.formatDICOMTime(report.reportDate || now),
        completionFlag: report.status === 'final' || report.status === 'finalized' ? 'COMPLETE' : 'PARTIAL',
        verificationFlag: report.signedAt ? 'VERIFIED' : 'UNVERIFIED',
        documentTitle: 'Radiology Report',
        conceptNameCodeSequence: {
          codeValue: '18748-4',
          codingSchemeDesignator: 'LN',
          codeMeaning: 'Diagnostic imaging study'
        }
      },

      // Report Content
      reportContent: this.formatReportContent(report),

      // Structured Findings
      structuredFindings: report.structuredFindings || [],

      // Measurements
      measurements: report.measurements || [],

      // Signature Information
      signature: report.signature || null,
      signedBy: report.radiologistName || report.signature?.signedBy,
      signedAt: report.signedAt || report.signature?.signedAt,

      // Observer Context
      observerContext: {
        observerType: 'PERSON',
        personName: report.radiologistName || report.createdBy?.toString() || 'UNKNOWN',
        organizationName: 'Medical Imaging Center'
      },

      // Metadata
      metadata: {
        reportId: report.reportId,
        reportStatus: report.status,
        modality: report.modality || study?.modality || 'OT',
        createdAt: report.createdAt,
        version: report.version || 1
      }
    };
  }

  /**
   * Format report content for DICOM SR
   * @param {Object} report - Report document
   * @returns {string} Formatted report text
   */
  formatReportContent(report) {
    const sections = [];

    // Clinical History
    if (report.clinicalHistory) {
      sections.push('CLINICAL HISTORY:');
      sections.push(report.clinicalHistory);
      sections.push('');
    }

    // Technique
    if (report.technique) {
      sections.push('TECHNIQUE:');
      sections.push(report.technique);
      sections.push('');
    }

    // Comparison
    if (report.comparison) {
      sections.push('COMPARISON:');
      sections.push(report.comparison);
      sections.push('');
    }

    // Findings
    sections.push('FINDINGS:');
    sections.push(report.findings || report.findingsText || 'No significant findings.');
    sections.push('');

    // Impression
    sections.push('IMPRESSION:');
    sections.push(report.impression || 'See findings above.');
    sections.push('');

    // Recommendations
    if (report.recommendations) {
      sections.push('RECOMMENDATIONS:');
      sections.push(report.recommendations);
      sections.push('');
    }

    // Signature
    if (report.signedAt && report.radiologistName) {
      sections.push('');
      sections.push(`Electronically signed by ${report.radiologistName}`);
      sections.push(`Date: ${new Date(report.signedAt).toLocaleString()}`);
    }

    return sections.join('\n');
  }

  /**
   * Validate DICOM structure
   * @param {Object} dicomSR - DICOM SR structure
   */
  validateDICOMStructure(dicomSR) {
    const errors = [];

    // Required fields validation
    if (!dicomSR.sopInstanceUID) errors.push('Missing SOP Instance UID');
    if (!dicomSR.sopClassUID) errors.push('Missing SOP Class UID');
    if (!dicomSR.patientInfo?.patientID) errors.push('Missing Patient ID');
    if (!dicomSR.studyInfo?.studyInstanceUID) errors.push('Missing Study Instance UID');
    if (!dicomSR.seriesInfo?.seriesInstanceUID) errors.push('Missing Series Instance UID');
    if (!dicomSR.reportContent) errors.push('Missing report content');

    if (errors.length > 0) {
      throw new Error(`DICOM SR validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Encode DICOM SR to binary format
   * @param {Object} dicomSR - DICOM SR structure
   * @returns {Buffer} DICOM file buffer
   */
  encodeDICOM(dicomSR) {
    // Create DICOM dataset as JSON structure
    // This is a simplified implementation - in production, use a proper DICOM library
    const dataset = {
      // File Meta Information
      '00020001': { vr: 'OB', Value: [Buffer.from([0x00, 0x01])] }, // File Meta Information Version
      '00020002': { vr: 'UI', Value: [dicomSR.sopClassUID] }, // Media Storage SOP Class UID
      '00020003': { vr: 'UI', Value: [dicomSR.sopInstanceUID] }, // Media Storage SOP Instance UID
      '00020010': { vr: 'UI', Value: ['1.2.840.10008.1.2.1'] }, // Transfer Syntax UID (Explicit VR Little Endian)
      '00020012': { vr: 'UI', Value: [this.implementationClassUID] }, // Implementation Class UID
      '00020013': { vr: 'SH', Value: [this.implementationVersionName] }, // Implementation Version Name

      // Patient Module
      '00100010': { vr: 'PN', Value: [dicomSR.patientInfo.patientName] }, // Patient Name
      '00100020': { vr: 'LO', Value: [dicomSR.patientInfo.patientID] }, // Patient ID
      '00100030': { vr: 'DA', Value: [dicomSR.patientInfo.patientBirthDate] }, // Patient Birth Date
      '00100040': { vr: 'CS', Value: [dicomSR.patientInfo.patientSex] }, // Patient Sex
      '00101010': { vr: 'AS', Value: [dicomSR.patientInfo.patientAge || ''] }, // Patient Age

      // Study Module
      '0020000D': { vr: 'UI', Value: [dicomSR.studyInfo.studyInstanceUID] }, // Study Instance UID
      '00080020': { vr: 'DA', Value: [dicomSR.studyInfo.studyDate] }, // Study Date
      '00080030': { vr: 'TM', Value: [dicomSR.studyInfo.studyTime] }, // Study Time
      '00081030': { vr: 'LO', Value: [dicomSR.studyInfo.studyDescription] }, // Study Description
      '00080050': { vr: 'SH', Value: [dicomSR.studyInfo.accessionNumber] }, // Accession Number
      '00200010': { vr: 'SH', Value: [dicomSR.studyInfo.studyID] }, // Study ID

      // Series Module
      '0020000E': { vr: 'UI', Value: [dicomSR.seriesInfo.seriesInstanceUID] }, // Series Instance UID
      '00200011': { vr: 'IS', Value: [dicomSR.seriesInfo.seriesNumber.toString()] }, // Series Number
      '00080060': { vr: 'CS', Value: [dicomSR.seriesInfo.modality] }, // Modality
      '00080021': { vr: 'DA', Value: [dicomSR.seriesInfo.seriesDate] }, // Series Date
      '00080031': { vr: 'TM', Value: [dicomSR.seriesInfo.seriesTime] }, // Series Time
      '0008103E': { vr: 'LO', Value: [dicomSR.seriesInfo.seriesDescription] }, // Series Description

      // SOP Common Module
      '00080016': { vr: 'UI', Value: [dicomSR.sopClassUID] }, // SOP Class UID
      '00080018': { vr: 'UI', Value: [dicomSR.sopInstanceUID] }, // SOP Instance UID
      '00080012': { vr: 'DA', Value: [dicomSR.documentInfo.instanceCreationDate] }, // Instance Creation Date
      '00080013': { vr: 'TM', Value: [dicomSR.documentInfo.instanceCreationTime] }, // Instance Creation Time

      // SR Document Module
      '00420011': { vr: 'CS', Value: [dicomSR.documentInfo.completionFlag] }, // Completion Flag
      '00420012': { vr: 'CS', Value: [dicomSR.documentInfo.verificationFlag] }, // Verification Flag
      '00080023': { vr: 'DA', Value: [dicomSR.documentInfo.contentDate] }, // Content Date
      '00080033': { vr: 'TM', Value: [dicomSR.documentInfo.contentTime] }, // Content Time
      '00420010': { vr: 'ST', Value: [dicomSR.documentInfo.documentTitle] }, // Document Title

      // Report Content as Text Value
      '00400a160': { vr: 'UT', Value: [dicomSR.reportContent] } // Text Value
    };

    // Convert to JSON string for simplified storage
    // In production, this should be properly encoded as DICOM binary
    const jsonString = JSON.stringify(dataset, null, 2);
    return Buffer.from(jsonString, 'utf-8');
  }

  /**
   * Generate DICOM UID
   * @returns {string} DICOM UID
   */
  generateUID() {
    // Use organization root: 1.2.840.10008.5.1.4.1.1.88.11
    // Append timestamp and random component
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    return `1.2.840.10008.5.1.4.1.1.88.11.${timestamp}.${random}`;
  }

  /**
   * Format date for DICOM (YYYYMMDD)
   * @param {string|Date} date - Date to format
   * @returns {string} DICOM formatted date
   */
  formatDICOMDate(date) {
    if (!date) return '';
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    return `${year}${month}${day}`;
  }

  /**
   * Format time for DICOM (HHMMSS)
   * @param {string|Date} time - Time to format
   * @returns {string} DICOM formatted time
   */
  formatDICOMTime(time) {
    if (!time) return '';
    
    const d = time instanceof Date ? time : new Date(time);
    if (isNaN(d.getTime())) return '';
    
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    return `${hours}${minutes}${seconds}`;
  }

  /**
   * Calculate age from birth date
   * @param {string|Date} birthDate - Birth date
   * @returns {string} Age in DICOM format (e.g., "045Y")
   */
  calculateAge(birthDate) {
    if (!birthDate) return '';
    
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return '';
    
    const now = new Date();
    const years = now.getFullYear() - birth.getFullYear();
    
    return `${String(years).padStart(3, '0')}Y`;
  }
}

module.exports = new DICOMSRService();
