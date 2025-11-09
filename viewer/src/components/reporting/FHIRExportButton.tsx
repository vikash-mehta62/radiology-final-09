import React, { useState } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  CloudDownload as DownloadIcon,
  CloudUpload as UploadIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Close as CloseIcon,
  Description as FileIcon
} from '@mui/icons-material';
import axios from 'axios';

interface FHIRExportButtonProps {
  reportId: string;
  reportStatus?: string;
  onExportComplete?: (result: any) => void;
}

interface ExportStatus {
  reportExists: boolean;
  hasFindings: boolean;
  hasImpression: boolean;
  isSigned: boolean;
  status: string;
  canExport: boolean;
  warnings: string[];
}

const FHIRExportButton: React.FC<FHIRExportButtonProps> = ({
  reportId,
  reportStatus,
  onExportComplete
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [loading, setLoading] = useState(false);
  const [pushDialogOpen, setPushDialogOpen] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [exportStatus, setExportStatus] = useState<ExportStatus | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem('accessToken');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  // Check export status
  const checkExportStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(
        `${import.meta.env.VITE_API_URL || 'http://3.144.196.75:8001'}/api/fhir/reports/${reportId}/status`,
        { headers: getAuthHeaders() }
      );

      setExportStatus(response.data.readiness);
      setStatusDialogOpen(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to check export status');
    } finally {
      setLoading(false);
    }
  };

  // Download FHIR report
  const downloadFHIR = async (format: 'report' | 'bundle') => {
    try {
      setLoading(true);
      setError(null);
      handleClose();

      const response = await axios.get(
        `${import.meta.env.VITE_API_URL || 'http://3.144.196.75:8001'}/api/fhir/reports/${reportId}/download?format=${format}`,
        {
          headers: getAuthHeaders(),
          responseType: 'blob'
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `fhir-${format}-${reportId}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      setSuccess(`FHIR ${format} downloaded successfully`);
      
      if (onExportComplete) {
        onExportComplete({ format, success: true });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to download FHIR report');
    } finally {
      setLoading(false);
    }
  };

  // Push to FHIR server
  const pushToServer = async (format: 'report' | 'bundle') => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://3.144.196.75:8001'}/api/fhir/reports/${reportId}/push`,
        { serverUrl, format },
        { headers: getAuthHeaders() }
      );

      setSuccess(`FHIR ${format} pushed to server successfully`);
      setPushDialogOpen(false);
      setServerUrl('');
      
      if (onExportComplete) {
        onExportComplete({ format, serverUrl, success: true });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to push FHIR report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Main Export Button */}
      <Tooltip title="Export to FHIR format for healthcare interoperability">
        <Button
          variant="outlined"
          color="primary"
          startIcon={loading ? <CircularProgress size={20} /> : <FileIcon />}
          onClick={handleClick}
          disabled={loading}
          sx={{ minWidth: 140 }}
        >
          FHIR Export
        </Button>
      </Tooltip>

      {/* Export Menu */}
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={checkExportStatus}>
          <CheckIcon sx={{ mr: 1 }} fontSize="small" />
          Check Export Status
        </MenuItem>
        
        <MenuItem onClick={() => downloadFHIR('report')}>
          <DownloadIcon sx={{ mr: 1 }} fontSize="small" />
          Download DiagnosticReport
        </MenuItem>
        
        <MenuItem onClick={() => downloadFHIR('bundle')}>
          <DownloadIcon sx={{ mr: 1 }} fontSize="small" />
          Download FHIR Bundle
        </MenuItem>
        
        <MenuItem onClick={() => { setPushDialogOpen(true); handleClose(); }}>
          <UploadIcon sx={{ mr: 1 }} fontSize="small" />
          Push to FHIR Server
        </MenuItem>
      </Menu>

      {/* Push to Server Dialog */}
      <Dialog 
        open={pushDialogOpen} 
        onClose={() => setPushDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Push to FHIR Server
          <IconButton
            onClick={() => setPushDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Enter the URL of your FHIR R4 server to push this report.
            </Typography>
            
            <TextField
              fullWidth
              label="FHIR Server URL"
              placeholder="https://fhir-server.example.com"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              helperText="Example: https://hapi.fhir.org/baseR4"
              sx={{ mb: 2 }}
            />

            <Alert severity="info" sx={{ mb: 2 }}>
              This will push the report as a FHIR DiagnosticReport resource to the specified server.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPushDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => pushToServer('report')}
            variant="contained"
            disabled={!serverUrl || loading}
            startIcon={loading ? <CircularProgress size={20} /> : <UploadIcon />}
          >
            Push Report
          </Button>
          <Button
            onClick={() => pushToServer('bundle')}
            variant="contained"
            disabled={!serverUrl || loading}
            startIcon={loading ? <CircularProgress size={20} /> : <UploadIcon />}
          >
            Push Bundle
          </Button>
        </DialogActions>
      </Dialog>

      {/* Export Status Dialog */}
      <Dialog
        open={statusDialogOpen}
        onClose={() => setStatusDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          FHIR Export Status
          <IconButton
            onClick={() => setStatusDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {exportStatus && (
            <Box sx={{ pt: 2 }}>
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Report Status
                </Typography>
                <Chip 
                  label={exportStatus.status.toUpperCase()} 
                  color={exportStatus.status === 'final' ? 'success' : 'warning'}
                  size="small"
                />
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Export Readiness
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {exportStatus.hasFindings ? (
                      <CheckIcon color="success" fontSize="small" />
                    ) : (
                      <WarningIcon color="warning" fontSize="small" />
                    )}
                    <Typography variant="body2">
                      Findings: {exportStatus.hasFindings ? 'Present' : 'Missing'}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {exportStatus.hasImpression ? (
                      <CheckIcon color="success" fontSize="small" />
                    ) : (
                      <WarningIcon color="warning" fontSize="small" />
                    )}
                    <Typography variant="body2">
                      Impression: {exportStatus.hasImpression ? 'Present' : 'Missing'}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {exportStatus.isSigned ? (
                      <CheckIcon color="success" fontSize="small" />
                    ) : (
                      <WarningIcon color="warning" fontSize="small" />
                    )}
                    <Typography variant="body2">
                      Signature: {exportStatus.isSigned ? 'Signed' : 'Not signed'}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {exportStatus.warnings.length > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Warnings:
                  </Typography>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {exportStatus.warnings.map((warning, index) => (
                      <li key={index}>
                        <Typography variant="body2">{warning}</Typography>
                      </li>
                    ))}
                  </ul>
                </Alert>
              )}

              {exportStatus.canExport ? (
                <Alert severity="success">
                  This report is ready for FHIR export.
                </Alert>
              ) : (
                <Alert severity="error">
                  This report cannot be exported yet. Please complete the required fields.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Snackbar */}
      {success && (
        <Alert 
          severity="success" 
          onClose={() => setSuccess(null)}
          sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}
        >
          {success}
        </Alert>
      )}

      {/* Error Snackbar */}
      {error && (
        <Alert 
          severity="error" 
          onClose={() => setError(null)}
          sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}
        >
          {error}
        </Alert>
      )}
    </>
  );
};

export default FHIRExportButton;
