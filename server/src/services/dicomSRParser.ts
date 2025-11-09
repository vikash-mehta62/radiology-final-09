import type { ReportMeasurement, ReportFinding } from '@medical-imaging/shared-types'

interface DICOMSRInstance {
  SOPInstanceUID: string
  SeriesInstanceUID: string
  StudyInstanceUID: string
  ContentSequence?: any[]
  ConceptNameCodeSequence?: any[]
}

interface ParsedSRData {
  measurements: ReportMeasurement[]
  findings: ReportFinding[]
  annotations: Array<{
    type: string
    text: string
    location?: string
  }>
}

/**
 * Parse DICOM Structured Report content
 */
export class DICOMSRParser {
  /**
   * Parse DICOM SR instance and extract measurements and findings
   */
  parseSRInstance(srData: any): ParsedSRData {
    const measurements: ReportMeasurement[] = []
    const findings: ReportFinding[] = []
    const annotations: Array<{ type: string; text: string; location?: string }> = []

    try {
      // Parse content sequence
      if (srData.ContentSequence) {
        this.parseContentSequence(srData.ContentSequence, measurements, findings, annotations)
      }

      // Parse measurement groups (OHIF format)
      if (srData.MeasurementGroups) {
        this.parseMeasurementGroups(srData.MeasurementGroups, measurements)
      }

      // Parse imaging measurements (standard DICOM SR)
      if (srData.ImagingMeasurements) {
        this.parseImagingMeasurements(srData.ImagingMeasurements, measurements)
      }

    } catch (error) {
      console.error('Error parsing DICOM SR:', error)
    }

    return { measurements, findings, annotations }
  }

  /**
   * Parse content sequence recursively
   */
  private parseContentSequence(
    contentSeq: any[],
    measurements: ReportMeasurement[],
    findings: ReportFinding[],
    annotations: Array<{ type: string; text: string; location?: string }>
  ): void {
    for (const item of contentSeq) {
      const conceptName = this.getConceptName(item)
      const valueType = item.ValueType

      // Handle measurements
      if (this.isMeasurement(conceptName, valueType)) {
        const measurement = this.extractMeasurement(item)
        if (measurement) {
          measurements.push(measurement)
        }
      }

      // Handle findings/observations
      if (this.isFinding(conceptName, valueType)) {
        const finding = this.extractFinding(item)
        if (finding) {
          findings.push(finding)
        }
      }

      // Handle text annotations
      if (valueType === 'TEXT') {
        annotations.push({
          type: conceptName || 'annotation',
          text: item.TextValue || '',
          location: this.extractLocation(item)
        })
      }

      // Recurse into nested content
      if (item.ContentSequence) {
        this.parseContentSequence(item.ContentSequence, measurements, findings, annotations)
      }
    }
  }

  /**
   * Parse OHIF measurement groups
   */
  private parseMeasurementGroups(groups: any[], measurements: ReportMeasurement[]): void {
    for (const group of groups) {
      if (group.measurements) {
        for (const m of group.measurements) {
          measurements.push({
            id: m.uid || this.generateId(),
            type: this.mapMeasurementType(m.type || 'length'),
            value: m.value || 0,
            unit: m.unit || 'mm',
            location: m.label || group.label || 'Unknown',
            seriesInstanceUID: m.SeriesInstanceUID,
            sopInstanceUID: m.SOPInstanceUID,
            frameNumber: m.frameNumber,
            coordinates: m.points || [],
            metadata: {
              toolName: m.toolName,
              label: m.label,
              description: m.description
            }
          })
        }
      }
    }
  }

  /**
   * Parse standard DICOM imaging measurements
   */
  private parseImagingMeasurements(measurements: any[], results: ReportMeasurement[]): void {
    for (const m of measurements) {
      results.push({
        id: m.uid || this.generateId(),
        type: this.mapMeasurementType(m.type),
        value: parseFloat(m.value) || 0,
        unit: m.unit || 'mm',
        location: m.anatomicLocation || 'Unknown',
        seriesInstanceUID: m.SeriesInstanceUID,
        sopInstanceUID: m.SOPInstanceUID,
        metadata: {
          method: m.method,
          derivation: m.derivation
        }
      })
    }
  }

  /**
   * Extract measurement from content item
   */
  private extractMeasurement(item: any): ReportMeasurement | null {
    try {
      const conceptName = this.getConceptName(item)
      let value = 0
      let unit = 'mm'

      // Extract numeric value
      if (item.MeasuredValueSequence && item.MeasuredValueSequence[0]) {
        const measured = item.MeasuredValueSequence[0]
        value = parseFloat(measured.NumericValue) || 0
        
        if (measured.MeasurementUnitsCodeSequence && measured.MeasurementUnitsCodeSequence[0]) {
          unit = measured.MeasurementUnitsCodeSequence[0].CodeMeaning || 'mm'
        }
      } else if (item.NumericValue) {
        value = parseFloat(item.NumericValue) || 0
      }

      return {
        id: this.generateId(),
        type: this.mapMeasurementType(conceptName),
        value,
        unit,
        location: this.extractLocation(item) || 'Unknown',
        metadata: {
          conceptName,
          valueType: item.ValueType
        }
      }
    } catch (error) {
      console.error('Error extracting measurement:', error)
      return null
    }
  }

  /**
   * Extract finding from content item
   */
  private extractFinding(item: any): ReportFinding | null {
    try {
      const conceptName = this.getConceptName(item)
      let description = ''

      if (item.TextValue) {
        description = item.TextValue
      } else if (item.ConceptCodeSequence && item.ConceptCodeSequence[0]) {
        description = item.ConceptCodeSequence[0].CodeMeaning || ''
      }

      return {
        id: this.generateId(),
        category: this.categorizeFinding(conceptName),
        description,
        location: this.extractLocation(item),
        severity: this.extractSeverity(item),
        metadata: {
          conceptName,
          code: this.extractCode(item)
        }
      }
    } catch (error) {
      console.error('Error extracting finding:', error)
      return null
    }
  }

  /**
   * Get concept name from item
   */
  private getConceptName(item: any): string {
    if (item.ConceptNameCodeSequence && item.ConceptNameCodeSequence[0]) {
      return item.ConceptNameCodeSequence[0].CodeMeaning || ''
    }
    return ''
  }

  /**
   * Check if item is a measurement
   */
  private isMeasurement(conceptName: string, valueType: string): boolean {
    const measurementKeywords = ['length', 'distance', 'diameter', 'area', 'volume', 'measurement']
    return valueType === 'NUM' || measurementKeywords.some(kw => 
      conceptName.toLowerCase().includes(kw)
    )
  }

  /**
   * Check if item is a finding
   */
  private isFinding(conceptName: string, valueType: string): boolean {
    const findingKeywords = ['finding', 'observation', 'impression', 'diagnosis']
    return findingKeywords.some(kw => conceptName.toLowerCase().includes(kw))
  }

  /**
   * Extract anatomical location
   */
  private extractLocation(item: any): string {
    if (item.AnatomicRegionSequence && item.AnatomicRegionSequence[0]) {
      return item.AnatomicRegionSequence[0].CodeMeaning || 'Unknown'
    }
    if (item.FindingSiteSequence && item.FindingSiteSequence[0]) {
      return item.FindingSiteSequence[0].CodeMeaning || 'Unknown'
    }
    return 'Unknown'
  }

  /**
   * Extract severity
   */
  private extractSeverity(item: any): 'normal' | 'mild' | 'moderate' | 'severe' | undefined {
    const text = (item.TextValue || '').toLowerCase()
    if (text.includes('severe')) return 'severe'
    if (text.includes('moderate')) return 'moderate'
    if (text.includes('mild')) return 'mild'
    if (text.includes('normal')) return 'normal'
    return undefined
  }

  /**
   * Extract code
   */
  private extractCode(item: any): string | undefined {
    if (item.ConceptCodeSequence && item.ConceptCodeSequence[0]) {
      return item.ConceptCodeSequence[0].CodeValue
    }
    return undefined
  }

  /**
   * Map measurement type
   */
  private mapMeasurementType(type: string): 'length' | 'area' | 'volume' | 'angle' | 'other' {
    const lowerType = type.toLowerCase()
    if (lowerType.includes('length') || lowerType.includes('distance') || lowerType.includes('diameter')) {
      return 'length'
    }
    if (lowerType.includes('area')) return 'area'
    if (lowerType.includes('volume')) return 'volume'
    if (lowerType.includes('angle')) return 'angle'
    return 'other'
  }

  /**
   * Categorize finding
   */
  private categorizeFinding(conceptName: string): string {
    const lower = conceptName.toLowerCase()
    if (lower.includes('normal')) return 'normal'
    if (lower.includes('abnormal') || lower.includes('pathology')) return 'abnormal'
    if (lower.includes('incidental')) return 'incidental'
    return 'observation'
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `sr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

export const dicomSRParser = new DICOMSRParser()
