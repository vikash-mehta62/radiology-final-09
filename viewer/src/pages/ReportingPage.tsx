/**
 * Medical Reporting Page - REFACTORED
 * Clean architecture with centralized state management
 * Route: /reporting
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Breadcrumbs,
  Link
} from '@mui/material';
import {
  Home as HomeIcon,
  ArrowBack as BackIcon
} from '@mui/icons-material';
import { ReportingProvider } from '../contexts/ReportingContext';
import UnifiedReportEditor from '../components/reporting/UnifiedReportEditor';
import TemplateSelector from '../components/reporting/TemplateSelectorUnified';
import { telemetryEmit } from '../utils/reportingUtils';

const ReportingPage: React.FC = () => {
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  /**
   * Initialize from URL parameters
   */
  useEffect(() => {
    loadReportData();
  }, []);

  const loadReportData = async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const studyUID = params.get('studyUID') || params.get('studyInstanceUID');
      const reportId = params.get('reportId');
      const analysisId = params.get('analysisId');
      
      console.log('📋 Reporting Page initialized:', { studyUID, reportId, analysisId });

      if (!studyUID) {
        throw new Error('Study UID is required. Please provide studyUID parameter in the URL.');
      }

      // Load existing report OR prepare for new report
      if (reportId) {
        // Load existing report
        const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
        const response = await fetch(`/api/reports/${reportId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
          throw new Error('Failed to load report');
        }
        
        const data = await response.json();
        setReportData(data.report);
        console.log('✅ Loaded existing report:', reportId);
      } else {
        // New report - load viewer annotations/measurements
        const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
        let viewerData = { measurements: [], annotations: [] };
        
        try {
          const viewerResponse = await fetch(`/api/viewer/data/${studyUID}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (viewerResponse.ok) {
            const viewerResult = await viewerResponse.json();
            if (viewerResult.success) {
              viewerData = viewerResult;
              console.log('✅ Loaded viewer data:', {
                measurements: viewerData.measurements?.length || 0,
                annotations: viewerData.annotations?.length || 0
              });
            }
          }
        } catch (err) {
          console.warn('Could not load viewer data:', err);
        }
        
        // Show template selector with viewer data
        setShowTemplateSelector(true);
        setReportData({
          studyInstanceUID: studyUID,
          analysisId,
          patientInfo: {
            patientID: params.get('patientID') || 'Unknown',
            patientName: params.get('patientName') || 'Unknown Patient',
            modality: params.get('modality') || 'CT',
            studyDescription: params.get('studyDescription')
          },
          measurements: viewerData.measurements || [],
          annotations: viewerData.annotations || [],
          creationMode: analysisId ? 'ai-assisted' : 'manual'
        });
        console.log('✅ Prepared for new report with viewer data');
      }

      telemetryEmit('reporting.page.loaded', { studyUID, reportId, analysisId });
      setLoading(false);
    } catch (err: any) {
      console.error('❌ Failed to load reporting page:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  /**
   * Handle template selection
   */
  const handleTemplateSelected = (templateId: string, createdReportId: string) => {
    console.log('✅ Template selected, report created:', createdReportId);
    setShowTemplateSelector(false);
    setReportData({ 
      ...reportData, 
      reportId: createdReportId, 
      templateId 
    });
  };

  /**
   * Handle navigation back
   */
  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };

  /**
   * Loading state
   */
  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        bgcolor="background.default"
      >
        <CircularProgress />
      </Box>
    );
  }

  /**
   * Error state
   */
  if (error) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        bgcolor="background.default"
        p={3}
      >
        <Alert severity="error" sx={{ mb: 3, maxWidth: 600 }}>
          <Typography variant="h6" gutterBottom>
            Unable to Load Reporting Page
          </Typography>
          <Typography variant="body2">{error}</Typography>
        </Alert>
        <Button variant="contained" startIcon={<BackIcon />} onClick={handleBack}>
          Go Back
        </Button>
      </Box>
    );
  }

  /**
   * Template Selection Screen
   */
  if (showTemplateSelector) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <Paper
          elevation={2}
          sx={{
            p: 2,
            borderRadius: 0,
            borderBottom: 1,
            borderColor: 'divider'
          }}
        >
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Breadcrumbs aria-label="breadcrumb">
              <Link
                color="inherit"
                href="/"
                sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
              >
                <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
                Home
              </Link>
              <Typography color="text.primary">
                Select Template
              </Typography>
            </Breadcrumbs>

            <Button variant="outlined" startIcon={<BackIcon />} onClick={handleBack}>
              Cancel
            </Button>
          </Box>
        </Paper>

        <TemplateSelector
          studyUID={reportData.studyInstanceUID}
          patientInfo={reportData.patientInfo}
          onTemplateSelect={handleTemplateSelected}
          onBack={handleBack}
        />
      </Box>
    );
  }

  /**
   * Main Report Editor
   */
  // Safety check: ensure reportData is valid before rendering
  if (!reportData || !reportData.studyInstanceUID) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        bgcolor="background.default"
      >
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <ReportingProvider initialData={reportData}>
      <UnifiedReportEditor onClose={handleBack} />
    </ReportingProvider>
  );
};

export default ReportingPage;
