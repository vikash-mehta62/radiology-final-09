/**
 * Advanced Reporting Hub
 * Integration component for all advanced features
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Button,
  Alert,
  Snackbar,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  Mic as VoiceIcon,
  GetApp as ExportIcon,
  PhoneAndroid as MobileIcon,
  Palette as UIIcon,
  Assignment as ReportIcon
} from '@mui/icons-material';

// Import our new components
import VoiceDictationAdvanced from './VoiceDictationAdvanced';
import AdvancedExportSystem from '../export/AdvancedExportSystem';
import MobileReviewApp from '../mobile/MobileReviewApp';
import ModernUIEnhancements from '../ui/ModernUIEnhancements';

interface AdvancedReportingHubProps {
  reportData?: any;
  patientInfo?: any;
  studyInfo?: any;
  onReportUpdate?: (data: any) => void;
}

const AdvancedReportingHub: React.FC<AdvancedReportingHubProps> = ({
  reportData,
  patientInfo,
  studyInfo,
  onReportUpdate
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [activeTab, setActiveTab] = useState(0);
  const [reportText, setReportText] = useState(reportData?.findings || '');
  const [notification, setNotification] = useState<string | null>(null);

  // Handle voice dictation updates
  const handleVoiceUpdate = (text: string) => {
    setReportText(text);
    if (onReportUpdate) {
      onReportUpdate({ ...reportData, findings: text });
    }
  };

  // Handle export
  const handleExport = (options: any) => {
    console.log('Exporting with options:', options);
    setNotification('Report exported successfully!');
  };

  // Handle mobile actions
  const handleMobileApprove = (reportId: string) => {
    console.log('Approved report:', reportId);
    setNotification('Report approved!');
  };

  const handleMobileReject = (reportId: string, reason: string) => {
    console.log('Rejected report:', reportId, reason);
    setNotification('Report rejected with feedback');
  };

  const handleMobileComment = (reportId: string, comment: string) => {
    console.log('Added comment:', reportId, comment);
    setNotification('Comment added successfully');
  };

  // Sample data for mobile review
  const sampleReports = [
    {
      id: '1',
      patientName: patientInfo?.patientName || 'John Doe',
      patientId: patientInfo?.patientID || 'P001',
      modality: patientInfo?.modality || 'CT',
      status: 'pending',
      findings: reportText || 'Sample findings for review...'
    }
  ];

  const tabs = [
    { label: 'Voice Dictation', icon: <VoiceIcon />, component: 'voice' },
    { label: 'Export Options', icon: <ExportIcon />, component: 'export' },
    { label: 'Mobile Review', icon: <MobileIcon />, component: 'mobile' },
    { label: 'Modern UI', icon: <UIIcon />, component: 'ui' }
  ];

  // Auto-switch to mobile view on small screens
  useEffect(() => {
    if (isMobile && activeTab !== 2) {
      setActiveTab(2);
    }
  }, [isMobile, activeTab]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 0:
        return (
          <VoiceDictationAdvanced
            onTextUpdate={handleVoiceUpdate}
            initialText={reportText}
            placeholder="Start speaking to dictate your medical report..."
            medicalMode={true}
          />
        );
      
      case 1:
        return (
          <AdvancedExportSystem
            reportData={{ ...reportData, findings: reportText }}
            patientInfo={patientInfo}
            studyInfo={studyInfo}
            onExport={handleExport}
          />
        );
      
      case 2:
        return (
          <MobileReviewApp
            reports={sampleReports}
            onApprove={handleMobileApprove}
            onReject={handleMobileReject}
            onComment={handleMobileComment}
          />
        );
      
      case 3:
        return (
          <ModernUIEnhancements
            data={sampleReports}
            onAction={(action, item) => console.log('UI Action:', action, item)}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Paper elevation={2} sx={{ mb: 3 }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
            Advanced Reporting Features
          </Typography>
          <Typography variant="body2" color="text.secondary">
            World-class reporting tools with voice dictation, professional export, mobile access, and modern UI
          </Typography>
        </Box>
        
        {/* Tabs */}
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant={isMobile ? 'scrollable' : 'fullWidth'}
          scrollButtons="auto"
        >
          {tabs.map((tab, index) => (
            <Tab
              key={index}
              label={tab.label}
              icon={tab.icon}
              iconPosition="start"
              sx={{ minHeight: 64 }}
            />
          ))}
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <Box sx={{ minHeight: 400 }}>
        {renderTabContent()}
      </Box>

      {/* Success Notification */}
      <Snackbar
        open={!!notification}
        autoHideDuration={4000}
        onClose={() => setNotification(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setNotification(null)} 
          severity="success"
          variant="filled"
        >
          {notification}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AdvancedReportingHub;