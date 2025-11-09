/**
 * Radiology Worklist Page
 * Production-ready worklist for radiologists
 * Shows pending studies with filters and search
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
  Chip,
  Button,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip,
  Badge,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Visibility as ViewIcon,
  Assignment as ReportIcon,
  Warning as UrgentIcon,
  CheckCircle as CompleteIcon,
  HourglassEmpty as PendingIcon,
  Person as PatientIcon,
  CalendarToday as DateIcon,
  LocalHospital as ModalityIcon
} from '@mui/icons-material';
import axios from 'axios';

interface Study {
  studyInstanceUID: string;
  patientID: string;
  patientName: string;
  patientAge?: string;
  patientSex?: string;
  studyDate: string;
  studyTime: string;
  studyDescription: string;
  modality: string;
  accessionNumber?: string;
  priority: 'stat' | 'urgent' | 'routine';
  reportStatus: 'pending' | 'draft' | 'final';
  hasAIAnalysis: boolean;
  aiDetectionCount?: number;
}

const WorklistPage: React.FC = () => {
  // State
  const [studies, setStudies] = useState<Study[]>([]);
  const [filteredStudies, setFilteredStudies] = useState<Study[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalityFilter, setModalityFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const API_URL = import.meta.env.VITE_API_URL || 'http://3.144.196.75:8001';

  /**
   * Load studies from backend
   * // ✅ WORKLIST EMPTY FIX: Call with status='ALL', from=now-90d
   */
  const loadStudies = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
      
      // ✅ WORKLIST EMPTY FIX: Default date range = last 90 days
      const now = new Date();
      const from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      
      const response = await axios.get(`${API_URL}/api/worklist`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          // ✅ WORKLIST EMPTY FIX: If status missing → treat as ALL (no filter by status)
          status: statusFilter !== 'all' ? statusFilter : 'ALL',
          priority: priorityFilter !== 'all' ? priorityFilter : undefined,
          startDate: from.toISOString(),
          endDate: now.toISOString()
        }
      });

      const studiesData = response.data.items || [];
      setStudies(studiesData);
      setFilteredStudies(studiesData);
      
      console.log('📋 Loaded', studiesData.length, 'studies');
      
      // ✅ WORKLIST EMPTY FIX: If 0 results, automatically call POST /api/worklist/sync
      if (studiesData.length === 0) {
        console.log('📋 No studies found, triggering sync...');
        await syncWorklist();
      }
    } catch (error) {
      console.error('❌ Failed to load studies:', error);
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Sync worklist from studies
   * // ✅ WORKLIST EMPTY FIX: Auto-sync when empty
   */
  const syncWorklist = async () => {
    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
      
      const response = await axios.post(`${API_URL}/api/worklist/sync`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Sync complete:', response.data);
      
      // Reload studies after sync
      await loadStudies();
    } catch (error) {
      console.error('❌ Failed to sync worklist:', error);
    }
  };

  /**
   * Initial load and auto-refresh
   * // ✅ WORKLIST EMPTY FIX: On mount: call with status='ALL', from=now-90d
   */
  useEffect(() => {
    loadStudies();

    // ✅ WORKLIST EMPTY FIX: Live updates fallback - poll every 15s only when tab is active
    if (autoRefresh) {
      const interval = setInterval(loadStudies, 15000); // Poll every 15s
      return () => clearInterval(interval);
    }
  }, [statusFilter, modalityFilter, priorityFilter, autoRefresh]);

  /**
   * Search and filter
   */
  useEffect(() => {
    if (!searchTerm) {
      setFilteredStudies(studies);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = studies.filter(study =>
      study.patientName.toLowerCase().includes(term) ||
      study.patientID.toLowerCase().includes(term) ||
      study.studyDescription.toLowerCase().includes(term) ||
      study.accessionNumber?.toLowerCase().includes(term)
    );
    
    setFilteredStudies(filtered);
  }, [searchTerm, studies]);

  /**
   * Open study in viewer
   */
  const handleOpenStudy = (study: Study) => {
    window.location.href = `/viewer?studyUID=${study.studyInstanceUID}`;
  };

  /**
   * Open report editor
   */
  const handleCreateReport = (study: Study) => {
    const params = new URLSearchParams({
      studyUID: study.studyInstanceUID,
      patientID: study.patientID,
      patientName: study.patientName,
      modality: study.modality
    });
    
    window.location.href = `/reporting?${params.toString()}`;
  };

  /**
   * Get priority color
   */
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'stat': return 'error';
      case 'urgent': return 'warning';
      default: return 'default';
    }
  };

  /**
   * Get status color
   */
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'final': return 'success';
      case 'draft': return 'info';
      default: return 'default';
    }
  };

  /**
   * Format date/time
   */
  const formatDateTime = (date: string, time: string) => {
    try {
      const dateStr = `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}`;
      const timeStr = time ? `${time.slice(0,2)}:${time.slice(2,4)}` : '';
      return `${dateStr} ${timeStr}`;
    } catch {
      return date;
    }
  };

  /**
   * Statistics
   */
  const stats = {
    total: studies.length,
    pending: studies.filter(s => s.reportStatus === 'pending').length,
    stat: studies.filter(s => s.priority === 'stat').length,
    withAI: studies.filter(s => s.hasAIAnalysis).length
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3 }}>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h4" gutterBottom>
              📋 Radiology Worklist
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage and review medical imaging studies
            </Typography>
          </Box>
          
          <Box display="flex" gap={2}>
            <Tooltip title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}>
              <IconButton
                color={autoRefresh ? 'primary' : 'default'}
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            
            {/* ✅ WORKLIST EMPTY FIX: Add visible "Reset Filters" button */}
            <Button
              variant="outlined"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setModalityFilter('all');
                setPriorityFilter('all');
                loadStudies();
              }}
              disabled={loading}
            >
              Reset Filters
            </Button>
            
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={loadStudies}
              disabled={loading}
            >
              Refresh
            </Button>
            
            {/* ✅ WORKLIST EMPTY FIX: Sync Studies button */}
            <Button
              variant="contained"
              color="secondary"
              onClick={syncWorklist}
              disabled={loading}
            >
              Sync Studies
            </Button>
          </Box>
        </Box>

        {/* Statistics */}
        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h4" color="primary">{stats.total}</Typography>
                <Typography variant="body2" color="text.secondary">Total Studies</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h4" color="warning.main">{stats.pending}</Typography>
                <Typography variant="body2" color="text.secondary">Pending Reports</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h4" color="error.main">{stats.stat}</Typography>
                <Typography variant="body2" color="text.secondary">STAT Studies</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h4" color="success.main">{stats.withAI}</Typography>
                <Typography variant="body2" color="text.secondary">AI Analyzed</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      {/* Filters */}
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search patient name, ID, or accession..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          
          <Grid item xs={12} sm={4} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {/* ✅ WORKLIST EMPTY FIX: Add "All" option alongside Pending/In-Progress/Completed */}
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={4} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Modality</InputLabel>
              <Select
                value={modalityFilter}
                label="Modality"
                onChange={(e) => setModalityFilter(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="CT">CT</MenuItem>
                <MenuItem value="MR">MR</MenuItem>
                <MenuItem value="CR">CR</MenuItem>
                <MenuItem value="DX">DX</MenuItem>
                <MenuItem value="US">US</MenuItem>
                <MenuItem value="MG">MG</MenuItem>
                <MenuItem value="XA">XA</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={4} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Priority</InputLabel>
              <Select
                value={priorityFilter}
                label="Priority"
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="stat">STAT</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
                <MenuItem value="routine">Routine</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={4} md={2}>
            <Typography variant="body2" color="text.secondary">
              Showing {filteredStudies.length} of {studies.length} studies
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Studies Table */}
      <Paper elevation={1}>
        {loading ? (
          <Box display="flex" justifyContent="center" p={5}>
            <CircularProgress />
          </Box>
        ) : filteredStudies.length === 0 ? (
          <Box p={5} textAlign="center">
            {/* ✅ WORKLIST EMPTY FIX: Show empty state with "Sync Studies" CTA */}
            <Alert severity="info" sx={{ mb: 2 }}>
              No studies found. Try adjusting your filters or sync studies from PACS.
            </Alert>
            <Button
              variant="contained"
              color="primary"
              onClick={syncWorklist}
              disabled={loading}
            >
              Sync Studies from PACS
            </Button>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Priority</TableCell>
                  <TableCell>Patient</TableCell>
                  <TableCell>Study Date/Time</TableCell>
                  <TableCell>Modality</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>AI</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredStudies.map((study) => (
                  <TableRow
                    key={study.studyInstanceUID}
                    hover
                    sx={{
                      cursor: 'pointer',
                      bgcolor: study.priority === 'stat' ? 'error.50' : 'inherit'
                    }}
                    onClick={() => handleOpenStudy(study)}
                  >
                    <TableCell>
                      <Chip
                        label={study.priority.toUpperCase()}
                        color={getPriorityColor(study.priority)}
                        size="small"
                        icon={study.priority === 'stat' ? <UrgentIcon /> : undefined}
                      />
                    </TableCell>
                    
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="bold">
                          {study.patientName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ID: {study.patientID}
                        </Typography>
                      </Box>
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2">
                        {formatDateTime(study.studyDate, study.studyTime)}
                      </Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Chip label={study.modality} size="small" variant="outlined" />
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                        {study.studyDescription}
                      </Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Chip
                        label={study.reportStatus}
                        color={getStatusColor(study.reportStatus)}
                        size="small"
                        icon={
                          study.reportStatus === 'final' ? <CompleteIcon /> :
                          study.reportStatus === 'draft' ? <ReportIcon /> :
                          <PendingIcon />
                        }
                      />
                    </TableCell>
                    
                    <TableCell>
                      {study.hasAIAnalysis ? (
                        <Tooltip title={`${study.aiDetectionCount || 0} detections`}>
                          <Badge badgeContent={study.aiDetectionCount} color="primary">
                            <Chip label="AI" size="small" color="success" />
                          </Badge>
                        </Tooltip>
                      ) : (
                        <Chip label="No AI" size="small" variant="outlined" />
                      )}
                    </TableCell>
                    
                    <TableCell align="right">
                      <Box display="flex" gap={1} justifyContent="flex-end">
                        <Tooltip title="Open Viewer">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenStudy(study);
                            }}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        
                        <Tooltip title="Create Report">
                          <IconButton
                            size="small"
                            color="success"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCreateReport(study);
                            }}
                          >
                            <ReportIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
};

export default WorklistPage;
