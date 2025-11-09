/**
 * PHI Audit Log Page
 * HIPAA-compliant audit trail viewer
 * Route: /admin/audit-logs
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  Alert,
  Pagination,
  InputAdornment,
  IconButton,
  Tooltip,
  Stack
} from '@mui/material';
import {
  Download,
  Search,
  FilterList,
  Refresh,
  Clear,
  Security,
  Warning,
  CheckCircle,
  Error as ErrorIcon
} from '@mui/icons-material';
import { Helmet } from 'react-helmet-async';

interface AuditLog {
  _id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  patientId: string;
  patientName: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  metadata?: any;
}

const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statistics, setStatistics] = useState<any>(null);

  // Filters
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    userId: '',
    action: 'all',
    resourceType: 'all',
    success: 'all',
    limit: 50
  });

  // Fetch logs from API
  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.action !== 'all') params.append('action', filters.action);
      if (filters.resourceType !== 'all') params.append('resourceType', filters.resourceType);
      params.append('limit', filters.limit.toString());

      const response = await fetch(`/api/phi-audit/report?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch audit logs');

      const data = await response.json();
      setLogs(data.data || []);
      setTotalPages(Math.ceil((data.count || 0) / filters.limit));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch statistics
  const fetchStatistics = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const response = await fetch(`/api/phi-audit/statistics?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStatistics(data.statistics);
      }
    } catch (err) {
      console.error('Error fetching statistics:', err);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchStatistics();
  }, []);

  // Export to CSV
  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.action !== 'all') params.append('action', filters.action);
      if (filters.resourceType !== 'all') params.append('resourceType', filters.resourceType);

      const token = localStorage.getItem('accessToken');
      window.open(`/api/phi-audit/export-csv?${params.toString()}&token=${token}`, '_blank');
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Clear filters
  const handleClearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      userId: '',
      action: 'all',
      resourceType: 'all',
      success: 'all',
      limit: 50
    });
  };

  // Get action color
  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'view': return 'info';
      case 'export': return 'warning';
      case 'sign': return 'success';
      case 'delete': return 'error';
      default: return 'default';
    }
  };

  return (
    <>
      <Helmet>
        <title>PHI Audit Logs - Medical Imaging</title>
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
                <Security sx={{ mr: 1, verticalAlign: 'middle' }} />
                PHI Audit Logs
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                HIPAA-compliant access tracking and compliance reporting
              </Typography>
            </Box>
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={() => {
                  fetchLogs();
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
                startIcon={<Download />}
                onClick={handleExport}
                sx={{
                  bgcolor: 'white',
                  color: 'primary.main',
                  '&:hover': { bgcolor: 'grey.100' }
                }}
              >
                Export CSV
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {/* Statistics Cards */}
        {statistics && (
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Total Accesses
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {statistics.totalAccesses || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Successful
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="success.main">
                    {statistics.successfulAccesses || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Failed Attempts
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="error.main">
                    {statistics.failedAccesses || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Unique Users
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {statistics.uniqueUsers || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Filters */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <FilterList sx={{ mr: 1 }} />
            Filters
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Start Date"
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="End Date"
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Action</InputLabel>
                <Select
                  value={filters.action}
                  onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                  label="Action"
                >
                  <MenuItem value="all">All Actions</MenuItem>
                  <MenuItem value="view">View</MenuItem>
                  <MenuItem value="export">Export</MenuItem>
                  <MenuItem value="sign">Sign</MenuItem>
                  <MenuItem value="delete">Delete</MenuItem>
                  <MenuItem value="update">Update</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Resource Type</InputLabel>
                <Select
                  value={filters.resourceType}
                  onChange={(e) => setFilters({ ...filters, resourceType: e.target.value })}
                  label="Resource Type"
                >
                  <MenuItem value="all">All Types</MenuItem>
                  <MenuItem value="patient">Patient</MenuItem>
                  <MenuItem value="study">Study</MenuItem>
                  <MenuItem value="report">Report</MenuItem>
                  <MenuItem value="audit_report">Audit Report</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Stack direction="row" spacing={1}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<Search />}
                  onClick={fetchLogs}
                  sx={{ height: '56px' }}
                >
                  Search
                </Button>
                <Tooltip title="Clear Filters">
                  <IconButton
                    onClick={handleClearFilters}
                    sx={{ height: '56px', width: '56px' }}
                  >
                    <Clear />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Logs Table */}
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Resource</TableCell>
                  <TableCell>Patient</TableCell>
                  <TableCell>IP Address</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 10 }}>
                      <CircularProgress />
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        Loading audit logs...
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 10 }}>
                      <Security sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                      <Typography variant="h6" color="text.secondary" gutterBottom>
                        No audit logs found
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Try adjusting your filters or date range
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log._id} hover>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(log.timestamp).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {log.userName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {log.userRole}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={log.action}
                          size="small"
                          color={getActionColor(log.action) as any}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{log.resourceType}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                          {log.resourceId.substring(0, 8)}...
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{log.patientName || 'N/A'}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {log.patientId || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {log.ipAddress}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {log.success ? (
                          <Chip
                            icon={<CheckCircle />}
                            label="Success"
                            color="success"
                            size="small"
                          />
                        ) : (
                          <Chip
                            icon={<ErrorIcon />}
                            label="Failed"
                            color="error"
                            size="small"
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          {logs.length > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(e, value) => setPage(value)}
                color="primary"
              />
            </Box>
          )}
        </Paper>
      </Box>
    </>
  );
};

export default AuditLogPage;
