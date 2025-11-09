/**
 * 📊 REPORT STATE HOOK
 * Centralized state management for report editing
 */

import { useState, useCallback } from 'react';
import { reportsApi } from '../services/ReportsApi';
import type { StructuredReport, StructuredFinding, KeyImage } from '../types/reporting';

interface LoadOrCreateDraftParams {
  studyInstanceUID: string;
  patientID?: string;
  patientName?: string;
  modality?: string;
  templateId?: string;
  aiAnalysisId?: string;
}

interface UseReportStateReturn {
  report: Partial<StructuredReport>;
  loading: boolean;
  error: string | null;
  updateSection: (sectionId: string, value: string) => void;
  updateField: (field: keyof StructuredReport, value: any) => void;
  addFinding: (finding: StructuredFinding) => void;
  updateFinding: (id: string, updates: Partial<StructuredFinding>) => void;
  removeFinding: (id: string) => void;
  addKeyImage: (image: KeyImage) => void;
  removeKeyImage: (id: string) => void;
  setReport: (report: Partial<StructuredReport>) => void;
  resetReport: () => void;
  loadOrCreateDraft: (params: LoadOrCreateDraftParams) => Promise<StructuredReport>;
}

/**
 * Hook for managing report state
 */
export const useReportState = (
  initialReport?: Partial<StructuredReport>
): UseReportStateReturn => {
  const [report, setReportInternal] = useState<Partial<StructuredReport>>(
    initialReport || {
      findings: [],
      sections: {},
      reportStatus: 'draft'
    }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Update a section value
   */
  const updateSection = useCallback((sectionId: string, value: string) => {
    setReportInternal((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        [sectionId]: value
      }
    }));
  }, []);

  /**
   * Update a top-level field
   */
  const updateField = useCallback((field: keyof StructuredReport, value: any) => {
    setReportInternal((prev) => ({
      ...prev,
      [field]: value
    }));
  }, []);

  /**
   * Add a finding
   */
  const addFinding = useCallback((finding: StructuredFinding) => {
    setReportInternal((prev) => ({
      ...prev,
      findings: [...(prev.findings || []), finding]
    }));
  }, []);

  /**
   * Update a finding
   */
  const updateFinding = useCallback((id: string, updates: Partial<StructuredFinding>) => {
    setReportInternal((prev) => ({
      ...prev,
      findings: (prev.findings || []).map((f) =>
        f.id === id ? { ...f, ...updates } : f
      )
    }));
  }, []);

  /**
   * Remove a finding
   */
  const removeFinding = useCallback((id: string) => {
    setReportInternal((prev) => ({
      ...prev,
      findings: (prev.findings || []).filter((f) => f.id !== id)
    }));
  }, []);

  /**
   * Add a key image
   */
  const addKeyImage = useCallback((image: KeyImage) => {
    setReportInternal((prev) => ({
      ...prev,
      keyImages: [...(prev.keyImages || []), image],
      imageCount: (prev.keyImages || []).length + 1
    }));
  }, []);

  /**
   * Remove a key image
   */
  const removeKeyImage = useCallback((id: string) => {
    setReportInternal((prev) => ({
      ...prev,
      keyImages: (prev.keyImages || []).filter((img) => img.id !== id),
      imageCount: Math.max(0, (prev.imageCount || 0) - 1)
    }));
  }, []);

  /**
   * Set entire report
   */
  const setReport = useCallback((newReport: Partial<StructuredReport>) => {
    setReportInternal(newReport);
  }, []);

  /**
   * Reset report to initial state
   */
  const resetReport = useCallback(() => {
    setReportInternal(
      initialReport || {
        findings: [],
        sections: {},
        reportStatus: 'draft'
      }
    );
    setError(null);
  }, [initialReport]);

  /**
   * E) Load existing draft or create new one with fallback support
   */
  const loadOrCreateDraft = useCallback(async (params: LoadOrCreateDraftParams): Promise<StructuredReport> => {
    setLoading(true);
    setError(null);

    try {
      // 0. First, initialize CSRF token and test backend connectivity
      console.log('🔍 Initializing CSRF and testing backend connectivity...');
      try {
        await reportsApi.initializeCSRF();
        await reportsApi.ping();
        console.log('✅ Backend is reachable and CSRF initialized');
      } catch (pingError: any) {
        console.error('❌ Backend ping failed:', pingError.message);
        throw new Error(`Backend unreachable: ${pingError.message}`);
      }

      // 1. Try to find existing draft for this study
      console.log(`📋 Looking for existing drafts for study: ${params.studyInstanceUID}`);
      const response = await reportsApi.listByStudy(params.studyInstanceUID);
      const existingReports = response.reports || [];
      
      // Look for a draft report
      const existingDraft = existingReports.find(
        (r) => r.reportStatus === 'draft'
      );

      if (existingDraft) {
        console.log('✅ Found existing draft:', existingDraft.reportId);
        setReportInternal(existingDraft);
        setLoading(false);
        return existingDraft;
      }

      // 2. No draft found, create new one
      console.log('📝 Creating new draft report...');
      
      const newReport: Partial<StructuredReport> = {
        studyInstanceUID: params.studyInstanceUID,
        patientID: params.patientID || 'UNKNOWN',
        patientName: params.patientName,
        modality: params.modality,
        templateId: params.templateId,
        aiAnalysisId: params.aiAnalysisId,
        sections: {},
        findings: [],
        measurements: [],
        annotations: [],
        keyImages: [],
        reportStatus: 'draft',
        version: 1,
        creationMode: params.aiAnalysisId ? 'ai-assisted' : 'manual'
      };

      const createResponse = await reportsApi.upsert(newReport);
      const createdReport = createResponse.report || createResponse.data!;

      console.log('✅ Created draft:', createdReport.reportId);
      setReportInternal(createdReport);
      setLoading(false);
      return createdReport;

    } catch (err: any) {
      // E) Fallback: Create temporary local draft if API fails
      console.error('❌ Error loading/creating draft:', err);
      console.error('🔄 Creating temporary fallback draft (local mode)...');
      
      const tempDraft: StructuredReport = {
        reportId: `temp-${Date.now()}`,
        studyInstanceUID: params.studyInstanceUID,
        patientID: params.patientID || 'UNKNOWN',
        patientName: params.patientName || 'Unknown Patient',
        modality: params.modality || 'CT',
        templateId: params.templateId,
        aiAnalysisId: params.aiAnalysisId,
        sections: {},
        findings: [],
        measurements: [],
        annotations: [],
        keyImages: [],
        reportStatus: 'draft',
        version: 1,
        creationMode: params.aiAnalysisId ? 'ai-assisted' : 'manual',
        content: {
          indication: '',
          technique: '',
          findings: '',
          impression: ''
        },
        metadata: {
          createdAt: new Date().toISOString(),
          createdBy: 'local-user',
          lastModified: new Date().toISOString(),
          modifiedBy: 'local-user'
        }
      } as StructuredReport;

      console.warn('⚠️ Using temporary draft (offline mode):', tempDraft.reportId);
      setReportInternal(tempDraft);
      setError('Server unreachable - using local draft (changes will not be saved)');
      setLoading(false);
      return tempDraft;
    }
  }, []);

  return {
    report,
    loading,
    error,
    updateSection,
    updateField,
    addFinding,
    updateFinding,
    removeFinding,
    addKeyImage,
    removeKeyImage,
    setReport,
    resetReport,
    loadOrCreateDraft
  };
};

export default useReportState;
