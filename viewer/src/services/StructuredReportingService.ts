/**
 * Structured Reporting Service
 * Handles saving and retrieving structured reports with measurements and annotations
 */

interface Finding {
  id: string;
  type: 'finding' | 'impression' | 'recommendation' | 'critical';
  category?: string;
  description: string;
  severity?: 'normal' | 'mild' | 'moderate' | 'severe' | 'critical';
  clinicalCode?: string;
  location?: string;
  frameIndex?: number;
  timestamp?: Date;
}

interface Measurement {
  id: string;
  type: 'length' | 'angle' | 'area' | 'volume';
  value: number;
  unit: string;
  label?: string;
  points: Array<{ x: number; y: number }>;
  frameIndex: number;
  timestamp?: Date;
}

interface Annotation {
  id: string;
  type: 'text' | 'arrow' | 'freehand' | 'rectangle' | 'circle' | 'polygon' | 'clinical' | 'leader';
  text?: string;
  color: string;
  points: Array<{ x: number; y: number }>;
  anchor?: { x: number; y: number };
  textPos?: { x: number; y: number };
  category?: string;
  clinicalCode?: string;
  isKeyImage?: boolean;
  frameIndex: number;
  timestamp?: Date;
}

interface StructuredReport {
  reportId?: string;
  studyInstanceUID: string;
  patientID: string;
  patientName?: string;
  reportStatus: 'draft' | 'preliminary' | 'final' | 'amended' | 'cancelled';
  radiologistSignature?: string;
  findings: Finding[];
  measurements: Measurement[];
  annotations: Annotation[];
  clinicalHistory?: string;
  technique?: string;
  comparison?: string;
  findingsText?: string;
  impression?: string;
  recommendations?: string;
  keyImages?: number[];
  tags?: string[];
  priority?: 'routine' | 'urgent' | 'stat';
}

interface ReportResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

class StructuredReportingService {
  private static instance: StructuredReportingService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = '/api/reports';
  }

  public static getInstance(): StructuredReportingService {
    if (!StructuredReportingService.instance) {
      StructuredReportingService.instance = new StructuredReportingService();
    }
    return StructuredReportingService.instance;
  }

  /**
   * Save or update a structured report
   */
  async saveReport(report: StructuredReport): Promise<ReportResponse> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(report),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error saving report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save report',
      };
    }
  }

  /**
   * Get reports for a specific study
   */
  async getReportsByStudy(studyInstanceUID: string, status?: string): Promise<ReportResponse> {
    try {
      const url = new URL(`${this.baseUrl}/study/${studyInstanceUID}`, window.location.origin);
      if (status) {
        url.searchParams.append('status', status);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'include',
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching reports by study:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch reports',
      };
    }
  }

  /**
   * Get reports for a specific patient
   */
  async getReportsByPatient(patientID: string, status?: string): Promise<ReportResponse> {
    try {
      const url = new URL(`${this.baseUrl}/patient/${patientID}`, window.location.origin);
      if (status) {
        url.searchParams.append('status', status);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'include',
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching reports by patient:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch reports',
      };
    }
  }

  /**
   * Get a specific report by ID
   */
  async getReportById(reportId: string): Promise<ReportResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/${reportId}`, {
        method: 'GET',
        credentials: 'include',
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch report',
      };
    }
  }

  /**
   * Get reports created by current radiologist
   */
  async getMyReports(status?: string): Promise<ReportResponse> {
    try {
      const url = new URL(`${this.baseUrl}/my-reports`, window.location.origin);
      if (status) {
        url.searchParams.append('status', status);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'include',
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching my reports:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch reports',
      };
    }
  }

  /**
   * Delete (cancel) a report
   */
  async deleteReport(reportId: string): Promise<ReportResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/${reportId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error deleting report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete report',
      };
    }
  }

  /**
   * Export report as JSON
   */
  async exportReport(reportId: string): Promise<ReportResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/${reportId}/export`, {
        method: 'GET',
        credentials: 'include',
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error exporting report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export report',
      };
    }
  }

  /**
   * Get report statistics
   */
  async getReportStats(): Promise<ReportResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/stats`, {
        method: 'GET',
        credentials: 'include',
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching report stats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch statistics',
      };
    }
  }

  /**
   * Auto-save report (draft mode)
   * Automatically saves measurements and annotations as draft
   */
  async autoSaveReport(
    studyInstanceUID: string,
    patientID: string,
    measurements: Measurement[],
    annotations: Annotation[],
    existingReportId?: string
  ): Promise<ReportResponse> {
    const report: StructuredReport = {
      reportId: existingReportId,
      studyInstanceUID,
      patientID,
      reportStatus: 'draft',
      findings: [],
      measurements,
      annotations,
    };

    return this.saveReport(report);
  }

  /**
   * Finalize report (change status to final)
   */
  async finalizeReport(
    reportId: string,
    radiologistSignature: string,
    additionalData?: Partial<StructuredReport>
  ): Promise<ReportResponse> {
    try {
      // First get the existing report
      const existingReport = await this.getReportById(reportId);
      
      if (!existingReport.success || !existingReport.data) {
        return {
          success: false,
          error: 'Report not found',
        };
      }

      // Update with final status
      const updatedReport: StructuredReport = {
        ...existingReport.data,
        ...additionalData,
        reportId,
        reportStatus: 'final',
        radiologistSignature,
      };

      return this.saveReport(updatedReport);
    } catch (error) {
      console.error('Error finalizing report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to finalize report',
      };
    }
  }
}

export default StructuredReportingService;
export type { StructuredReport, Finding, Measurement, Annotation, ReportResponse };
