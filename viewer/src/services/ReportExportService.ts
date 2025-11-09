import { jsPDF } from 'jspdf'

export interface ExportOptions {
  format: 'pdf' | 'docx' | 'dicom-sr' | 'hl7' | 'txt'
  includeImages: boolean
  includeMetadata: boolean
  includeMeasurements: boolean
  includeSignature?: boolean
  includeAddendums?: boolean
  includeAuditTrail?: boolean
  watermark?: 'DRAFT' | 'FINAL' | 'PRELIMINARY' | null
  headerInfo?: {
    institutionName?: string
    departmentName?: string
    radiologist?: string
    physicianName?: string
    institutionLogo?: string
  }
}

export interface ReportData {
  studyInfo: {
    patientName: string
    patientID: string
    studyDate: string
    studyTime?: string
    modality: string
    studyDescription: string
    studyInstanceUID: string
  }
  sections: {
    [key: string]: string
  }
  findings: Array<{
    id: string
    category: string
    location: string
    description: string
    severity: string
    measurements?: string[]
  }>
  measurements: Array<{
    id: string
    type: string
    value: number
    unit: string
    location?: string
    frameIndex: number
  }>
  reportStatus: string
  timestamp: string
  radiologist?: string
  capturedImages?: Array<{
    id: string
    dataUrl: string
    caption: string
    timestamp?: Date
  }>
  radiologistSignature?: string
  addendums?: Array<{
    text: string
    timestamp: string
    author: string
  }>
  auditTrail?: Array<{
    timestamp: string
    user: string
    action: string
  }>
  locked?: boolean
}

class ReportExportService {
  private static instance: ReportExportService
  
  public static getInstance(): ReportExportService {
    if (!ReportExportService.instance) {
      ReportExportService.instance = new ReportExportService()
    }
    return ReportExportService.instance
  }

  /**
   * Export report to PDF format with images, signature, and watermarks
   */
  public async exportToPDF(reportData: ReportData, options: ExportOptions = { 
    format: 'pdf', 
    includeImages: true, 
    includeMetadata: true, 
    includeMeasurements: true,
    includeSignature: true,
    includeAddendums: true,
    watermark: reportData.reportStatus === 'final' ? 'FINAL' : 'DRAFT'
  }): Promise<void> {
    try {
      const doc = new jsPDF()
      let yPosition = 20
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 20
      let currentPage = 1

      // Helper function to add watermark to current page
      const addWatermark = () => {
        if (options.watermark) {
          doc.saveGraphicsState()
          doc.setGState(new doc.GState({ opacity: 0.1 }))
          doc.setFontSize(80)
          doc.setTextColor(reportData.reportStatus === 'final' ? 0 : 255, 0, 0)
          doc.setFont('helvetica', 'bold')
          
          // Rotate and center watermark
          const text = options.watermark
          const textWidth = doc.getTextWidth(text)
          doc.text(text, pageWidth / 2, pageHeight / 2, {
            align: 'center',
            angle: 45
          })
          doc.restoreGraphicsState()
        }
      }

      // Helper function to add header/footer
      const addHeaderFooter = () => {
        // Header
        doc.setFontSize(8)
        doc.setTextColor(100)
        doc.setFont('helvetica', 'normal')
        if (options.headerInfo?.institutionName) {
          doc.text(options.headerInfo.institutionName, margin, 10)
        }
        doc.text(`Patient: ${reportData.studyInfo.patientName}`, pageWidth - margin, 10, { align: 'right' })
        
        // Footer
        doc.setFontSize(8)
        doc.text(`Page ${currentPage}`, pageWidth / 2, pageHeight - 10, { align: 'center' })
        doc.text(`Generated: ${new Date(reportData.timestamp).toLocaleDateString()}`, margin, pageHeight - 10)
        doc.text(`Status: ${reportData.reportStatus.toUpperCase()}`, pageWidth - margin, pageHeight - 10, { align: 'right' })
        
        // Add watermark
        addWatermark()
      }

      // Helper function to check if new page needed
      const checkNewPage = (spaceNeeded: number = 20) => {
        if (yPosition + spaceNeeded > pageHeight - 30) {
          doc.addPage()
          currentPage++
          yPosition = 20
          addHeaderFooter()
        }
      }

      // Add header/footer to first page
      addHeaderFooter()

      // Institution Header
      if (options.headerInfo?.institutionName) {
        doc.setFontSize(16)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(0, 51, 102)
        doc.text(options.headerInfo.institutionName, pageWidth / 2, yPosition, { align: 'center' })
        yPosition += 8
        
        if (options.headerInfo.departmentName) {
          doc.setFontSize(12)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(0)
          doc.text(options.headerInfo.departmentName, pageWidth / 2, yPosition, { align: 'center' })
          yPosition += 12
        }
      }

      // Title
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0)
      doc.text('RADIOLOGY REPORT', pageWidth / 2, yPosition, { align: 'center' })
      yPosition += 15

      // Patient Information Box
      doc.setFillColor(240, 240, 240)
      doc.rect(margin, yPosition, pageWidth - 2 * margin, 35, 'F')
      yPosition += 8

      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('PATIENT INFORMATION', margin + 5, yPosition)
      yPosition += 6

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`Patient Name: ${reportData.studyInfo.patientName}`, margin + 5, yPosition)
      doc.text(`Patient ID: ${reportData.studyInfo.patientID}`, pageWidth / 2 + 10, yPosition)
      yPosition += 5
      doc.text(`Study Date: ${this.formatDate(reportData.studyInfo.studyDate)}`, margin + 5, yPosition)
      doc.text(`Modality: ${reportData.studyInfo.modality}`, pageWidth / 2 + 10, yPosition)
      yPosition += 5
      doc.text(`Study Description: ${reportData.studyInfo.studyDescription}`, margin + 5, yPosition)
      yPosition += 15

      // Report Sections
      Object.entries(reportData.sections).forEach(([sectionId, content]) => {
        if (content && content.trim()) {
          checkNewPage(30)

          doc.setFontSize(12)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(0, 51, 102)
          doc.text(this.formatSectionTitle(sectionId).toUpperCase(), margin, yPosition)
          yPosition += 7

          doc.setFont('helvetica', 'normal')
          doc.setFontSize(10)
          doc.setTextColor(0)
          const lines = doc.splitTextToSize(content, pageWidth - 2 * margin)
          lines.forEach((line: string) => {
            checkNewPage()
            doc.text(line, margin, yPosition)
            yPosition += 5
          })
          yPosition += 8
        }
      })

      // Measurements Table
      if (options.includeMeasurements && reportData.measurements.length > 0) {
        checkNewPage(40)

        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(0, 51, 102)
        doc.text('MEASUREMENTS', margin, yPosition)
        yPosition += 7

        // Table header
        doc.setFillColor(220, 220, 220)
        doc.rect(margin, yPosition, pageWidth - 2 * margin, 8, 'F')
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.text('Type', margin + 2, yPosition + 5)
        doc.text('Value', margin + 40, yPosition + 5)
        doc.text('Location', margin + 80, yPosition + 5)
        yPosition += 10

        // Table rows
        doc.setFont('helvetica', 'normal')
        reportData.measurements.forEach((measurement, idx) => {
          checkNewPage()
          if (idx % 2 === 0) {
            doc.setFillColor(245, 245, 245)
            doc.rect(margin, yPosition - 4, pageWidth - 2 * margin, 6, 'F')
          }
          doc.text(measurement.type, margin + 2, yPosition)
          doc.text(`${measurement.value} ${measurement.unit}`, margin + 40, yPosition)
          doc.text(measurement.location || `Frame ${measurement.frameIndex}`, margin + 80, yPosition)
          yPosition += 6
        })
        yPosition += 10
      }

      // Captured Images
      if (options.includeImages && reportData.capturedImages && reportData.capturedImages.length > 0) {
        checkNewPage(60)

        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(0, 51, 102)
        doc.text('KEY IMAGES', margin, yPosition)
        yPosition += 10

        for (const image of reportData.capturedImages) {
          checkNewPage(80)

          try {
            // Add image
            const imgWidth = 160
            const imgHeight = 120
            doc.addImage(image.dataUrl, 'PNG', margin, yPosition, imgWidth, imgHeight)
            
            // Add caption below image
            doc.setFontSize(9)
            doc.setFont('helvetica', 'italic')
            doc.setTextColor(100)
            doc.text(image.caption, margin, yPosition + imgHeight + 5)
            
            yPosition += imgHeight + 15
          } catch (error) {
            console.error('Error adding image to PDF:', error)
            doc.setFontSize(9)
            doc.setTextColor(255, 0, 0)
            doc.text(`[Image could not be embedded: ${image.caption}]`, margin, yPosition)
            yPosition += 10
          }
        }
      }

      // Findings
      if (reportData.findings.length > 0) {
        checkNewPage(30)

        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(0, 51, 102)
        doc.text('DETAILED FINDINGS', margin, yPosition)
        yPosition += 7

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(0)
        reportData.findings.forEach((finding, index) => {
          checkNewPage(15)
          doc.text(`${index + 1}. ${finding.location} - ${finding.description}`, margin, yPosition)
          yPosition += 5
          doc.setFontSize(9)
          doc.setTextColor(100)
          doc.text(`   Category: ${finding.category}, Severity: ${finding.severity}`, margin + 5, yPosition)
          doc.setFontSize(10)
          doc.setTextColor(0)
          yPosition += 8
        })
      }

      // Addendums
      if (options.includeAddendums && reportData.addendums && reportData.addendums.length > 0) {
        checkNewPage(30)

        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(255, 140, 0)
        doc.text('ADDENDUMS', margin, yPosition)
        yPosition += 7

        reportData.addendums.forEach((addendum, idx) => {
          checkNewPage(20)
          
          doc.setFillColor(255, 250, 240)
          const addendumHeight = 20
          doc.rect(margin, yPosition - 3, pageWidth - 2 * margin, addendumHeight, 'F')
          
          doc.setFontSize(9)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(0)
          doc.text(`Addendum #${idx + 1} - ${new Date(addendum.timestamp).toLocaleString()} - ${addendum.author}`, margin + 2, yPosition)
          yPosition += 5
          
          doc.setFont('helvetica', 'normal')
          const addendumLines = doc.splitTextToSize(addendum.text, pageWidth - 2 * margin - 4)
          addendumLines.forEach((line: string) => {
            doc.text(line, margin + 2, yPosition)
            yPosition += 4
          })
          yPosition += 8
        })
      }

      // Signature
      if (options.includeSignature && reportData.radiologistSignature) {
        checkNewPage(50)

        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(0, 51, 102)
        doc.text('RADIOLOGIST SIGNATURE', margin, yPosition)
        yPosition += 10

        try {
          // Add signature image
          doc.addImage(reportData.radiologistSignature, 'PNG', margin, yPosition, 80, 30)
          yPosition += 35
        } catch (error) {
          console.error('Error adding signature:', error)
        }

        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(0)
        doc.text(`Radiologist: ${options.headerInfo?.radiologist || 'Dr. Medical Professional'}`, margin, yPosition)
        yPosition += 5
        doc.text(`Date: ${new Date(reportData.timestamp).toLocaleString()}`, margin, yPosition)
        yPosition += 5
        
        if (reportData.locked) {
          doc.setTextColor(0, 128, 0)
          doc.setFont('helvetica', 'bold')
          doc.text('✓ REPORT LOCKED AND FINALIZED', margin, yPosition)
        }
      }

      // Save the PDF
      const fileName = `RadiologyReport_${reportData.studyInfo.patientName.replace(/[^a-zA-Z0-9]/g, '_')}_${reportData.studyInfo.studyDate}.pdf`
      doc.save(fileName)
      
      console.log('✅ PDF exported successfully with images and signature')
      
    } catch (error) {
      console.error('Error exporting to PDF:', error)
      throw new Error('Failed to export report to PDF')
    }
  }

  /**
   * Export report to DOCX format (using HTML conversion)
   */
  public async exportToDOCX(reportData: ReportData, options: ExportOptions): Promise<void> {
    try {
      // Generate HTML content
      let htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Calibri', Arial, sans-serif; margin: 40px; line-height: 1.6; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #003366; padding-bottom: 20px; }
    .header h1 { color: #003366; margin: 10px 0; font-size: 24pt; }
    .header h2 { color: #666; margin: 5px 0; font-size: 14pt; font-weight: normal; }
    .patient-info { background-color: #f0f0f0; padding: 15px; margin: 20px 0; border-left: 4px solid #003366; }
    .patient-info table { width: 100%; border-collapse: collapse; }
    .patient-info td { padding: 5px; }
    .patient-info td:first-child { font-weight: bold; width: 150px; }
    .section { margin: 20px 0; }
    .section-title { color: #003366; font-size: 14pt; font-weight: bold; margin: 15px 0 10px 0; border-bottom: 2px solid #003366; padding-bottom: 5px; }
    .section-content { margin-left: 10px; text-align: justify; }
    .measurements-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    .measurements-table th { background-color: #003366; color: white; padding: 10px; text-align: left; }
    .measurements-table td { border: 1px solid #ddd; padding: 8px; }
    .measurements-table tr:nth-child(even) { background-color: #f9f9f9; }
    .image-container { margin: 20px 0; text-align: center; page-break-inside: avoid; }
    .image-container img { max-width: 600px; border: 1px solid #ddd; }
    .image-caption { font-style: italic; color: #666; margin-top: 5px; font-size: 10pt; }
    .addendum { background-color: #fff8dc; border-left: 4px solid #ff8c00; padding: 15px; margin: 15px 0; }
    .addendum-header { font-weight: bold; color: #ff8c00; margin-bottom: 10px; }
    .signature { margin-top: 40px; border-top: 2px solid #003366; padding-top: 20px; }
    .signature img { max-width: 200px; }
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 120pt; color: rgba(255, 0, 0, 0.1); font-weight: bold; z-index: -1; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 9pt; color: #666; }
    @media print { .watermark { display: block; } }
  </style>
</head>
<body>
`

      // Watermark
      if (options.watermark) {
        htmlContent += `<div class="watermark">${options.watermark}</div>\n`
      }

      // Header
      htmlContent += `<div class="header">\n`
      if (options.headerInfo?.institutionName) {
        htmlContent += `  <h1>${options.headerInfo.institutionName}</h1>\n`
        if (options.headerInfo.departmentName) {
          htmlContent += `  <h2>${options.headerInfo.departmentName}</h2>\n`
        }
      }
      htmlContent += `  <h1>RADIOLOGY REPORT</h1>\n`
      htmlContent += `</div>\n`

      // Patient Information
      htmlContent += `<div class="patient-info">\n`
      htmlContent += `  <table>\n`
      htmlContent += `    <tr><td>Patient Name:</td><td>${reportData.studyInfo.patientName}</td></tr>\n`
      htmlContent += `    <tr><td>Patient ID:</td><td>${reportData.studyInfo.patientID}</td></tr>\n`
      htmlContent += `    <tr><td>Study Date:</td><td>${this.formatDate(reportData.studyInfo.studyDate)}</td></tr>\n`
      htmlContent += `    <tr><td>Modality:</td><td>${reportData.studyInfo.modality}</td></tr>\n`
      htmlContent += `    <tr><td>Study Description:</td><td>${reportData.studyInfo.studyDescription}</td></tr>\n`
      htmlContent += `    <tr><td>Study UID:</td><td style="font-size: 8pt;">${reportData.studyInfo.studyInstanceUID}</td></tr>\n`
      htmlContent += `  </table>\n`
      htmlContent += `</div>\n`

      // Report Sections
      Object.entries(reportData.sections).forEach(([sectionId, content]) => {
        if (content && content.trim()) {
          htmlContent += `<div class="section">\n`
          htmlContent += `  <div class="section-title">${this.formatSectionTitle(sectionId).toUpperCase()}</div>\n`
          htmlContent += `  <div class="section-content">${content.replace(/\n/g, '<br>')}</div>\n`
          htmlContent += `</div>\n`
        }
      })

      // Measurements Table
      if (options.includeMeasurements && reportData.measurements.length > 0) {
        htmlContent += `<div class="section">\n`
        htmlContent += `  <div class="section-title">MEASUREMENTS</div>\n`
        htmlContent += `  <table class="measurements-table">\n`
        htmlContent += `    <tr><th>Type</th><th>Value</th><th>Unit</th><th>Location</th></tr>\n`
        reportData.measurements.forEach(m => {
          htmlContent += `    <tr><td>${m.type}</td><td>${m.value}</td><td>${m.unit}</td><td>${m.location || 'Frame ' + m.frameIndex}</td></tr>\n`
        })
        htmlContent += `  </table>\n`
        htmlContent += `</div>\n`
      }

      // Captured Images
      if (options.includeImages && reportData.capturedImages && reportData.capturedImages.length > 0) {
        htmlContent += `<div class="section">\n`
        htmlContent += `  <div class="section-title">KEY IMAGES</div>\n`
        reportData.capturedImages.forEach((img, idx) => {
          htmlContent += `  <div class="image-container">\n`
          htmlContent += `    <img src="${img.dataUrl}" alt="${img.caption}" />\n`
          htmlContent += `    <div class="image-caption">Image ${idx + 1}: ${img.caption}</div>\n`
          htmlContent += `  </div>\n`
        })
        htmlContent += `</div>\n`
      }

      // Findings
      if (reportData.findings.length > 0) {
        htmlContent += `<div class="section">\n`
        htmlContent += `  <div class="section-title">DETAILED FINDINGS</div>\n`
        htmlContent += `  <div class="section-content">\n`
        htmlContent += `    <ol>\n`
        reportData.findings.forEach(f => {
          htmlContent += `      <li><strong>${f.location}</strong> - ${f.description}<br><em>Category: ${f.category}, Severity: ${f.severity}</em></li>\n`
        })
        htmlContent += `    </ol>\n`
        htmlContent += `  </div>\n`
        htmlContent += `</div>\n`
      }

      // Addendums
      if (options.includeAddendums && reportData.addendums && reportData.addendums.length > 0) {
        htmlContent += `<div class="section">\n`
        htmlContent += `  <div class="section-title" style="color: #ff8c00;">ADDENDUMS</div>\n`
        reportData.addendums.forEach((addendum, idx) => {
          htmlContent += `  <div class="addendum">\n`
          htmlContent += `    <div class="addendum-header">Addendum #${idx + 1} - ${new Date(addendum.timestamp).toLocaleString()} - ${addendum.author}</div>\n`
          htmlContent += `    <div>${addendum.text.replace(/\n/g, '<br>')}</div>\n`
          htmlContent += `  </div>\n`
        })
        htmlContent += `</div>\n`
      }

      // Signature
      if (options.includeSignature && reportData.radiologistSignature) {
        htmlContent += `<div class="signature">\n`
        htmlContent += `  <div class="section-title">RADIOLOGIST SIGNATURE</div>\n`
        htmlContent += `  <img src="${reportData.radiologistSignature}" alt="Signature" /><br>\n`
        htmlContent += `  <p><strong>Radiologist:</strong> ${options.headerInfo?.radiologist || 'Dr. Medical Professional'}</p>\n`
        htmlContent += `  <p><strong>Date:</strong> ${new Date(reportData.timestamp).toLocaleString()}</p>\n`
        if (reportData.locked) {
          htmlContent += `  <p style="color: green; font-weight: bold;">✓ REPORT LOCKED AND FINALIZED</p>\n`
        }
        htmlContent += `</div>\n`
      }

      // Footer
      htmlContent += `<div class="footer">\n`
      htmlContent += `  <p>Report Status: <strong>${reportData.reportStatus.toUpperCase()}</strong></p>\n`
      htmlContent += `  <p>Generated: ${new Date(reportData.timestamp).toLocaleString()}</p>\n`
      htmlContent += `</div>\n`

      htmlContent += `</body>\n</html>`

      // Create blob and download as HTML (which can be opened in Word)
      const blob = new Blob([htmlContent], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `RadiologyReport_${reportData.studyInfo.patientName.replace(/[^a-zA-Z0-9]/g, '_')}_${reportData.studyInfo.studyDate}.doc`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      console.log('✅ DOCX exported successfully (as HTML/DOC format)')
      
    } catch (error) {
      console.error('Error exporting to DOCX:', error)
      throw new Error('Failed to export report to DOCX')
    }
  }

  /**
   * Export report to plain text
   */
  public async exportToText(reportData: ReportData): Promise<string> {
    let reportText = ''
    
    // Header
    reportText += 'STRUCTURED RADIOLOGY REPORT\n'
    reportText += '='.repeat(50) + '\n\n'
    
    // Patient Info
    reportText += 'PATIENT INFORMATION:\n'
    reportText += `-`.repeat(20) + '\n'
    reportText += `Patient Name: ${reportData.studyInfo.patientName}\n`
    reportText += `Patient ID: ${reportData.studyInfo.patientID}\n`
    reportText += `Study Date: ${this.formatDate(reportData.studyInfo.studyDate)}\n`
    reportText += `Modality: ${reportData.studyInfo.modality}\n`
    reportText += `Study Description: ${reportData.studyInfo.studyDescription}\n\n`
    
    // Sections
    Object.entries(reportData.sections).forEach(([sectionId, content]) => {
      if (content && content.trim()) {
        reportText += `${this.formatSectionTitle(sectionId).toUpperCase()}:\n`
        reportText += content + '\n\n'
      }
    })
    
    // Measurements
    if (reportData.measurements.length > 0) {
      reportText += 'MEASUREMENTS:\n'
      reportText += '-'.repeat(12) + '\n'
      reportData.measurements.forEach(measurement => {
        reportText += `• ${measurement.type}: ${measurement.value} ${measurement.unit}`
        if (measurement.location) {
          reportText += ` (${measurement.location})`
        }
        reportText += `\n`
      })
      reportText += '\n'
    }
    
    // Findings
    if (reportData.findings.length > 0) {
      reportText += 'DETAILED FINDINGS:\n'
      reportText += '-'.repeat(17) + '\n'
      reportData.findings.forEach((finding, index) => {
        reportText += `${index + 1}. ${finding.location} - ${finding.description}\n`
        reportText += `   Category: ${finding.category}, Severity: ${finding.severity}\n`
      })
      reportText += '\n'
    }
    
    // Footer
    reportText += '-'.repeat(50) + '\n'
    reportText += `Report Status: ${reportData.reportStatus.toUpperCase()}\n`
    reportText += `Generated: ${new Date(reportData.timestamp).toLocaleString()}\n`
    
    return reportText
  }

  /**
   * Export report to DICOM Structured Report format (Enhanced)
   */
  public async exportToDICOMSR(reportData: ReportData): Promise<string> {
    // Enhanced DICOM SR structure with proper tags
    const dicomSR = {
      // File Meta Information
      '00020001': { vr: 'OB', Value: [0, 1] }, // File Meta Information Version
      '00020002': { vr: 'UI', Value: ['1.2.840.10008.5.1.4.1.1.88.11'] }, // Media Storage SOP Class UID (Basic Text SR)
      '00020003': { vr: 'UI', Value: [this.generateUID()] }, // Media Storage SOP Instance UID
      '00020010': { vr: 'UI', Value: ['1.2.840.10008.1.2.1'] }, // Transfer Syntax UID (Explicit VR Little Endian)
      '00020012': { vr: 'UI', Value: ['1.2.840.113619.6.0'] }, // Implementation Class UID
      '00020013': { vr: 'SH', Value: ['MEDICAL_VIEWER_1.0'] }, // Implementation Version Name
      
      // Patient Module
      '00100010': { vr: 'PN', Value: [reportData.studyInfo.patientName] }, // Patient Name
      '00100020': { vr: 'LO', Value: [reportData.studyInfo.patientID] }, // Patient ID
      '00100030': { vr: 'DA', Value: [''] }, // Patient Birth Date
      '00100040': { vr: 'CS', Value: ['O'] }, // Patient Sex
      
      // General Study Module
      '0020000D': { vr: 'UI', Value: [reportData.studyInfo.studyInstanceUID] }, // Study Instance UID
      '00080020': { vr: 'DA', Value: [reportData.studyInfo.studyDate] }, // Study Date
      '00080030': { vr: 'TM', Value: [reportData.studyInfo.studyTime || '120000'] }, // Study Time
      '00080050': { vr: 'SH', Value: [''] }, // Accession Number
      '00080090': { vr: 'PN', Value: [''] }, // Referring Physician Name
      '00081030': { vr: 'LO', Value: [reportData.studyInfo.studyDescription] }, // Study Description
      
      // General Series Module
      '00080060': { vr: 'CS', Value: ['SR'] }, // Modality
      '0020000E': { vr: 'UI', Value: [this.generateUID()] }, // Series Instance UID
      '00200011': { vr: 'IS', Value: ['1'] }, // Series Number
      
      // SR Document Series Module
      '0008103E': { vr: 'LO', Value: ['Radiology Report'] }, // Series Description
      
      // General Equipment Module
      '00080070': { vr: 'LO', Value: ['Medical Imaging Viewer'] }, // Manufacturer
      '00081090': { vr: 'LO', Value: ['Medical Viewer v1.0'] }, // Manufacturer Model Name
      '00181020': { vr: 'LO', Value: ['1.0'] }, // Software Version
      
      // SR Document General Module
      '00080023': { vr: 'DA', Value: [new Date().toISOString().split('T')[0].replace(/-/g, '')] }, // Content Date
      '00080033': { vr: 'TM', Value: [new Date().toISOString().split('T')[1].split('.')[0].replace(/:/g, '')] }, // Content Time
      '00080016': { vr: 'UI', Value: ['1.2.840.10008.5.1.4.1.1.88.11'] }, // SOP Class UID
      '00080018': { vr: 'UI', Value: [this.generateUID()] }, // SOP Instance UID
      '00200013': { vr: 'IS', Value: ['1'] }, // Instance Number
      '0040A491': { vr: 'CS', Value: [reportData.reportStatus === 'final' ? 'COMPLETE' : 'PARTIAL'] }, // Completion Flag
      '0040A493': { vr: 'CS', Value: [reportData.reportStatus === 'final' ? 'VERIFIED' : 'UNVERIFIED'] }, // Verification Flag
      
      // SR Document Content Module
      '0040A043': { vr: 'SQ', Value: [{ // Concept Name Code Sequence
        '00080100': { vr: 'SH', Value: ['11528-7'] }, // Code Value
        '00080102': { vr: 'SH', Value: ['LN'] }, // Coding Scheme Designator
        '00080104': { vr: 'LO', Value: ['Radiology Report'] } // Code Meaning
      }] },
      
      // Content Sequence (Simplified - contains report sections)
      '0040A730': { vr: 'SQ', Value: this.buildContentSequence(reportData) },
      
      // Custom Report Data (for reference)
      'PRIVATE_REPORT_DATA': {
        sections: reportData.sections,
        findings: reportData.findings,
        measurements: reportData.measurements,
        capturedImages: reportData.capturedImages?.length || 0,
        hasSignature: !!reportData.radiologistSignature,
        addendums: reportData.addendums?.length || 0,
        locked: reportData.locked || false
      }
    }
    
    // Convert to JSON string with note about DICOM format
    const jsonOutput = {
      _note: 'This is a simplified DICOM SR representation in JSON format. For true DICOM binary format, use a DICOM library like dcmjs or pydicom.',
      _format: 'DICOM SR (JSON representation)',
      _sopClassUID: '1.2.840.10008.5.1.4.1.1.88.11',
      _sopClassDescription: 'Basic Text SR Storage',
      dicomTags: dicomSR
    }
    
    const fileName = `DICOM_SR_${reportData.studyInfo.patientName.replace(/[^a-zA-Z0-9]/g, '_')}_${reportData.studyInfo.studyDate}.json`
    this.downloadAsFile(JSON.stringify(jsonOutput, null, 2), fileName, 'application/json')
    
    console.log('✅ DICOM SR exported (JSON format - use DICOM library for binary format)')
    
    return JSON.stringify(jsonOutput)
  }
  
  /**
   * Build DICOM SR Content Sequence
   */
  private buildContentSequence(reportData: ReportData): any[] {
    const contentItems: any[] = []
    
    // Add sections as content items
    Object.entries(reportData.sections).forEach(([sectionId, content]) => {
      if (content && content.trim()) {
        contentItems.push({
          '0040A040': { vr: 'CS', Value: ['TEXT'] }, // Value Type
          '0040A043': { vr: 'SQ', Value: [{ // Concept Name Code Sequence
            '00080100': { vr: 'SH', Value: [sectionId] },
            '00080102': { vr: 'SH', Value: ['99LOCAL'] },
            '00080104': { vr: 'LO', Value: [this.formatSectionTitle(sectionId)] }
          }] },
          '0040A160': { vr: 'UT', Value: [content] } // Text Value
        })
      }
    })
    
    // Add measurements
    reportData.measurements.forEach(m => {
      contentItems.push({
        '0040A040': { vr: 'CS', Value: ['NUM'] }, // Value Type
        '0040A043': { vr: 'SQ', Value: [{ // Concept Name Code Sequence
          '00080100': { vr: 'SH', Value: [m.type] },
          '00080102': { vr: 'SH', Value: ['99LOCAL'] },
          '00080104': { vr: 'LO', Value: [m.type] }
        }] },
        '0040A30A': { vr: 'DS', Value: [m.value.toString()] }, // Numeric Value
        '0040A043': { vr: 'SQ', Value: [{ // Measurement Units Code Sequence
          '00080100': { vr: 'SH', Value: [m.unit] },
          '00080102': { vr: 'SH', Value: ['UCUM'] },
          '00080104': { vr: 'LO', Value: [m.unit] }
        }] }
      })
    })
    
    return contentItems
  }

  /**
   * Export report to HL7 format
   */
  public async exportToHL7(reportData: ReportData): Promise<string> {
    const hl7Timestamp = new Date(reportData.timestamp).toISOString().replace(/[-:]/g, '').split('.')[0]
    const reportText = await this.exportToText(reportData)
    
    // Basic HL7 MDM message structure
    const hl7Message = [
      'MSH|^~\\&|RadiologyIS|HOSPITAL|RIS|HOSPITAL|' + hl7Timestamp + '||MDM^T02|' + Date.now() + '|P|2.5',
      'EVN|T02|' + hl7Timestamp,
      `PID|||${reportData.studyInfo.patientID}||${reportData.studyInfo.patientName.replace('^', '\\S\\')}`,
      'PV1|1|I|||||||||||||||||||||||||||||||||||||||||||||||||',
      'TXA|1|RA|TEXT|' + hl7Timestamp + '||||||||' + reportData.studyInfo.studyInstanceUID + '|',
      'OBX|1|TX|RAD_REPORT^Radiology Report^L||' + reportText.replace(/\n/g, '\\E\\') + '||||||F'
    ].join('\r')
    
    const fileName = `HL7_${reportData.studyInfo.patientName.replace(/[^a-zA-Z0-9]/g, '_')}_${reportData.studyInfo.studyDate}.hl7`
    this.downloadAsFile(hl7Message, fileName, 'text/plain')
    
    return hl7Message
  }

  /**
   * Download text content as file
   */
  private downloadAsFile(content: string, fileName: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  /**
   * Format section title for display
   */
  private formatSectionTitle(sectionId: string): string {
    return sectionId
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  /**
   * Format date for display
   */
  private formatDate(dateString: string): string {
    if (!dateString) return 'Unknown'
    
    // Handle DICOM date format (YYYYMMDD)
    if (dateString.length === 8 && /^\d+$/.test(dateString)) {
      const year = dateString.substring(0, 4)
      const month = dateString.substring(4, 6)
      const day = dateString.substring(6, 8)
      return `${month}/${day}/${year}`
    }
    
    return dateString
  }

  /**
   * Generate a simple UID for DICOM
   */
  private generateUID(): string {
    const timestamp = Date.now()
    const random = Math.floor(Math.random() * 10000)
    return `1.2.840.113619.2.5.${timestamp}.${random}`
  }

  /**
   * Copy report text to clipboard
   */
  public async copyToClipboard(reportData: ReportData): Promise<void> {
    try {
      const reportText = await this.exportToText(reportData)
      await navigator.clipboard.writeText(reportText)
    } catch (error) {
      console.error('Error copying to clipboard:', error)
      throw new Error('Failed to copy report to clipboard')
    }
  }

  /**
   * Print report
   */
  public async printReport(reportData: ReportData, options: ExportOptions = { format: 'pdf', includeImages: false, includeMetadata: true, includeMeasurements: true }): Promise<void> {
    try {
      const reportText = await this.exportToText(reportData)
      
      // Create a new window for printing
      const printWindow = window.open('', '_blank', 'width=800,height=600')
      if (!printWindow) {
        throw new Error('Unable to open print window')
      }
      
      printWindow.document.write(`
        <html>
          <head>
            <title>Radiology Report</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
              h1 { color: #333; border-bottom: 2px solid #333; }
              .header { text-align: center; margin-bottom: 30px; }
              .section { margin-bottom: 20px; }
              .measurements { background-color: #f5f5f5; padding: 10px; }
              @media print {
                body { margin: 0; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>RADIOLOGY REPORT</h1>
              ${options.headerInfo?.institutionName ? `<h2>${options.headerInfo.institutionName}</h2>` : ''}
              ${options.headerInfo?.departmentName ? `<h3>${options.headerInfo.departmentName}</h3>` : ''}
            </div>
            <pre style="white-space: pre-wrap; font-family: Arial, sans-serif;">${reportText}</pre>
            <div class="no-print" style="margin-top: 20px; text-align: center;">
              <button onclick="window.print()">Print Report</button>
              <button onclick="window.close()">Close</button>
            </div>
          </body>
        </html>
      `)
      
      printWindow.document.close()
      printWindow.focus()
      
    } catch (error) {
      console.error('Error printing report:', error)
      throw new Error('Failed to print report')
    }
  }
}

export default ReportExportService