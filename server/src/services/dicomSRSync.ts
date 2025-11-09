import axios from 'axios'
import { dicomSRParser } from './dicomSRParser'
import type { ReportMeasurement, ReportFinding } from '@medical-imaging/shared-types'

interface SyncResult {
  success: boolean
  measurementsAdded: number
  findingsAdded: number
  error?: string
}

/**
 * Service to sync DICOM SR data from Orthanc to reporting system
 */
export class DICOMSRSyncService {
  private orthancUrl: string

  constructor(orthancUrl: string = process.env.ORTHANC_URL || 'http://localhost:8042') {
    this.orthancUrl = orthancUrl
  }

  /**
   * Sync DICOM SR data from Orthanc for a study
   */
  async syncStudySR(studyInstanceUID: string): Promise<{
    measurements: ReportMeasurement[]
    findings: ReportFinding[]
    annotations: Array<{ type: string; text: string; location?: string }>
  }> {
    try {
      console.log(`🔄 Syncing DICOM SR for study: ${studyInstanceUID}`)

      // 1. Search for SR instances in the study
      const srInstances = await this.findSRInstances(studyInstanceUID)
      
      if (srInstances.length === 0) {
        console.log('ℹ️ No DICOM SR instances found for study')
        return { measurements: [], findings: [], annotations: [] }
      }

      console.log(`📋 Found ${srInstances.length} SR instance(s)`)

      // 2. Parse all SR instances
      const allMeasurements: ReportMeasurement[] = []
      const allFindings: ReportFinding[] = []
      const allAnnotations: Array<{ type: string; text: string; location?: string }> = []

      for (const instanceId of srInstances) {
        const srData = await this.fetchSRInstance(instanceId)
        const parsed = dicomSRParser.parseSRInstance(srData)
        
        allMeasurements.push(...parsed.measurements)
        allFindings.push(...parsed.findings)
        allAnnotations.push(...parsed.annotations)
      }

      console.log(`✅ Parsed ${allMeasurements.length} measurements, ${allFindings.length} findings`)

      return {
        measurements: allMeasurements,
        findings: allFindings,
        annotations: allAnnotations
      }
    } catch (error: any) {
      console.error('❌ Error syncing DICOM SR:', error)
      throw new Error(`Failed to sync DICOM SR: ${error.message}`)
    }
  }

  /**
   * Find SR instances for a study using DICOMweb
   */
  private async findSRInstances(studyInstanceUID: string): Promise<string[]> {
    try {
      // Try DICOMweb QIDO-RS first
      const response = await axios.get(
        `${this.orthancUrl}/dicom-web/studies/${studyInstanceUID}/instances`,
        {
          params: {
            Modality: 'SR'
          },
          headers: {
            'Accept': 'application/dicom+json'
          }
        }
      )

      if (response.data && Array.isArray(response.data)) {
        return response.data.map((instance: any) => {
          // Extract Orthanc instance ID from DICOMweb response
          const sopInstanceUID = instance['00080018']?.Value?.[0]
          return sopInstanceUID
        }).filter(Boolean)
      }

      return []
    } catch (error) {
      console.log('⚠️ DICOMweb search failed, trying Orthanc REST API')
      return this.findSRInstancesOrthancAPI(studyInstanceUID)
    }
  }

  /**
   * Find SR instances using Orthanc REST API
   */
  private async findSRInstancesOrthancAPI(studyInstanceUID: string): Promise<string[]> {
    try {
      // Find study by StudyInstanceUID
      const studiesResponse = await axios.post(
        `${this.orthancUrl}/tools/find`,
        {
          Level: 'Study',
          Query: {
            StudyInstanceUID: studyInstanceUID
          }
        }
      )

      if (!studiesResponse.data || studiesResponse.data.length === 0) {
        return []
      }

      const orthancStudyId = studiesResponse.data[0]

      // Get all instances in the study
      const studyResponse = await axios.get(
        `${this.orthancUrl}/studies/${orthancStudyId}`
      )

      const instances: string[] = []

      // Check each series for SR modality
      for (const seriesId of studyResponse.data.Series || []) {
        const seriesResponse = await axios.get(
          `${this.orthancUrl}/series/${seriesId}`
        )

        if (seriesResponse.data.MainDicomTags?.Modality === 'SR') {
          instances.push(...(seriesResponse.data.Instances || []))
        }
      }

      return instances
    } catch (error: any) {
      console.error('Error finding SR instances via Orthanc API:', error.message)
      return []
    }
  }

  /**
   * Fetch SR instance data from Orthanc
   */
  private async fetchSRInstance(instanceId: string): Promise<any> {
    try {
      // Try to get simplified JSON first
      const response = await axios.get(
        `${this.orthancUrl}/instances/${instanceId}/simplified-tags`
      )
      return response.data
    } catch (error) {
      // Fallback to full tags
      const response = await axios.get(
        `${this.orthancUrl}/instances/${instanceId}/tags?simplify`
      )
      return response.data
    }
  }

  /**
   * Sync SR data to a specific report
   */
  async syncToReport(
    reportId: string,
    studyInstanceUID: string,
    mergeStrategy: 'replace' | 'append' = 'append'
  ): Promise<SyncResult> {
    try {
      // Get SR data from Orthanc
      const srData = await this.syncStudySR(studyInstanceUID)

      if (srData.measurements.length === 0 && srData.findings.length === 0) {
        return {
          success: true,
          measurementsAdded: 0,
          findingsAdded: 0
        }
      }

      // Update report via API
      // Note: This assumes you have a report update endpoint
      // You'll need to implement this in your reports router
      const updateData: any = {}

      if (mergeStrategy === 'replace') {
        updateData.measurements = srData.measurements
        updateData.findings = srData.findings
      } else {
        // Append mode - merge with existing data
        updateData.$push = {
          measurements: { $each: srData.measurements },
          findings: { $each: srData.findings }
        }
      }

      return {
        success: true,
        measurementsAdded: srData.measurements.length,
        findingsAdded: srData.findings.length
      }
    } catch (error: any) {
      return {
        success: false,
        measurementsAdded: 0,
        findingsAdded: 0,
        error: error.message
      }
    }
  }
}

export const dicomSRSync = new DICOMSRSyncService()
