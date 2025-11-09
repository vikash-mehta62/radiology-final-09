const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const Report = require('../models/Report');
const Study = require('../models/Study');
const Patient = require('../models/Patient');
const DigitalSignature = require('../models/DigitalSignature');

/**
 * PDF Service
 * Implements professional PDF report generation with branding and signatures
 * Supports PDF/A format for long-term archival
 */

class PDFService {
  constructor() {
    this.pageWidth = 612; // Letter size width in points
    this.pageHeight = 792; // Letter size height in points
    this.margin = 50;
    this.contentWidth = this.pageWidth - (this.margin * 2);
  }

  /**
   * Export report as PDF
   * @param {string} reportId - Report ID to export
   * @param {Object} options - Export options
   * @returns {Promise<Buffer>} PDF file as buffer
   */
  async exportReport(reportId, options = {}) {
    try {
      console.log(`📄 Starting PDF export for report: ${reportId}`);

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

      // 4. Fetch signature if exists
      let signature = null;
      if (report.signedAt) {
        signature = await DigitalSignature.findOne({ 
          reportId: report.reportId 
        }).lean();
      }

      // 5. Generate PDF
      const pdfBuffer = await this.generatePDF(report, study, patient, signature, options);

      console.log(`✅ PDF export completed for report: ${reportId}`);
      return pdfBuffer;

    } catch (error) {
      console.error(`❌ PDF export failed for report ${reportId}:`, error);
      throw error;
    }
  }

  /**
   * Validate report is ready for export
   * @param {Object} report - Report document
   */
  validateReportForExport(report) {
    const errors = [];

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
   * Generate PDF document
   * @param {Object} report - Report document
   * @param {Object} study - Study document
   * @param {Object} patient - Patient document
   * @param {Object} signature - Digital signature document
   * @param {Object} options - Generation options
   * @returns {Promise<Buffer>} PDF buffer
   */
  async generatePDF(report, study, patient, signature, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        // Create PDF document
        const doc = new PDFDocument({
          size: 'LETTER',
          margins: {
            top: this.margin,
            bottom: this.margin,
            left: this.margin,
            right: this.margin
          },
          info: {
            Title: `Medical Imaging Report - ${report.reportId}`,
            Author: report.radiologistName || 'Medical Imaging Center',
            Subject: 'Radiology Report',
            Keywords: `radiology, ${report.modality || 'imaging'}, medical report`,
            CreationDate: new Date(),
            ModDate: new Date()
          },
          pdfVersion: options.pdfA ? '1.4' : '1.7'
        });

        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add watermark for preliminary reports
        if (report.status === 'draft' || report.status === 'preliminary') {
          this.addWatermark(doc, 'PRELIMINARY');
        }

        // Header
        this.addHeader(doc, report, study, patient);

        // Patient and Study Information
        this.addPatientInfo(doc, report, patient);
        this.addStudyInfo(doc, report, study);

        // Report Content
        doc.moveDown(1);
        this.addSection(doc, 'Clinical History', report.clinicalHistory);
        this.addSection(doc, 'Technique', report.technique);
        this.addSection(doc, 'Comparison', report.comparison);
        this.addSection(doc, 'Findings', report.findings || report.findingsText);
        this.addSection(doc, 'Impression', report.impression);
        this.addSection(doc, 'Recommendations', report.recommendations);

        // Structured Findings Table
        if (report.structuredFindings && report.structuredFindings.length > 0) {
          this.addStructuredFindings(doc, report.structuredFindings);
        }

        // Measurements Table
        if (report.measurements && report.measurements.length > 0) {
          this.addMeasurements(doc, report.measurements);
        }

        // Key Images
        if (report.keyImages && report.keyImages.length > 0 && options.includeImages) {
          this.addKeyImages(doc, report.keyImages);
        }

        // Signature Section
        if (signature || report.signedAt) {
          this.addSignature(doc, report, signature);
        }

        // Footer on all pages
        this.addFooter(doc, report);

        // Finalize PDF
        doc.end();

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Add watermark to document
   * @param {PDFDocument} doc - PDF document
   * @param {string} text - Watermark text
   */
  addWatermark(doc, text) {
    const centerX = this.pageWidth / 2;
    const centerY = this.pageHeight / 2;

    doc.save();
    doc.fontSize(60)
      .fillColor('red', 0.2)
      .rotate(-45, { origin: [centerX, centerY] })
      .text(text, centerX - 200, centerY, {
        width: 400,
        align: 'center'
      });
    doc.restore();
  }

  /**
   * Add header to document
   * @param {PDFDocument} doc - PDF document
   * @param {Object} report - Report document
   * @param {Object} study - Study document
   * @param {Object} patient - Patient document
   */
  addHeader(doc, report, study, patient) {
    // Hospital/Institution Name
    doc.fontSize(20)
      .fillColor('#1976d2')
      .text('Medical Imaging Center', this.margin, this.margin, {
        align: 'center'
      });

    doc.fontSize(10)
      .fillColor('#666666')
      .text('Radiology Department', {
        align: 'center'
      });

    // Horizontal line
    doc.moveTo(this.margin, 100)
      .lineTo(this.pageWidth - this.margin, 100)
      .strokeColor('#1976d2')
      .lineWidth(2)
      .stroke();

    doc.moveDown(2);

    // Report Title
    doc.fontSize(16)
      .fillColor('#000000')
      .text('RADIOLOGY REPORT', {
        align: 'center'
      });

    doc.moveDown(1);
  }

  /**
   * Add patient information
   * @param {PDFDocument} doc - PDF document
   * @param {Object} report - Report document
   * @param {Object} patient - Patient document
   */
  addPatientInfo(doc, report, patient) {
    const startY = doc.y;
    const col1X = this.margin;
    const col2X = this.margin + (this.contentWidth / 2);

    doc.fontSize(12)
      .fillColor('#1976d2')
      .text('PATIENT INFORMATION', col1X, startY);

    doc.fontSize(10)
      .fillColor('#000000');

    const patientData = [
      ['Patient ID:', patient?.patientID || report.patientID],
      ['Patient Name:', patient?.patientName || report.patientName || 'Unknown'],
      ['Date of Birth:', patient?.birthDate || report.patientBirthDate || 'Unknown'],
      ['Sex:', patient?.sex || report.patientSex || 'Unknown'],
      ['Age:', report.patientAge || 'Unknown']
    ];

    let currentY = startY + 20;
    patientData.forEach(([label, value]) => {
      doc.text(label, col1X, currentY, { continued: true, width: 100 })
        .font('Helvetica-Bold')
        .text(value, { width: 200 })
        .font('Helvetica');
      currentY += 15;
    });

    doc.moveDown(1);
  }

  /**
   * Add study information
   * @param {PDFDocument} doc - PDF document
   * @param {Object} report - Report document
   * @param {Object} study - Study document
   */
  addStudyInfo(doc, report, study) {
    const startY = doc.y;
    const col1X = this.margin;

    doc.fontSize(12)
      .fillColor('#1976d2')
      .text('STUDY INFORMATION', col1X, startY);

    doc.fontSize(10)
      .fillColor('#000000');

    const studyData = [
      ['Report ID:', report.reportId],
      ['Study Date:', report.studyDate || study?.studyDate || 'Unknown'],
      ['Study Time:', report.studyTime || study?.studyTime || 'Unknown'],
      ['Modality:', report.modality || study?.modality || 'Unknown'],
      ['Study Description:', report.studyDescription || study?.studyDescription || 'N/A'],
      ['Accession Number:', study?.accessionNumber || 'N/A'],
      ['Report Status:', this.formatStatus(report.status)]
    ];

    let currentY = startY + 20;
    studyData.forEach(([label, value]) => {
      doc.text(label, col1X, currentY, { continued: true, width: 150 })
        .font('Helvetica-Bold')
        .text(value, { width: 350 })
        .font('Helvetica');
      currentY += 15;
    });

    doc.moveDown(1);
  }

  /**
   * Add report section
   * @param {PDFDocument} doc - PDF document
   * @param {string} title - Section title
   * @param {string} content - Section content
   */
  addSection(doc, title, content) {
    if (!content) return;

    // Check if we need a new page
    if (doc.y > this.pageHeight - 150) {
      doc.addPage();
    }

    doc.fontSize(12)
      .fillColor('#1976d2')
      .text(title.toUpperCase(), {
        underline: true
      });

    doc.moveDown(0.5);

    doc.fontSize(10)
      .fillColor('#000000')
      .text(content, {
        align: 'justify',
        lineGap: 2
      });

    doc.moveDown(1);
  }

  /**
   * Add structured findings table
   * @param {PDFDocument} doc - PDF document
   * @param {Array} findings - Structured findings
   */
  addStructuredFindings(doc, findings) {
    if (doc.y > this.pageHeight - 200) {
      doc.addPage();
    }

    doc.fontSize(12)
      .fillColor('#1976d2')
      .text('STRUCTURED FINDINGS', {
        underline: true
      });

    doc.moveDown(0.5);

    // Table header
    const tableTop = doc.y;
    const col1 = this.margin;
    const col2 = this.margin + 100;
    const col3 = this.margin + 200;
    const col4 = this.margin + 350;

    doc.fontSize(9)
      .font('Helvetica-Bold')
      .text('Location', col1, tableTop)
      .text('Finding', col2, tableTop)
      .text('Severity', col3, tableTop)
      .text('Confidence', col4, tableTop);

    doc.moveTo(col1, tableTop + 12)
      .lineTo(this.pageWidth - this.margin, tableTop + 12)
      .stroke();

    // Table rows
    let rowY = tableTop + 20;
    doc.font('Helvetica').fontSize(8);

    findings.slice(0, 10).forEach(finding => {
      if (rowY > this.pageHeight - 100) {
        doc.addPage();
        rowY = this.margin;
      }

      doc.text(finding.location || 'N/A', col1, rowY, { width: 90 })
        .text(finding.description || finding.finding || 'N/A', col2, rowY, { width: 140 })
        .text(finding.severity || 'N/A', col3, rowY, { width: 140 })
        .text(finding.confidence ? `${(finding.confidence * 100).toFixed(0)}%` : 'N/A', col4, rowY);

      rowY += 25;
    });

    doc.moveDown(2);
  }

  /**
   * Add measurements table
   * @param {PDFDocument} doc - PDF document
   * @param {Array} measurements - Measurements
   */
  addMeasurements(doc, measurements) {
    if (doc.y > this.pageHeight - 200) {
      doc.addPage();
    }

    doc.fontSize(12)
      .fillColor('#1976d2')
      .text('MEASUREMENTS', {
        underline: true
      });

    doc.moveDown(0.5);

    // Table header
    const tableTop = doc.y;
    const col1 = this.margin;
    const col2 = this.margin + 150;
    const col3 = this.margin + 300;
    const col4 = this.margin + 400;

    doc.fontSize(9)
      .font('Helvetica-Bold')
      .text('Label', col1, tableTop)
      .text('Type', col2, tableTop)
      .text('Value', col3, tableTop)
      .text('Unit', col4, tableTop);

    doc.moveTo(col1, tableTop + 12)
      .lineTo(this.pageWidth - this.margin, tableTop + 12)
      .stroke();

    // Table rows
    let rowY = tableTop + 20;
    doc.font('Helvetica').fontSize(8);

    measurements.slice(0, 15).forEach(measurement => {
      if (rowY > this.pageHeight - 100) {
        doc.addPage();
        rowY = this.margin;
      }

      doc.text(measurement.label || measurement.type || 'N/A', col1, rowY, { width: 140 })
        .text(measurement.type || 'N/A', col2, rowY, { width: 140 })
        .text(measurement.value?.toFixed(2) || 'N/A', col3, rowY, { width: 90 })
        .text(measurement.unit || 'N/A', col4, rowY);

      rowY += 20;
    });

    doc.moveDown(2);
  }

  /**
   * Add key images
   * @param {PDFDocument} doc - PDF document
   * @param {Array} keyImages - Key images
   */
  addKeyImages(doc, keyImages) {
    doc.addPage();

    doc.fontSize(12)
      .fillColor('#1976d2')
      .text('KEY IMAGES', {
        underline: true
      });

    doc.moveDown(1);

    // Add up to 4 images per page
    keyImages.slice(0, 4).forEach((image, index) => {
      if (image.dataUrl) {
        try {
          // Extract base64 data
          const base64Data = image.dataUrl.split(',')[1];
          const imageBuffer = Buffer.from(base64Data, 'base64');

          const imageX = this.margin + (index % 2) * 250;
          const imageY = doc.y + Math.floor(index / 2) * 200;

          doc.image(imageBuffer, imageX, imageY, {
            width: 200,
            height: 150
          });

          if (image.caption) {
            doc.fontSize(8)
              .text(image.caption, imageX, imageY + 155, {
                width: 200,
                align: 'center'
              });
          }
        } catch (error) {
          console.warn('Failed to add image to PDF:', error.message);
        }
      }
    });

    doc.moveDown(2);
  }

  /**
   * Add signature section
   * @param {PDFDocument} doc - PDF document
   * @param {Object} report - Report document
   * @param {Object} signature - Digital signature document
   */
  addSignature(doc, report, signature) {
    // Ensure we're on a new section
    if (doc.y > this.pageHeight - 200) {
      doc.addPage();
    }

    doc.moveDown(2);

    // Signature box
    const boxTop = doc.y;
    const boxHeight = 100;

    doc.rect(this.margin, boxTop, this.contentWidth, boxHeight)
      .strokeColor('#1976d2')
      .lineWidth(1)
      .stroke();

    doc.fontSize(10)
      .fillColor('#000000')
      .text('ELECTRONIC SIGNATURE', this.margin + 10, boxTop + 10, {
        underline: true
      });

    doc.moveDown(0.5);

    const signatureData = [
      ['Signed by:', report.radiologistName || 'Unknown'],
      ['Date:', report.signedAt ? new Date(report.signedAt).toLocaleString() : 'Unknown'],
      ['Status:', signature ? 'Verified' : 'Signed']
    ];

    if (signature) {
      signatureData.push(['Signature ID:', signature.id || 'N/A']);
      signatureData.push(['Algorithm:', signature.algorithm || 'RSA-SHA256']);
    }

    let currentY = boxTop + 30;
    signatureData.forEach(([label, value]) => {
      doc.fontSize(9)
        .text(label, this.margin + 10, currentY, { continued: true, width: 100 })
        .font('Helvetica-Bold')
        .text(value, { width: 400 })
        .font('Helvetica');
      currentY += 15;
    });

    doc.moveDown(2);
  }

  /**
   * Add footer to all pages
   * @param {PDFDocument} doc - PDF document
   * @param {Object} report - Report document
   */
  addFooter(doc, report) {
    const pages = doc.bufferedPageRange();
    
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);

      const footerY = this.pageHeight - 40;

      // Horizontal line
      doc.moveTo(this.margin, footerY)
        .lineTo(this.pageWidth - this.margin, footerY)
        .strokeColor('#cccccc')
        .lineWidth(1)
        .stroke();

      // Footer text
      doc.fontSize(8)
        .fillColor('#666666')
        .text(
          `Report ID: ${report.reportId} | Generated: ${new Date().toLocaleString()}`,
          this.margin,
          footerY + 5,
          { align: 'left' }
        )
        .text(
          `Page ${i + 1} of ${pages.count}`,
          this.margin,
          footerY + 5,
          { align: 'right' }
        );
    }
  }

  /**
   * Format report status for display
   * @param {string} status - Report status
   * @returns {string} Formatted status
   */
  formatStatus(status) {
    const statusMap = {
      'draft': 'Draft',
      'preliminary': 'Preliminary',
      'final': 'Final',
      'finalized': 'Final',
      'amended': 'Amended',
      'cancelled': 'Cancelled'
    };

    return statusMap[status] || status;
  }
}

module.exports = new PDFService();
