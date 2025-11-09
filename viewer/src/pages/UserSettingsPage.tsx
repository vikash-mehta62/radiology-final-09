/**
 * User Settings Page
 * Manage radiologist profile, signature, and preferences
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Avatar,
  Divider,
  Alert,
  Snackbar,
  Tab,
  Tabs,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Save as SaveIcon,
  Upload as UploadIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Person as PersonIcon
} from '@mui/icons-material';

interface UserProfile {
  username: string;
  email: string;
  fullName: string;
  role: string;
  hospitalId: string;
  hospitalName: string;
  licenseNumber?: string;
  specialty?: string;
  signatureText?: string;
  signatureImageUrl?: string;
}

const UserSettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [profile, setProfile] = useState<UserProfile>({
    username: '',
    email: '',
    fullName: '',
    role: '',
    hospitalId: '',
    hospitalName: ''
  });
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
      const response = await fetch('/api/users/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile);
        if (data.profile.signatureImageUrl) {
          setSignaturePreview(data.profile.signatureImageUrl);
        }
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  const handleProfileUpdate = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fullName: profile.fullName,
          email: profile.email,
          licenseNumber: profile.licenseNumber,
          specialty: profile.specialty,
          signatureText: profile.signatureText
        })
      });

      if (response.ok) {
        setSnackbar({ open: true, message: 'Profile updated successfully', severity: 'success' });
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to update profile', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSignatureUpload = async () => {
    if (!signatureFile) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
      const formData = new FormData();
      formData.append('signature', signatureFile);

      const response = await fetch('/api/users/signature', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setSignaturePreview(data.signatureUrl);
        setProfile({ ...profile, signatureImageUrl: data.signatureUrl });
        setSnackbar({ open: true, message: 'Signature uploaded successfully', severity: 'success' });
      } else {
        throw new Error('Failed to upload signature');
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to upload signature', severity: 'error' });
    } finally {
      setLoading(false);
      setSignatureFile(null);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSignatureFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSignaturePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteSignature = async () => {
    if (!confirm('Are you sure you want to delete your signature?')) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
      const response = await fetch('/api/users/signature', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setSignaturePreview('');
        setProfile({ ...profile, signatureImageUrl: undefined });
        setSnackbar({ open: true, message: 'Signature deleted successfully', severity: 'success' });
      } else {
        throw new Error('Failed to delete signature');
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to delete signature', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.main' }}>
            <PersonIcon sx={{ fontSize: 40 }} />
          </Avatar>
          <Box>
            <Typography variant="h4">User Settings</Typography>
            <Typography variant="body2" color="text.secondary">
              Manage your profile and signature
            </Typography>
          </Box>
        </Box>

        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3 }}>
          <Tab label="Profile Information" />
          <Tab label="Digital Signature" />
          <Tab label="Preferences" />
        </Tabs>

        <Divider sx={{ mb: 3 }} />

        {/* Profile Tab */}
        {activeTab === 0 && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Username"
                value={profile.username}
                disabled
                helperText="Username cannot be changed"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Full Name"
                value={profile.fullName}
                onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Role"
                value={profile.role}
                disabled
                helperText="Role is assigned by administrator"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="License Number"
                value={profile.licenseNumber || ''}
                onChange={(e) => setProfile({ ...profile, licenseNumber: e.target.value })}
                helperText="Medical license number"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Specialty"
                value={profile.specialty || ''}
                onChange={(e) => setProfile({ ...profile, specialty: e.target.value })}
                helperText="e.g., Diagnostic Radiology, Neuroradiology"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Hospital/Organization"
                value={profile.hospitalName}
                disabled
                helperText="Organization is assigned by administrator"
              />
            </Grid>
            <Grid item xs={12}>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleProfileUpdate}
                disabled={loading}
              >
                Save Profile
              </Button>
            </Grid>
          </Grid>
        )}

        {/* Signature Tab */}
        {activeTab === 1 && (
          <Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              Your digital signature will be used when signing reports. You can upload an image of your signature or use text-based signature.
            </Alert>

            <Grid container spacing={3}>
              {/* Text Signature */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Text Signature
                    </Typography>
                    <TextField
                      fullWidth
                      label="Signature Text"
                      value={profile.signatureText || ''}
                      onChange={(e) => setProfile({ ...profile, signatureText: e.target.value })}
                      placeholder="e.g., Dr. John Smith, MD"
                      helperText="This text will appear on signed reports"
                      sx={{ mb: 2 }}
                    />
                    <Button
                      variant="outlined"
                      startIcon={<SaveIcon />}
                      onClick={handleProfileUpdate}
                      disabled={loading}
                    >
                      Save Text Signature
                    </Button>
                  </CardContent>
                </Card>
              </Grid>

              {/* Image Signature */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Image Signature
                    </Typography>
                    
                    {signaturePreview && (
                      <Box sx={{ mb: 2, p: 2, border: '1px solid #ddd', borderRadius: 1, bgcolor: 'white' }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Current Signature:
                        </Typography>
                        <img 
                          src={signaturePreview} 
                          alt="Signature" 
                          style={{ maxWidth: '300px', maxHeight: '100px', display: 'block' }}
                        />
                        <Box mt={1}>
                          <Tooltip title="Delete signature">
                            <IconButton size="small" color="error" onClick={handleDeleteSignature}>
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                    )}

                    <Box display="flex" gap={2} alignItems="center">
                      <input
                        accept="image/*"
                        style={{ display: 'none' }}
                        id="signature-upload"
                        type="file"
                        onChange={handleFileSelect}
                      />
                      <label htmlFor="signature-upload">
                        <Button
                          variant="outlined"
                          component="span"
                          startIcon={<UploadIcon />}
                        >
                          Choose Image
                        </Button>
                      </label>
                      
                      {signatureFile && (
                        <Button
                          variant="contained"
                          startIcon={<SaveIcon />}
                          onClick={handleSignatureUpload}
                          disabled={loading}
                        >
                          Upload Signature
                        </Button>
                      )}
                    </Box>
                    
                    <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                      Supported formats: JPG, PNG, GIF (max 5MB)
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Preferences Tab */}
        {activeTab === 2 && (
          <Box>
            <Alert severity="info">
              Additional preferences coming soon...
            </Alert>
          </Box>
        )}
      </Paper>

      {/* Snackbar */}
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
    </Box>
  );
};

export default UserSettingsPage;
