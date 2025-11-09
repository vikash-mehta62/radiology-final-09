/**
 * 🎯 UNIFIED STRUCTURED REPORTING ORCHESTRATOR
 * State machine: selection → template → editor
 */

import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { ProductionReportEditor } from '../reports';
import TemplateSelector from './TemplateSelectorUnified';
import { telemetryEmit } from '../../utils/reportingUtils';
import type { CreationMode, WorkflowStep } from '../../types/reporting';

export interface StructuredReportingProps {
  studyUID: string;
  reportId?: string; // Optional: for viewing/editing existing report
  analysisId?: string;
  initialMode?: CreationMode;
  patientInfo?: {
    patientID?: string;
    patientName?: string;
    modality?: string;
    studyDescription?: string;
  };
  onClose?: () => void;
}

/**
 * Unified Structured Reporting Orchestrator
 */
export const StructuredReportingUnified: React.FC<StructuredReportingProps> = ({
  studyUID,
  reportId: initialReportId,
  analysisId,
  initialMode,
  patientInfo,
  onClose
}) => {
  // ============================================================================
  // STATE MACHINE
  // ============================================================================
  
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>('selection');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined);
  const [reportId, setReportId] = useState<string | undefined>(initialReportId);
  
  // ✅ TEMPLATE FIX: Track if user has manually selected a template
  const [hasUserSelectedTemplate, setHasUserSelectedTemplate] = useState<boolean>(false);

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  useEffect(() => {
    // D) Validate studyUID on mount
    console.info('📋 StructuredReporting initialized:', { 
      studyUID, 
      reportId: initialReportId,
      analysisId,
      initialMode,
      patientInfo 
    });

    if (!studyUID) {
      console.error('❌ StructuredReporting: Missing studyUID');
      return;
    }

    // If reportId is provided, go directly to editor to view/edit existing report
    if (initialReportId) {
      console.log('🔄 Workflow: Opening existing report in editor');
      setReportId(initialReportId);
      setWorkflowStep('editor');
      telemetryEmit('reporting.workflow.start', { mode: 'edit', studyUID, reportId: initialReportId });
      return;
    }

    // Determine initial workflow step based on mode
    if (initialMode === 'manual') {
      console.log('🔄 Workflow: selection → template (manual mode)');
      setWorkflowStep('template');
      telemetryEmit('reporting.workflow.start', { mode: 'manual', studyUID });
    } else if (initialMode === 'ai-assisted' || initialMode === 'quick') {
      console.log(`🔄 Workflow: selection → editor (${initialMode} mode)`);
      setWorkflowStep('editor');
      telemetryEmit('reporting.workflow.start', { mode: initialMode, studyUID });
    } else {
      console.log('🔄 Workflow: starting at selection screen');
      setWorkflowStep('selection');
      telemetryEmit('reporting.workflow.start', { mode: 'selection', studyUID });
    }
  }, [initialMode, studyUID, initialReportId]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  /**
   * Handle mode selection from selection screen
   */
  const handleModeSelect = (mode: CreationMode) => {
    console.log(`🔄 Mode selected: ${mode}`);
    telemetryEmit('reporting.mode.selected', { mode });

    switch (mode) {
      case 'manual':
        console.log('🔄 Workflow: selection → template');
        setWorkflowStep('template');
        break;
      
      case 'ai-assisted':
      case 'quick':
        console.log('🔄 Workflow: selection → editor');
        setWorkflowStep('editor');
        break;
    }
  };

  /**
   * Handle template selection
   * This will be called after TemplateSelector creates the draft
   * ✅ TEMPLATE FIX: Set flag to prevent auto-reapplying suggestions
   */
  const handleTemplateSelect = (templateId: string, createdReportId: string) => {
    console.log('✅ Template selected and draft created:', { templateId, createdReportId });
    console.log('🔄 Workflow: template → editor');
    
    setSelectedTemplateId(templateId);
    setReportId(createdReportId);
    setWorkflowStep('editor');
    
    // ✅ TEMPLATE FIX: Mark that user has made a manual selection
    setHasUserSelectedTemplate(true);
    
    telemetryEmit('reporting.template.selected', { templateId, reportId: createdReportId });
  };

  /**
   * Handle report created in editor
   */
  const handleReportCreated = (createdReportId: string) => {
    console.log('✅ Report created in editor:', createdReportId);
    setReportId(createdReportId);
    telemetryEmit('reporting.report.created', { reportId: createdReportId });
  };

  /**
   * Handle report signed
   */
  const handleReportSigned = () => {
    console.log('✅ Report signed');
    telemetryEmit('reporting.report.signed', { reportId });
    
    // Optionally close or navigate back
    if (onClose) {
      setTimeout(() => {
        if (confirm('Report signed successfully! Would you like to return?')) {
          onClose();
        }
      }, 500);
    }
  };

  /**
   * Handle back navigation
   */
  const handleBack = () => {
    if (workflowStep === 'editor') {
      setWorkflowStep('template');
      setSelectedTemplateId(undefined);
      setReportId(undefined);
    } else if (workflowStep === 'template') {
      setWorkflowStep('selection');
    } else if (onClose) {
      onClose();
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  // D) Fail-safe: Show error if studyUID is missing
  if (!studyUID) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '400px',
          p: 3 
        }}
      >
        <Box sx={{ textAlign: 'center', maxWidth: 600 }}>
          <Typography variant="h5" color="error" gutterBottom>
            ❌ Missing Study UID
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Cannot load reporting interface without a study UID.
            Please navigate from a study viewer or provide studyUID in the URL.
          </Typography>
          <Typography variant="caption" display="block" sx={{ mt: 2 }}>
            Expected: /reporting?studyUID=xxx
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height: '100%', minHeight: '80vh' }}>
      {/* STEP 1: Selection Screen (if no initial mode) */}
      {workflowStep === 'selection' && (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <h2>Select Report Creation Mode</h2>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 3 }}>
            <button onClick={() => handleModeSelect('manual')}>
              📝 Template-Based
            </button>
            <button onClick={() => handleModeSelect('ai-assisted')}>
              🤖 AI-Assisted
            </button>
            <button onClick={() => handleModeSelect('quick')}>
              ⚡ Quick Report
            </button>
          </Box>
        </Box>
      )}

      {/* STEP 2: Template Selection */}
      {workflowStep === 'template' && (
        <TemplateSelector
          studyUID={studyUID}
          patientInfo={patientInfo}
          onTemplateSelect={handleTemplateSelect}
          onBack={handleBack}
        />
      )}

      {/* STEP 3: Report Editor */}
      {workflowStep === 'editor' && (
        <ProductionReportEditor
          studyInstanceUID={studyUID}
          patientInfo={{
            patientID: patientInfo?.patientID || 'Unknown',
            patientName: patientInfo?.patientName || 'Unknown Patient',
            modality: patientInfo?.modality || 'CT',
            studyDate: patientInfo?.studyDescription
          }}
          analysisId={analysisId}
          reportId={reportId}
          onReportCreated={handleReportCreated}
          onReportSigned={handleReportSigned}
          onClose={handleBack}
        />
      )}
    </Box>
  );
};

export default StructuredReportingUnified;
