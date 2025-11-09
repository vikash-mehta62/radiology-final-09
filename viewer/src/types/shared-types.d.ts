// Shared types module declaration
declare module '@medical-imaging/shared-types' {
  export interface StructuredReport {
    id: string
    studyInstanceUID: string
    patientId: string
    reportType: string
    findings: Finding[]
    measurements: Measurement[]
    impressions: string
    impression?: string
    recommendations?: string
    sections?: ReportSection[]
    reportStatus?: ReportStatus
    reportDate?: string
    priority?: string
    finalizedAt?: string
    signedAt?: string
    createdAt: string
    updatedAt: string
    createdBy: string
    status: 'draft' | 'final' | 'amended' | 'in_progress'
  }

  export interface Finding {
    id: string
    category: string
    description: string
    severity: 'low' | 'medium' | 'high'
    location?: string
    confidence?: number
    aiGenerated?: boolean
    aiModelName?: string
    aiConfidence?: number
  }

  export interface Measurement {
    id: string
    type: string
    value: number
    unit: string
    location?: string
    seriesInstanceUID?: string
    imageInstanceUID?: string
    name?: string
    aiGenerated?: boolean
  }

  export type ReportStatus = 'draft' | 'in_progress' | 'final' | 'amended' | 'signed'
  export type FindingSeverity = 'low' | 'medium' | 'high' | 'critical' | 'normal' | 'mild' | 'moderate' | 'severe'
  
  export interface AnatomicalLocation {
    code: string
    display: string
    system?: string
    bodyPart?: string
    laterality?: string
    region?: string
  }

  export interface ReportFinding {
    id: string
    type?: string
    category: string
    description: string
    severity: FindingSeverity
    location?: AnatomicalLocation
    confidence?: number
    aiGenerated?: boolean
    aiModelName?: string
    aiConfidence?: number
    snomedCode?: string
    radlexCode?: string
  }

  export interface ReportMeasurement {
    id: string
    name?: string
    type: string
    value: number
    unit: string
    method?: string
    normalRange?: string
    location?: AnatomicalLocation
    seriesInstanceUID?: string
    imageInstanceUID?: string
    aiGenerated?: boolean
  }

  export interface ReportTemplate {
    id: string
    name: string
    description?: string
    sections: ReportSection[]
    modality?: string
    specialty?: string
  }

  export interface ReportSection {
    id: string
    title: string
    fields: ReportField[]
    order: number
  }

  export interface ReportField {
    id: string
    label: string
    type: 'text' | 'textarea' | 'select' | 'multiselect' | 'number' | 'date'
    required?: boolean
    options?: string[]
    defaultValue?: any
  }

  export interface ReportSectionData {
    sectionId: string
    data: Record<string, any>
  }

  export interface ReportComparison {
    previousReport: StructuredReport
    currentReport: StructuredReport
    differences: ReportDifference[]
  }

  export interface ReportDifference {
    field: string
    previousValue: any
    currentValue: any
    type: 'added' | 'removed' | 'modified'
  }

  export interface PatientContext {
    patientId: string
    patientName: string
    patientBirthDate: string
    patientSex: string
    studyInstanceUID: string
    studyDate: string
    studyDescription: string
    modality: string
    serviceRequests?: any[]
  }

  export interface DiagnosticReport {
    id: string
    status: string
    code: {
      coding: Array<{
        system: string
        code: string
        display: string
      }>
    }
    subject: {
      reference: string
    }
    effectiveDateTime: string
    issued: string
    performer: Array<{
      reference: string
    }>
    conclusion?: string
    conclusionCode?: Array<{
      coding: Array<{
        system: string
        code: string
        display: string
      }>
    }>
  }

  export interface Observation {
    id: string
    status: string
    code: {
      coding: Array<{
        system: string
        code: string
        display: string
      }>
    }
    subject: {
      reference: string
    }
    effectiveDateTime: string
    valueString?: string
    valueQuantity?: {
      value: number
      unit: string
    }
  }

  export interface ImagingStudy {
    id: string
    status: string
    subject: {
      reference: string
    }
    started: string
    numberOfSeries: number
    numberOfInstances: number
    series: Array<{
      uid: string
      number: number
      modality: {
        system: string
        code: string
      }
      numberOfInstances: number
    }>
  }

  export interface Patient {
    id: string
    identifier: Array<{
      system: string
      value: string
    }>
    name: Array<{
      family: string
      given: string[]
    }>
    gender: string
    birthDate: string
  }

  export interface Condition {
    id: string
    clinicalStatus: {
      coding: Array<{
        system: string
        code: string
      }>
    }
    code: {
      coding: Array<{
        system: string
        code: string
        display: string
      }>
    }
    subject: {
      reference: string
    }
    onsetDateTime?: string
  }
}
