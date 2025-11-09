import axios, { AxiosResponse } from 'axios'
import type {
  FHIRPatient,
  FHIRDiagnosticReport,
  FHIRServiceRequest,
  FHIRObservation,
  FHIRTask,
  PatientContext,
  FHIRBundle,
  FHIRSearchParams,
} from '@medical-imaging/shared-types'

class FHIRService {
  private baseURL = '/api/fhir'

  /**
   * Get patient demographics by patient ID
   */
  async getPatient(patientId: string): Promise<FHIRPatient | null> {
    try {
      const response: AxiosResponse<{ success: boolean; data: FHIRPatient }> = await axios.get(
        `${this.baseURL}/Patient/${patientId}`
      )
      return response.data.data
    } catch (error) {
      console.error('Failed to fetch patient:', error)
      return null
    }
  }

  /**
   * Search for patients by various criteria
   */
  async searchPatients(params: {
    name?: string
    identifier?: string
    birthdate?: string
    gender?: string
  }): Promise<FHIRPatient[]> {
    try {
      const searchParams: FHIRSearchParams = {}
      
      if (params.name) searchParams.name = params.name
      if (params.identifier) searchParams.identifier = params.identifier
      if (params.birthdate) searchParams.birthdate = params.birthdate
      if (params.gender) searchParams.gender = params.gender

      const response: AxiosResponse<{ success: boolean; data: FHIRBundle<FHIRPatient> }> = await axios.get(
        `${this.baseURL}/Patient`,
        { params: searchParams }
      )
      
      return response.data.data.entry?.map(entry => entry.resource) || []
    } catch (error) {
      console.error('Failed to search patients:', error)
      return []
    }
  }

  /**
   * Get diagnostic reports for a patient
   */
  async getDiagnosticReports(patientId: string, params?: {
    category?: string
    date?: string
    status?: string
  }): Promise<FHIRDiagnosticReport[]> {
    try {
      const searchParams: FHIRSearchParams = {
        subject: `Patient/${patientId}`,
        _sort: '-date',
        _count: 50,
      }
      
      if (params?.category) searchParams.category = params.category
      if (params?.date) searchParams.date = params.date
      if (params?.status) searchParams.status = params.status

      const response: AxiosResponse<{ success: boolean; data: FHIRBundle<FHIRDiagnosticReport> }> = await axios.get(
        `${this.baseURL}/DiagnosticReport`,
        { params: searchParams }
      )
      
      return response.data.data.entry?.map(entry => entry.resource) || []
    } catch (error) {
      console.error('Failed to fetch diagnostic reports:', error)
      return []
    }
  }

  /**
   * Get service requests (imaging orders) for a patient
   */
  async getServiceRequests(patientId: string, params?: {
    category?: string
    status?: string
    intent?: string
  }): Promise<FHIRServiceRequest[]> {
    try {
      const searchParams: FHIRSearchParams = {
        subject: `Patient/${patientId}`,
        _sort: '-authored',
        _count: 20,
      }
      
      if (params?.category) searchParams.category = params.category
      if (params?.status) searchParams.status = params.status
      if (params?.intent) searchParams.intent = params.intent

      const response: AxiosResponse<{ success: boolean; data: FHIRBundle<FHIRServiceRequest> }> = await axios.get(
        `${this.baseURL}/ServiceRequest`,
        { params: searchParams }
      )
      
      return response.data.data.entry?.map(entry => entry.resource) || []
    } catch (error) {
      console.error('Failed to fetch service requests:', error)
      return []
    }
  }

  /**
   * Get observations for a patient
   */
  async getObservations(patientId: string, params?: {
    category?: string
    code?: string
    date?: string
  }): Promise<FHIRObservation[]> {
    try {
      const searchParams: FHIRSearchParams = {
        subject: `Patient/${patientId}`,
        _sort: '-date',
        _count: 100,
      }
      
      if (params?.category) searchParams.category = params.category
      if (params?.code) searchParams.code = params.code
      if (params?.date) searchParams.date = params.date

      const response: AxiosResponse<{ success: boolean; data: FHIRBundle<FHIRObservation> }> = await axios.get(
        `${this.baseURL}/Observation`,
        { params: searchParams }
      )
      
      return response.data.data.entry?.map(entry => entry.resource) || []
    } catch (error) {
      console.error('Failed to fetch observations:', error)
      return []
    }
  }

  /**
   * Get tasks for a patient (worklist items)
   */
  async getTasks(patientId?: string, params?: {
    status?: string
    priority?: string
    code?: string
  }): Promise<FHIRTask[]> {
    try {
      const searchParams: FHIRSearchParams = {
        _sort: '-authored-on',
        _count: 50,
      }
      
      if (patientId) searchParams.for = `Patient/${patientId}`
      if (params?.status) searchParams.status = params.status
      if (params?.priority) searchParams.priority = params.priority
      if (params?.code) searchParams.code = params.code

      const response: AxiosResponse<{ success: boolean; data: FHIRBundle<FHIRTask> }> = await axios.get(
        `${this.baseURL}/Task`,
        { params: searchParams }
      )
      
      return response.data.data.entry?.map(entry => entry.resource) || []
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
      return []
    }
  }

  /**
   * Get complete patient context (aggregated data)
   */
  async getPatientContext(patientId: string): Promise<PatientContext | null> {
    try {
      const response: AxiosResponse<{ success: boolean; data: PatientContext }> = await axios.get(
        `${this.baseURL}/Patient/${patientId}/context`
      )
      return response.data.data
    } catch (error) {
      console.error('Failed to fetch patient context:', error)
      
      // Fallback: fetch data individually
      try {
        const [patient, diagnosticReports, serviceRequests, observations, tasks] = await Promise.all([
          this.getPatient(patientId),
          this.getDiagnosticReports(patientId),
          this.getServiceRequests(patientId),
          this.getObservations(patientId),
          this.getTasks(patientId),
        ])

        if (!patient) return null

        return {
          patient,
          diagnosticReports,
          serviceRequests,
          observations,
          tasks,
        }
      } catch (fallbackError) {
        console.error('Failed to fetch patient context (fallback):', fallbackError)
        return null
      }
    }
  }

  /**
   * Create a new diagnostic report
   */
  async createDiagnosticReport(reportData: Partial<FHIRDiagnosticReport>): Promise<FHIRDiagnosticReport | null> {
    try {
      const response: AxiosResponse<{ success: boolean; data: FHIRDiagnosticReport }> = await axios.post(
        `${this.baseURL}/DiagnosticReport`,
        reportData
      )
      return response.data.data
    } catch (error) {
      console.error('Failed to create diagnostic report:', error)
      return null
    }
  }

  /**
   * Update an existing diagnostic report
   */
  async updateDiagnosticReport(reportId: string, reportData: Partial<FHIRDiagnosticReport>): Promise<FHIRDiagnosticReport | null> {
    try {
      const response: AxiosResponse<{ success: boolean; data: FHIRDiagnosticReport }> = await axios.put(
        `${this.baseURL}/DiagnosticReport/${reportId}`,
        reportData
      )
      return response.data.data
    } catch (error) {
      console.error('Failed to update diagnostic report:', error)
      return null
    }
  }

  /**
   * Get imaging studies for a patient
   */
  async getImagingStudies(patientId: string, params?: {
    modality?: string
    started?: string
    status?: string
  }): Promise<any[]> {
    try {
      const searchParams: FHIRSearchParams = {
        subject: `Patient/${patientId}`,
        _sort: '-started',
        _count: 50,
      }
      
      if (params?.modality) searchParams.modality = params.modality
      if (params?.started) searchParams.started = params.started
      if (params?.status) searchParams.status = params.status

      const response: AxiosResponse<{ success: boolean; data: FHIRBundle<any> }> = await axios.get(
        `${this.baseURL}/ImagingStudy`,
        { params: searchParams }
      )
      
      return response.data.data.entry?.map(entry => entry.resource) || []
    } catch (error) {
      console.error('Failed to fetch imaging studies:', error)
      return []
    }
  }

  /**
   * Get study context by study instance UID
   */
  async getStudyContext(studyInstanceUID: string): Promise<any> {
    try {
      const response: AxiosResponse<{ success: boolean; data: any }> = await axios.get(
        `${this.baseURL}/ImagingStudy/context/${studyInstanceUID}`
      )
      return response.data.data
    } catch (error) {
      console.error('Failed to fetch study context:', error)
      return null
    }
  }
}

// Export singleton instance
export const fhirService = new FHIRService()
export default fhirService
    