import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  LinearProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Dashboard,
  Business,
  ContactMail,
  TrendingUp,
  People,
  Storage,
  Assessment,
  Refresh,
  Visibility,
  Edit,
  CheckCircle,
  Cancel,
  Schedule
} from '@mui/icons-material';
import axios from 'axios';
import { Line, Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip as ChartTooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  ChartTooltip,
  Legend
);

interface DashboardStats {
  overview: {
    totalHospitals: number;
    activeHospitals: number;
    totalUsers: number;
    totalStudies: number;
    pendingRequests: number;
    storage: {
      used: number;
      total: number;
      percentage: string;
    };
  };
  today: {
    totalUploads: number;
    totalViews: number;
    activeUsers: number;
  };
  recentActivity: Array<{
    type: string;
    description: string;
    timestamp: string;
  }>;
}

interface Hospital {
  _id: string;
  hospitalId: string;
  name: string;
  status: string;
  subscription: {
    plan: string;
    currentStorage: number;
    maxStorage: number;
  };
  userCount: number;
  last30Days: {
    totalUploads: number;
    totalViews: number;
    avgActiveUsers: number;
  };
  createdAt: string;
}

interface ContactRequest {
  _id: string;
  requestId: string;
  type: string;
  status: string;
  priority: string;
  contactInfo: {
    name: string;
    email: string;
    phone?: string;
    organization?: string;
  };
  details: {
    message: string;
  };
  createdAt: string;
}

const SuperAdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([]);
  const [systemAnalytics, setSystemAnalytics] = useState<any>(null);
  const [selectedRequest, setSelectedRequest] = useState<ContactRequest | null>(null);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, hospitalsRes, requestsRes, analyticsRes] = await Promise.all([
        axios.get('/api/superadmin/dashboard/stats'),
        axios.get('/api/superadmin/hospitals'),
        axios.get('/api/superadmin/contact-requests'),
        axios.get('/api/superadmin/analytics/system?period=30')
      ]);

      setDashboardStats(statsRes.data);
      setHospitals(hospitalsRes.data);
      setContactRequests(requestsRes.data);
      setSystemAnalytics(analyticsRes.data);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRequestStatus = async (requestId: string, status: string) => {
    try {
      await axios.put(`/api/superadmin/contact-requests/${requestId}`, { status });
      loadDashboardData();
    } catch (error) {
      console.error('Error updating request:', error);
    }
  };

  const handleAddNote = async () => {
    if (!selectedRequest || !noteText) return;
    try {
      await axios.post(`/api/superadmin/contact-requests/${selectedRequest._id}/notes`, {
        note: noteText
      });
      setNoteText('');
      setRequestDialogOpen(false);
      loadDashboardData();
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, any> = {
      new: 'error',
      in_progress: 'warning',
      contacted: 'info',
      converted: 'success',
      closed: 'default'
    };
    return colors[status] || 'default';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, any> = {
      urgent: 'error',
      high: 'warning',
      medium: 'info',
      low: 'default'
    };
    return colors[priority] || 'default';
  };

  if (loading) {
    return (
      <Box sx={{ width: '100%', mt: 2 }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Super Admin Dashboard
        </Typography>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={loadDashboardData}
        >
          Refresh
        </Button>
      </Box>

      {/* Overview Cards */}
      {dashboardStats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Business color="primary" sx={{ mr: 1 }} />
                  <Typography color="text.secondary" variant="body2">
                    Hospitals
                  </Typography>
                </Box>
                <Typography variant="h4" fontWeight="bold">
                  {dashboardStats.overview.totalHospitals}
                </Typography>
                <Typography variant="body2" color="success.main">
                  {dashboardStats.overview.activeHospitals} active
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <People color="primary" sx={{ mr: 1 }} />
                  <Typography color="text.secondary" variant="body2">
                    Total Users
                  </Typography>
                </Box>
                <Typography variant="h4" fontWeight="bold">
                  {dashboardStats.overview.totalUsers}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {dashboardStats.today.activeUsers} active today
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Assessment color="primary" sx={{ mr: 1 }} />
                  <Typography color="text.secondary" variant="body2">
                    Total Studies
                  </Typography>
                </Box>
                <Typography variant="h4" fontWeight="bold">
                  {dashboardStats.overview.totalStudies.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {dashboardStats.today.totalUploads} uploaded today
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <ContactMail color="primary" sx={{ mr: 1 }} />
                  <Typography color="text.secondary" variant="body2">
                    Pending Requests
                  </Typography>
                </Box>
                <Typography variant="h4" fontWeight="bold">
                  {dashboardStats.overview.pendingRequests}
                </Typography>
                <Typography variant="body2" color="warning.main">
                  Needs attention
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Storage color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">Storage Usage</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={parseFloat(dashboardStats.overview.storage.percentage)}
                  sx={{ height: 10, borderRadius: 5, mb: 1 }}
                />
                <Typography variant="body2" color="text.secondary">
                  {dashboardStats.overview.storage.used.toFixed(2)} GB / {dashboardStats.overview.storage.total} GB
                  ({dashboardStats.overview.storage.percentage}%)
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
          <Tab icon={<Dashboard />} label="Overview" />
          <Tab icon={<Business />} label="Hospitals" />
          <Tab icon={<ContactMail />} label="Contact Requests" />
          <Tab icon={<TrendingUp />} label="Analytics" />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Recent Activity
                </Typography>
                {dashboardStats?.recentActivity.map((activity, index) => (
                  <Box key={index} sx={{ mb: 2, pb: 2, borderBottom: '1px solid #eee' }}>
                    <Typography variant="body2" fontWeight="bold">
                      {activity.description}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(activity.timestamp).toLocaleString()}
                    </Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Today's Activity
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Studies Uploaded
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {dashboardStats?.today.totalUploads || 0}
                  </Typography>
                </Box>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Studies Viewed
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {dashboardStats?.today.totalViews || 0}
                  </Typography>
                </Box>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Active Users
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {dashboardStats?.today.activeUsers || 0}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 1 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Hospital Name</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Plan</TableCell>
                <TableCell>Users</TableCell>
                <TableCell>Storage</TableCell>
                <TableCell>30-Day Activity</TableCell>
                <TableCell>Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {hospitals.map((hospital) => (
                <TableRow key={hospital._id}>
                  <TableCell>{hospital.name}</TableCell>
                  <TableCell>
                    <Chip
                      label={hospital.status}
                      color={hospital.status === 'active' ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip label={hospital.subscription.plan} size="small" />
                  </TableCell>
                  <TableCell>{hospital.userCount}</TableCell>
                  <TableCell>
                    {hospital.subscription.currentStorage.toFixed(1)} / {hospital.subscription.maxStorage} GB
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      ↑ {hospital.last30Days.totalUploads} uploads
                    </Typography>
                    <Typography variant="body2">
                      👁 {hospital.last30Days.totalViews} views
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {new Date(hospital.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {activeTab === 2 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Request ID</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Organization</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {contactRequests.map((request) => (
                <TableRow key={request._id}>
                  <TableCell>{request.requestId}</TableCell>
                  <TableCell>
                    <Chip label={request.type} size="small" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{request.contactInfo.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {request.contactInfo.email}
                    </Typography>
                  </TableCell>
                  <TableCell>{request.contactInfo.organization || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={request.status}
                      color={getStatusColor(request.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={request.priority}
                      color={getPriorityColor(request.priority)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(request.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedRequest(request);
                          setRequestDialogOpen(true);
                        }}
                      >
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                    {request.status === 'new' && (
                      <Tooltip title="Mark as Contacted">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleUpdateRequestStatus(request._id, 'contacted')}
                        >
                          <CheckCircle />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {activeTab === 3 && systemAnalytics && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Daily Activity Trend (Last 30 Days)
                </Typography>
                <Line
                  data={{
                    labels: systemAnalytics.dailyMetrics.map((m: any) => m._id),
                    datasets: [
                      {
                        label: 'Uploads',
                        data: systemAnalytics.dailyMetrics.map((m: any) => m.totalUploads),
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1
                      },
                      {
                        label: 'Views',
                        data: systemAnalytics.dailyMetrics.map((m: any) => m.totalViews),
                        borderColor: 'rgb(255, 99, 132)',
                        tension: 0.1
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { position: 'top' }
                    }
                  }}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Modality Distribution
                </Typography>
                <Pie
                  data={{
                    labels: Object.keys(systemAnalytics.modalityDistribution).filter(k => k !== '_id'),
                    datasets: [{
                      data: Object.entries(systemAnalytics.modalityDistribution)
                        .filter(([k]) => k !== '_id')
                        .map(([, v]) => v),
                      backgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
                        '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
                      ]
                    }]
                  }}
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Request Details Dialog */}
      <Dialog
        open={requestDialogOpen}
        onClose={() => setRequestDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedRequest && (
          <>
            <DialogTitle>
              Request Details - {selectedRequest.requestId}
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Name
                  </Typography>
                  <Typography>{selectedRequest.contactInfo.name}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Email
                  </Typography>
                  <Typography>{selectedRequest.contactInfo.email}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Phone
                  </Typography>
                  <Typography>{selectedRequest.contactInfo.phone || '-'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Organization
                  </Typography>
                  <Typography>{selectedRequest.contactInfo.organization || '-'}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Message
                  </Typography>
                  <Typography>{selectedRequest.details.message}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Add Note"
                    multiline
                    rows={3}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setRequestDialogOpen(false)}>Close</Button>
              <Button variant="contained" onClick={handleAddNote} disabled={!noteText}>
                Add Note
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
};

export default SuperAdminDashboard;
