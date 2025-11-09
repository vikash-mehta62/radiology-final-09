import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  TextField,
  InputAdornment
} from '@mui/material';
import {
  AttachMoney as BillingIcon,
  Description as DescriptionIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  CheckCircle as ApprovedIcon,
  Pending as PendingIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import axios from 'axios';
import { getAuthToken } from '@/services/ApiService';

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://3.144.196.75:8001';

const axiosClient = axios.create({
  baseURL: backendUrl,
  withCredentials: true,
});

axiosClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const BillingPage: React.FC = () => {
  const [superbills, setSuperbills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    approved: 0,
    submitted: 0,
    totalCharges: 0
  });

  useEffect(() => {
    loadSuperbills();
  }, []);

  const loadSuperbills = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // In a real implementation, you'd have an endpoint to list all superbills
      // For now, we'll show a message
      setSuperbills([]);
      setStats({
        total: 0,
        draft: 0,
        approved: 0,
        submitted: 0,
        totalCharges: 0
      });
    } catch (err: any) {
      setError('Failed to load superbills');
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async (superbillId: string) => {
    try {
      const response = await axiosClient.get(
        `/api/billing/superbills/${superbillId}/export/pdf`,
        { responseType: 'blob' }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `superbill-${superbillId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export superbill');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <ApprovedIcon sx={{ color: '#4caf50' }} />;
      case 'draft':
        return <PendingIcon sx={{ color: '#ff9800' }} />;
      default:
        return <ErrorIcon sx={{ color: '#f44336' }} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'draft':
        return 'warning';
      case 'submitted':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <BillingIcon sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
              Billing & Superbills
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage billing codes and generate superbills
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Total Superbills
              </Typography>
              <Typography variant="h4">{stats.total}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Draft
              </Typography>
              <Typography variant="h4" sx={{ color: '#ff9800' }}>
                {stats.draft}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Approved
              </Typography>
              <Typography variant="h4" sx={{ color: '#4caf50' }}>
                {stats.approved}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Total Charges
              </Typography>
              <Typography variant="h4" sx={{ color: '#2196f3' }}>
                ${stats.totalCharges.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Info Alert */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>How to create superbills:</strong> Go to Patients → Select a study → 
          Open Structured Reporting → Click the "💰 Billing" tab → Use AI to suggest codes → 
          Create superbill
        </Typography>
      </Alert>

      {/* Search and Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search by patient name, superbill number, or study..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      {/* Superbills Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Superbill #</TableCell>
                <TableCell>Patient</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>CPT Codes</TableCell>
                <TableCell>ICD-10 Codes</TableCell>
                <TableCell>Charges</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : superbills.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Box sx={{ py: 4 }}>
                      <DescriptionIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                      <Typography variant="h6" color="text.secondary">
                        No superbills yet
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Create your first superbill from the Structured Reporting billing tab
                      </Typography>
                      <Button
                        variant="contained"
                        sx={{ mt: 2 }}
                        onClick={() => window.location.href = '/patients'}
                      >
                        Go to Patients
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                superbills.map((superbill) => (
                  <TableRow key={superbill._id}>
                    <TableCell>{superbill.superbillNumber}</TableCell>
                    <TableCell>{superbill.patientName}</TableCell>
                    <TableCell>
                      {new Date(superbill.dateOfService).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{superbill.cptCodes?.length || 0}</TableCell>
                    <TableCell>{superbill.icd10Codes?.length || 0}</TableCell>
                    <TableCell>${superbill.totalCharges?.toFixed(2)}</TableCell>
                    <TableCell>
                      <Chip
                        icon={getStatusIcon(superbill.status)}
                        label={superbill.status}
                        color={getStatusColor(superbill.status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="View">
                        <IconButton size="small">
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Export PDF">
                        <IconButton
                          size="small"
                          onClick={() => handleExportPDF(superbill._id)}
                        >
                          <DownloadIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default BillingPage;
