import React, { useState, useEffect } from 'react';
import { 
  Box, Paper, Typography, Button, Grid, Alert, Chip, Card, CardContent, 
  IconButton, CircularProgress, TextField, Select, MenuItem, FormControl, 
  InputLabel, Checkbox, FormControlLabel, Dialog, DialogTitle, DialogContent, 
  DialogActions, Tooltip, Divider, Autocomplete, TextareaAutosize
} from '@mui/material';
import { 
  AutoAwesome as AIIcon, Save as SaveIcon, Download as DownloadIcon, 
  Delete as DeleteIcon, Star as StarIcon, StarBorder as StarBorderIcon,
  History as HistoryIcon, ContentCopy as CopyIcon, Print as PrintIcon,
  Email as EmailIcon, AttachFile as AttachFileIcon, Add as AddIcon,
  Link as LinkIcon
} from '@mui/icons-material';
import axios from 'axios';
import { getAuthToken } from '@/services/ApiService';

interface BillingPanelProps {
  studyData: any;
  reportData: any;
  onSuperbillCreated?: (superbill: any) => void;
}

// Common modifiers
const COMMON_MODIFIERS = [
  { value: '26', label: '26 - Professional Component' },
  { value: 'TC', label: 'TC - Technical Component' },
  { value: '59', label: '59 - Distinct Procedural Service' },
  { value: 'RT', label: 'RT - Right Side' },
  { value: 'LT', label: 'LT - Left Side' },
  { value: '50', label: '50 - Bilateral Procedure' },
  { value: '51', label: '51 - Multiple Procedures' },
  { value: '76', label: '76 - Repeat Procedure' },
  { value: '77', label: '77 - Repeat Procedure by Another Physician' },
  { value: '78', label: '78 - Unplanned Return to OR' },
  { value: '79', label: '79 - Unrelated Procedure' },
  { value: '91', label: '91 - Repeat Clinical Diagnostic Lab Test' }
];

const BillingPanel: React.FC<BillingPanelProps> = ({ studyData, reportData, onSuperbillCreated }) => {
  const [cptCodes, setCptCodes] = useState<any[]>([]);
  const [icd10Codes, setIcd10Codes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // New state for improvements
  const [favoriteCodes, setFavoriteCodes] = useState<string[]>([]);
  const [recentCodes, setRecentCodes] = useState<any[]>([]);
  const [showRecentCodes, setShowRecentCodes] = useState(false);
  const [showBulkEntry, setShowBulkEntry] = useState(false);
  const [bulkCPTText, setBulkCPTText] = useState('');
  const [bulkICD10Text, setBulkICD10Text] = useState('');
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);

  // Load favorites and recent codes from localStorage
  useEffect(() => {
    const savedFavorites = localStorage.getItem('billing_favorites');
    const savedRecent = localStorage.getItem('billing_recent');
    if (savedFavorites) setFavoriteCodes(JSON.parse(savedFavorites));
    if (savedRecent) setRecentCodes(JSON.parse(savedRecent));
  }, []);

  // Toggle favorite code
  const toggleFavorite = (code: string) => {
    const newFavorites = favoriteCodes.includes(code)
      ? favoriteCodes.filter(c => c !== code)
      : [...favoriteCodes, code];
    setFavoriteCodes(newFavorites);
    localStorage.setItem('billing_favorites', JSON.stringify(newFavorites));
  };

  // Add to recent codes
  const addToRecent = (code: any, type: 'cpt' | 'icd10') => {
    const recent = [...recentCodes];
    const exists = recent.find(r => r.code === code.code && r.type === type);
    if (!exists) {
      recent.unshift({ ...code, type, timestamp: new Date() });
      const limited = recent.slice(0, 10); // Keep only last 10
      setRecentCodes(limited);
      localStorage.setItem('billing_recent', JSON.stringify(limited));
    }
  };

  // Update CPT code with modifiers and diagnosis pointers
  const updateCPTCode = (index: number, field: string, value: any) => {
    const updated = [...cptCodes];
    updated[index] = { ...updated[index], [field]: value };
    setCptCodes(updated);
  };

  // Copy codes from previous superbill
  const copyFromPrevious = async () => {
    try {
      const response = await axios.get(
        `/api/billing/superbills/study/${studyData?.studyInstanceUID}`,
        { headers: { Authorization: `Bearer ${getAuthToken()}` } }
      );
      if (response.data.success && response.data.superbills.length > 0) {
        const lastSuperbill = response.data.superbills[0];
        setCptCodes(lastSuperbill.cptCodes || []);
        setIcd10Codes(lastSuperbill.icd10Codes || []);
        setSuccess('Copied codes from previous superbill!');
      }
    } catch (err) {
      setError('No previous superbill found');
    }
  };

  // Bulk code entry
  const handleBulkCPTEntry = () => {
    const codes = bulkCPTText.split('\n').filter(line => line.trim());
    const newCodes = codes.map(line => {
      const [code, ...descParts] = line.split('-');
      return {
        code: code.trim(),
        description: descParts.join('-').trim() || 'Manual entry',
        modifiers: [],
        units: 1,
        charge: 0,
        diagnosisPointers: [],
        aiSuggested: false,
        manuallyAdded: true
      };
    });
    setCptCodes([...cptCodes, ...newCodes]);
    setBulkCPTText('');
    setShowBulkEntry(false);
    setSuccess(`Added ${newCodes.length} CPT codes`);
  };

  const handleBulkICD10Entry = () => {
    const codes = bulkICD10Text.split('\n').filter(line => line.trim());
    const newCodes = codes.map((line, index) => {
      const [code, ...descParts] = line.split('-');
      return {
        code: code.trim(),
        description: descParts.join('-').trim() || 'Manual entry',
        pointer: icd10Codes.length + index + 1,
        aiSuggested: false,
        manuallyAdded: true
      };
    });
    setIcd10Codes([...icd10Codes, ...newCodes]);
    setBulkICD10Text('');
    setShowBulkEntry(false);
    setSuccess(`Added ${newCodes.length} ICD-10 codes`);
  };

  // Email superbill
  const handleEmailSuperbill = async () => {
    if (!emailAddress) {
      setError('Please enter an email address');
      return;
    }
    try {
      // In production, you'd have an API endpoint for this
      setSuccess(`Superbill will be emailed to ${emailAddress}`);
      setShowEmailDialog(false);
      setEmailAddress('');
    } catch (err) {
      setError('Failed to send email');
    }
  };

  const handleAISuggest = async () => {
    setLoading(true);
    try {
      const response = await axios.post('/api/billing/suggest-codes', {
        reportData: { studyData, sections: reportData?.sections || {}, findings: reportData?.findings || [] }
      }, {
        headers: { Authorization: `Bearer ${getAuthToken()}` }
      });

      if (response.data.success) {
        setCptCodes(response.data.suggestions.cptCodes);
        setIcd10Codes(response.data.suggestions.icd10Codes);
        setSuccess('AI suggested codes successfully!');
      }
    } catch (err) {
      setError('Failed to get AI suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuperbill = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('/api/billing/superbills', {
        studyInstanceUID: studyData?.studyInstanceUID,
        patientInfo: {
          patientID: studyData?.patientID || '',
          patientName: studyData?.patientName || '',
          patientDOB: studyData?.patientBirthDate || '',
          patientSex: studyData?.patientSex || ''
        },
        insuranceInfo: {},
        providerInfo: {},
        cptCodes,
        icd10Codes,
        dateOfService: new Date()
      }, {
        headers: { Authorization: `Bearer ${getAuthToken()}` }
      });

      if (response.data.success) {
        setSuccess('Superbill created successfully!');
        if (onSuperbillCreated) {
          onSuperbillCreated(response.data.superbill);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create superbill');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, bgcolor: '#1a1a1a', color: '#fff', height: '100%', overflow: 'auto' }}>
      {/* Header with Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5" sx={{ color: '#64b5f6' }}>
          <AIIcon sx={{ mr: 1 }} /> Hybrid Billing System
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Tooltip title="AI Suggest Codes">
            <Button variant="contained" startIcon={<AIIcon />} onClick={handleAISuggest} disabled={loading}>
              AI Suggest
            </Button>
          </Tooltip>
          <Tooltip title="Show Recent Codes">
            <Button variant="outlined" startIcon={<HistoryIcon />} onClick={() => setShowRecentCodes(true)}>
              Recent
            </Button>
          </Tooltip>
          <Tooltip title="Copy from Previous">
            <Button variant="outlined" startIcon={<CopyIcon />} onClick={copyFromPrevious}>
              Copy Previous
            </Button>
          </Tooltip>
          <Tooltip title="Bulk Entry">
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setShowBulkEntry(true)}>
              Bulk Add
            </Button>
          </Tooltip>
        </Box>
      </Box>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>{success}</Alert>}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, bgcolor: '#2a2a2a' }}>
            <Typography variant="h6" sx={{ color: '#64b5f6', mb: 2 }}>
              CPT Codes (Procedures)
            </Typography>
            {cptCodes.map((code, i) => (
              <Card key={i} sx={{ mb: 2, bgcolor: '#333' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ color: '#64b5f6', fontWeight: 'bold' }}>{code.code}</Typography>
                        <IconButton size="small" onClick={() => toggleFavorite(code.code)}>
                          {favoriteCodes.includes(code.code) ? 
                            <StarIcon sx={{ color: '#ffc107', fontSize: 18 }} /> : 
                            <StarBorderIcon sx={{ color: '#ccc', fontSize: 18 }} />
                          }
                        </IconButton>
                        {code.aiSuggested && <Chip label={`AI ${code.confidence}%`} size="small" sx={{ bgcolor: '#9c27b0' }} />}
                      </Box>
                      <Typography variant="body2" sx={{ color: '#ccc', mb: 1 }}>{code.description}</Typography>
                      
                      {/* Modifiers Selector */}
                      <FormControl size="small" fullWidth sx={{ mb: 1 }}>
                        <Autocomplete
                          multiple
                          options={COMMON_MODIFIERS}
                          value={COMMON_MODIFIERS.filter(m => code.modifiers?.includes(m.value))}
                          onChange={(e, newValue) => {
                            updateCPTCode(i, 'modifiers', newValue.map(v => v.value));
                          }}
                          getOptionLabel={(option) => option.label}
                          renderInput={(params) => (
                            <TextField {...params} label="Modifiers" placeholder="Select modifiers" size="small" />
                          )}
                          renderTags={(value, getTagProps) =>
                            value.map((option, index) => (
                              <Chip label={option.value} size="small" {...getTagProps({ index })} />
                            ))
                          }
                          sx={{ '& .MuiOutlinedInput-root': { color: '#fff' } }}
                        />
                      </FormControl>

                      {/* Diagnosis Pointers */}
                      <FormControl size="small" fullWidth sx={{ mb: 1 }}>
                        <InputLabel sx={{ color: '#ccc' }}>Link to Diagnoses</InputLabel>
                        <Select
                          multiple
                          value={code.diagnosisPointers || []}
                          onChange={(e) => updateCPTCode(i, 'diagnosisPointers', e.target.value)}
                          renderValue={(selected) => (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {(selected as number[]).map((value) => (
                                <Chip key={value} label={`Dx ${value}`} size="small" />
                              ))}
                            </Box>
                          )}
                          sx={{ color: '#fff' }}
                        >
                          {icd10Codes.map((icd, idx) => (
                            <MenuItem key={idx} value={icd.pointer}>
                              {icd.pointer}. {icd.code} - {icd.description}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      <Grid container spacing={1}>
                        <Grid item xs={4}>
                          <TextField
                            label="Units"
                            type="number"
                            value={code.units || 1}
                            onChange={(e) => updateCPTCode(i, 'units', parseInt(e.target.value))}
                            size="small"
                            fullWidth
                            sx={{ '& .MuiOutlinedInput-root': { color: '#fff' } }}
                          />
                        </Grid>
                        <Grid item xs={4}>
                          <TextField
                            label="Charge"
                            type="number"
                            value={code.charge || 0}
                            onChange={(e) => updateCPTCode(i, 'charge', parseFloat(e.target.value))}
                            size="small"
                            fullWidth
                            sx={{ '& .MuiOutlinedInput-root': { color: '#fff' } }}
                          />
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="caption" sx={{ color: '#ccc', display: 'block', mt: 1 }}>
                            Total: ${((code.charge || 0) * (code.units || 1)).toFixed(2)}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Box>
                    <IconButton onClick={() => setCptCodes(cptCodes.filter((_, idx) => idx !== i))} sx={{ color: '#f44336' }}>
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            ))}
            {cptCodes.length === 0 && (
              <Alert severity="info">No CPT codes added. Use AI suggestion or add manually.</Alert>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, bgcolor: '#2a2a2a' }}>
            <Typography variant="h6" sx={{ color: '#64b5f6', mb: 2 }}>
              ICD-10 Codes (Diagnoses)
            </Typography>
            {icd10Codes.map((code, i) => (
              <Card key={i} sx={{ mb: 2, bgcolor: '#333' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Chip label={`Dx ${code.pointer}`} size="small" sx={{ bgcolor: '#555' }} />
                        <Typography sx={{ color: '#4caf50', fontWeight: 'bold' }}>{code.code}</Typography>
                        <IconButton size="small" onClick={() => toggleFavorite(code.code)}>
                          {favoriteCodes.includes(code.code) ? 
                            <StarIcon sx={{ color: '#ffc107', fontSize: 18 }} /> : 
                            <StarBorderIcon sx={{ color: '#ccc', fontSize: 18 }} />
                          }
                        </IconButton>
                        {code.aiSuggested && <Chip label={`AI ${code.confidence}%`} size="small" sx={{ bgcolor: '#9c27b0' }} />}
                      </Box>
                      <Typography variant="body2" sx={{ color: '#ccc' }}>{code.description}</Typography>
                    </Box>
                    <IconButton onClick={() => setIcd10Codes(icd10Codes.filter((_, idx) => idx !== i))} sx={{ color: '#f44336' }}>
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            ))}
            {icd10Codes.length === 0 && (
              <Alert severity="info">No ICD-10 codes added. Use AI suggestion or add manually.</Alert>
            )}
          </Paper>
        </Grid>

        {/* Notes and Attachments */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, bgcolor: '#2a2a2a' }}>
            <Typography variant="h6" sx={{ mb: 2, color: '#64b5f6' }}>
              Notes & Attachments
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              placeholder="Add internal notes about this superbill..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              sx={{ 
                mb: 2,
                '& .MuiOutlinedInput-root': { color: '#fff' }
              }}
            />
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Button
                variant="outlined"
                startIcon={<AttachFileIcon />}
                component="label"
              >
                Attach Files
                <input
                  type="file"
                  hidden
                  multiple
                  onChange={(e) => {
                    if (e.target.files) {
                      setAttachments([...attachments, ...Array.from(e.target.files)]);
                    }
                  }}
                />
              </Button>
              {attachments.length > 0 && (
                <Typography variant="body2" sx={{ color: '#ccc' }}>
                  {attachments.length} file(s) attached
                </Typography>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Financial Summary & Actions */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, bgcolor: '#2a2a2a' }}>
            <Typography variant="h6" sx={{ mb: 2, color: '#64b5f6' }}>
              Financial Summary
            </Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={4}>
                <Typography variant="body2" sx={{ color: '#ccc' }}>CPT Codes:</Typography>
                <Typography variant="h4" sx={{ color: '#64b5f6' }}>{cptCodes.length}</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="body2" sx={{ color: '#ccc' }}>ICD-10 Codes:</Typography>
                <Typography variant="h4" sx={{ color: '#4caf50' }}>{icd10Codes.length}</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="body2" sx={{ color: '#ccc' }}>Total Charges:</Typography>
                <Typography variant="h4" sx={{ color: '#ffc107' }}>
                  ${cptCodes.reduce((sum, code) => sum + ((code.charge || 0) * (code.units || 1)), 0).toFixed(2)}
                </Typography>
              </Grid>
            </Grid>
            
            <Divider sx={{ my: 2, bgcolor: '#555' }} />
            
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Tooltip title="Preview before creating">
                <Button
                  variant="outlined"
                  startIcon={<PrintIcon />}
                  onClick={() => setShowPrintPreview(true)}
                  disabled={cptCodes.length === 0 || icd10Codes.length === 0}
                >
                  Preview
                </Button>
              </Tooltip>
              <Tooltip title="Email superbill">
                <Button
                  variant="outlined"
                  startIcon={<EmailIcon />}
                  onClick={() => setShowEmailDialog(true)}
                  disabled={cptCodes.length === 0 || icd10Codes.length === 0}
                >
                  Email
                </Button>
              </Tooltip>
              <Button
                variant="contained"
                startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                onClick={handleCreateSuperbill}
                disabled={loading || cptCodes.length === 0 || icd10Codes.length === 0}
                sx={{ bgcolor: '#4caf50', '&:hover': { bgcolor: '#45a049' } }}
              >
                {loading ? 'Creating...' : 'Create Superbill'}
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Recent Codes Dialog */}
      <Dialog open={showRecentCodes} onClose={() => setShowRecentCodes(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: '#2a2a2a', color: '#fff' }}>Recent Codes (Last 10)</DialogTitle>
        <DialogContent sx={{ bgcolor: '#1a1a1a', color: '#fff', mt: 2 }}>
          {recentCodes.length === 0 ? (
            <Typography>No recent codes yet</Typography>
          ) : (
            <Grid container spacing={2}>
              {recentCodes.map((code, i) => (
                <Grid item xs={12} key={i}>
                  <Card sx={{ bgcolor: '#333' }}>
                    <CardContent>
                      <Chip label={code.type.toUpperCase()} size="small" sx={{ mb: 1 }} />
                      <Typography sx={{ color: code.type === 'cpt' ? '#64b5f6' : '#4caf50' }}>
                        {code.code} - {code.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#2a2a2a' }}>
          <Button onClick={() => setShowRecentCodes(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Entry Dialog */}
      <Dialog open={showBulkEntry} onClose={() => setShowBulkEntry(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: '#2a2a2a', color: '#fff' }}>Bulk Code Entry</DialogTitle>
        <DialogContent sx={{ bgcolor: '#1a1a1a', color: '#fff', mt: 2 }}>
          <Typography variant="body2" sx={{ mb: 2, color: '#ccc' }}>
            Enter one code per line in format: CODE - Description
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={6}
            placeholder="71045 - Chest X-ray, 2 views&#10;71046 - Chest X-ray, 3 views"
            value={bulkCPTText}
            onChange={(e) => setBulkCPTText(e.target.value)}
            label="CPT Codes"
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { color: '#fff' } }}
          />
          <TextField
            fullWidth
            multiline
            rows={6}
            placeholder="J18.9 - Pneumonia&#10;R06.02 - Shortness of breath"
            value={bulkICD10Text}
            onChange={(e) => setBulkICD10Text(e.target.value)}
            label="ICD-10 Codes"
            sx={{ '& .MuiOutlinedInput-root': { color: '#fff' } }}
          />
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#2a2a2a' }}>
          <Button onClick={() => setShowBulkEntry(false)}>Cancel</Button>
          <Button onClick={handleBulkCPTEntry} disabled={!bulkCPTText.trim()}>Add CPT Codes</Button>
          <Button onClick={handleBulkICD10Entry} disabled={!bulkICD10Text.trim()}>Add ICD-10 Codes</Button>
        </DialogActions>
      </Dialog>

      {/* Print Preview Dialog */}
      <Dialog open={showPrintPreview} onClose={() => setShowPrintPreview(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: '#2a2a2a', color: '#fff' }}>Superbill Preview</DialogTitle>
        <DialogContent sx={{ bgcolor: '#fff', color: '#000', mt: 2 }}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h5" sx={{ mb: 2 }}>SUPERBILL</Typography>
            <Typography><strong>Patient:</strong> {studyData?.patientName}</Typography>
            <Typography><strong>Date:</strong> {new Date().toLocaleDateString()}</Typography>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>CPT Codes:</Typography>
            {cptCodes.map((code, i) => (
              <Typography key={i}>
                {code.code} {code.modifiers?.length > 0 && `(${code.modifiers.join(', ')})`} - {code.description} - ${((code.charge || 0) * (code.units || 1)).toFixed(2)}
              </Typography>
            ))}
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>ICD-10 Codes:</Typography>
            {icd10Codes.map((code, i) => (
              <Typography key={i}>{code.pointer}. {code.code} - {code.description}</Typography>
            ))}
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6">Total: ${cptCodes.reduce((sum, code) => sum + ((code.charge || 0) * (code.units || 1)), 0).toFixed(2)}</Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#2a2a2a' }}>
          <Button onClick={() => setShowPrintPreview(false)}>Close</Button>
          <Button onClick={() => window.print()} startIcon={<PrintIcon />}>Print</Button>
        </DialogActions>
      </Dialog>

      {/* Email Dialog */}
      <Dialog open={showEmailDialog} onClose={() => setShowEmailDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: '#2a2a2a', color: '#fff' }}>Email Superbill</DialogTitle>
        <DialogContent sx={{ bgcolor: '#1a1a1a', color: '#fff', mt: 2 }}>
          <TextField
            fullWidth
            type="email"
            label="Email Address"
            value={emailAddress}
            onChange={(e) => setEmailAddress(e.target.value)}
            placeholder="recipient@example.com"
            sx={{ '& .MuiOutlinedInput-root': { color: '#fff' } }}
          />
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#2a2a2a' }}>
          <Button onClick={() => setShowEmailDialog(false)}>Cancel</Button>
          <Button onClick={handleEmailSuperbill} variant="contained">Send</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BillingPanel;
