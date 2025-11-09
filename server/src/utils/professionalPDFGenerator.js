/**
 * Professional PDF Generator for Medical Reports
 * Creates clinical-grade PDF reports with proper formatting
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class ProfessionalPDFGenerator {
  constructor() {
    this.pageMargins = { top: 72, bottom: 72, left: 72, right: 72 };
    this.colors = {
      primary: '#2C3E50',
      secondary: '#34495E',
      accent: '#3498DB',
      critical: '#E74C3C',
      warning: '#F39C12',
      success: '#27AE60',
      text: '#2C3E50',
      lightGray: '#ECF0F1',
      mediumGray: '#BDC3C7',
      darkGray: '#7F8C8D'
    };
  }

  /**
   * Generate professional medical report PDF
   * @param {Object} reportData - Complete report data
   * @param {String} outputPath - Path to save PDF
   * @returns {Promise} PDF generation promise
   */
  async generateReport(reportData, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: this.pageMargins,
          info: {
            Title: `Medical Report - ${reportData.reportId}`,
            Author: reportData.radiologistName || 'AI System',
            Subject: 'AI-Assisted Medical Analysis Report',
            Keywords: 'medical, radiology, AI, analysis'
          }
        });

        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        // Track page numbers
        let pageNumber = 1;

        // Add page number footer to each page
        doc.on('pageAdded', () => {
          pageNumber++;
          this.addPageFooter(doc, pageNumber, reportData);
        });

        // Generate report sections
        this.addTitlePage(doc, reportData);
        this.addExecutiveSummary(doc, reportData);
        this.addStudyInformation(doc, reportData);
        
        if (reportData.frames && reportData.frames.length > 0) {
          this.addPerFrameAnalysis(doc, reportData);
        }
        
        this.addComprehensiveSummary(doc, reportData);
        this.addDisclaimers(doc, reportData);

        // Add initial page footer
        this.addPageFooter(doc, pageNumber, reportData);

        doc.end();

        stream.on('finish', () => resolve(outputPath));
        stream.on('error', reject);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Add title page
   */
  addTitlePage(doc, data) {
    // Header logo/title area
    doc.fontSize(28)
       .fillColor(this.colors.primary)
       .font('Helvetica-Bold')
       .text('AI MEDICAL ANALYSIS REPORT', { align: 'center' });

    doc.moveDown(0.5);
    
    doc.fontSize(14)
       .fillColor(this.colors.secondary)
       .font('Helvetica')
       .text('Powered by MedSigLIP & MedGemma', { align: 'center' });

    doc.moveDown(3);

    // Report metadata box
    const boxY = doc.y;
    doc.rect(this.pageMargins.left, boxY, 
             doc.page.width - this.pageMargins.left - this.pageMargins.right, 
             200)
       .fillAndStroke(this.colors.lightGray, this.colors.mediumGray);

    doc.fillColor(this.colors.text)
       .fontSize(12)
       .font('Helvetica-Bold');

    let yPos = boxY + 20;
    
    // Report ID
    doc.text('Report ID:', this.pageMargins.left + 20, yPos);
    doc.font('Helvetica')
       .text(data.reportId || 'N/A', this.pageMargins.left + 150, yPos);
    
    yPos += 25;

    // Patient Information
    doc.font('Helvetica-Bold')
       .text('Patient:', this.pageMargins.left + 20, yPos);
    doc.font('Helvetica')
       .text(data.patientName || 'Anonymous', this.pageMargins.left + 150, yPos);
    
    yPos += 20;
    doc.font('Helvetica-Bold')
       .text('Patient ID:', this.pageMargins.left + 20, yPos);
    doc.font('Helvetica')
       .text(data.patientID || 'N/A', this.pageMargins.left + 150, yPos);

    yPos += 25;

    // Study Information
    doc.font('Helvetica-Bold')
       .text('Study UID:', this.pageMargins.left + 20, yPos);
    doc.font('Helvetica')
       .fontSize(9)
       .text(data.studyInstanceUID || 'N/A', this.pageMargins.left + 150, yPos, {
         width: 300
       });

    yPos += 25;
    doc.fontSize(12);

    // Report Date
    doc.font('Helvetica-Bold')
       .text('Report Date:', this.pageMargins.left + 20, yPos);
    doc.font('Helvetica')
       .text(new Date(data.reportDate || Date.now()).toLocaleString(), 
             this.pageMargins.left + 150, yPos);

    yPos += 20;

    // Radiologist
    doc.font('Helvetica-Bold')
       .text('Radiologist:', this.pageMargins.left + 20, yPos);
    doc.font('Helvetica')
       .text(data.radiologistName || 'AI System', this.pageMargins.left + 150, yPos);

    doc.moveDown(4);

    // Status badge
    const status = data.reportStatus || 'draft';
    const statusColor = status === 'final' ? this.colors.success :
                       status === 'preliminary' ? this.colors.warning :
                       this.colors.mediumGray;

    doc.fontSize(14)
       .fillColor(statusColor)
       .font('Helvetica-Bold')
       .text(`STATUS: ${status.toUpperCase()}`, { align: 'center' });

    doc.addPage();
  }

  /**
   * Add executive summary
   */
  addExecutiveSummary(doc, data) {
    this.addSectionHeader(doc, 'EXECUTIVE SUMMARY');

    doc.fontSize(11)
       .fillColor(this.colors.text)
       .font('Helvetica');

    if (data.executiveSummary) {
      doc.text(data.executiveSummary, {
        align: 'justify',
        lineGap: 4
      });
    } else if (data.stats) {
      // Generate from stats
      const stats = data.stats;
      
      doc.font('Helvetica-Bold')
         .text(`Total Frames Analyzed: ${stats.totalFrames}`);
      doc.font('Helvetica')
         .moveDown(0.5);

      if (stats.mostCommonFinding) {
        doc.text(`Most Common Finding: ${stats.mostCommonFinding} (${stats.mostCommonFindingCount} occurrences)`);
        doc.moveDown(0.5);
      }

      if (stats.averageConfidence > 0) {
        doc.text(`Average Confidence: ${(stats.averageConfidence * 100).toFixed(1)}%`);
        doc.moveDown(0.5);
      }

      if (stats.criticalFindings && stats.criticalFindings.length > 0) {
        doc.fillColor(this.colors.critical)
           .font('Helvetica-Bold')
           .text(`CRITICAL: ${stats.criticalFindings.length} critical finding(s) identified`);
        doc.fillColor(this.colors.text)
           .font('Helvetica')
           .moveDown(0.5);
      }
    } else {
      doc.text('Executive summary not available.');
    }

    doc.moveDown(2);
  }

  /**
   * Add study information
   */
  addStudyInformation(doc, data) {
    this.addSectionHeader(doc, 'STUDY INFORMATION');

    const info = [
      ['Modality', data.modality || 'N/A'],
      ['Study Description', data.studyDescription || 'N/A'],
      ['Study Date', data.studyDate || 'N/A'],
      ['Total Frames', data.stats?.totalFrames || data.frames?.length || 'N/A'],
      ['AI Services', data.stats?.servicesUsed?.join(', ') || 'MedSigLIP, MedGemma']
    ];

    doc.fontSize(11)
       .font('Helvetica');

    info.forEach(([label, value]) => {
      doc.font('Helvetica-Bold')
         .text(`${label}: `, { continued: true })
         .font('Helvetica')
         .text(value);
      doc.moveDown(0.3);
    });

    doc.moveDown(2);
  }

  /**
   * Add per-frame analysis
   */
  addPerFrameAnalysis(doc, data) {
    if (!data.frames || data.frames.length === 0) {
      return;
    }

    this.addSectionHeader(doc, 'DETAILED FRAME ANALYSIS');

    data.frames.forEach((frame, index) => {
      // Check if we need a new page
      if (doc.y > doc.page.height - 200) {
        doc.addPage();
      }

      // Frame header
      doc.fontSize(13)
         .fillColor(this.colors.accent)
         .font('Helvetica-Bold')
         .text(`Frame ${frame.frameIndex !== undefined ? frame.frameIndex : index + 1}`, {
           underline: true
         });

      doc.moveDown(0.5);
      doc.fontSize(11)
         .fillColor(this.colors.text)
         .font('Helvetica');

      // Classification
      if (frame.classification) {
        doc.font('Helvetica-Bold')
           .text('Classification: ', { continued: true })
           .font('Helvetica')
           .text(frame.classification.label || frame.classification);
        
        if (frame.classification.confidence !== undefined) {
          doc.font('Helvetica-Bold')
             .text('Confidence: ', { continued: true })
             .font('Helvetica')
             .text(`${(frame.classification.confidence * 100).toFixed(1)}%`);
        }
        doc.moveDown(0.5);
      }

      // Findings
      if (frame.report?.findings || frame.findingsText) {
        doc.font('Helvetica-Bold')
           .text('FINDINGS:');
        doc.font('Helvetica')
           .text(frame.report?.findings || frame.findingsText, {
             align: 'justify',
             lineGap: 3
           });
        doc.moveDown(0.5);
      }

      // Impression
      if (frame.report?.impression || frame.impression) {
        doc.font('Helvetica-Bold')
           .text('IMPRESSION:');
        doc.font('Helvetica')
           .text(frame.report?.impression || frame.impression, {
             align: 'justify',
             lineGap: 3
           });
        doc.moveDown(0.5);
      }

      // Recommendations
      if (frame.report?.recommendations && frame.report.recommendations.length > 0) {
        doc.font('Helvetica-Bold')
           .text('RECOMMENDATIONS:');
        frame.report.recommendations.forEach((rec, idx) => {
          doc.font('Helvetica')
             .text(`${idx + 1}. ${rec}`);
        });
        doc.moveDown(0.5);
      }

      // Image snapshot
      if (frame.imageSnapshot && frame.imageSnapshot.data) {
        try {
          const imageData = frame.imageSnapshot.data.replace(/^data:image\/\w+;base64,/, '');
          const imageBuffer = Buffer.from(imageData, 'base64');
          
          doc.moveDown(0.5);
          doc.image(imageBuffer, {
            fit: [400, 300],
            align: 'center'
          });
          
          doc.fontSize(9)
             .fillColor(this.colors.darkGray)
             .text(`Frame ${frame.frameIndex}, captured at ${new Date(frame.timestamp || Date.now()).toLocaleString()}`, {
               align: 'center'
             });
          doc.fillColor(this.colors.text)
             .fontSize(11);
        } catch (error) {
          console.error('Error embedding image:', error.message);
          doc.fontSize(9)
             .fillColor(this.colors.darkGray)
             .text('[Image not available]', { align: 'center' });
          doc.fillColor(this.colors.text)
             .fontSize(11);
        }
      }

      // Separator
      doc.moveDown(1);
      doc.moveTo(this.pageMargins.left, doc.y)
         .lineTo(doc.page.width - this.pageMargins.right, doc.y)
         .stroke(this.colors.lightGray);
      doc.moveDown(1);
    });
  }

  /**
   * Add comprehensive summary
   */
  addComprehensiveSummary(doc, data) {
    doc.addPage();
    this.addSectionHeader(doc, 'COMPREHENSIVE SUMMARY');

    doc.fontSize(11)
       .fillColor(this.colors.text)
       .font('Helvetica');

    if (data.comprehensiveSummary) {
      doc.text(data.comprehensiveSummary, {
        align: 'justify',
        lineGap: 4
      });
    } else if (data.stats) {
      // Generate from stats
      const stats = data.stats;

      // Classification distribution
      if (stats.classificationDistribution && stats.classificationDistribution.length > 0) {
        doc.font('Helvetica-Bold')
           .text('Classification Distribution:');
        doc.font('Helvetica')
           .moveDown(0.3);

        stats.classificationDistribution.forEach(item => {
          doc.text(`• ${item.label}: ${item.count} frames (${item.percentage}%)`);
        });
        doc.moveDown(1);
      }

      // Confidence analysis
      doc.font('Helvetica-Bold')
         .text('Confidence Analysis:');
      doc.font('Helvetica')
         .text(`• Average: ${(stats.averageConfidence * 100).toFixed(1)}%`)
         .text(`• Highest: ${(stats.highestConfidence.score * 100).toFixed(1)}% (Frame ${stats.highestConfidence.frameIndex})`)
         .text(`• Lowest: ${(stats.lowestConfidence.score * 100).toFixed(1)}% (Frame ${stats.lowestConfidence.frameIndex})`);
      doc.moveDown(1);

      // Critical findings
      if (stats.criticalFindings && stats.criticalFindings.length > 0) {
        doc.fillColor(this.colors.critical)
           .font('Helvetica-Bold')
           .text('Critical Findings:');
        doc.fillColor(this.colors.text)
           .font('Helvetica');

        stats.criticalFindings.forEach((finding, idx) => {
          doc.text(`${idx + 1}. Frame ${finding.frameIndex}: ${finding.type} - ${finding.description}`);
        });
      }
    }

    doc.moveDown(2);
  }

  /**
   * Add disclaimers and legal notices
   */
  addDisclaimers(doc, data) {
    doc.addPage();
    this.addSectionHeader(doc, 'IMPORTANT NOTICES & DISCLAIMERS');

    doc.fontSize(10)
       .fillColor(this.colors.text)
       .font('Helvetica');

    // AI Disclaimer
    doc.font('Helvetica-Bold')
       .text('AI-Assisted Analysis Disclaimer:');
    doc.font('Helvetica')
       .moveDown(0.3);

    const aiDisclaimers = [
      'This report was generated using artificial intelligence (AI) models including MedSigLIP for image classification and MedGemma for report generation.',
      'AI-generated findings and recommendations should be reviewed and validated by a qualified radiologist or physician before making clinical decisions.',
      'The AI system is designed to assist healthcare professionals and is not intended to replace professional medical judgment.',
      'Confidence scores indicate the AI model\'s certainty and should be interpreted in clinical context.',
      'Critical findings identified by the AI system require immediate review by a qualified healthcare professional.'
    ];

    aiDisclaimers.forEach((disclaimer, idx) => {
      doc.text(`${idx + 1}. ${disclaimer}`, {
        align: 'justify',
        lineGap: 4
      });
      doc.moveDown(0.5);
    });

    doc.moveDown(1.5);

    // Clinical Disclaimer
    doc.font('Helvetica-Bold')
       .text('Clinical Use Disclaimer:');
    doc.font('Helvetica')
       .moveDown(0.3);

    const clinicalDisclaimers = [
      'This report is for professional medical use only and should be interpreted by qualified healthcare professionals.',
      'Clinical correlation with patient history, physical examination, and other diagnostic tests is essential.',
      'The accuracy of AI analysis depends on image quality, technical factors, and clinical context.',
      'Any discrepancies between AI findings and clinical assessment should be resolved by the attending physician.',
      'This report does not constitute a final diagnosis and should not be used as the sole basis for treatment decisions.'
    ];

    clinicalDisclaimers.forEach((disclaimer, idx) => {
      doc.text(`${idx + 1}. ${disclaimer}`, {
        align: 'justify',
        lineGap: 4
      });
      doc.moveDown(0.5);
    });

    doc.moveDown(1.5);

    // Legal Disclaimer
    doc.font('Helvetica-Bold')
       .text('Legal Notice:');
    doc.font('Helvetica')
       .moveDown(0.3);

    doc.text('This medical report is confidential and protected by applicable privacy laws including HIPAA. ' +
             'Unauthorized access, use, or disclosure is strictly prohibited. ' +
             'This document is intended solely for the use of the named patient and authorized healthcare providers.', {
      align: 'justify',
      lineGap: 4
    });

    doc.moveDown(2);

    // Report metadata
    doc.fontSize(9)
       .fillColor(this.colors.darkGray)
       .font('Helvetica-Bold')
       .text('Report Metadata:');
    doc.font('Helvetica')
       .moveDown(0.3);

    doc.text(`Report ID: ${data.reportId}`);
    doc.text(`Generated: ${new Date(data.reportDate || Date.now()).toLocaleString()}`);
    doc.text(`AI Models: MedSigLIP (Classification), MedGemma (Report Generation)`);
    if (data.stats?.servicesUsed) {
      doc.text(`Services: ${data.stats.servicesUsed.join(', ')}`);
    }
    doc.text(`Report Version: ${data.version || '1.0'}`);
    doc.text(`Status: ${(data.reportStatus || 'draft').toUpperCase()}`);

    // Signature section if final
    if (data.reportStatus === 'final' && data.radiologistSignature) {
      doc.moveDown(2);
      doc.font('Helvetica-Bold')
         .fillColor(this.colors.text)
         .text('Electronically Signed By:');
      doc.font('Helvetica')
         .text(data.radiologistName || 'Unknown');
      if (data.signedAt) {
        doc.text(`Date: ${new Date(data.signedAt).toLocaleString()}`);
      }
      doc.text(`Signature: ${data.radiologistSignature}`);
    }
  }

  /**
   * Add section header
   */
  addSectionHeader(doc, title) {
    doc.fontSize(16)
       .fillColor(this.colors.primary)
       .font('Helvetica-Bold')
       .text(title);

    doc.moveDown(0.3);
    doc.moveTo(this.pageMargins.left, doc.y)
       .lineTo(doc.page.width - this.pageMargins.right, doc.y)
       .lineWidth(2)
       .stroke(this.colors.accent);
    doc.moveDown(1);
  }

  /**
   * Add page footer with header
   */
  addPageFooter(doc, pageNumber, data) {
    const footerY = doc.page.height - this.pageMargins.bottom + 20;
    const headerY = this.pageMargins.top - 40;

    // Add header line on all pages except first
    if (pageNumber > 1) {
      doc.fontSize(8)
         .fillColor(this.colors.darkGray)
         .font('Helvetica')
         .text(
           `${data.patientName || 'Patient'} | ${data.patientID || 'N/A'} | ${data.modality || 'Medical'} Report`,
           this.pageMargins.left,
           headerY,
           { width: doc.page.width - this.pageMargins.left - this.pageMargins.right, align: 'center' }
         );

      // Header line
      doc.moveTo(this.pageMargins.left, headerY + 15)
         .lineTo(doc.page.width - this.pageMargins.right, headerY + 15)
         .stroke(this.colors.lightGray);
    }

    // Footer line
    doc.moveTo(this.pageMargins.left, footerY - 10)
       .lineTo(doc.page.width - this.pageMargins.right, footerY - 10)
       .stroke(this.colors.lightGray);

    doc.fontSize(9)
       .fillColor(this.colors.darkGray)
       .font('Helvetica');

    // Left: Report ID
    doc.text(
      `Report: ${data.reportId || 'N/A'}`,
      this.pageMargins.left,
      footerY,
      { width: 200, align: 'left' }
    );

    // Center: Confidential
    doc.text(
      'CONFIDENTIAL MEDICAL REPORT',
      0,
      footerY,
      { width: doc.page.width, align: 'center' }
    );

    // Right: Page number
    doc.text(
      `Page ${pageNumber}`,
      doc.page.width - this.pageMargins.right - 100,
      footerY,
      { width: 100, align: 'right' }
    );
  }

  /**
   * Add quality assurance section
   */
  addQualityAssurance(doc, qaResults) {
    if (!qaResults) return;

    this.addSectionHeader(doc, 'QUALITY ASSURANCE');

    doc.fontSize(11)
       .fillColor(this.colors.text)
       .font('Helvetica');

    // QA Score
    const scoreColor = qaResults.passed ? this.colors.success : this.colors.critical;
    doc.font('Helvetica-Bold')
       .text('QA Score: ', { continued: true })
       .fillColor(scoreColor)
       .text(`${qaResults.score}/${qaResults.maxScore || 100} (${qaResults.percentage}%)`)
       .fillColor(this.colors.text);

    doc.font('Helvetica-Bold')
       .text('Grade: ', { continued: true })
       .font('Helvetica')
       .text(qaResults.grade || 'N/A');

    doc.font('Helvetica-Bold')
       .text('Status: ', { continued: true })
       .fillColor(scoreColor)
       .text(qaResults.passed ? 'PASSED ✓' : 'FAILED ✗')
       .fillColor(this.colors.text);

    doc.moveDown(1);

    // QA Checks
    if (qaResults.checks && qaResults.checks.length > 0) {
      doc.font('Helvetica-Bold')
         .text('Quality Checks:');
      doc.font('Helvetica')
         .moveDown(0.3);

      qaResults.checks.forEach(check => {
        const icon = check.passed ? '✓' : '✗';
        const color = check.passed ? this.colors.success : this.colors.warning;
        
        doc.fillColor(color)
           .text(`${icon} ${check.name}: ${check.points}/${check.maxPoints} points`, {
             indent: 20
           })
           .fillColor(this.colors.text);
      });

      doc.moveDown(1);
    }

    // Warnings
    if (qaResults.warnings && qaResults.warnings.length > 0) {
      doc.fillColor(this.colors.warning)
         .font('Helvetica-Bold')
         .text(`Warnings (${qaResults.warnings.length}):`);
      doc.fillColor(this.colors.text)
         .font('Helvetica')
         .moveDown(0.3);

      qaResults.warnings.forEach((warning, idx) => {
        doc.text(`${idx + 1}. ${warning}`, { indent: 20 });
      });

      doc.moveDown(1);
    }

    // Errors
    if (qaResults.errors && qaResults.errors.length > 0) {
      doc.fillColor(this.colors.critical)
         .font('Helvetica-Bold')
         .text(`Errors (${qaResults.errors.length}):`);
      doc.fillColor(this.colors.text)
         .font('Helvetica')
         .moveDown(0.3);

      qaResults.errors.forEach((error, idx) => {
        doc.text(`${idx + 1}. ${error}`, { indent: 20 });
      });
    }

    doc.moveDown(2);
  }

  /**
   * Add data quality metrics
   */
  addDataQualityMetrics(doc, dataQuality) {
    if (!dataQuality) return;

    this.addSectionHeader(doc, 'DATA QUALITY METRICS');

    doc.fontSize(11)
       .fillColor(this.colors.text)
       .font('Helvetica');

    const metrics = [
      ['Frames with Complete Data', dataQuality.framesWithCompleteData || 'N/A'],
      ['Average Data Completeness', `${dataQuality.averageCompleteness || 0}%`],
      ['Images Available', dataQuality.imagesAvailable || 'N/A'],
      ['Data Quality Score', dataQuality.qualityScore || 'N/A']
    ];

    metrics.forEach(([label, value]) => {
      doc.font('Helvetica-Bold')
         .text(`${label}: `, { continued: true })
         .font('Helvetica')
         .text(value);
      doc.moveDown(0.3);
    });

    doc.moveDown(2);
  }

  /**
   * Generate report with all sections including QA
   */
  async generateReportWithQA(reportData, qaResults, dataQuality, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: this.pageMargins,
          info: {
            Title: `Medical Report - ${reportData.reportId}`,
            Author: reportData.radiologistName || 'AI System',
            Subject: 'AI-Assisted Medical Analysis Report',
            Keywords: 'medical, radiology, AI, analysis, quality-assured'
          }
        });

        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        let pageNumber = 1;

        doc.on('pageAdded', () => {
          pageNumber++;
          this.addPageFooter(doc, pageNumber, reportData);
        });

        // Generate all sections
        this.addTitlePage(doc, reportData);
        this.addExecutiveSummary(doc, reportData);
        this.addStudyInformation(doc, reportData);
        
        // Add QA and data quality sections
        if (qaResults) {
          this.addQualityAssurance(doc, qaResults);
        }
        
        if (dataQuality) {
          this.addDataQualityMetrics(doc, dataQuality);
        }
        
        if (reportData.frames && reportData.frames.length > 0) {
          this.addPerFrameAnalysis(doc, reportData);
        }
        
        this.addComprehensiveSummary(doc, reportData);
        this.addDisclaimers(doc, reportData);

        this.addPageFooter(doc, pageNumber, reportData);

        doc.end();

        stream.on('finish', () => resolve(outputPath));
        stream.on('error', reject);

      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = ProfessionalPDFGenerator;
