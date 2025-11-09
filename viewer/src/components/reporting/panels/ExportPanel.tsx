/**
 * Export Panel
 * Multi-format report export options
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  CircularProgress,
  Alert,
  Divider
} from '@mui/material';
import {
  PictureAsPdf as PDFIcon,
  Description as TextIcon,
  Code as JSONIcon,
  LocalHospital as FHIRIcon,
  MedicalServices as DICOMIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { useReporting } from '../../../contexts/ReportingContext';

interface ExportFormat {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  endpoint: string;
}

const EXPORT_FORMATS: ExportFormat[] = [
  {
    id: 'pdf',
    name: 'PDF Report',
    description: 'Professional PDF document with letterhead',
    icon: <PDFIcon />,
    endpoint: '/pdf'
  },
  {
    id: 'txt',
    name: 'Plain Text',
    description: 'Simple text format for copying',
    icon: <TextIcon />,
    endpoint: '/export/txt'
  },
  {
    id: 'json',
    name: 'JSON',
    description: 'Structured data format',
    icon: <JSONIcon />,
    endpoint: '/export'
  },
  {
    id: 'dicom-sr',
    name: 'DICOM SR',
    description: 'DICOM Structured Report',
    icon: <DICOMIcon />,
    endpoint: '/export/dicom-sr'
  },
  {
    id: 'fhir',
    name: 'FHIR Bundle',
    description: 'HL7 FHIR DiagnosticReport',
    icon: <FHIRIcon />,
    endpoint: '/export/fhir'
  }
];

const ExportPanel: React.FC = () => {
  const { state } = useReporting();
  const [selectedFormat, setSelectedFormat] = useState<string>('pdf');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const handleExport = async () => {
    if (!state.reportId) {
      setError('Cannot export: No report ID');
      return;
    }
    
    setExporting(true);
    setError(null);
    setSuccess(null);
    
    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
      const format = EXPORT_FORMATS.find(f => f.id === selectedFormat);
      
      if (!format) {
        throw new Error('Invalid export format');
      }
      
      const response = await fetch(`/api/reports/${state.reportId}${format.endpoint}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }
      
      // Handle different response types
      if (selectedFormat === 'pdf') {
        // Download PDF
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-${state.reportId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else if (selectedFormat === 'txt') {
        // Download text
        const text = await response.text();
        const blob = new Blob([text], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-${state.reportId}.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        // Download JSON/FHIR/DICOM
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-${state.reportId}.${selectedFormat === 'fhir' ? 'fhir.json' : selectedFormat}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
      
      setSuccess(`Report exported successfully as ${format.name}`);
    } catch (err: any) {
      console.error('Export failed:', err);
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };
  
  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
        Export Report
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}
      
      {/* Report Status */}
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
          Report Status
        </Typography>
        <Box display="flex" gap={1} alignItems="center">
          <Typography variant="body2">
            Status: <strong>{state.reportStatus.toUpperCase()}</strong>
          </Typography>
        </Box>
        {state.reportStatus !== 'final' && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            Report is not finalized. Consider signing before exporting.
          </Alert>
        )}
      </Paper>
      
      {/* Format Selection */}
      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
        Select Export Format
      </Typography>
      
      <FormControl component="fieldset" fullWidth>
        <RadioGroup
          value={selectedFormat}
          onChange={(e) => setSelectedFormat(e.target.value)}
        >
          <List dense>
            {EXPORT_FORMATS.map((format) => (
              <React.Fragment key={format.id}>
                <ListItem
                  button
                  onClick={() => setSelectedFormat(format.id)}
                  sx={{
                    border: 1,
                    borderColor: selectedFormat === format.id ? 'primary.main' : 'divider',
                    borderRadius: 1,
                    mb: 1,
                    bgcolor: selectedFormat === format.id ? 'action.selected' : 'background.default'
                  }}
                >
                  <ListItemIcon>
                    <Radio
                      checked={selectedFormat === format.id}
                      value={format.id}
                    />
                  </ListItemIcon>
                  <ListItemIcon>
                    {format.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={format.name}
                    secondary={format.description}
                  />
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        </RadioGroup>
      </FormControl>
      
      {/* Export Button */}
      <Button
        variant="contained"
        color="primary"
        fullWidth
        size="large"
        startIcon={exporting ? <CircularProgress size={20} /> : <DownloadIcon />}
        onClick={handleExport}
        disabled={exporting || !state.reportId}
        sx={{ mt: 2 }}
      >
        {exporting ? 'Exporting...' : 'Export Report'}
      </Button>
      
      <Divider sx={{ my: 2 }} />
      
      {/* Export Info */}
      <Paper elevation={1} sx={{ p: 2, bgcolor: 'info.light' }}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
          📄 Export Information
        </Typography>
        <Typography variant="caption" component="div">
          • <strong>PDF:</strong> Best for printing and sharing
        </Typography>
        <Typography variant="caption" component="div">
          • <strong>DICOM SR:</strong> For PACS integration
        </Typography>
        <Typography variant="caption" component="div">
          • <strong>FHIR:</strong> For EHR/EMR systems
        </Typography>
        <Typography variant="caption" component="div">
          • <strong>JSON:</strong> For data processing
        </Typography>
        <Typography variant="caption" component="div">
          • <strong>Text:</strong> For quick copying
        </Typography>
      </Paper>
    </Box>
  );
};

export default ExportPanel;
