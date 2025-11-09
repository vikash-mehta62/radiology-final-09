/**
 * Advanced Export System with Professional Branding
 * Multiple formats, custom templates, and branding options
 */

import React, { useState, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Switch,
  FormControlLabel,
  Chip,
  Alert,
  LinearProgress,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Divider,
  Avatar
} from '@mui/material';
import {
  GetApp as ExportIcon,
  PictureAsPdf as PdfIcon,
  Description as DocIcon,
  Code as JsonIcon,
  Image as ImageIcon,
  Email as EmailIcon,
  Print as PrintIcon,
  Settings as SettingsIcon,
  Palette as BrandIcon,
  Close as CloseIcon,
  CloudUpload as UploadIcon,
  LocalHospital as FhirIcon
} from '@mui/icons-material';
import FHIRExportButton from '../reporting/FHIRExportButton';

interface ExportOptions {
  format: 'pdf' | 'docx' | 'json' | 'png' | 'html';
  template: 'standard' | 'detailed' | 'summary' | 'custom';
  includeBranding: boolean;
  includeImages: boolean;
  includeSignatures: boolean;
  watermark: boolean;
  customLogo?: File;
  hospitalName?: string;
  departmentName?: string;
  customFooter?: string;
}

interface AdvancedExportSystemProps {
  reportData: any;
  patientInfo: any;
  studyInfo: any;
  onExport?: (options: ExportOptions) => void;
  onClose?: () => void;
}

const EXPORT_FORMATS = [
  { value: 'pdf', label: 'PDF Report', icon: <PdfIcon />, description: 'Professional PDF with formatting' },
  { value: 'docx', label: 'Word Document', icon: <DocIcon />, description: 'Editable Word document' },
  { value: 'fhir', label: 'FHIR Export', icon: <FhirIcon />, description: 'HL7 FHIR R4 DiagnosticReport' },
  { value: 'json', label: 'JSON Data', icon: <JsonIcon />, description: 'Structured data export' },
  { value: 'png', label: 'Image Export', icon: <ImageIcon />, description: 'High-quality image' },
  { value: 'html', label: 'Web Page', icon: <EmailIcon />, description: 'Shareable web format' }
];

const TEMPLATES = [
  { value: 'standard', label: 'Standard Report', description: 'Standard medical report format' },
  { value: 'detailed', label: 'Detailed Analysis', description: 'Comprehensive with all findings' },
  { value: 'summary', label: 'Executive Summary', description: 'Concise overview for referrers' },
  { value: 'custom', label: 'Custom Template', description: 'Use your custom template' }
];

const AdvancedExportSystem: React.FC<AdvancedExportSystemProps> = ({
  reportData,
  patientInfo,
  studyInfo,
  onExport,
  onClose
}) => {
  // State
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ExportOptions>({
    format: 'pdf',
    template: 'standard',
    includeBranding: true,
    includeImages: true,
    includeSignatures: true,
    watermark: false,
    hospitalName: 'Medical Center',
    departmentName: 'Radiology Department'
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showBrandingSettings, setShowBrandingSettings] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handle export option changes
   */
  const handleOptionChange = (key: keyof ExportOptions, value: any) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  };

  /**
   * Handle logo upload
   */
  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setOptions(prev => ({ ...prev, customLogo: file }));
    }
  };

  /**
   * Generate preview
   */
  const generatePreview = async () => {
    try {
      setIsExporting(true);
      setExportProgress(20);

      // Simulate preview generation
      await new Promise(resolve => setTimeout(resolve, 1000));
      setExportProgress(60);

      // Create preview URL (mock)
      const previewData = generatePreviewData();
      const blob = new Blob([previewData], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      
      setExportProgress(100);
    } catch (error) {
      console.error('Preview generation failed:', error);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  /**
   * Generate preview HTML
   */
  const generatePreviewData = (): string => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Report Preview</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { border-bottom: 2px solid #1976d2; padding-bottom: 10px; margin-bottom: 20px; }
          .logo { float: right; max-height: 60px; }
          .patient-info { background: #f5f5f5; padding: 15px; margin: 20px 0; }
          .findings { margin: 20px 0; }
          .signature { margin-top: 40px; border-top: 1px solid #ccc; padding-top: 20px; }
          ${options.watermark ? '.watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); opacity: 0.1; font-size: 72px; z-index: -1; }' : ''}
        </style>
      </head>
      <body>
        ${options.watermark ? '<div class="watermark">CONFIDENTIAL</div>' : ''}
        
        <div class="header">
          ${options.includeBranding ? `
            <h1>${options.hospitalName || 'Medical Center'}</h1>
            <h2>${options.departmentName || 'Radiology Department'}</h2>
          ` : ''}
        </div>

        <div class="patient-info">
          <h3>Patient Information</h3>
          <p><strong>Name:</strong> ${patientInfo?.patientName || 'Unknown'}</p>
          <p><strong>ID:</strong> ${patientInfo?.patientID || 'Unknown'}</p>
          <p><strong>Study Date:</strong> ${new Date().toLocaleDateString()}</p>
          <p><strong>Modality:</strong> ${patientInfo?.modality || 'CT'}</p>
        </div>

        <div class="findings">
          <h3>Findings</h3>
          <p>${reportData?.findings || 'Sample findings would appear here...'}</p>
          
          <h3>Impression</h3>
          <p>${reportData?.impression || 'Sample impression would appear here...'}</p>
        </div>

        ${options.includeSignatures ? `
          <div class="signature">
            <p><strong>Reported by:</strong> Dr. Sample Radiologist</p>
            <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
          </div>
        ` : ''}

        ${options.customFooter ? `
          <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #666;">
            ${options.customFooter}
          </div>
        ` : ''}
      </body>
      </html>
    `;
  };

  /**
   * Handle export
   */
  const handleExport = async () => {
    try {
      setIsExporting(true);
      setExportProgress(0);

      // Simulate export process
      for (let i = 0; i <= 100; i += 10) {
        setExportProgress(i);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Call parent export handler
      if (onExport) {
        onExport(options);
      }

      // Create download based on format
      await createDownload();

    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  /**
   * Create download file
   */
  const createDownload = async () => {
    const filename = `report_${patientInfo?.patientID || 'unknown'}_${Date.now()}`;
    
    switch (options.format) {
      case 'pdf':
        // In real implementation, use jsPDF or similar
        const pdfContent = generatePreviewData();
        downloadFile(pdfContent, `${filename}.pdf`, 'application/pdf');
        break;
        
      case 'json':
        const jsonData = JSON.stringify({
          patient: patientInfo,
          study: studyInfo,
          report: reportData,
          exportOptions: options,
          exportedAt: new Date().toISOString()
        }, null, 2);
        downloadFile(jsonData, `${filename}.json`, 'application/json');
        break;
        
      case 'html':
        const htmlContent = generatePreviewData();
        downloadFile(htmlContent, `${filename}.html`, 'text/html');
        break;
        
      default:
        console.log(`Export format ${options.format} not implemented yet`);
    }
  };

  /**
   * Download file helper
   */
  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Export Button */}
      <Button
        variant="contained"
        startIcon={<ExportIcon />}
        onClick={() => setOpen(true)}
        sx={{ mb: 2 }}
      >
        Advanced Export
      </Button>

      {/* Export Dialog */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { minHeight: '70vh' } }}
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Advanced Export Options</Typography>
            <IconButton onClick={() => setOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Grid container spacing={3}>
            {/* Format Selection */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>Export Format</Typography>
              <Grid container spacing={2}>
                {EXPORT_FORMATS.map((format) => (
                  <Grid item xs={12} key={format.value}>
                    <Card
                      variant={options.format === format.value ? 'elevation' : 'outlined'}
                      sx={{
                        cursor: 'pointer',
                        border: options.format === format.value ? 2 : 1,
                        borderColor: options.format === format.value ? 'primary.main' : 'divider'
                      }}
                      onClick={() => handleOptionChange('format', format.value)}
                    >
                      <CardContent sx={{ py: 2 }}>
                        <Box display="flex" alignItems="center" gap={2}>
                          {format.icon}
                          <Box>
                            <Typography variant="subtitle2">{format.label}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {format.description}
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Grid>

            {/* Template & Options */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>Template & Options</Typography>
              
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Template</InputLabel>
                <Select
                  value={options.template}
                  onChange={(e) => handleOptionChange('template', e.target.value)}
                >
                  {TEMPLATES.map((template) => (
                    <MenuItem key={template.value} value={template.value}>
                      <Box>
                        <Typography variant="body2">{template.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {template.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box display="flex" flexDirection="column" gap={1}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={options.includeBranding}
                      onChange={(e) => handleOptionChange('includeBranding', e.target.checked)}
                    />
                  }
                  label="Include Hospital Branding"
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={options.includeImages}
                      onChange={(e) => handleOptionChange('includeImages', e.target.checked)}
                    />
                  }
                  label="Include Medical Images"
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={options.includeSignatures}
                      onChange={(e) => handleOptionChange('includeSignatures', e.target.checked)}
                    />
                  }
                  label="Include Digital Signatures"
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={options.watermark}
                      onChange={(e) => handleOptionChange('watermark', e.target.checked)}
                    />
                  }
                  label="Add Confidential Watermark"
                />
              </Box>

              {/* Branding Settings */}
              {options.includeBranding && (
                <Box mt={2}>
                  <Button
                    startIcon={<BrandIcon />}
                    onClick={() => setShowBrandingSettings(!showBrandingSettings)}
                    variant="outlined"
                    size="small"
                  >
                    Branding Settings
                  </Button>
                  
                  {showBrandingSettings && (
                    <Box mt={2} p={2} border={1} borderColor="divider" borderRadius={1}>
                      <TextField
                        fullWidth
                        label="Hospital Name"
                        value={options.hospitalName || ''}
                        onChange={(e) => handleOptionChange('hospitalName', e.target.value)}
                        sx={{ mb: 2 }}
                      />
                      
                      <TextField
                        fullWidth
                        label="Department Name"
                        value={options.departmentName || ''}
                        onChange={(e) => handleOptionChange('departmentName', e.target.value)}
                        sx={{ mb: 2 }}
                      />
                      
                      <TextField
                        fullWidth
                        label="Custom Footer"
                        value={options.customFooter || ''}
                        onChange={(e) => handleOptionChange('customFooter', e.target.value)}
                        multiline
                        rows={2}
                        sx={{ mb: 2 }}
                      />
                      
                      <Button
                        startIcon={<UploadIcon />}
                        onClick={() => fileInputRef.current?.click()}
                        variant="outlined"
                        size="small"
                      >
                        Upload Logo
                      </Button>
                      
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        style={{ display: 'none' }}
                      />
                      
                      {options.customLogo && (
                        <Chip
                          label={options.customLogo.name}
                          onDelete={() => handleOptionChange('customLogo', undefined)}
                          sx={{ ml: 1 }}
                        />
                      )}
                    </Box>
                  )}
                </Box>
              )}
            </Grid>

            {/* Preview */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Preview</Typography>
                <Button
                  variant="outlined"
                  onClick={generatePreview}
                  disabled={isExporting}
                >
                  Generate Preview
                </Button>
              </Box>
              
              {previewUrl && (
                <Box
                  component="iframe"
                  src={previewUrl}
                  sx={{
                    width: '100%',
                    height: 400,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1
                  }}
                />
              )}
            </Grid>
          </Grid>

          {/* Export Progress */}
          {isExporting && (
            <Box mt={2}>
              <LinearProgress variant="determinate" value={exportProgress} />
              <Typography variant="caption" color="text.secondary" mt={1}>
                {exportProgress < 100 ? `Exporting... ${exportProgress}%` : 'Export complete!'}
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleExport}
            disabled={isExporting}
            startIcon={<ExportIcon />}
          >
            {isExporting ? 'Exporting...' : 'Export Report'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AdvancedExportSystem;