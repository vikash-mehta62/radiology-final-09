/**
 * API Service for handling backend communication
 * Uses environment variables for proper URL configuration
 */

// Get backend URL from environment variables
const getBackendUrl = (): string => {
  // In development, use relative URLs to leverage Vite proxy
  if (import.meta.env && import.meta.env.DEV) {
    return '' // Use relative URLs for proxy
  }

  // In production, use environment variables
  const backendUrl = (import.meta.env && import.meta.env.VITE_BACKEND_URL) ||
    (import.meta.env && import.meta.env.REACT_APP_BACKEND_URL) ||
    (typeof process !== 'undefined' && process.env && process.env.REACT_APP_BACKEND_URL) ||
    'http://3.144.196.75:8001'

  return backendUrl
}

const BACKEND_URL = getBackendUrl()

/**
 * Get auth token from storage
 */
export const getAuthToken = (): string | null => {
  return localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')
}

/**
 * Get CSRF token from cookie
 */
export const getCSRFToken = (): string | null => {
  const name = 'XSRF-TOKEN';
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  
  if (parts.length === 2) {
    const token = parts.pop()?.split(';').shift();
    // Extract just the token value (before the signature)
    return token?.split('.')[0] || null;
  }
  
  return null;
}

/**
 * Make an API call to the backend
 */
export const apiCall = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const url = `${BACKEND_URL}${endpoint}`

  console.log(`API Call: ${options.method || 'GET'} ${url}`)

  // Get auth token
  const token = getAuthToken()
  
  // Get CSRF token for state-changing operations
  const csrfToken = getCSRFToken()

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Send cookies
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...(csrfToken && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method?.toUpperCase() || 'GET') && { 'X-XSRF-TOKEN': csrfToken }),
      ...options.headers,
    },
  })

  return response
}

/**
 * Upload files to backend
 */
export const uploadFile = async (
  endpoint: string,
  file: File
): Promise<Response> => {
  const url = `${BACKEND_URL}${endpoint}`

  console.log(`File Upload: POST ${url}`)

  const formData = new FormData()
  formData.append('file', file)

  // Get auth token
  const token = getAuthToken()

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
    credentials: 'include', // Send cookies
    headers: {
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
  })

  return response
}

/**
 * Get available studies
 */
export const getStudies = async () => {
  const response = await apiCall('/api/dicom/studies')
  return response.json()
}

/**
 * Get study metadata with series details
 */
export const getStudyMetadata = async (studyUID: string) => {
  const response = await apiCall(`/api/dicom/studies/${studyUID}/metadata`)
  return response.json()
}

/**
 * Get study detailed metadata
 */
export const getStudyDetailedMetadata = async (studyUID: string) => {
  const response = await apiCall(`/api/dicom/studies/${studyUID}/metadata`)
  return response.json()
}

/**
 * Upload DICOM file
 */
export const uploadDicomFile = async (file: File) => {
  const response = await uploadFile('/api/dicom/upload', file)
  return response.json()
}

/**
 * Upload ZIP file containing DICOM study
 * All DICOM files in ZIP are grouped under single StudyInstanceUID for 3D reconstruction
 */
export const uploadZipStudy = async (
  file: File,
  options?: {
    forceUnifiedStudy?: boolean
    patientID?: string
    patientName?: string
    onProgress?: (progress: number) => void
  }
) => {
  const url = `${BACKEND_URL}/api/dicom/upload/zip`
  const formData = new FormData()
  formData.append('file', file)

  if (options?.forceUnifiedStudy) {
    formData.append('forceUnifiedStudy', 'true')
  }
  if (options?.patientID) {
    formData.append('patientID', options.patientID)
  }
  if (options?.patientName) {
    formData.append('patientName', options.patientName)
  }

  console.log(`ZIP Upload: POST ${url}`)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    // Track upload progress
    if (options?.onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100)
          options.onProgress?.(progress)
        }
      })
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText)
          resolve(response)
        } catch (error) {
          reject(new Error('Failed to parse response'))
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText)
          reject(new Error(error.message || 'Upload failed'))
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`))
        }
      }
    })

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'))
    })

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload aborted'))
    })

    xhr.open('POST', url)
    xhr.send(formData)
  })
}

/**
 * Get ZIP upload capabilities and info
 */
export const getZipUploadInfo = async () => {
  const response = await apiCall('/api/dicom/upload/zip/info')
  return response.json()
}

/**
 * Get frame image URL
 */
export const getFrameImageUrl = (studyUID: string, frameIndex: number, seriesUID?: string): string => {
  if (seriesUID) {
    return `/api/dicom/studies/${studyUID}/series/${seriesUID}/frames/${frameIndex}`
  }
  return `/api/dicom/studies/${studyUID}/frames/${frameIndex}`
}

/**
 * Get patients list
 */
export const getPatients = async () => {
  const response = await apiCall('/api/patients')
  return response.json()
}

/**
 * Get studies for a patient
 */
export const getPatientStudies = async (patientID: string) => {
  const response = await apiCall(`/api/patients/${patientID}/studies`)
  return response.json()
}

export const createPatient = async (patient: { patientID?: string; patientName?: string; birthDate?: string; sex?: string }) => {
  const response = await apiCall('/api/patients', {
    method: 'POST',
    body: JSON.stringify(patient),
  })
  return response.json()
}

/**
 * Upload DICOM file for a specific patient (includes patient fields)
 */
export const uploadDicomFileForPatient = async (file: File, patientID: string, patientName?: string) => {
  const url = `${BACKEND_URL}/api/dicom/upload`
  const formData = new FormData()

  // Append file with explicit filename to preserve extension
  formData.append('file', file, file.name)
  formData.append('patientID', patientID)
  if (patientName) formData.append('patientName', patientName)

  const token = getAuthToken()

  console.log('📤 Uploading DICOM file:', {
    name: file.name,
    size: file.size,
    type: file.type
  })

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
    credentials: 'include',
    headers: {
      // Don't set Content-Type - let browser set it with boundary
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  })

  const result = await response.json()
  console.log('📥 Upload response:', result)
  return result
}

/**
 * Upload DICOM study files to PACS server
 * Supports multiple files for batch upload
 */
export const uploadPacsStudy = async (files: File[]) => {
  const url = `${BACKEND_URL}/api/pacs/upload`
  const formData = new FormData()

  // Append all files with 'dicom' field name (required by backend)
  files.forEach((file) => {
    formData.append('dicom', file)
  })

  const token = getAuthToken()

  console.log('📤 Uploading PACS study:', {
    fileCount: files.length,
    files: files.map(f => ({ name: f.name, size: f.size, type: f.type })),
    totalSize: files.reduce((sum, f) => sum + f.size, 0)
  })

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
    credentials: 'include',
    headers: {
      // Don't set Content-Type - let browser set it with boundary
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ PACS upload failed:', errorText)
    try {
      const errorJson = JSON.parse(errorText)
      throw new Error(errorJson.message || 'Upload failed')
    } catch {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
    }
  }

  const result = await response.json()
  console.log('📥 PACS upload response:', result)
  return result
}

/**
 * Orthanc Viewer API - Direct access to Orthanc data
 */

/**
 * Get all studies from Orthanc
 */
export const getOrthancStudies = async () => {
  const response = await apiCall('/api/viewer/studies')
  return response.json()
}

/**
 * Search studies in Orthanc
 */
export const searchOrthancStudies = async (query: string) => {
  const response = await apiCall(`/api/viewer/studies/search?q=${encodeURIComponent(query)}`)
  return response.json()
}

/**
 * Get study details from Orthanc
 */
export const getOrthancStudy = async (studyId: string) => {
  const response = await apiCall(`/api/viewer/studies/${studyId}`)
  return response.json()
}

/**
 * Get series details from Orthanc
 */
export const getOrthancSeries = async (seriesId: string) => {
  const response = await apiCall(`/api/viewer/series/${seriesId}`)
  return response.json()
}

/**
 * Get Orthanc statistics
 */
export const getOrthancStats = async () => {
  const response = await apiCall('/api/viewer/stats')
  return response.json()
}

/**
 * Get Orthanc instance preview URL
 */
export const getOrthancInstancePreviewUrl = (instanceId: string): string => {
  return `http://69.62.70.102:8042/instances/${instanceId}/preview`
}

/**
 * Get Orthanc instance image URL
 */
export const getOrthancInstanceImageUrl = (instanceId: string): string => {
  return `http://69.62.70.102:8042/instances/${instanceId}/image-uint8`
}

/**
 * Get Orthanc series preview URL
 */
export const getOrthancSeriesPreviewUrl = (seriesId: string): string => {
  return `http://69.62.70.102:8042/series/${seriesId}/preview`
}

/**
 * Medical AI API Methods (UNIFIED - All AI calls route through backend)
 */

/**
 * Analyze study with AI via backend (proxied to AI services)
 * This is the ONLY way to call AI services - no direct calls allowed
 */
export const analyzeStudyWithAI = async (
  studyInstanceUID: string,
  frameIndex: number = 0,
  patientContext?: any,
  imageData?: string
) => {
  const response = await apiCall('/api/ai/analyze', {
    method: 'POST',
    body: JSON.stringify({
      studyInstanceUID,
      frameIndex,
      patientContext,
      imageData
    })
  })
  return response.json()
}

/**
 * Classify image with MedSigLIP
 */
export const classifyImageWithAI = async (
  studyInstanceUID: string,
  frameIndex: number = 0
) => {
  const response = await apiCall('/api/medical-ai/classify-image', {
    method: 'POST',
    body: JSON.stringify({
      studyInstanceUID,
      frameIndex
    })
  })
  return response.json()
}

/**
 * Generate radiology report with MedGemma
 */
export const generateAIReport = async (
  studyInstanceUID: string,
  frameIndex: number = 0,
  patientContext?: any
) => {
  const response = await apiCall('/api/medical-ai/generate-report', {
    method: 'POST',
    body: JSON.stringify({
      studyInstanceUID,
      frameIndex,
      patientContext
    })
  })
  return response.json()
}

/**
 * Find similar images using MedSigLIP
 */
export const findSimilarImages = async (
  studyInstanceUID: string,
  frameIndex: number = 0,
  topK: number = 5
) => {
  const response = await apiCall('/api/medical-ai/find-similar', {
    method: 'POST',
    body: JSON.stringify({
      studyInstanceUID,
      frameIndex,
      topK
    })
  })
  return response.json()
}

/**
 * Summarize medical text with MedGemma
 */
export const summarizeMedicalText = async (
  text: string,
  summaryType: 'brief' | 'detailed' | 'bullet_points' = 'brief'
) => {
  const response = await apiCall('/api/medical-ai/summarize-text', {
    method: 'POST',
    body: JSON.stringify({
      text,
      summaryType
    })
  })
  return response.json()
}

/**
 * Get saved AI analysis for a study
 */
export const getStudyAIAnalysis = async (studyInstanceUID: string) => {
  const response = await apiCall(`/api/medical-ai/study/${studyInstanceUID}/analysis`)
  return response.json()
}

/**
 * Check AI services health
 */
export const checkAIHealth = async () => {
  const response = await apiCall('/api/medical-ai/health')
  return response.json()
}

/**
 * Export API Methods
 */

/**
 * Export patient data with all studies and DICOM files
 */
export const exportPatientData = async (
  patientID: string,
  includeImages: boolean = true,
  format: 'zip' | 'json' = 'zip'
) => {
  const url = `${BACKEND_URL}/api/export/patient/${patientID}?includeImages=${includeImages}&format=${format}`
  const token = getAuthToken()

  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  })

  if (!response.ok) {
    throw new Error('Export failed')
  }

  // Download the file
  const blob = await response.blob()
  const downloadUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = `patient_${patientID}_export.${format}`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(downloadUrl)

  return { success: true }
}

/**
 * Export study data with DICOM files
 */
export const exportStudyData = async (
  studyUID: string,
  includeImages: boolean = true,
  format: 'zip' | 'json' = 'zip'
) => {
  const url = `${BACKEND_URL}/api/export/study/${studyUID}?includeImages=${includeImages}&format=${format}`
  const token = getAuthToken()

  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  })

  if (!response.ok) {
    throw new Error('Export failed')
  }

  // Download the file
  const blob = await response.blob()
  const downloadUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = `study_${studyUID}_export.${format}`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(downloadUrl)

  return { success: true }
}

/**
 * Export all data (bulk export)
 */
export const exportAllData = async (includeImages: boolean = false) => {
  const url = `${BACKEND_URL}/api/export/all?includeImages=${includeImages}`
  const token = getAuthToken()

  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  })

  if (!response.ok) {
    throw new Error('Export failed')
  }

  // Download the file
  const blob = await response.blob()
  const downloadUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = `complete_export.zip`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(downloadUrl)

  return { success: true }
}

export default {
  apiCall,
  uploadFile,
  getStudies,
  getStudyMetadata,
  getStudyDetailedMetadata,
  uploadDicomFile,
  uploadZipStudy,
  getZipUploadInfo,
  getFrameImageUrl,
  getPatients,
  getPatientStudies,
  createPatient,
  uploadDicomFileForPatient,
  uploadPacsStudy,
  // Orthanc Viewer API
  getOrthancStudies,
  searchOrthancStudies,
  getOrthancStudy,
  getOrthancSeries,
  getOrthancStats,
  getOrthancInstancePreviewUrl,
  getOrthancInstanceImageUrl,
  getOrthancSeriesPreviewUrl,
  // Medical AI API
  analyzeStudyWithAI,
  classifyImageWithAI,
  generateAIReport,
  findSimilarImages,
  summarizeMedicalText,
  getStudyAIAnalysis,
  checkAIHealth,
  // Export API
  exportPatientData,
  exportStudyData,
  exportAllData,
  // Follow-up API
  getFollowUps: async (filters = {}) => {
    const response = await apiCall('/api/follow-ups', {
      method: 'GET',
    })
    return response.json()
  },
  getFollowUp: async (id: string) => {
    const response = await apiCall(`/api/follow-ups/${id}`)
    return response.json()
  },
  createFollowUp: async (data: any) => {
    const response = await apiCall('/api/follow-ups', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return response.json()
  },
  updateFollowUp: async (id: string, data: any) => {
    const response = await apiCall(`/api/follow-ups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    return response.json()
  },
  deleteFollowUp: async (id: string) => {
    const response = await apiCall(`/api/follow-ups/${id}`, {
      method: 'DELETE',
    })
    return response.json()
  },
  scheduleFollowUp: async (id: string, scheduledDate: string) => {
    const response = await apiCall(`/api/follow-ups/${id}/schedule`, {
      method: 'POST',
      body: JSON.stringify({ scheduledDate }),
    })
    return response.json()
  },
  completeFollowUp: async (id: string) => {
    const response = await apiCall(`/api/follow-ups/${id}/complete`, {
      method: 'POST',
    })
    return response.json()
  },
  addFollowUpNote: async (id: string, text: string) => {
    const response = await apiCall(`/api/follow-ups/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    })
    return response.json()
  },
  getOverdueFollowUps: async () => {
    const response = await apiCall('/api/follow-ups/overdue')
    return response.json()
  },
  getUpcomingFollowUps: async (days = 7) => {
    const response = await apiCall(`/api/follow-ups/upcoming?days=${days}`)
    return response.json()
  },
  getFollowUpStatistics: async () => {
    const response = await apiCall('/api/follow-ups/statistics')
    return response.json()
  },
  generateFollowUpFromReport: async (reportId: string) => {
    const response = await apiCall(`/api/follow-ups/generate/${reportId}`, {
      method: 'POST',
    })
    return response.json()
  },
  getFollowUpRecommendations: async (reportId: string) => {
    const response = await apiCall(`/api/follow-ups/recommendations/${reportId}`)
    return response.json()
  },
  // User Management API
  getUsers: async () => {
    const response = await apiCall('/api/users')
    return response.json()
  },
  getUser: async (id: string) => {
    const response = await apiCall(`/api/users/${id}`)
    return response.json()
  },
  createUser: async (userData: any) => {
    const response = await apiCall('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    })
    return response.json()
  },
  updateUser: async (id: string, userData: any) => {
    const response = await apiCall(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    })
    return response.json()
  },
  deleteUser: async (id: string) => {
    const response = await apiCall(`/api/users/${id}`, {
      method: 'DELETE',
    })
    return response.json()
  },
  toggleUserStatus: async (id: string) => {
    const response = await apiCall(`/api/users/${id}/toggle-status`, {
      method: 'POST',
    })
    return response.json()
  },
  resetUserPassword: async (id: string, newPassword: string) => {
    const response = await apiCall(`/api/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    })
    return response.json()
  },
  // Prior Authorization API
  getPriorAuths: async (filters?: any) => {
    const queryParams = new URLSearchParams(filters).toString()
    const response = await apiCall(`/api/prior-auth${queryParams ? `?${queryParams}` : ''}`)
    return response.json()
  },
  getPriorAuth: async (id: string) => {
    const response = await apiCall(`/api/prior-auth/${id}`)
    return response.json()
  },
  createPriorAuth: async (data: any) => {
    const response = await apiCall('/api/prior-auth', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return response.json()
  },
  updatePriorAuth: async (id: string, data: any) => {
    const response = await apiCall(`/api/prior-auth/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    return response.json()
  },
  approvePriorAuth: async (id: string, notes?: string) => {
    const response = await apiCall(`/api/prior-auth/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reviewNotes: notes }),
    })
    return response.json()
  },
  denyPriorAuth: async (id: string, reason: string, notes?: string) => {
    const response = await apiCall(`/api/prior-auth/${id}/deny`, {
      method: 'POST',
      body: JSON.stringify({ denialReason: reason, reviewNotes: notes }),
    })
    return response.json()
  },
  requestMoreInfo: async (id: string, requestedInfo: string) => {
    const response = await apiCall(`/api/prior-auth/${id}/request-info`, {
      method: 'POST',
      body: JSON.stringify({ requestedInfo }),
    })
    return response.json()
  },
  addPriorAuthNote: async (id: string, note: string) => {
    const response = await apiCall(`/api/prior-auth/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    })
    return response.json()
  },
  getPriorAuthStats: async () => {
    const response = await apiCall('/api/prior-auth/stats/dashboard')
    return response.json()
  },
  uploadPriorAuthDocument: async (id: string, file: File) => {
    const response = await uploadFile(`/api/prior-auth/${id}/documents`, file)
    return response.json()
  },
}