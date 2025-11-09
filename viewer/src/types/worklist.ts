export interface Study {
  studyInstanceUID: string
  studyDate: string
  studyTime: string
  studyDescription: string
  patientName: string
  patientID: string
  patientBirthDate: string
  patientSex: string
  modality: string
  numberOfSeries: number
  numberOfInstances: number
  priority: string
  status: string
  aiStatus: string
  assignedTo?: string
  accessionNumber?: string
  createdAt?: string
  updatedAt?: string
}

export interface WorklistResponse {
  studies: Study[]
  total: number
  page: number
  pageSize: number
}

export interface WorklistFilters {
  modalities: string[]
  dateRange: {
    start: string | null
    end: string | null
  }
  priorities: string[]
  statuses: string[]
  aiStatus: string[]
}

export interface SortOptions {
  field: string
  direction: 'asc' | 'desc'
}

export interface AIFinding {
  id: string
  type: string
  description: string
  confidence: number
  location?: string
  severity?: 'low' | 'medium' | 'high' | 'critical' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  measurements?: Record<string, any>
  boundingBox?: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface AIResult {
  id: string
  studyInstanceUID: string
  seriesInstanceUID?: string
  imageInstanceUID?: string
  modelName: string
  modelVersion: string
  findings: AIFinding[]
  overallConfidence: number
  confidence?: number
  processingTime: number
  createdAt: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
}