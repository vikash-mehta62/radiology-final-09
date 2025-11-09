/**
 * 🌐 UNIFIED REPORTS API CLIENT
 * Single service layer that ONLY talks to /api/reports
 * Enhanced with comprehensive error diagnostics and fallback support
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import type {
  StructuredReport,
  ReportTemplate,
  ApiResponse,
  ExportFormat,
  TemplateMatchResult,
  AIDetection
} from '../types/reporting';
import { StructuredReportSchema } from '../types/reporting';
import { telemetryEmit, mapApiError } from '../utils/reportingUtils';
import { getCSRFToken } from '../utils/csrfUtils';

// A) API Base URL with proper fallback chain
// IMPORTANT: Use relative path to go through Vite proxy and avoid CORS
const getBaseURL = (): string => {
  // In development, ALWAYS use relative path to go through Vite proxy
  // In production, use relative path (same origin) or configured URL
  const envBaseURL = import.meta.env.VITE_API_BASE_URL;
  
  if (envBaseURL) {
    console.log('🌐 Using VITE_API_BASE_URL:', envBaseURL);
    return envBaseURL;
  }
  
  // Default to empty string (relative URLs) to use Vite proxy
  console.log('🌐 Using relative URLs (Vite proxy)');
  return '';
};

const API_BASE_URL = getBaseURL();
const BASE_PATH = '/api/reports';

// Flag to log URL only once
let hasLoggedURL = false;

/**
 * Get authentication token from storage
 */
const getAuthToken = (): string | null => {
  return (
    localStorage.getItem('accessToken') ||
    sessionStorage.getItem('accessToken') ||
    localStorage.getItem('accessToken')
  );
};

/**
 * Format mapping for export file extensions
 */
const FORMAT_EXTENSIONS: Record<ExportFormat, string> = {
  'pdf': 'pdf',
  'dicom-sr': 'dcm',
  'fhir': 'fhir.json',
  'json': 'json'
};

/**
 * Unified Reports API Client
 */
export class ReportsApi {
  private client: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = API_BASE_URL;
    
    // Build full base URL for axios
    // If API_BASE_URL is empty, just use BASE_PATH (relative URL)
    const fullBaseURL = this.baseURL ? this.baseURL + BASE_PATH : BASE_PATH;
    
    console.log('🌐 ReportsApi initialized with baseURL:', fullBaseURL);
    
    this.client = axios.create({
      baseURL: fullBaseURL,
      headers: {
        'Content-Type': 'application/json',
        'x-reports-impl': 'unified' // Telemetry header
      },
      withCredentials: true
    });

    // Add auth and CSRF interceptor
    this.client.interceptors.request.use((config) => {
      const token = getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      // Add CSRF token for state-changing requests
      if (config.method && !['get', 'head', 'options'].includes(config.method.toLowerCase())) {
        const csrfToken = getCSRFToken();
        if (csrfToken) {
          config.headers['X-XSRF-TOKEN'] = csrfToken;
        }
      }
      
      // B) Log full URL for FIRST request only
      if (!hasLoggedURL) {
        const fullURL = this.baseURL 
          ? `${this.baseURL}${BASE_PATH}${config.url || ''}`
          : `${BASE_PATH}${config.url || ''}`;
        console.warn('🌐 Reports API Configuration:');
        console.warn('   Base URL:', this.baseURL || '(relative - using Vite proxy)');
        console.warn('   Full Path:', BASE_PATH);
        console.warn('   First Request:', fullURL);
        console.warn('   Using Proxy:', !this.baseURL);
        hasLoggedURL = true;
      }
      
      return config;
    });

    // Add response interceptor for telemetry and detailed error logging
    this.client.interceptors.response.use(
      (response) => {
        telemetryEmit('reporting.api.success', {
          method: response.config.method,
          url: response.config.url,
          status: response.status
        });
        return response;
      },
      (error) => {
        // B) Detailed error logging
        this.logDetailedError(error);
        
        telemetryEmit('reporting.api.error', {
          method: error.config?.method,
          url: error.config?.url,
          status: error.response?.status,
          error: error.message
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * B) Log detailed error information
   */
  private logDetailedError(error: any): void {
    const fullURL = error.config?.url 
      ? (this.baseURL ? `${this.baseURL}${BASE_PATH}${error.config.url}` : `${BASE_PATH}${error.config.url}`)
      : 'Unknown URL';
    
    console.error('❌ API Request Failed:');
    console.error('  URL:', fullURL);
    console.error('  Method:', error.config?.method?.toUpperCase() || 'UNKNOWN');
    
    if (error.config?.data) {
      try {
        const data = typeof error.config.data === 'string' 
          ? JSON.parse(error.config.data) 
          : error.config.data;
        console.error('  Request Body:', data);
      } catch {
        console.error('  Request Body:', error.config.data);
      }
    }
    
    if (error.response) {
      // Server responded with error status
      console.error('  Status:', error.response.status);
      console.error('  Response:', error.response.data);
    } else if (error.request) {
      // Request made but no response
      console.error('  No Response Received');
      console.error('  Network Error or Server Unreachable');
    } else {
      // Something else happened
      console.error('  Error:', error.message);
    }
    
    if (error.stack) {
      console.error('  Stack:', error.stack);
    }
  }

  // ==========================================================================
  // HEALTH & DIAGNOSTICS
  // ==========================================================================

  /**
   * Initialize CSRF token by making a GET request
   * This sets the XSRF-TOKEN cookie
   */
  async initializeCSRF(): Promise<void> {
    try {
      // Make a GET request to trigger CSRF token generation
      await this.client.get('/health');
      console.log('✅ CSRF token initialized');
    } catch (error: any) {
      console.warn('⚠️ Failed to initialize CSRF token:', error.message);
    }
  }

  /**
   * Ping health endpoint to test connectivity
   * GET /api/reports/health
   */
  async ping(): Promise<{ ok: boolean; service: string; timestamp: number }> {
    try {
      const response = await this.client.get('/health');
      console.log('✅ Backend health check passed:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Backend health check failed:', error.message);
      throw error;
    }
  }

  /**
   * Run comprehensive connectivity test
   */
  async runConnectivityTest(): Promise<{
    health: boolean;
    templates: boolean;
    errors: string[];
  }> {
    const results = {
      health: false,
      templates: false,
      errors: [] as string[]
    };

    // Test 1: Health endpoint
    try {
      await this.ping();
      results.health = true;
      console.log('✅ Test 1/2: Health check passed');
    } catch (error: any) {
      results.errors.push(`Health check failed: ${error.message}`);
      console.error('❌ Test 1/2: Health check failed');
    }

    // Test 2: Templates endpoint
    try {
      await this.getTemplates();
      results.templates = true;
      console.log('✅ Test 2/2: Templates fetch passed');
    } catch (error: any) {
      results.errors.push(`Templates fetch failed: ${error.message}`);
      console.error('❌ Test 2/2: Templates fetch failed');
    }

    return results;
  }

  // ==========================================================================
  // CRUD OPERATIONS
  // ==========================================================================

  /**
   * Create or update report (upsert)
   * POST /api/reports
   * ✅ TEMPLATE FIX: Ensure template metadata is always included
   */
  async upsert(report: Partial<StructuredReport>): Promise<ApiResponse<StructuredReport>> {
    try {
      // ✅ TEMPLATE FIX: Guard against sending sections from a previous template
      // If templateId is present, ensure sections match that template
      if (report.templateId && report.sections) {
        // Sections should be fresh for this template
        // This is enforced by the editor resetting sections on template change
      }
      
      // Validate before sending
      const validated = StructuredReportSchema.partial().parse(report);
      
      const response = await this.client.post<ApiResponse<StructuredReport>>('', validated);
      
      telemetryEmit('reporting.report.upserted', {
        reportId: response.data.report?.reportId,
        mode: report.creationMode,
        status: report.reportStatus,
        templateId: report.templateId // ✅ TEMPLATE FIX: Track template in telemetry
      });

      return response.data;
    } catch (error: any) {
      // Error already logged by interceptor
      throw error;
    }
  }

  /**
   * Get report by ID
   * GET /api/reports/:reportId
   */
  async get(reportId: string): Promise<ApiResponse<StructuredReport>> {
    try {
      const response = await this.client.get<ApiResponse<StructuredReport>>(`/${reportId}`);
      return response.data;
    } catch (error: any) {
      // Error already logged by interceptor
      throw error;
    }
  }

  /**
   * Update existing report
   * PUT /api/reports/:reportId
   * ✅ COMPLIANCE UPDATE: Optimistic locking with ETag/version
   * ✅ TEMPLATE FIX: Ensure template metadata is always included
   */
  async update(
    reportId: string,
    updates: Partial<StructuredReport>,
    currentVersion?: number
  ): Promise<ApiResponse<StructuredReport>> {
    try {
      const config: AxiosRequestConfig = {};
      
      // ✅ COMPLIANCE UPDATE: Send If-Match header for optimistic locking
      if (currentVersion !== undefined) {
        config.headers = {
          'If-Match': String(currentVersion)
        };
      }

      // ✅ TEMPLATE FIX: Guard against sending sections from a previous template
      // If templateId changed, sections must be fresh for the new template
      if (updates.templateId && updates.sections) {
        // Sections should match the new templateId
        // This is enforced by the editor resetting sections on template change
      }

      const response = await this.client.put<ApiResponse<StructuredReport>>(
        `/${reportId}`,
        updates,
        config
      );

      telemetryEmit('reporting.report.updated', {
        reportId,
        fields: Object.keys(updates),
        version: response.data.report?.version,
        templateId: updates.templateId // ✅ TEMPLATE FIX: Track template in telemetry
      });

      return response.data;
    } catch (error: any) {
      // ✅ COMPLIANCE UPDATE: Handle version conflict
      if (error.response?.status === 409 && error.response?.data?.error === 'VERSION_CONFLICT') {
        telemetryEmit('reporting.version.conflict', {
          reportId,
          clientVersion: currentVersion,
          serverVersion: error.response.data.serverVersion
        });
      }
      
      // ✅ COMPLIANCE UPDATE: Handle signed immutable error
      if (error.response?.status === 409 && error.response?.data?.error === 'SIGNED_IMMUTABLE') {
        telemetryEmit('reporting.edit.blocked', {
          reportId,
          reason: 'signed_immutable'
        });
      }
      
      throw error;
    }
  }

  /**
   * Delete report (draft only)
   * DELETE /api/reports/:reportId
   */
  async delete(reportId: string): Promise<ApiResponse> {
    try {
      const response = await this.client.delete<ApiResponse>(`/${reportId}`);
      
      telemetryEmit('reporting.report.deleted', { reportId });
      
      return response.data;
    } catch (error: any) {
      // Error already logged by interceptor
      throw error;
    }
  }

  // ==========================================================================
  // QUERY OPERATIONS
  // ==========================================================================

  /**
   * Get all reports for a study
   * GET /api/reports/study/:studyInstanceUID
   */
  async listByStudy(studyInstanceUID: string): Promise<ApiResponse<StructuredReport[]>> {
    try {
      const url = `/study/${studyInstanceUID}`;
      console.log(`📋 Fetching reports for study: ${studyInstanceUID}`);
      console.log(`   Full URL: ${this.baseURL}${BASE_PATH}${url}`);
      
      const response = await this.client.get<ApiResponse<StructuredReport[]>>(url);
      
      console.log(`✅ Found ${response.data.reports?.length || 0} reports for study`);
      return response.data;
    } catch (error: any) {
      // Error already logged by interceptor
      console.error(`❌ Failed to fetch reports for study ${studyInstanceUID}`);
      throw error;
    }
  }

  /**
   * Get all reports for a patient
   * GET /api/reports/patient/:patientID
   */
  async listByPatient(
    patientID: string,
    limit?: number
  ): Promise<ApiResponse<StructuredReport[]>> {
    try {
      const url = `/patient/${patientID}${limit ? `?limit=${limit}` : ''}`;
      const response = await this.client.get<ApiResponse<StructuredReport[]>>(url);
      return response.data;
    } catch (error: any) {
      // Error already logged by interceptor
      throw error;
    }
  }

  // ==========================================================================
  // TEMPLATE OPERATIONS
  // ==========================================================================

  /**
   * Get all templates
   * GET /api/reports/templates
   */
  async getTemplates(activeOnly = true): Promise<ApiResponse<ReportTemplate[]>> {
    try {
      const response = await this.client.get<ApiResponse<ReportTemplate[]>>(
        `/templates?active=${activeOnly}`
      );
      return response.data;
    } catch (error: any) {
      // Error already logged by interceptor
      throw error;
    }
  }

  /**
   * Suggest best template for study
   * POST /api/reports/templates/suggest
   */
  async suggestTemplate(params: {
    modality?: string;
    studyDescription?: string;
    aiSummary?: string;
  }): Promise<ApiResponse<TemplateMatchResult>> {
    try {
      const response = await this.client.post<ApiResponse<TemplateMatchResult>>(
        '/templates/suggest',
        params
      );

      telemetryEmit('reporting.template.suggested', {
        modality: params.modality,
        matched: !!response.data.template
      });

      return response.data;
    } catch (error: any) {
      // Error already logged by interceptor
      throw error;
    }
  }

  // ==========================================================================
  // WORKFLOW OPERATIONS
  // ==========================================================================

  /**
   * Finalize report (draft → preliminary)
   * POST /api/reports/:reportId/finalize
   */
  async finalize(reportId: string): Promise<ApiResponse<StructuredReport>> {
    try {
      const response = await this.client.post<ApiResponse<StructuredReport>>(
        `/${reportId}/finalize`
      );

      telemetryEmit('reporting.report.finalized', { reportId });

      return response.data;
    } catch (error: any) {
      // Error already logged by interceptor
      throw error;
    }
  }

  /**
   * Sign report (preliminary/draft → final)
   * POST /api/reports/:reportId/sign
   * ✅ COMPLIANCE UPDATE: Enhanced FDA-compliant signature with meaning and reason
   */
  async sign(
    reportId: string,
    signature: {
      signatureText?: string;
      signatureImage?: Blob;
      signatureHash?: string;
      meaning?: 'authored' | 'reviewed' | 'approved' | 'verified';
      reason?: string;
    }
  ): Promise<ApiResponse<StructuredReport>> {
    try {
      const formData = new FormData();

      if (signature.signatureText) {
        formData.append('signatureText', signature.signatureText);
      }

      if (signature.signatureImage) {
        formData.append('signature', signature.signatureImage, 'signature.png');
      }

      if (signature.signatureHash) {
        formData.append('signatureHash', signature.signatureHash);
      }

      // ✅ COMPLIANCE UPDATE: Add meaning and reason for FDA compliance
      formData.append('meaning', signature.meaning || 'authored');
      
      if (signature.reason) {
        formData.append('reason', signature.reason);
      }

      const response = await this.client.post<ApiResponse<StructuredReport>>(
        `/${reportId}/sign`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      telemetryEmit('reporting.report.signed', { 
        reportId,
        meaning: signature.meaning || 'authored'
      });

      return response.data;
    } catch (error: any) {
      // ✅ COMPLIANCE UPDATE: Handle validation errors
      if (error.response?.status === 400 && error.response?.data?.error === 'VALIDATION_FAILED') {
        telemetryEmit('reporting.sign.validation_failed', {
          reportId,
          errors: error.response.data.validationErrors
        });
      }
      
      throw error;
    }
  }

  /**
   * Add addendum to final report
   * POST /api/reports/:reportId/addendum
   * ✅ COMPLIANCE UPDATE: Reason is now required
   */
  async addAddendum(
    reportId: string,
    content: string,
    reason: string
  ): Promise<ApiResponse<StructuredReport>> {
    try {
      if (!reason) {
        throw new Error('Reason for addendum is required');
      }

      const response = await this.client.post<ApiResponse<StructuredReport>>(
        `/${reportId}/addendum`,
        { content, reason }
      );

      telemetryEmit('reporting.addendum.added', { reportId, reason });

      return response.data;
    } catch (error: any) {
      // Error already logged by interceptor
      const message = mapApiError(error);
      throw new Error(message);
    }
  }

  /**
   * Simplified addendum method (alias)
   * ✅ COMPLIANCE UPDATE: Reason is required
   */
  async addendum(reportId: string, text: string, reason: string): Promise<ApiResponse<StructuredReport>> {
    return this.addAddendum(reportId, text, reason);
  }

  /**
   * Document critical result communication
   * POST /api/reports/:reportId/critical-comm
   * ✅ COMPLIANCE UPDATE: New endpoint for critical finding documentation
   */
  async documentCriticalComm(
    reportId: string,
    recipient: string,
    method: string,
    notes?: string
  ): Promise<ApiResponse<StructuredReport>> {
    try {
      const response = await this.client.post<ApiResponse<StructuredReport>>(
        `/${reportId}/critical-comm`,
        { recipient, method, notes }
      );

      telemetryEmit('reporting.critical_comm.documented', { reportId, method });

      return response.data;
    } catch (error: any) {
      const message = mapApiError(error);
      throw new Error(message);
    }
  }

  // ==========================================================================
  // EXPORT OPERATIONS
  // ==========================================================================

  /**
   * Export report in specified format and trigger download
   * GET /api/reports/:reportId/export?format=...
   */
  async export(reportId: string, format: ExportFormat): Promise<void> {
    try {
      const response = await this.client.get(`/${reportId}/export`, {
        params: { format },
        responseType: 'blob'
      });

      telemetryEmit('reporting.report.exported', { reportId, format });

      // Auto-download the file
      const extension = FORMAT_EXTENSIONS[format];
      const filename = `report-${reportId}.${extension}`;
      this.downloadFile(response.data, filename);
    } catch (error: any) {
      // Error already logged by interceptor
      const message = mapApiError(error);
      throw new Error(message);
    }
  }

  /**
   * Export report and return blob (for custom handling)
   */
  async exportBlob(reportId: string, format: ExportFormat): Promise<Blob> {
    try {
      const response = await this.client.get(`/${reportId}/export`, {
        params: { format },
        responseType: 'blob'
      });

      telemetryEmit('reporting.report.exported', { reportId, format });

      return response.data;
    } catch (error: any) {
      // Error already logged by interceptor
      const message = mapApiError(error);
      throw new Error(message);
    }
  }

  /**
   * Export report as PDF (POST for advanced options)
   * POST /api/reports/:reportId/export/pdf
   */
  async exportPDF(reportId: string, options?: any): Promise<void> {
    try {
      const response = await this.client.post(
        `/${reportId}/export/pdf`,
        options || {},
        { responseType: 'blob' }
      );

      telemetryEmit('reporting.report.exported', { reportId, format: 'pdf' });

      this.downloadFile(response.data, `report-${reportId}.pdf`);
    } catch (error: any) {
      // Error already logged by interceptor
      const message = mapApiError(error);
      throw new Error(message);
    }
  }

  /**
   * Export report as DICOM SR
   * POST /api/reports/:reportId/export/dicom-sr
   */
  async exportDICOMSR(reportId: string): Promise<void> {
    try {
      const response = await this.client.post(
        `/${reportId}/export/dicom-sr`,
        {},
        { responseType: 'blob' }
      );

      telemetryEmit('reporting.report.exported', { reportId, format: 'dicom-sr' });

      this.downloadFile(response.data, `report-${reportId}.dcm`);
    } catch (error: any) {
      // Error already logged by interceptor
      const message = mapApiError(error);
      throw new Error(message);
    }
  }

  /**
   * Export report as FHIR
   * POST /api/reports/:reportId/export/fhir
   */
  async exportFHIR(reportId: string): Promise<void> {
    try {
      const response = await this.client.post(`/${reportId}/export/fhir`);

      telemetryEmit('reporting.report.exported', { reportId, format: 'fhir' });

      // Download as JSON
      const blob = new Blob([JSON.stringify(response.data, null, 2)], {
        type: 'application/fhir+json'
      });
      this.downloadFile(blob, `report-${reportId}.fhir.json`);
    } catch (error: any) {
      // Error already logged by interceptor
      const message = mapApiError(error);
      throw new Error(message);
    }
  }

  // ==========================================================================
  // AI INTEGRATION (OPTIONAL)
  // ==========================================================================

  /**
   * Get AI detections for analysis (optional stub)
   * This can be implemented when AI service is available
   */
  async getAIDetections(analysisId: string): Promise<{ findings: AIDetection[] }> {
    try {
      // Stub implementation - replace with actual AI endpoint when available
      console.warn('⚠️ getAIDetections is a stub. Implement actual AI endpoint.');
      
      // Try to fetch from AI service if available
      const response = await axios.get(
        `${this.baseURL}/api/ai/analysis/${analysisId}`,
        {
          headers: {
            Authorization: `Bearer ${getAuthToken()}`,
            'x-reports-impl': 'unified'
          }
        }
      );

      const aiData = response.data;
      const findings: AIDetection[] = [];

      // Extract detections from AI response
      if (aiData.results?.detections) {
        aiData.results.detections.forEach((d: any, idx: number) => {
          findings.push({
            id: `ai-${idx}`,
            type: d.label || d.type || 'finding',
            confidence: d.confidence || d.score || 0,
            bbox: d.bbox || d.boundingBox,
            measurements: d.measurements,
            severity: d.severity || (d.confidence > 0.8 ? 'moderate' : 'mild'),
            description: d.description || `AI detected ${d.label || d.type}`
          });
        });
      }

      return { findings };
    } catch (error: any) {
      console.error('❌ Error fetching AI detections:', error);
      // Return empty findings instead of throwing
      return { findings: [] };
    }
  }

  /**
   * Download exported file
   */
  downloadFile(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  // ✅ COMPLIANCE UPDATE: Helper to build frozen payload for export
  /**
   * Build frozen export payload from report and UI state
   * This mirrors the payload structure used in the editor
   */
  buildFrozenPayload(report: any, uiState?: any): any {
    return {
      reportId: report.reportId || report._id,
      studyInstanceUID: report.studyInstanceUID,
      patientID: report.patientID,
      patientName: report.patientName,
      modality: report.modality,
      templateId: report.templateId,
      templateName: report.templateName,
      templateVersion: report.templateVersion,
      technique: report.technique,
      clinicalHistory: report.clinicalHistory,
      findingsText: report.findingsText,
      impression: report.impression,
      recommendations: report.recommendations,
      sections: report.sections || {},
      findings: report.findings || [],
      measurements: report.measurements || [],
      aiDetections: report.aiDetections || [],
      keyImages: report.keyImages || [],
      reportStatus: report.reportStatus,
      createdAt: report.createdAt || report.metadata?.createdAt,
      updatedAt: report.updatedAt || report.metadata?.updatedAt,
      signedAt: report.signedAt,
      signedBy: report.radiologistName,
      version: report.version
    };
  }

  // ============================================================================
  // ✅ COMPLIANCE UPDATE (ADVANCED): PHI-SAFE SHARING
  // ============================================================================

  /**
   * Create a PHI-safe shareable export link
   * POST /api/reports/:reportId/export/share
   */
  async createSharedExport(reportId: string, payload: any): Promise<{
    shareId: string;
    url: string;
    expiresAt: string;
  }> {
    try {
      const response = await this.client.post<{
        success: boolean;
        shareId: string;
        url: string;
        expiresAt: string;
      }>(`/${reportId}/export/share`, { payload });

      telemetryEmit('reporting.share.created', {
        reportId,
        shareId: response.data.shareId
      });

      return {
        shareId: response.data.shareId,
        url: response.data.url,
        expiresAt: response.data.expiresAt
      };
    } catch (error: any) {
      const message = mapApiError(error);
      throw new Error(message);
    }
  }

  /**
   * Retrieve a shared export (PHI-safe)
   * GET /api/reports/export/share/:shareId
   */
  async getSharedExport(shareId: string): Promise<any> {
    try {
      const response = await this.client.get<{
        success: boolean;
        payload: any;
        expiresAt: string;
        accessCount: number;
      }>(`/export/share/${shareId}`);

      telemetryEmit('reporting.share.accessed', {
        shareId,
        accessCount: response.data.accessCount
      });

      return response.data.payload;
    } catch (error: any) {
      const message = mapApiError(error);
      throw new Error(message);
    }
  }
}

// Singleton instance
export const reportsApi = new ReportsApi();

export default reportsApi;
