/**
 * IP Whitelist Management Page
 * Manage allowed IP addresses for system access
 * Route: /admin/ip-whitelist
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Alert,
  CircularProgress,
  Stack,
  Card,
  CardContent,
  Grid,
  Divider,
  Tooltip
} from '@mui/material';
import {
  Delete,
  Add,
  Refresh,
  Security,
  CheckCircle,
  Error as ErrorIcon,
  Info,
  VpnLock
} from '@mui/icons-material';
import { Helmet } from 'react-helmet-async';

interface WhitelistInfo {
  whitelist: string[];
  count: number;
  enabled: boolean;
  strictMode: boolean;
}

const IPWhitelistPage: React.FC = () => {
  const [whitelistInfo, setWhitelistInfo] = useState<WhitelistInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newIP, setNewIP] = useState('');
  const [description, setDescription] = useState('');
  const [testIP, setTestIP] = useState('');
  const [testResult, setTestResult] = useState<{ whitelisted: boolean } | null>(null);

  // Fetch whitelist
  const fetchWhitelist = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/ip-whitelist', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch whitelist');

      const data = await response.json();
      setWhitelistInfo(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWhitelist();
  }, []);

  // Add IP
  const handleAddIP = async () => {
    if (!newIP.trim()) {
      setError('IP address is required');
      return;
    }

    try {
      const response = await fetch('/api/ip-whitelist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({ ip: newIP.trim(), description: description.trim() })
      });

      if (!response.ok) throw new Error('Failed to add IP');

      setSuccess(`IP ${newIP} added successfully`);
      setAddDialogOpen(false);
      setNewIP('');
      setDescription('');
      fetchWhitelist();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Remove IP
  const handleRemoveIP = async (ip: string) => {
    if (!confirm(`Are you sure you want to remove ${ip} from the whitelist?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/ip-whitelist/${encodeURIComponent(ip)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (!response.ok) throw new Error('Failed to remove IP');

      setSuccess(`IP ${ip} removed successfully`);
      fetchWhitelist();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Test IP
  const handleTestIP = async () => {
    if (!testIP.trim()) {
      setError('IP address is required');
      return;
    }

    try {
      const response = await fetch(`/api/ip-whitelist/check/${encodeURIComponent(testIP)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (!response.ok) throw new Error('Failed to check IP');

      const data = await response.json();
      setTestResult(data.data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Reload whitelist
  const handleReload = async () => {
    try {
      const response = await fetch('/api/ip-whitelist/reload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (!response.ok) throw new Error('Failed to reload whitelist');

      setSuccess('Whitelist reloaded successfully');
      fetchWhitelist();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <>
      <Helmet>
        <title>IP Whitelist Management - Medical Imaging</title>
      </Helmet>

      <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50', p: 4 }}>
        {/* Header */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white'
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                <VpnLock sx={{ mr: 1, verticalAlign: 'middle' }} />
                IP Whitelist Management
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Control which IP addresses can access the system
              </Typography>
            </Box>
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={handleReload}
                sx={{
                  color: 'white',
                  borderColor: 'rgba(255,255,255,0.5)',
                  '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' }
                }}
              >
                Reload
              </Button>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setAddDialogOpen(true)}
                sx={{
                  bgcolor: 'white',
                  color: 'primary.main',
                  '&:hover': { bgcolor: 'grey.100' }
                }}
              >
                Add IP
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {/* Status Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Whitelist Status
                </Typography>
                <Chip
                  icon={whitelistInfo?.enabled ? <CheckCircle /> : <ErrorIcon />}
                  label={whitelistInfo?.enabled ? 'Enabled' : 'Disabled'}
                  color={whitelistInfo?.enabled ? 'success' : 'error'}
                  sx={{ mt: 1 }}
                />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Total IPs
                </Typography>
                <Typography variant="h4" fontWeight="bold">
                  {whitelistInfo?.count || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Strict Mode
                </Typography>
                <Chip
                  label={whitelistInfo?.strictMode ? 'ON' : 'OFF'}
                  color={whitelistInfo?.strictMode ? 'warning' : 'default'}
                  sx={{ mt: 1 }}
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Alerts */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Whitelist */}
          <Grid item xs={12} md={8}>
            <Paper>
              <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="h6" fontWeight="bold">
                  Whitelisted IP Addresses
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {whitelistInfo?.count || 0} IP addresses allowed
                </Typography>
              </Box>

              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
                  <CircularProgress />
                </Box>
              ) : whitelistInfo?.whitelist && whitelistInfo.whitelist.length > 0 ? (
                <List>
                  {whitelistInfo.whitelist.map((ip, index) => (
                    <React.Fragment key={index}>
                      <ListItem
                        secondaryAction={
                          <Tooltip title="Remove from whitelist">
                            <IconButton
                              edge="end"
                              onClick={() => handleRemoveIP(ip)}
                              color="error"
                            >
                              <Delete />
                            </IconButton>
                          </Tooltip>
                        }
                      >
                        <ListItemText
                          primary={
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Security color="success" fontSize="small" />
                              <Typography variant="body1" fontWeight="bold" sx={{ fontFamily: 'monospace' }}>
                                {ip}
                              </Typography>
                            </Stack>
                          }
                          secondary="Whitelisted IP address or CIDR range"
                        />
                      </ListItem>
                      {index < whitelistInfo.whitelist.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Box sx={{ textAlign: 'center', py: 10 }}>
                  <VpnLock sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No IP addresses whitelisted
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Add IP addresses to control system access
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => setAddDialogOpen(true)}
                    sx={{ mt: 2 }}
                  >
                    Add First IP
                  </Button>
                </Box>
              )}
            </Paper>
          </Grid>

          {/* Test IP */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Test IP Address
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Check if an IP is whitelisted
              </Typography>

              <TextField
                fullWidth
                label="IP Address"
                value={testIP}
                onChange={(e) => setTestIP(e.target.value)}
                placeholder="192.168.1.1"
                sx={{ mb: 2 }}
              />

              <Button
                fullWidth
                variant="contained"
                onClick={handleTestIP}
                sx={{ mb: 3 }}
              >
                Test IP
              </Button>

              {testResult && (
                <Alert
                  severity={testResult.whitelisted ? 'success' : 'error'}
                  icon={testResult.whitelisted ? <CheckCircle /> : <ErrorIcon />}
                >
                  <Typography variant="body2" fontWeight="bold">
                    {testResult.whitelisted ? 'IP is whitelisted' : 'IP is not whitelisted'}
                  </Typography>
                  <Typography variant="caption">
                    {testResult.whitelisted
                      ? 'This IP address can access the system'
                      : 'This IP address will be blocked'}
                  </Typography>
                </Alert>
              )}

              <Divider sx={{ my: 3 }} />

              <Alert severity="info" icon={<Info />}>
                <Typography variant="caption">
                  <strong>Supported formats:</strong><br />
                  • Single IP: 192.168.1.1<br />
                  • CIDR range: 192.168.1.0/24<br />
                  • IPv6: 2001:db8::1
                </Typography>
              </Alert>
            </Paper>
          </Grid>
        </Grid>
      </Box>

      {/* Add IP Dialog */}
      <Dialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6" fontWeight="bold">
            Add IP to Whitelist
          </Typography>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="IP Address or CIDR Range"
            value={newIP}
            onChange={(e) => setNewIP(e.target.value)}
            placeholder="192.168.1.1 or 192.168.1.0/24"
            sx={{ mt: 2, mb: 2 }}
            helperText="Enter a single IP address or CIDR range"
          />
          <TextField
            fullWidth
            label="Description (Optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Office network"
            helperText="Add a note to identify this IP"
          />

          <Alert severity="warning" sx={{ mt: 3 }}>
            <Typography variant="caption">
              <strong>Warning:</strong> Adding an IP to the whitelist will allow access from that address.
              Make sure you trust the source.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setAddDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAddIP}
            disabled={!newIP.trim()}
          >
            Add to Whitelist
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default IPWhitelistPage;
