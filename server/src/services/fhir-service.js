const { v4: uuidv4 } = require('uuid');
const Report = require('../models/Report');
const Study = require('../models/Study');
const Patient = require('../models/Patient');
const User = require('../models/User');

/**
 * FHIR Service
 * Implements HL7 FHIR R4 DiagnosticReport export functionality
 * Compliant with FHIR R4 specification
 */

class FHIRService {
  constructor() {
    this.fhirVersion = '4.0.1';
    this.baseUrl = process.env.FHIR_BASE_URL || 'http://localhost:3000/fhir';
  }

  /**
   * Export report as FHIR DiagnosticReport
   * @param {string} reportId - Report ID to export
   * @returns {Promise<Object>} FHIR DiagnosticReport resource
   */
  async exportReport(reportId) {
    try {
      console.log(`🔷 Starting FHIR export for report: ${reportId}`);

      // 1. Fetch report data
      const report = await Report.findOne({ reportId })
        .populate('createdBy')
        .lean();
      
      if (!report) {
        throw new Error(`Report not found: ${reportId}`);
      }

      // 2. Validate report completeness
      this.validateReportForExport(report);

      // 3. Fetch related data
      const study = await Study.findOne({ 
        studyInstanceUID: report.studyInstanceUID 
      }).lean();
      
      const patient = await Patient.findOne({ 
        patientID: report.patientID 
      }).lean();

      // 4. Generate FHIR DiagnosticReport
      const fhirReport = this.generateDiagnosticReport(report, study, patient);

      // 5. Validate FHIR resource
      await this.validateFHIR(fhirReport);

      console.log(`✅ FHIR export completed for report: ${reportId}`);
      return fhirReport;

    } catch (error) {
      console.error(`❌ FHIR export failed for report ${reportId}:`, error);
      throw error;
    }
  }

  /**
   * Export report as FHIR Bundle (includes related resources)
   * @param {string} reportId - Report ID to export
   * @returns {Promise<Object>} FHIR Bundle resource
   */
  async exportReportBundle(reportId) {
    try {
      console.log(`📦 Starting FHIR Bundle export for report: ${reportId}`);

      const report = await Report.findOne({ reportId })
        .populate('createdBy')
        .lean();
      
      if (!report) {
        throw new Error(`Report not found: ${reportId}`);
      }

      const study = await Study.findOne({ 
        studyInstanceUID: report.studyInstanceUID 
      }).lean();
      
      const patient = await Patient.findOne({ 
        patientID: report.patientID 
      }).lean();

      // Generate bundle with all related resources
      const bundle = {
        resourceType: 'Bundle',
        id: uuidv4(),
        type: 'collection',
        timestamp: new Date().toISOString(),
        entry: []
      };

      // Add Patient resource
      if (patient) {
        bundle.entry.push({
          fullUrl: `${this.baseUrl}/Patient/${patient.patientID}`,
          resource: this.generatePatientResource(patient)
        });
      }

      // Add ImagingStudy resource
      if (study) {
        bundle.entry.push({
          fullUrl: `${this.baseUrl}/ImagingStudy/${study.studyInstanceUID}`,
          resource: this.generateImagingStudyResource(study, patient)
        });
      }

      // Add DiagnosticReport resource
      bundle.entry.push({
        fullUrl: `${this.baseUrl}/DiagnosticReport/${report.reportId}`,
        resource: this.generateDiagnosticReport(report, study, patient)
      });

      console.log(`✅ FHIR Bundle export completed for report: ${reportId}`);
      return bundle;

    } catch (error) {
      console.error(`❌ FHIR Bundle export failed for report ${reportId}:`, error);
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

    if (errors.length > 0) {
      throw new Error(`Report validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Generate FHIR DiagnosticReport resource
   * @param {Object} report - Report document
   * @param {Object} study - Study document
   * @param {Object} patient - Patient document
   * @returns {Object} FHIR DiagnosticReport resource
   */
  generateDiagnosticReport(report, study, patient) {
    const diagnosticReport = {
      resourceType: 'DiagnosticReport',
      id: report.reportId,
      meta: {
        versionId: report.version?.toString() || '1',
        lastUpdated: report.updatedAt?.toISOString() || new Date().toISOString(),
        profile: ['http://hl7.org/fhir/StructureDefinition/DiagnosticReport']
      },
      
      // Status mapping
      status: this.mapStatus(report.status),
      
      // Category
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
          code: 'RAD',
          display: 'Radiology'
        }]
      }],
      
      // Code (type of report)
      code: {
        coding: [{
          system: 'http://loinc.org',
          code: '18748-4',
          display: 'Diagnostic imaging study'
        }],
        text: report.modality ? `${report.modality} Report` : 'Imaging Report'
      },
      
      // Subject (Patient reference)
      subject: {
        reference: `Patient/${report.patientID}`,
        display: patient?.patientName || report.patientName || 'Unknown Patient'
      },
      
      // Effective date/time
      effectiveDateTime: report.studyDate || report.reportDate?.toISOString() || new Date().toISOString(),
      
      // Issued date/time
      issued: report.reportDate?.toISOString() || new Date().toISOString(),
      
      // Performer (Radiologist)
      performer: [],
      
      // Results interpreter
      resultsInterpreter: [],
      
      // Imaging study reference
      imagingStudy: study ? [{
        reference: `ImagingStudy/${study.studyInstanceUID}`,
        display: study.studyDescription || 'Imaging Study'
      }] : [],
      
      // Conclusion
      conclusion: report.impression || '',
      
      // Conclusion code (if structured findings exist)
      conclusionCode: this.generateConclusionCodes(report),
      
      // Presented form (full report text)
      presentedForm: [{
        contentType: 'text/plain',
        language: 'en-US',
        data: Buffer.from(this.formatReportText(report)).toString('base64'),
        title: 'Radiology Report',
        creation: report.reportDate?.toISOString() || new Date().toISOString()
      }]
    };

    // Add performer if radiologist info exists
    if (report.radiologistName || report.createdBy) {
      diagnosticReport.performer.push({
        reference: `Practitioner/${report.radiologistId || report.createdBy}`,
        display: report.radiologistName || 'Radiologist'
      });
      
      diagnosticReport.resultsInterpreter.push({
        reference: `Practitioner/${report.radiologistId || report.createdBy}`,
        display: report.radiologistName || 'Radiologist'
      });
    }

    // Add observations for structured findings
    if (report.structuredFindings && report.structuredFindings.length > 0) {
      diagnosticReport.result = this.generateObservationReferences(report.structuredFindings);
    }

    // Add measurements as observations
    if (report.measurements && report.measurements.length > 0) {
      if (!diagnosticReport.result) {
        diagnosticReport.result = [];
      }
      diagnosticReport.result.push(...this.generateMeasurementReferences(report.measurements));
    }

    return diagnosticReport;
  }

  /**
   * Generate FHIR Patient resource
   * @param {Object} patient - Patient document
   * @returns {Object} FHIR Patient resource
   */
  generatePatientResource(patient) {
    return {
      resourceType: 'Patient',
      id: patient.patientID,
      identifier: [{
        use: 'official',
        system: 'urn:oid:2.16.840.1.113883.4.1',
        value: patient.patientID
      }],
      name: [{
        use: 'official',
        text: patient.patientName,
        family: patient.patientName?.split(' ').pop() || '',
        given: patient.patientName?.split(' ').slice(0, -1) || []
      }],
      gender: this.mapGender(patient.sex),
      birthDate: patient.birthDate ? new Date(patient.birthDate).toISOString().split('T')[0] : undefined
    };
  }

  /**
   * Generate FHIR ImagingStudy resource
   * @param {Object} study - Study document
   * @param {Object} patient - Patient document
   * @returns {Object} FHIR ImagingStudy resource
   */
  generateImagingStudyResource(study, patient) {
    return {
      resourceType: 'ImagingStudy',
      id: study.studyInstanceUID,
      identifier: [{
        system: 'urn:dicom:uid',
        value: `urn:oid:${study.studyInstanceUID}`
      }],
      status: 'available',
      subject: {
        reference: `Patient/${study.patientID}`,
        display: patient?.patientName || 'Unknown Patient'
      },
      started: study.studyDate ? new Date(study.studyDate).toISOString() : undefined,
      numberOfSeries: study.numberOfSeries || 0,
      numberOfInstances: study.numberOfInstances || 0,
      description: study.studyDescription || '',
      modality: study.modality ? [{
        system: 'http://dicom.nema.org/resources/ontology/DCM',
        code: study.modality
      }] : []
    };
  }

  /**
   * Generate conclusion codes from structured findings
   * @param {Object} report - Report document
   * @returns {Array} FHIR CodeableConcept array
   */
  generateConclusionCodes(report) {
    const codes = [];

    if (report.structuredFindings && report.structuredFindings.length > 0) {
      report.structuredFindings.forEach(finding => {
        if (finding.clinicalCode) {
          codes.push({
            coding: [{
              system: 'http://snomed.info/sct',
              code: finding.clinicalCode,
              display: finding.description || finding.finding
            }]
          });
        }
      });
    }

    return codes.length > 0 ? codes : undefined;
  }

  /**
   * Generate observation references for structured findings
   * @param {Array} findings - Structured findings
   * @returns {Array} FHIR Reference array
   */
  generateObservationReferences(findings) {
    return findings.map((finding, index) => ({
      reference: `Observation/${finding.id || `finding-${index}`}`,
      display: finding.description || finding.finding || 'Finding'
    }));
  }

  /**
   * Generate measurement references
   * @param {Array} measurements - Measurements
   * @returns {Array} FHIR Reference array
   */
  generateMeasurementReferences(measurements) {
    return measurements.map((measurement, index) => ({
      reference: `Observation/${measurement.id || `measurement-${index}`}`,
      display: `${measurement.label || measurement.type}: ${measurement.value} ${measurement.unit}`
    }));
  }

  /**
   * Format report text for FHIR
   * @param {Object} report - Report document
   * @returns {string} Formatted report text
   */
  formatReportText(report) {
    const sections = [];

    sections.push('RADIOLOGY REPORT');
    sections.push('='.repeat(50));
    sections.push('');

    // Patient Information
    sections.push('PATIENT INFORMATION:');
    sections.push(`Patient ID: ${report.patientID}`);
    sections.push(`Patient Name: ${report.patientName || 'Unknown'}`);
    if (report.patientAge) sections.push(`Age: ${report.patientAge}`);
    if (report.patientSex) sections.push(`Sex: ${report.patientSex}`);
    sections.push('');

    // Study Information
    sections.push('STUDY INFORMATION:');
    sections.push(`Study Date: ${report.studyDate || 'Unknown'}`);
    sections.push(`Modality: ${report.modality || 'Unknown'}`);
    if (report.studyDescription) sections.push(`Description: ${report.studyDescription}`);
    sections.push('');

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
   * Map report status to FHIR status
   * @param {string} status - Report status
   * @returns {string} FHIR status
   */
  mapStatus(status) {
    const statusMap = {
      'draft': 'preliminary',
      'preliminary': 'preliminary',
      'final': 'final',
      'finalized': 'final',
      'amended': 'amended',
      'cancelled': 'cancelled'
    };

    return statusMap[status] || 'preliminary';
  }

  /**
   * Map patient sex to FHIR gender
   * @param {string} sex - Patient sex
   * @returns {string} FHIR gender
   */
  mapGender(sex) {
    if (!sex) return 'unknown';
    
    const genderMap = {
      'M': 'male',
      'F': 'female',
      'O': 'other',
      'U': 'unknown'
    };

    return genderMap[sex.toUpperCase()] || 'unknown';
  }

  /**
   * Validate FHIR resource against specification
   * @param {Object} resource - FHIR resource
   */
  async validateFHIR(resource) {
    const errors = [];

    // Basic validation
    if (!resource.resourceType) {
      errors.push('Missing resourceType');
    }

    if (resource.resourceType === 'DiagnosticReport') {
      if (!resource.status) errors.push('Missing status');
      if (!resource.code) errors.push('Missing code');
      if (!resource.subject) errors.push('Missing subject');
    }

    if (resource.resourceType === 'Bundle') {
      if (!resource.type) errors.push('Missing bundle type');
      if (!resource.entry) errors.push('Missing bundle entries');
    }

    if (errors.length > 0) {
      throw new Error(`FHIR validation failed: ${errors.join(', ')}`);
    }

    // In production, use a proper FHIR validator library
    console.log('✓ FHIR resource validation passed');
  }

  /**
   * Push FHIR resource to FHIR server
   * @param {Object} resource - FHIR resource
   * @param {string} serverUrl - FHIR server URL
   * @returns {Promise<Object>} Server response
   */
  async pushToFHIRServer(resource, serverUrl) {
    try {
      const axios = require('axios');
      
      const response = await axios.post(
        `${serverUrl}/${resource.resourceType}`,
        resource,
        {
          headers: {
            'Content-Type': 'application/fhir+json',
            'Accept': 'application/fhir+json'
          }
        }
      );

      console.log(`✅ FHIR resource pushed to server: ${serverUrl}`);
      return response.data;

    } catch (error) {
      console.error('❌ Failed to push FHIR resource to server:', error.message);
      throw error;
    }
  }
}

module.exports = new FHIRService();
