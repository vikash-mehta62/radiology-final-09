import { useState, useCallback } from 'react'
import axios from 'axios'

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

export interface UseExportReturn {
  exportSession: ExportSession | null
  loading: boolean
  error: string | null
  initiateExport: (reportId: string, format: 'pdf' | 'dicom-sr' | 'fhir' | 'txt', metadata?: any) => Promise<ExportSession>
  getExportStatus: (exportId: string) => Promise<ExportSession>
  downloadExport: (exportId: string) => Promise<void>
  cancelExport: (exportId: string) => Promise<void>
  getExportHistory: (reportId?: string, userId?: string, limit?: number) => Promise<ExportSession[]>
  clearError: () => void
}

export const useExport = (): UseExportReturn => {
  const [exportSession, setExportSession] = useState<ExportSession | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initiateExport = useCallback(async (
    reportId: string,
    format: 'pdf' | 'dicom-sr' | 'fhir' | 'txt',
    metadata?: any
  ): Promise<ExportSession> => {
    setLoading(true)
    setError(null)

    try {
      let endpoint = ''
      switch (format) {
        case 'pdf':
          endpoint = `/api/reports/${reportId}/export/pdf`
          break
        case 'dicom-sr':
          endpoint = `/api/reports/${reportId}/export/dicom-sr`
          break
        case 'fhir':
          endpoint = `/api/reports/${reportId}/export/fhir`
          break
        case 'txt':
          endpoint = `/api/reports/${reportId}/export/txt`
          break
        default:
          throw new Error(`Unsupported export format: ${format}`)
      }

      const response = await axios.post(endpoint, { metadata })

      const session = response.data.data || response.data
      setExportSession(session)
      return session
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to initiate export'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  const getExportStatus = useCallback(async (
    exportId: string
  ): Promise<ExportSession> => {
    try {
      const response = await axios.get(`/api/reports/export/status/${exportId}`)

      const session = response.data.data || response.data
      setExportSession(session)
      return session
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to get export status'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [])

  const downloadExport = useCallback(async (
    exportId: string
  ): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      const response = await axios.get(`/api/reports/export/download/${exportId}`, {
        responseType: 'blob'
      })

      // Get filename from Content-Disposition header or use default
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
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to download export'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  const cancelExport = useCallback(async (
    exportId: string
  ): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      await axios.post(`/api/reports/export/cancel/${exportId}`)

      // Update local state
      if (exportSession && exportSession.id === exportId) {
        setExportSession({
          ...exportSession,
          status: 'failed',
          error: 'Cancelled by user'
        })
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to cancel export'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [exportSession])

  const getExportHistory = useCallback(async (
    reportId?: string,
    userId?: string,
    limit: number = 10
  ): Promise<ExportSession[]> => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (reportId) params.append('reportId', reportId)
      if (userId) params.append('userId', userId)
      if (limit) params.append('limit', limit.toString())

      const response = await axios.get(`/api/reports/export/history?${params.toString()}`)

      return response.data.data || response.data
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to get export history'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    exportSession,
    loading,
    error,
    initiateExport,
    getExportStatus,
    downloadExport,
    cancelExport,
    getExportHistory,
    clearError
  }
}
