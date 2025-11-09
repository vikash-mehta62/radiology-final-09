import axios, { AxiosError } from 'axios'

export interface ExportSession {
  id: string
  reportId: string
  userId: string
  userName?: string
  format: 'pdf' | 'dicom-sr' | 'fhir' | 'txt'
  status: 'initiated' | 'processing' | 'completed' | 'failed'
  progress: number
  fileUrl?: string
  fileSize?: number
  error?: string
  metadata?: {
    recipient?: string
    purpose?: string
    ipAddress?: string
  }
  createdAt: string
  completedAt?: string
}

export interface ExportMetadata {
  recipient?: string
  purpose?: string
  includeImages?: boolean
  includeSignature?: boolean
  watermark?: boolean
}

interface RetryOptions {
  maxRetries?: number
  retryDelay?: number
  backoffMultiplier?: number
}

interface ProgressCallback {
  (progress: number, status: string): void
}

class ExportService {
  private baseURL = '/api/reports'
  private readonly defaultRetryOptions: RetryOptions = {
    maxRetries: 3,
    retryDelay: 1000,
    backoffMultiplier: 2,
  }
  private progressCallbacks: Map<string, ProgressCallback> = new Map()

  /**
   * Retry wrapper with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const { maxRetries, retryDelay, backoffMultiplier } = {
      ...this.defaultRetryOptions,
      ...options,
    }

    let lastError: Error | null = null
    let delay = retryDelay!

    for (let attempt = 0; attempt <= maxRetries!; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error as Error
        
        // Don't retry on validation errors (4xx except 408, 429)
        if (axios.isAxiosError(error)) {
          const status = error.response?.status
          if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
            throw error
          }
        }
        
        if (attempt < maxRetries!) {
          console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`, error)
          await new Promise(resolve => setTimeout(resolve, delay))
          delay *= backoffMultiplier!
        }
      }
    }

    throw lastError || new Error('Operation failed after retries')
  }

  /**
   * Validate export request
   */
  private validateExportRequest(reportId: string, format: string): void {
    if (!reportId || reportId.trim() === '') {
      throw new Error('Report ID is required')
    }
    if (!['pdf', 'dicom-sr', 'fhir', 'txt'].includes(format)) {
      throw new Error('Invalid export format. Must be pdf, dicom-sr, fhir, or txt')
    }
  }

  /**
   * Register a progress callback for an export session
   */
  onProgress(exportId: string, callback: ProgressCallback): void {
    this.progressCallbacks.set(exportId, callback)
  }

  /**
   * Unregister a progress callback
   */
  offProgress(exportId: string): void {
    this.progressCallbacks.delete(exportId)
  }

  /**
   * Initiate an export with validation and retry logic
   */
  async initiateExport(
    reportId: string,
    format: 'pdf' | 'dicom-sr' | 'fhir' | 'txt',
    metadata?: ExportMetadata
  ): Promise<ExportSession> {
    // Validate input
    this.validateExportRequest(reportId, format)

    try {
      return await this.retryWithBackoff(async () => {
        let endpoint = ''
        switch (format) {
          case 'pdf':
            endpoint = `${this.baseURL}/${reportId}/export/pdf`
            break
          case 'dicom-sr':
            endpoint = `${this.baseURL}/${reportId}/export/dicom-sr`
            break
          case 'fhir':
            endpoint = `${this.baseURL}/${reportId}/export/fhir`
            break
          case 'txt':
            endpoint = `${this.baseURL}/${reportId}/export/txt`
            break
        }

        const response = await axios.post(endpoint, { metadata })
        return response.data.data || response.data
      })
    } catch (error) {
      console.error('Error initiating export:', error)
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.message
        throw new Error(`Failed to initiate export: ${message}`)
      }
      throw error
    }
  }

  /**
   * Get export status with progress tracking and retry logic
   */
  async getExportStatus(exportId: string): Promise<ExportSession> {
    if (!exportId || exportId.trim() === '') {
      throw new Error('Export ID is required')
    }

    try {
      return await this.retryWithBackoff(async () => {
        const response = await axios.get(`${this.baseURL}/export/status/${exportId}`)
        const session = response.data.data || response.data
        
        // Trigger progress callback if registered
        const callback = this.progressCallbacks.get(exportId)
        if (callback) {
          callback(session.progress, session.status)
        }
        
        return session
      })
    } catch (error) {
      console.error('Error fetching export status:', error)
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.message
        throw new Error(`Failed to fetch export status: ${message}`)
      }
      throw error
    }
  }

  /**
   * Poll export status until completion
   */
  async pollExportStatus(
    exportId: string,
    onProgress?: ProgressCallback,
    pollInterval: number = 2000,
    timeout: number = 300000 // 5 minutes
  ): Promise<ExportSession> {
    if (onProgress) {
      this.onProgress(exportId, onProgress)
    }

    const startTime = Date.now()

    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const session = await this.getExportStatus(exportId)

          if (session.status === 'completed') {
            this.offProgress(exportId)
            resolve(session)
            return
          }

          if (session.status === 'failed') {
            this.offProgress(exportId)
            reject(new Error(session.error || 'Export failed'))
            return
          }

          // Check timeout
          if (Date.now() - startTime > timeout) {
            this.offProgress(exportId)
            reject(new Error('Export timeout'))
            return
          }

          // Continue polling
          setTimeout(poll, pollInterval)
        } catch (error) {
          this.offProgress(exportId)
          reject(error)
        }
      }

      poll()
    })
  }

  /**
   * Download export file with retry logic
   */
  async downloadExport(exportId: string): Promise<void> {
    if (!exportId || exportId.trim() === '') {
      throw new Error('Export ID is required')
    }

    try {
      await this.retryWithBackoff(async () => {
        const response = await axios.get(`${this.baseURL}/export/download/${exportId}`, {
          responseType: 'blob'
        })

        // Get filename from Content-Disposition header
        const contentDisposition = response.headers['content-disposition']
        let filename = 'export.bin'
        
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
          if (filenameMatch && filenameMatch[1]) {
            filename = filenameMatch[1].replace(/['"]/g, '')
          }
        }

        // Create blob URL and trigger download
        const blob = new Blob([response.data])
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      })
    } catch (error) {
      console.error('Error downloading export:', error)
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.message
        throw new Error(`Failed to download export: ${message}`)
      }
      throw error
    }
  }

  /**
   * Cancel an export with retry logic
   */
  async cancelExport(exportId: string): Promise<void> {
    if (!exportId || exportId.trim() === '') {
      throw new Error('Export ID is required')
    }

    try {
      await this.retryWithBackoff(async () => {
        await axios.post(`${this.baseURL}/export/cancel/${exportId}`)
      })
      
      // Clean up progress callback
      this.offProgress(exportId)
    } catch (error) {
      console.error('Error canceling export:', error)
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.message
        throw new Error(`Failed to cancel export: ${message}`)
      }
      throw error
    }
  }

  /**
   * Get export history with retry logic
   */
  async getExportHistory(
    reportId?: string,
    userId?: string,
    limit: number = 10
  ): Promise<ExportSession[]> {
    try {
      return await this.retryWithBackoff(async () => {
        const params = new URLSearchParams()
        if (reportId) params.append('reportId', reportId)
        if (userId) params.append('userId', userId)
        if (limit) params.append('limit', limit.toString())

        const response = await axios.get(`${this.baseURL}/export/history?${params.toString()}`)
        return response.data.data || response.data
      })
    } catch (error) {
      console.error('Error fetching export history:', error)
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.message
        throw new Error(`Failed to fetch export history: ${message}`)
      }
      throw error
    }
  }

  /**
   * Validate an export with retry logic
   */
  async validateExport(exportId: string): Promise<{ valid: boolean; errors?: string[] }> {
    if (!exportId || exportId.trim() === '') {
      throw new Error('Export ID is required')
    }

    try {
      return await this.retryWithBackoff(async () => {
        const response = await axios.post(`${this.baseURL}/export/validate/${exportId}`)
        return response.data.data || response.data
      })
    } catch (error) {
      console.error('Error validating export:', error)
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.message
        throw new Error(`Failed to validate export: ${message}`)
      }
      throw error
    }
  }

  /**
   * Get export audit trail with retry logic
   */
  async getExportAuditTrail(exportId: string): Promise<any[]> {
    if (!exportId || exportId.trim() === '') {
      throw new Error('Export ID is required')
    }

    try {
      return await this.retryWithBackoff(async () => {
        const response = await axios.get(`${this.baseURL}/export/audit/${exportId}`)
        return response.data.data || response.data
      })
    } catch (error) {
      console.error('Error fetching export audit trail:', error)
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.message
        throw new Error(`Failed to fetch export audit trail: ${message}`)
      }
      throw error
    }
  }
}

export const exportService = new ExportService()
