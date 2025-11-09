/**
 * Centralized Reporting State Management
 * Single source of truth for all reporting data
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface Finding {
  id: string;
  location: string;
  description: string;
  severity: 'normal' | 'mild' | 'moderate' | 'severe' | 'critical';
  aiDetected?: boolean;
  coordinates?: { x: number; y: number; width?: number; height?: number };
  measurements?: Array<{ type: string; value: number; unit: string }>;
  linkedMarkingId?: string;
}

export interface AnatomicalMarking {
  id: string;
  type: 'point' | 'circle' | 'arrow' | 'freehand' | 'text';
  anatomicalLocation: string;
  coordinates: {
    x: number;
    y: number;
    width?: number;
    height?: number;
    points?: Array<{ x: number; y: number }>;
  };
  view: string;
  color: string;
  label?: string;
  linkedFindingId?: string;
  timestamp: Date;
}

export interface CapturedImage {
  id: string;
  dataUrl: string;
  timestamp: Date;
  description?: string;
}

export interface ReportState {
  // Core identifiers
  reportId?: string;
  studyInstanceUID: string;
  patientInfo: {
    patientID: string;
    patientName: string;
    modality: string;
    studyDate?: string;
    studyDescription?: string;
  };
  
  // Report content
  sections: Record<string, string>;
  findings: Finding[];
  measurements?: Array<{
    id: string;
    type: string;
    value: number;
    unit: string;
    label: string;
    points?: Array<{ x: number; y: number }>;
    frameIndex?: number;
  }>;
  annotations?: Array<{
    id: string;
    type: string;
    text?: string;
    color?: string;
    points?: Array<{ x: number; y: number }>;
    frameIndex?: number;
  }>;
  anatomicalMarkings: AnatomicalMarking[];
  keyImages: CapturedImage[];
  
  // Text fields
  clinicalHistory: string;
  technique: string;
  findingsText: string;
  impression: string;
  recommendations: string;
  
  // Workflow
  workflowStep: 'template' | 'editing' | 'review' | 'signed';
  creationMode: 'manual' | 'ai-assisted';
  templateId?: string;
  templateName?: string;
  analysisId?: string;
  
  // UI state
  activePanel: 'content' | 'anatomical' | 'voice' | 'ai' | 'export';
  hasUnsavedChanges: boolean;
  lastSaved?: Date;
  
  // Status
  loading: boolean;
  saving: boolean;
  error?: string;
  
  // Version control
  version: number;
  reportStatus: 'draft' | 'preliminary' | 'final' | 'amended';
  
  // Signature
  signedAt?: Date;
  signedBy?: string;
  signatureUrl?: string;
  radiologistSignature?: string;
}

export type ReportAction =
  | { type: 'SET_REPORT'; payload: Partial<ReportState> }
  | { type: 'UPDATE_SECTION'; payload: { key: string; value: string } }
  | { type: 'UPDATE_FIELD'; payload: { field: keyof ReportState; value: any } }
  | { type: 'ADD_FINDING'; payload: Finding }
  | { type: 'UPDATE_FINDING'; payload: { id: string; updates: Partial<Finding> } }
  | { type: 'DELETE_FINDING'; payload: string }
  | { type: 'ADD_MARKING'; payload: AnatomicalMarking }
  | { type: 'DELETE_MARKING'; payload: string }
  | { type: 'ADD_KEY_IMAGE'; payload: CapturedImage }
  | { type: 'SET_WORKFLOW_STEP'; payload: ReportState['workflowStep'] }
  | { type: 'SET_ACTIVE_PANEL'; payload: ReportState['activePanel'] }
  | { type: 'MARK_SAVED' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string };

// ============================================================================
// REDUCER
// ============================================================================

const reportReducer = (state: ReportState, action: ReportAction): ReportState => {
  switch (action.type) {
    case 'SET_REPORT':
      return { 
        ...state, 
        ...action.payload, 
        hasUnsavedChanges: false,
        loading: false 
      };
      
    case 'UPDATE_SECTION':
      return {
        ...state,
        sections: { 
          ...state.sections, 
          [action.payload.key]: action.payload.value 
        },
        hasUnsavedChanges: true
      };
      
    case 'UPDATE_FIELD':
      return {
        ...state,
        [action.payload.field]: action.payload.value,
        hasUnsavedChanges: true
      };
      
    case 'ADD_FINDING':
      return {
        ...state,
        findings: [...state.findings, action.payload],
        hasUnsavedChanges: true
      };
      
    case 'UPDATE_FINDING':
      return {
        ...state,
        findings: state.findings.map(f =>
          f.id === action.payload.id ? { ...f, ...action.payload.updates } : f
        ),
        hasUnsavedChanges: true
      };
      
    case 'DELETE_FINDING':
      return {
        ...state,
        findings: state.findings.filter(f => f.id !== action.payload),
        hasUnsavedChanges: true
      };
      
    case 'ADD_MARKING':
      return {
        ...state,
        anatomicalMarkings: [...state.anatomicalMarkings, action.payload],
        hasUnsavedChanges: true
      };
      
    case 'DELETE_MARKING':
      return {
        ...state,
        anatomicalMarkings: state.anatomicalMarkings.filter(m => m.id !== action.payload),
        hasUnsavedChanges: true
      };
      
    case 'ADD_KEY_IMAGE':
      return {
        ...state,
        keyImages: [...state.keyImages, action.payload],
        hasUnsavedChanges: true
      };
      
    case 'SET_WORKFLOW_STEP':
      return { ...state, workflowStep: action.payload };
      
    case 'SET_ACTIVE_PANEL':
      return { ...state, activePanel: action.payload };
      
    case 'MARK_SAVED':
      return { 
        ...state, 
        hasUnsavedChanges: false, 
        lastSaved: new Date(),
        saving: false 
      };
      
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
      
    case 'SET_SAVING':
      return { ...state, saving: action.payload };
      
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false, saving: false };
      
    default:
      return state;
  }
};

// ============================================================================
// CONTEXT
// ============================================================================

interface ReportContextValue {
  state: ReportState;
  dispatch: React.Dispatch<ReportAction>;
  actions: {
    saveReport: () => Promise<void>;
    signReport: (signatureData: any) => Promise<void>;
    addFinding: (finding: Finding) => void;
    updateFinding: (id: string, updates: Partial<Finding>) => void;
    deleteFinding: (id: string) => void;
    addMarking: (marking: AnatomicalMarking) => void;
    deleteMarking: (id: string) => void;
    addKeyImage: (image: CapturedImage) => void;
    updateSection: (key: string, value: string) => void;
    updateField: (field: keyof ReportState, value: any) => void;
    setActivePanel: (panel: ReportState['activePanel']) => void;
  };
}

const ReportingContext = createContext<ReportContextValue | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

export const ReportingProvider: React.FC<{
  children: React.ReactNode;
  initialData: Partial<ReportState>;
}> = ({ children, initialData }) => {
  const [state, dispatch] = useReducer(reportReducer, {
    studyInstanceUID: initialData.studyInstanceUID || '',
    patientInfo: initialData.patientInfo || {
      patientID: 'Unknown',
      patientName: 'Unknown',
      modality: 'CT'
    },
    sections: initialData.sections || {},
    findings: initialData.findings || [],
    anatomicalMarkings: initialData.anatomicalMarkings || [],
    keyImages: initialData.keyImages || [],
    clinicalHistory: initialData.clinicalHistory || '',
    technique: initialData.technique || '',
    findingsText: initialData.findingsText || '',
    impression: initialData.impression || '',
    recommendations: initialData.recommendations || '',
    workflowStep: initialData.workflowStep || 'editing',
    creationMode: initialData.creationMode || 'manual',
    activePanel: 'content',
    hasUnsavedChanges: false,
    loading: false,
    saving: false,
    version: initialData.version || 1,
    reportStatus: initialData.reportStatus || 'draft',
    ...initialData
  } as ReportState);
  
  // ✅ NEW: Auto-generate findings text from viewer annotations
  useEffect(() => {
    if (initialData.annotations && initialData.annotations.length > 0 && !initialData.findingsText) {
      const generatedFindings = initialData.annotations
        .map((ann: any) => ann.text || `${ann.type} annotation`)
        .filter(Boolean)
        .join('\n');
      
      if (generatedFindings) {
        console.log('✅ Auto-generated findings from annotations');
        dispatch({ type: 'UPDATE_FIELD', payload: { field: 'findingsText', value: generatedFindings } });
      }
    }
  }, []);
  
  // Auto-save every 30 seconds if there are unsaved changes
  useEffect(() => {
    if (state.hasUnsavedChanges && state.reportId && !state.saving) {
      const timer = setTimeout(() => {
        console.log('🔄 Auto-saving report...');
        actions.saveReport();
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [state.hasUnsavedChanges, state.reportId, state.saving]);
  
  // Actions
  const actions = {
    saveReport: useCallback(async () => {
      if (!state.reportId) {
        console.warn('Cannot save: No report ID');
        return;
      }
      
      dispatch({ type: 'SET_SAVING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: '' });
      
      try {
        const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
        
        const response = await fetch(`/api/reports/${state.reportId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            sections: state.sections,
            findings: state.findings,
            measurements: state.measurements || [],
            annotations: state.annotations || [],
            anatomicalMarkings: state.anatomicalMarkings,
            keyImages: state.keyImages,
            clinicalHistory: state.clinicalHistory,
            technique: state.technique,
            findingsText: state.findingsText,
            impression: state.impression,
            recommendations: state.recommendations,
            version: state.version
          })
        });
        
        if (!response.ok) {
          throw new Error(`Save failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('✅ Report saved successfully');
        
        dispatch({ type: 'MARK_SAVED' });
        dispatch({ type: 'UPDATE_FIELD', payload: { field: 'version', value: data.report?.version || state.version + 1 } });
      } catch (error: any) {
        console.error('❌ Save failed:', error);
        dispatch({ type: 'SET_ERROR', payload: error.message });
        dispatch({ type: 'SET_SAVING', payload: false });
      }
    }, [state]),
    
    signReport: useCallback(async (signatureData: any) => {
      if (!state.reportId) {
        throw new Error('Cannot sign: No report ID');
      }
      
      dispatch({ type: 'SET_SAVING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: '' });
      
      try {
        const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
        
        // Create FormData for file upload
        const formData = new FormData();
        
        // Add signature file if exists
        if (signatureData.signatureFile) {
          formData.append('signatureFile', signatureData.signatureFile);
        }
        
        // Add signature data as JSON
        formData.append('signatureData', JSON.stringify({
          signatureText: signatureData.signatureText,
          signatureMeaning: signatureData.signatureMeaning,
          password: signatureData.password,
          reason: signatureData.reason || 'Final report'
        }));
        
        const response = await fetch(`/api/reports/${state.reportId}/sign`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
            // Don't set Content-Type - browser will set it with boundary for FormData
          },
          body: formData
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to sign report');
        }
        
        const data = await response.json();
        console.log('✅ Report signed successfully');
        
        // Update state to final
        dispatch({ type: 'UPDATE_FIELD', payload: { field: 'reportStatus', value: 'final' } });
        dispatch({ type: 'UPDATE_FIELD', payload: { field: 'signedAt', value: new Date() } });
        dispatch({ type: 'UPDATE_FIELD', payload: { field: 'signatureUrl', value: data.report?.radiologistSignatureUrl } });
        dispatch({ type: 'UPDATE_FIELD', payload: { field: 'signedBy', value: data.report?.radiologistName } });
        dispatch({ type: 'UPDATE_FIELD', payload: { field: 'radiologistSignature', value: data.report?.radiologistSignature } });
        dispatch({ type: 'MARK_SAVED' });
        
      } catch (error: any) {
        console.error('❌ Sign failed:', error);
        dispatch({ type: 'SET_ERROR', payload: error.message });
        dispatch({ type: 'SET_SAVING', payload: false });
        throw error;
      }
    }, [state]),
    
    addFinding: useCallback((finding: Finding) => {
      dispatch({ type: 'ADD_FINDING', payload: finding });
    }, []),
    
    updateFinding: useCallback((id: string, updates: Partial<Finding>) => {
      dispatch({ type: 'UPDATE_FINDING', payload: { id, updates } });
    }, []),
    
    deleteFinding: useCallback((id: string) => {
      dispatch({ type: 'DELETE_FINDING', payload: id });
    }, []),
    
    addMarking: useCallback((marking: AnatomicalMarking) => {
      dispatch({ type: 'ADD_MARKING', payload: marking });
    }, []),
    
    deleteMarking: useCallback((id: string) => {
      dispatch({ type: 'DELETE_MARKING', payload: id });
    }, []),
    
    addKeyImage: useCallback((image: CapturedImage) => {
      dispatch({ type: 'ADD_KEY_IMAGE', payload: image });
    }, []),
    
    updateSection: useCallback((key: string, value: string) => {
      dispatch({ type: 'UPDATE_SECTION', payload: { key, value } });
    }, []),
    
    updateField: useCallback((field: keyof ReportState, value: any) => {
      dispatch({ type: 'UPDATE_FIELD', payload: { field, value } });
    }, []),
    
    setActivePanel: useCallback((panel: ReportState['activePanel']) => {
      dispatch({ type: 'SET_ACTIVE_PANEL', payload: panel });
    }, [])
  };
  
  return (
    <ReportingContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </ReportingContext.Provider>
  );
};

// ============================================================================
// HOOK
// ============================================================================

export const useReporting = () => {
  const context = useContext(ReportingContext);
  if (!context) {
    throw new Error(
      'useReporting must be used within ReportingProvider. ' +
      'Make sure UnifiedReportEditor is wrapped with <ReportingProvider>. ' +
      'Check ReportingPage.tsx for proper provider setup.'
    );
  }
  return context;
};
