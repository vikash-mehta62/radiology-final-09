import React, { useState, useEffect } from 'react'
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
  TextField,
  InputAdornment,
  Badge,
  Tooltip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material'
import {
  Search as SearchIcon,
  Visibility as ViewIcon,
  Assignment as ReportIcon,
  CheckCircle as CompleteIcon,
  Pending as PendingIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  MoreVert as MoreIcon,
  CalendarToday as CalendarIcon
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import ApiService from '../../services/ApiService'

interface Study {
  studyInstanceUID: string
  patientID: string
  patientName: string
  studyDate: string
  studyTime: string
  modality: string
  studyDescription: string
  status: 'pending' | 'completed'
  reportStatus?: 'draft' | 'finalized' | 'none'
  priority?: 'routine' | 'urgent' | 'stat'
  assignedTo?: string
}

const WorklistPage: React.FC = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(0)
  const [studies, setStudies] = useState<Study[]>([])
  const [filteredStudies, setFilteredStudies] = useState<Study[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedStudy, setSelectedStudy] = useState<Study | null>(null)

  useEffect(() => {
    fetchStudies()
  }, [])

  useEffect(() => {
    filterStudies()
  }, [activeTab, searchQuery, studies])

  const fetchStudies = async () => {
    setLoading(true)
    try {
      const response = await ApiService.getStudies()
      if (response.success && response.data) {
        // Add mock status for demo
        const studiesWithStatus = response.data.map((study: any) => ({
          ...study,
          status: Math.random() > 0.5 ? 'pending' : 'completed',
          reportStatus: Math.random() > 0.7 ? 'finalized' : Math.random() > 0.4 ? 'draft' : 'none',
          priority: Math.random() > 0.8 ? 'stat' : Math.random() > 0.5 ? 'urgent' : 'routine'
        }))
        setStudies(studiesWithStatus)
      }
    } catch (error) {
      console.error('Failed to fetch studies:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterStudies = () => {
    let filtered = studies

    // Filter by tab (pending/completed)
    if (activeTab === 0) {
      filtered = filtered.filter(s => s.status === 'pending')
    } else {
      filtered = filtered.filter(s => s.status === 'completed')
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(s =>
        s.patientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.patientID?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.studyDescription?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    setFilteredStudies(filtered)
  }

  const handleViewStudy = (study: Study) => {
    navigate(`/app/viewer/${study.studyInstanceUID}`)
  }

  const handleMarkComplete = async (study: Study) => {
    // Update study status
    const updated = studies.map(s =>
      s.studyInstanceUID === study.studyInstanceUID
        ? { ...s, status: 'completed' as const }
        : s
    )
    setStudies(updated)
  }

  const handleMarkPending = async (study: Study) => {
    // Update study status
    const updated = studies.map(s =>
      s.studyInstanceUID === study.studyInstanceUID
        ? { ...s, status: 'pending' as const }
        : s
    )
    setStudies(updated)
  }

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'stat': return 'error'
      case 'urgent': return 'warning'
      default: return 'default'
    }
  }

  const getReportStatusColor = (status?: string) => {
    switch (status) {
      case 'finalized': return 'success'
      case 'draft': return 'info'
      default: return 'default'
    }
  }

  const pendingCount = studies.filter(s => s.status === 'pending').length
  const completedCount = studies.filter(s => s.status === 'completed').length

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f5f5f5' }}>
      {/* Header */}
      <Paper sx={{ p: 3, borderRadius: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" fontWeight="bold">
            📋 Study Worklist
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              startIcon={<RefreshIcon />}
              onClick={fetchStudies}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              startIcon={<FilterIcon />}
              variant="outlined"
            >
              Filters
            </Button>
          </Box>
        </Box>

        {/* Search */}
        <TextField
          fullWidth
          placeholder="Search by patient name, ID, or study description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
        />
      </Paper>

      {/* Tabs */}
      <Paper sx={{ borderRadius: 0 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab
            label={
              <Badge badgeContent={pendingCount} color="warning">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PendingIcon />
                  Pending Studies
                </Box>
              </Badge>
            }
          />
          <Tab
            label={
              <Badge badgeContent={completedCount} color="success">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CompleteIcon />
                  Completed Studies
                </Box>
              </Badge>
            }
          />
        </Tabs>
      </Paper>

      {/* Table */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell>Priority</TableCell>
                <TableCell>Patient Name</TableCell>
                <TableCell>Patient ID</TableCell>
                <TableCell>Study Date</TableCell>
                <TableCell>Modality</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Report Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredStudies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                    <Typography variant="h6" color="text.secondary">
                      {loading ? 'Loading studies...' : 'No studies found'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredStudies.map((study) => (
                  <TableRow
                    key={study.studyInstanceUID}
                    hover
                    sx={{ '&:hover': { bgcolor: 'action.hover' } }}
                  >
                    <TableCell>
                      <Chip
                        label={study.priority?.toUpperCase()}
                        size="small"
                        color={getPriorityColor(study.priority)}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight="medium">
                        {study.patientName || 'Unknown'}
                      </Typography>
                    </TableCell>
                    <TableCell>{study.patientID}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CalendarIcon fontSize="small" color="action" />
                        {study.studyDate}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip label={study.modality} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>{study.studyDescription}</TableCell>
                    <TableCell>
                      <Chip
                        label={study.reportStatus === 'finalized' ? 'Finalized' : study.reportStatus === 'draft' ? 'Draft' : 'No Report'}
                        size="small"
                        color={getReportStatusColor(study.reportStatus)}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        <Tooltip title="View Study">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleViewStudy(study)}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        {study.status === 'pending' ? (
                          <Tooltip title="Mark as Complete">
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => handleMarkComplete(study)}
                            >
                              <CompleteIcon />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Tooltip title="Mark as Pending">
                            <IconButton
                              size="small"
                              color="warning"
                              onClick={() => handleMarkPending(study)}
                            >
                              <PendingIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="More Options">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              setAnchorEl(e.currentTarget)
                              setSelectedStudy(study)
                            }}
                          >
                            <MoreIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => {
          if (selectedStudy) handleViewStudy(selectedStudy)
          setAnchorEl(null)
        }}>
          <ViewIcon fontSize="small" sx={{ mr: 1 }} />
          Open in Viewer
        </MenuItem>
        <MenuItem onClick={() => {
          if (selectedStudy) navigate(`/app/viewer/${selectedStudy.studyInstanceUID}?tab=3`)
          setAnchorEl(null)
        }}>
          <ReportIcon fontSize="small" sx={{ mr: 1 }} />
          Create Report
        </MenuItem>
        <MenuItem onClick={() => {
          if (selectedStudy) {
            selectedStudy.status === 'pending'
              ? handleMarkComplete(selectedStudy)
              : handleMarkPending(selectedStudy)
          }
          setAnchorEl(null)
        }}>
          {selectedStudy?.status === 'pending' ? (
            <>
              <CompleteIcon fontSize="small" sx={{ mr: 1 }} />
              Mark Complete
            </>
          ) : (
            <>
              <PendingIcon fontSize="small" sx={{ mr: 1 }} />
              Mark Pending
            </>
          )}
        </MenuItem>
      </Menu>
    </Box>
  )
}

export default WorklistPage
