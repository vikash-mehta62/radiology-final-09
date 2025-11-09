/**
 * Sign Report Dialog
 * FDA-compliant digital signature with preview
 */

import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Alert,
  Divider,
  Paper,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab
} from '@mui/material';
import {
  CheckCircle as SignIcon,
  Visibility as PreviewIcon,
  Draw as DrawIcon
} from '@mui/icons-material';
import SignatureCanvas from 'react-signature-canvas';

interface SignReportDialogProps {
  open: boolean;
  onClose: () => void;
  onSign: (signatureData: SignatureData) => Promise<void>;
  reportData: {
    patientName: string;
    patientID: string;
    modality: string;
    clinicalHistory: string;
    technique: string;
    findingsText: string;
    impression: string;
    recommendations: string;
    findings: any[];
  };
}

export interface SignatureData {
  signatureFile?: File;
  signatureText: string;
  signatureMeaning: 'authored' | 'reviewed' | 'approved' | 'verified';
  password: string;
  timestamp: Date;
}

const SignReportDialog: React.FC<SignReportDialogProps> = ({
  open,
  onClose,
  onSign,
  reportData
}) => {
  // Convert a data URL to a Blob without using fetch (CSP-safe)
  const dataUrlToBlob = (dataUrl: string): Blob => {
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const binary = atob(parts[1]);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  };

  const [activeTab, setActiveTab] = useState(0);
  const [signatureText, setSignatureText] = useState('');
  const [signatureMeaning, setSignatureMeaning] = useState<'authored' | 'reviewed' | 'approved' | 'verified'>('authored');
  const [password, setPassword] = useState('');
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const signatureCanvasRef = useRef<SignatureCanvas>(null);
  
  const handleClearSignature = () => {
    signatureCanvasRef.current?.clear();
  };
  
  const handleSign = async () => {
    setError(null);
    
    // Validation
    if (!signatureText.trim()) {
      setError('Please enter your name');
      return;
    }
    
    if (!password.trim()) {
      setError('Please enter your password for verification');
      return;
    }
    
    // Check if signature is drawn (if on draw tab)
    if (activeTab === 1 && signatureCanvasRef.current?.isEmpty()) {
      setError('Please draw your signature');
      return;
    }
    
    // Validate report content
    if (!reportData.impression || reportData.impression.trim() === '') {
      setError('Impression is required before signing');
      return;
    }
    
    if (!reportData.findingsText || reportData.findingsText.trim() === '') {
      setError('Findings are required before signing');
      return;
    }
    
    setSigning(true);
    
    try {
      // Convert signature canvas to blob if drawn
      let signatureFile: File | undefined;
      if (activeTab === 1 && signatureCanvasRef.current) {
        const dataUrl = signatureCanvasRef.current.toDataURL('image/png');
        // Avoid fetch(data:) which may be blocked by CSP; convert inline
        const blob = dataUrlToBlob(dataUrl);
        signatureFile = new File([blob], 'signature.png', { type: 'image/png' });
      }
      
      const signatureData: SignatureData = {
        signatureText: signatureText.trim(),
        signatureMeaning,
        password,
        timestamp: new Date(),
        signatureFile // Pass file instead of base64
      };
      
      await onSign(signatureData);
      
      // Reset form
      setSignatureText('');
      setPassword('');
      handleClearSignature();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to sign report');
    } finally {
      setSigning(false);
    }
  };
  
  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <SignIcon color="success" />
          <Typography variant="h6">Sign Report</Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        
        {/* Report Preview */}
        <Paper elevation={1} sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
            Report Preview
          </Typography>
          <Divider sx={{ my: 1 }} />
          
          <Stack spacing={1}>
            <Box>
              <Typography variant="caption" color="text.secondary">Patient:</Typography>
              <Typography variant="body2">{reportData.patientName} (ID: {reportData.patientID})</Typography>
            </Box>
            
            <Box>
              <Typography variant="caption" color="text.secondary">Modality:</Typography>
              <Typography variant="body2">{reportData.modality}</Typography>
            </Box>
            
            {reportData.clinicalHistory && (
              <Box>
                <Typography variant="caption" color="text.secondary">Clinical History:</Typography>
                <Typography variant="body2">{reportData.clinicalHistory}</Typography>
              </Box>
            )}
            
            {reportData.technique && (
              <Box>
                <Typography variant="caption" color="text.secondary">Technique:</Typography>
                <Typography variant="body2">{reportData.technique}</Typography>
              </Box>
            )}
            
            <Box>
              <Typography variant="caption" color="text.secondary">Findings:</Typography>
              <Typography variant="body2">
                {reportData.findingsText || 'No findings documented'}
              </Typography>
            </Box>
            
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                Impression:
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                {reportData.impression || 'No impression documented'}
              </Typography>
            </Box>
            
            {reportData.recommendations && (
              <Box>
                <Typography variant="caption" color="text.secondary">Recommendations:</Typography>
                <Typography variant="body2">{reportData.recommendations}</Typography>
              </Box>
            )}
          </Stack>
        </Paper>
        
        {/* Signature Section */}
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
          Digital Signature
        </Typography>
        
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
          <Tab label="Type Signature" />
          <Tab label="Draw Signature" />
        </Tabs>
        
        {activeTab === 0 ? (
          <Box>
            <TextField
              fullWidth
              label="Full Name"
              value={signatureText}
              onChange={(e) => setSignatureText(e.target.value)}
              placeholder="Dr. John Smith"
              required
              sx={{ mb: 2 }}
            />
          </Box>
        ) : (
          <Box>
            <Paper 
              elevation={1} 
              sx={{ 
                border: 1, 
                borderColor: 'divider',
                mb: 2
              }}
            >
              <SignatureCanvas
                ref={signatureCanvasRef}
                canvasProps={{
                  width: 500,
                  height: 200,
                  className: 'signature-canvas',
                  style: { width: '100%', height: '200px' }
                }}
              />
            </Paper>
            <Button 
              size="small" 
              onClick={handleClearSignature}
              sx={{ mb: 2 }}
            >
              Clear Signature
            </Button>
            
            <TextField
              fullWidth
              label="Full Name (for verification)"
              value={signatureText}
              onChange={(e) => setSignatureText(e.target.value)}
              placeholder="Dr. John Smith"
              required
              sx={{ mb: 2 }}
            />
          </Box>
        )}
        
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Signature Meaning</InputLabel>
          <Select
            value={signatureMeaning}
            label="Signature Meaning"
            onChange={(e) => setSignatureMeaning(e.target.value as any)}
          >
            <MenuItem value="authored">Authored (I created this report)</MenuItem>
            <MenuItem value="reviewed">Reviewed (I reviewed this report)</MenuItem>
            <MenuItem value="approved">Approved (I approve this report)</MenuItem>
            <MenuItem value="verified">Verified (I verified this report)</MenuItem>
          </Select>
        </FormControl>
        
        <TextField
          fullWidth
          type="password"
          label="Password (for verification)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          required
          helperText="Your password is required to verify your identity"
        />
        
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="caption">
            By signing this report, you certify that you have reviewed the content and 
            that it accurately represents your professional findings and conclusions.
            This signature is legally binding and FDA-compliant.
          </Typography>
        </Alert>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose} disabled={signing}>
          Cancel
        </Button>
        <Button 
          variant="contained" 
          color="success"
          onClick={handleSign}
          disabled={signing}
          startIcon={<SignIcon />}
        >
          {signing ? 'Signing...' : 'Sign Report'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SignReportDialog;
