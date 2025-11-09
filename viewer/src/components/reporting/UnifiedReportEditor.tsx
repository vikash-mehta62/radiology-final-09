/**
 * Unified Report Editor
 * Single source of truth for report editing
 * Clean architecture with content panel + feature panels
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Badge,
  Chip,
  LinearProgress,
  Alert,
  Snackbar,
  Button
} from '@mui/material';
import {
  Save as SaveIcon,
  CheckCircle as SignIcon,
  Accessibility as AnatomicalIcon,
  Mic as VoiceIcon,
  SmartToy as AIIcon,
  Download as ExportIcon,
  Close as CloseIcon,
  Visibility as PreviewIcon
} from '@mui/icons-material';
import { useReporting } from '../../contexts/ReportingContext';
import ReportContentPanel from './panels/ReportContentPanel';
import AnatomicalDiagramPanel from './panels/AnatomicalDiagramPanel';
import VoiceDictationPanel from './panels/VoiceDictationPanel';
import AIAssistantPanel from './panels/AIAssistantPanel';
import ExportPanel from './panels/ExportPanel';
import SignReportDialog, { type SignatureData } from './SignReportDialog';
import ReportPreviewDialog from './ReportPreviewDialog';

interface UnifiedReportEditorProps {
  onClose?: () => void;
}

const UnifiedReportEditor: React.FC<UnifiedReportEditorProps> = ({ onClose }) => {
  const { state, actions } = useReporting();
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [showSignDialog, setShowSignDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  
  const handleSave = async () => {
    try {
      await actions.saveReport();
      setSnackbar({ open: true, message: 'Report saved successfully', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to save report', severity: 'error' });
    }
  };
  
  const handleSign = async (signatureData: SignatureData) => {
    try {
      await actions.signReport(signatureData);
      setSnackbar({ open: true, message: 'Report signed successfully', severity: 'success' });
      setShowSignDialog(false);
    } catch (error: any) {
      throw error; // Re-throw to be handled by dialog
    }
  };
  
  const handlePreview = () => {
    setShowPreviewDialog(true);
  };
  
  return (
    <Box display="flex" flexDirection="column" height="100vh">
      {/* Top Bar */}
      <Paper 
        elevation={2} 
        sx={{ 
          p: 2, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderRadius: 0
        }}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <Box>
            <Box display="flex" alignItems="center" gap={1}>
              <strong>{state.patientInfo.patientName}</strong>
              <Chip label={state.patientInfo.modality} size="small" color="primary" />
              <Chip 
                label={state.reportStatus.toUpperCase()} 
                size="small" 
                color={state.reportStatus === 'final' ? 'success' : 'default'}
              />
            </Box>
            <Box sx={{ fontSize: '0.875rem', color: 'text.secondary', mt: 0.5 }}>
              Patient ID: {state.patientInfo.patientID} | Study: {state.studyInstanceUID.slice(0, 20)}...
            </Box>
          </Box>
        </Box>
        
        <Box display="flex" gap={1} alignItems="center">
          {state.hasUnsavedChanges && (
            <Chip label="Unsaved changes" size="small" color="warning" />
          )}
          
          {state.lastSaved && (
            <Box sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
              Last saved: {state.lastSaved.toLocaleTimeString()}
            </Box>
          )}
          
          <Tooltip title="Preview Report">
            <Button
              variant="outlined"
              size="small"
              startIcon={<PreviewIcon />}
              onClick={handlePreview}
              sx={{ textTransform: 'none' }}
            >
              Preview
            </Button>
          </Tooltip>
          
          <Tooltip title="Save Report (Ctrl+S)">
            <IconButton 
              color="primary" 
              onClick={handleSave}
              disabled={state.saving || !state.hasUnsavedChanges}
            >
              <Badge color="error" variant="dot" invisible={!state.hasUnsavedChanges}>
                <SaveIcon />
              </Badge>
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Sign Report">
            <Button
              variant="contained"
              color="success"
              size="small"
              startIcon={<SignIcon />}
              onClick={() => setShowSignDialog(true)}
              disabled={state.reportStatus === 'final'}
              sx={{ textTransform: 'none' }}
            >
              Sign
            </Button>
          </Tooltip>
          
          {onClose && (
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          )}
        </Box>
      </Paper>
      
      {/* Loading Bar */}
      {(state.loading || state.saving) && <LinearProgress />}
      
      {/* Error Alert */}
      {state.error && (
        <Alert severity="error" onClose={() => actions.updateField('error', '')}>
          {state.error}
        </Alert>
      )}
      
      {/* Main Content Area */}
      <Box display="flex" flex={1} overflow="hidden">
        {/* LEFT: Main Content Editor */}
        <Box 
          flex={2} 
          p={2} 
          overflow="auto"
          sx={{ 
            bgcolor: 'background.default',
            borderRight: 1,
            borderColor: 'divider'
          }}
        >
          <ReportContentPanel />
        </Box>
        
        {/* RIGHT: Feature Panels */}
        <Paper 
          elevation={0}
          sx={{ 
            width: 450, 
            display: 'flex', 
            flexDirection: 'column',
            bgcolor: 'background.paper'
          }}
        >
          {/* Tab Selector */}
          <Tabs 
            value={state.activePanel} 
            onChange={(_, v) => actions.setActivePanel(v)}
            variant="fullWidth"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab 
              value="anatomical" 
              icon={<AnatomicalIcon />} 
              label="Body Diagram"
              iconPosition="start"
            />
            <Tab 
              value="voice" 
              icon={<VoiceIcon />} 
              label="Voice"
              iconPosition="start"
            />
            <Tab 
              value="ai" 
              icon={<AIIcon />} 
              label="AI"
              iconPosition="start"
            />
            <Tab 
              value="export" 
              icon={<ExportIcon />} 
              label="Export"
              iconPosition="start"
            />
          </Tabs>
          
          {/* Panel Content */}
          <Box flex={1} overflow="auto" p={2}>
            {state.activePanel === 'anatomical' && <AnatomicalDiagramPanel />}
            {state.activePanel === 'voice' && <VoiceDictationPanel />}
            {state.activePanel === 'ai' && <AIAssistantPanel />}
            {state.activePanel === 'export' && <ExportPanel />}
          </Box>
        </Paper>
      </Box>
      
      {/* Snackbar Notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          severity={snackbar.severity} 
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
      
      {/* Sign Report Dialog */}
      <SignReportDialog
        open={showSignDialog}
        onClose={() => setShowSignDialog(false)}
        onSign={handleSign}
        reportData={{
          patientName: state.patientInfo.patientName,
          patientID: state.patientInfo.patientID,
          modality: state.patientInfo.modality,
          clinicalHistory: state.clinicalHistory,
          technique: state.technique,
          findingsText: state.findingsText,
          impression: state.impression,
          recommendations: state.recommendations,
          findings: state.findings
        }}
      />
      
      {/* Report Preview Dialog */}
      <ReportPreviewDialog
        open={showPreviewDialog}
        onClose={() => setShowPreviewDialog(false)}
        reportData={{
          reportId: state.reportId,
          patientName: state.patientInfo.patientName,
          patientID: state.patientInfo.patientID,
          modality: state.patientInfo.modality,
          studyDate: state.patientInfo.studyDate,
          clinicalHistory: state.clinicalHistory,
          technique: state.technique,
          findingsText: state.findingsText,
          impression: state.impression,
          recommendations: state.recommendations,
          findings: state.findings,
          anatomicalMarkings: state.anatomicalMarkings,
          keyImages: state.keyImages,
          reportStatus: state.reportStatus,
          lastSaved: state.lastSaved,
          signedAt: state.signedAt,
          signedBy: state.signedBy,
          signatureUrl: state.signatureUrl,
          radiologistSignature: state.radiologistSignature
        }}
      />
    </Box>
  );
};

export default UnifiedReportEditor;
