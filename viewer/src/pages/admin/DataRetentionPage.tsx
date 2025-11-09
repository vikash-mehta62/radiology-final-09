/**
 * Data Retention Management Page
 * HIPAA-compliant data retention and archival management
 * Route: /admin/data-retention
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  LinearProgress
} from '@mui/material';
import {
  Archive,
  Delete,
  Refresh,
  Storage,
  Schedule,
  CheckCircle,
  Warning,
  Info
} from '@mui/icons-material';
import { Helmet } from 'react-helmet-async';

interface RetentionPolicy {
  [key: string]: number;
}

interface ArchiveStatistics {
  [key: string]: {
    total: number;
    archived: number;
    active: number;
    oldestRecord?: string;
    newestRecord?: string;
  };
}

const DataRetentionPage: React.FC = () => {
  const [policies, setPolicies] = useState<RetentionPolicy>({});
  const [statistics, setStatistics] = useState<ArchiveStatistics>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [selectedDataType, setSelectedDataType] = useState<string>('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });

  // Fetch policies
  const fetchPolicies = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/data-retention/policies', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch policies');

      const data = await response.json();
      setPolicies(data.policies || {});
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch statistics
  const fetchStatistics = async () => {
    try {
      const response = await fetch('/api/data-retention/archives/statistics', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStatistics(data.statistics || {});
      }
    } catch (err) {
      console.error('Error fetching statistics:', err);
    }
  };

  useEffect(() => {
    fetchPolicies();
    fetchStatistics();
  }, []);

  // Run archival
  const handleRunArchival = async () => {
    if (!confirm('This will archive old data according to retention policies. Continue?')) {
      return;
    }

    setArchiving(true);
    setError(null);
    try {
      const response = await fetch('/api/data-retention/run-archival', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (!response.ok) throw new Error('Failed to run archival');

      setSuccess('Archival process completed successfully');
      fetchStatistics();

      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setArchiving(false);
    }
  };

  // Archive specific data type
  const handleArchiveDataType = async () => {
    if (!selectedDataType || !dateRange.startDate || !dateRange.endDate) {
      setError('Please select data type and date range');
      return;
    }

    setArchiving(true);
    setError(null);
    try {
      const endpoint = `/api/data-retention/archive/${selectedDataType}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify(dateRange)
      });

      if (!response.ok) throw new Error('Failed to archive data');

      setSuccess(`${selectedDataType} archived successfully`);
      setArchiveDialogOpen(false);
      fetchStatistics();

      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setArchiving(false);
    }
  };

  // Delete expired data
  const handleDeleteExpired = async (dataType: string) => {
    if (!confirm(`This will permanently delete expired ${dataType}. This action cannot be undone. Continue?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/data-retention/expired/${dataType}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete expired data');

      setSuccess(`Expired ${dataType} deleted successfully`);
      fetchStatistics();

      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Calculate retention in years
  const daysToYears = (days: number) => {
    return (days / 365).toFixed(1);
  };

  // Calculate archive percentage
  const getArchivePercentage = (stats: any) => {
    if (!stats || stats.total === 0) return 0;
    return Math.round((stats.archived / stats.total) * 100);
  };

  return (
    <>
      <Helmet>
        <title>Data Retention Management - Medical Imaging</title>
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
                <Storage sx={{ mr: 1, verticalAlign: 'middle' }} />
                Data Retention Management
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                HIPAA-compliant data archival and retention policies
              </Typography>
            </Box>
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={() => {
                  fetchPolicies();
                  fetchStatistics();
                }}
                sx={{
                  color: 'white',
                  borderColor: 'rgba(255,255,255,0.5)',
                  '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' }
                }}
              >
                Refresh
              </Button>
              <Button
                variant="contained"
                startIcon={archiving ? <CircularProgress size={20} color="inherit" /> : <Archive />}
                onClick={handleRunArchival}
                disabled={archiving}
                sx={{
                  bgcolor: 'white',
                  color: 'primary.main',
                  '&:hover': { bgcolor: 'grey.100' }
                }}
              >
                {archiving ? 'Archiving...' : 'Run Archival'}
              </Button>
            </Stack>
          </Stack>
        </Paper>

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

        {/* Retention Policies */}
        <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
          <Schedule sx={{ mr: 1 }} />
          Retention Policies
        </Typography>
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {loading ? (
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
                <CircularProgress />
              </Box>
            </Grid>
          ) : Object.keys(policies).length === 0 ? (
            <Grid item xs={12}>
              <Alert severity="info">
                No retention policies configured
              </Alert>
            </Grid>
          ) : (
            Object.entries(policies).map(([key, value]) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={key}>
                <Card>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </Typography>
                      <Chip
                        label={`${daysToYears(value)} years`}
                        size="small"
                        color="primary"
                      />
                    </Stack>
                    <Typography variant="h4" fontWeight="bold" color="primary.main">
                      {value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      days retention
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))
          )}
        </Grid>

        {/* Archive Statistics */}
        <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
          <Archive sx={{ mr: 1 }} />
          Archive Statistics
        </Typography>
        <TableContainer component={Paper} sx={{ mb: 3 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell>Data Type</TableCell>
                <TableCell align="right">Total Records</TableCell>
                <TableCell align="right">Archived</TableCell>
                <TableCell align="right">Active</TableCell>
                <TableCell>Archive Progress</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.keys(statistics).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 10 }}>
                    <Storage sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No archive statistics available
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Run archival process to generate statistics
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                Object.entries(statistics).map(([key, value]) => {
                  const percentage = getArchivePercentage(value);
                  return (
                    <TableRow key={key} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {value.total?.toLocaleString() || 0}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          label={value.archived?.toLocaleString() || 0}
                          size="small"
                          color="success"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          label={value.active?.toLocaleString() || 0}
                          size="small"
                          color="primary"
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={percentage}
                            sx={{ flex: 1, height: 8, borderRadius: 1 }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {percentage}%
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={1} justifyContent="center">
                          <Button
                            size="small"
                            startIcon={<Archive />}
                            onClick={() => {
                              setSelectedDataType(key);
                              setArchiveDialogOpen(true);
                            }}
                          >
                            Archive
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            startIcon={<Delete />}
                            onClick={() => handleDeleteExpired(key)}
                          >
                            Delete Expired
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Info Cards */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Alert severity="info" icon={<Info />}>
              <Typography variant="body2" fontWeight="bold" gutterBottom>
                HIPAA Compliance
              </Typography>
              <Typography variant="caption">
                Data retention policies are configured to meet HIPAA requirements.
                Medical records are retained for a minimum of 6 years, and audit logs
                for 7 years as required by federal regulations.
              </Typography>
            </Alert>
          </Grid>
          <Grid item xs={12} md={6}>
            <Alert severity="warning" icon={<Warning />}>
              <Typography variant="body2" fontWeight="bold" gutterBottom>
                Archival Process
              </Typography>
              <Typography variant="caption">
                The archival process moves old data to long-term storage while maintaining
                accessibility for compliance purposes. Archived data can still be retrieved
                but is not included in active queries.
              </Typography>
            </Alert>
          </Grid>
        </Grid>
      </Box>

      {/* Archive Dialog */}
      <Dialog
        open={archiveDialogOpen}
        onClose={() => setArchiveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6" fontWeight="bold">
            Archive {selectedDataType}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Select the date range for data to archive
          </Typography>

          <TextField
            fullWidth
            label="Start Date"
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="End Date"
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />

          <Alert severity="warning" sx={{ mt: 3 }}>
            <Typography variant="caption">
              <strong>Note:</strong> Archived data will be moved to long-term storage
              and will not appear in active queries. Data can still be retrieved for
              compliance purposes.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setArchiveDialogOpen(false)} disabled={archiving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleArchiveDataType}
            disabled={archiving || !dateRange.startDate || !dateRange.endDate}
            startIcon={archiving ? <CircularProgress size={20} color="inherit" /> : <Archive />}
          >
            {archiving ? 'Archiving...' : 'Archive Data'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default DataRetentionPage;
