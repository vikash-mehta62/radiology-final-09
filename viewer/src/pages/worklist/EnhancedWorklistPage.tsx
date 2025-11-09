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
  DialogActions,
  Select,
  FormControl,
  InputLabel,
  Grid,
  Card,
  CardContent,
  Alert,
  CircularProgress
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
  CalendarToday as CalendarIcon,
  Warning as WarningIcon,
  PlayArrow as StartIcon,
  Person as AssignIcon,
  History as HistoryIcon,
  TrendingUp as StatsIcon
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import ApiService, { apiCall, getCSRFToken } from '../../services/ApiService'
import WorkflowNavigation from '../../components/workflow/WorkflowNavigation'
import { useWorkflow } from '../../contexts/WorkflowContext'
import { ExportButton } from '../../components/export/ExportButton'
import Person from '@mui/icons-material/Person'
import { Download as DownloadIcon } from '@mui/icons-material'

interface WorklistItem {
  _id: string
  studyInstanceUID: string
  patientID: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'routine' | 'urgent' | 'stat'
  reportStatus: 'none' | 'draft' | 'finalized'
  hasCriticalFindings: boolean
  assignedTo?: {
    _id: string
    username: string
  }
  scheduledFor?: string
  study?: {
    patientName: string
    studyDate: string
    studyTime: string
    modality: string
    studyDescription: string
  }
}

interface WorklistStats {
  total: number
  byStatus: {
    pending: number
    inProgress: number
    completed: number
  }
  byPriority: {
    stat: number
    urgent: number
    routine: number
  }
  criticalUnnotified: number
}

const EnhancedWorklistPage: React.FC = () => {
  const navigate = useNavigate()
  const { setCurrentStudy, addToHistory } = useWorkflow()
  const [activeTab, setActiveTab] = useState(0)
  const [items, setItems] = useState<WorklistItem[]>([])
  const [filteredItems, setFilteredItems] = useState<WorklistItem[]>([])
  const [stats, setStats] = useState<WorklistStats | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedItem, setSelectedItem] = useState<WorklistItem | null>(null)
  const [syncDialog, setSyncDialog] = useState(false)

  useEffect(() => {
    fetchWorklist()
    fetchStats()
  }, [])

  useEffect(() => {
    filterItems()
  }, [activeTab, searchQuery, priorityFilter, items])

  const fetchWorklist = async () => {
    setLoading(true)
      const csrfToken = getCSRFToken()
    
    try {
      const response = await apiCall('/api/worklist')
        
      
      const data = await response.json()
      
      if (data.success) {
        setItems(data.items)
      }
    } catch (error) {
      console.error('Failed to fetch worklist:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/worklist/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      })
      const data = await response.json()
      
      if (data.success) {
        setStats(data.statistics)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const filterItems = () => {
    let filtered = items

    // Filter by tab (status)
    if (activeTab === 0) {
      filtered = filtered.filter(i => i.status === 'pending')
    } else if (activeTab === 1) {
      filtered = filtered.filter(i => i.status === 'in_progress')
    } else if (activeTab === 2) {
      filtered = filtered.filter(i => i.status === 'completed')
    } else if (activeTab === 3) {
      filtered = filtered.filter(i => i.hasCriticalFindings)
    }

    // Filter by priority
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(i => i.priority === priorityFilter)
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(i =>
        i.study?.patientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.patientID?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.study?.studyDescription?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Sort by priority and scheduled time
    filtered.sort((a, b) => {
      const priorityOrder = { stat: 3, urgent: 2, routine: 1 }
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
      if (priorityDiff !== 0) return priorityDiff
      
      return new Date(a.scheduledFor || 0).getTime() - new Date(b.scheduledFor || 0).getTime()
    })

    setFilteredItems(filtered)
  }

  const handleViewStudy = (item: WorklistItem) => {
    // Update workflow context
    setCurrentStudy({
      studyInstanceUID: item.studyInstanceUID,
      patientName: item.study?.patientName || '',
      modality: item.study?.modality || '',
      studyDate: item.study?.studyDate || ''
    })
    addToHistory('worklist')
    navigate(`/app/viewer/${item.studyInstanceUID}`)
  }

  const handleStartReading = async (item: WorklistItem) => {
    try {
      const response = await fetch(`/api/worklist/${item.studyInstanceUID}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({ status: 'in_progress' })
      })
      
      if (response.ok) {
        fetchWorklist()
        handleViewStudy(item)
      }
    } catch (error) {
      console.error('Failed to start reading:', error)
    }
  }

  const handleMarkComplete = async (item: WorklistItem) => {
    try {
      const response = await fetch(`/api/worklist/${item.studyInstanceUID}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({ status: 'completed' })
      })
      
      if (response.ok) {
        fetchWorklist()
        fetchStats()
      }
    } catch (error) {
      console.error('Failed to mark complete:', error)
    }
  }

  const handleSyncWorklist = async () => {
      const csrfToken = getCSRFToken()

    try {
      const response = await apiCall('/api/worklist/sync',{
    method: 'POST',

      })
     
      
      const data = await response.json()
      
      if (data.success) {
        alert(`Synced ${data.created} new studies, ${data.skipped} already existed`)
        fetchWorklist()
        fetchStats()
      }
    } catch (error) {
      console.error('Failed to sync worklist:', error)
    } finally {
      setSyncDialog(false)
    }
  }

  const handleExportWorklist = async () => {
    try {
      const params = new URLSearchParams({
        format: 'csv',
        includeStats: 'true'
      })

      const response = await fetch(`/api/worklist/export?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      })

      if (!response.ok) throw new Error('Export failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `worklist-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      alert('✅ Worklist exported successfully!')
    } catch (error: any) {
      alert(`❌ Export failed: ${error.message}`)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'stat': return 'error'
      case 'urgent': return 'warning'
      default: return 'default'
    }
  }

  const getReportStatusColor = (status: string) => {
    switch (status) {
      case 'finalized': return 'success'
      case 'draft': return 'info'
      default: return 'default'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success'
      case 'in_progress': return 'info'
      case 'pending': return 'warning'
      default: return 'default'
    }
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f5f5f5' }}>
      {/* Workflow Navigation */}
      <Box sx={{ p: 2, pb: 0 }}>
        <WorkflowNavigation currentPage="worklist" />
      </Box>

      {/* Header */}
      <Paper sx={{ p: 3, borderRadius: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" fontWeight="bold">
            📋 Radiology Worklist
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              startIcon={<DownloadIcon />}
              variant="outlined"
              onClick={() => handleExportWorklist()}
            >
              Export Worklist
            </Button>
            <Button
              startIcon={<RefreshIcon />}
              onClick={fetchWorklist}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              startIcon={<StatsIcon />}
              variant="outlined"
              onClick={() => setSyncDialog(true)}
            >
              Sync Studies
            </Button>
          </Box>
        </Box>

        {/* Statistics Cards */}
        {stats && (
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Pending
                  </Typography>
                  <Typography variant="h4">
                    {stats.byStatus.pending}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    In Progress
                  </Typography>
                  <Typography variant="h4">
                    {stats.byStatus.inProgress}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    STAT/Urgent
                  </Typography>
                  <Typography variant="h4" color="error">
                    {stats.byPriority.stat + stats.byPriority.urgent}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: stats.criticalUnnotified > 0 ? 'error.light' : 'background.paper' }}>
                <CardContent>
                  <Typography color={stats.criticalUnnotified > 0 ? 'error.contrastText' : 'text.secondary'} gutterBottom>
                    Critical Unnotified
                  </Typography>
                  <Typography variant="h4" color={stats.criticalUnnotified > 0 ? 'error.contrastText' : 'text.primary'}>
                    {stats.criticalUnnotified}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Search and Filters */}
        <Box sx={{ display: 'flex', gap: 2 }}>
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
          <FormControl sx={{ minWidth: 150 }}>
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
        </Box>
      </Paper>

      {/* Tabs */}
      <Paper sx={{ borderRadius: 0 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab
            label={
              <Badge badgeContent={stats?.byStatus.pending || 0} color="warning">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PendingIcon />
                  Pending
                </Box>
              </Badge>
            }
          />
          <Tab
            label={
              <Badge badgeContent={stats?.byStatus.inProgress || 0} color="info">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <StartIcon />
                  In Progress
                </Box>
              </Badge>
            }
          />
          <Tab
            label={
              <Badge badgeContent={stats?.byStatus.completed || 0} color="success">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CompleteIcon />
                  Completed
                </Box>
              </Badge>
            }
          />
          <Tab
            label={
              <Badge badgeContent={stats?.criticalUnnotified || 0} color="error">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WarningIcon />
                  Critical
                </Box>
              </Badge>
            }
          />
        </Tabs>
      </Paper>

      {/* Table */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        {stats?.criticalUnnotified > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <strong>{stats.criticalUnnotified} critical finding(s)</strong> require immediate attention!
          </Alert>
        )}

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell>Priority</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Patient Name</TableCell>
                <TableCell>Patient ID</TableCell>
                <TableCell>Study Date</TableCell>
                <TableCell>Modality</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Report</TableCell>
                <TableCell>Assigned To</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 8 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 8 }}>
                    <Typography variant="h6" color="text.secondary">
                      No studies found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => (
                  <TableRow
                    key={item._id}
                    hover
                    sx={{ 
                      '&:hover': { bgcolor: 'action.hover' },
                      bgcolor: item.hasCriticalFindings ? 'error.light' : 'inherit'
                    }}
                  >
                    <TableCell>
                      <Chip
                        label={item.priority.toUpperCase()}
                        size="small"
                        color={getPriorityColor(item.priority)}
                        icon={item.hasCriticalFindings ? <WarningIcon /> : undefined}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.status.replace('_', ' ').toUpperCase()}
                        size="small"
                        color={getStatusColor(item.status)}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight="medium">
                        {item.study?.patientName || 'Unknown'}
                      </Typography>
                    </TableCell>
                    <TableCell>{item.patientID}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CalendarIcon fontSize="small" color="action" />
                        {item.study?.studyDate || 'N/A'}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip label={item.study?.modality || 'N/A'} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>{item.study?.studyDescription || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip
                        label={item.reportStatus === 'finalized' ? 'Finalized' : item.reportStatus === 'draft' ? 'Draft' : 'No Report'}
                        size="small"
                        color={getReportStatusColor(item.reportStatus)}
                      />
                    </TableCell>
                    <TableCell>
                      {item.assignedTo ? (
                        <Chip
                          label={item.assignedTo.username}
                          size="small"
                          icon={<Person />}
                        />
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Unassigned
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        {item.status === 'pending' && (
                          <Tooltip title="Start Reading">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleStartReading(item)}
                            >
                              <StartIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="View Study">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleViewStudy(item)}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        {item.status !== 'completed' && (
                          <Tooltip title="Mark Complete">
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => handleMarkComplete(item)}
                            >
                              <CompleteIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="More Options">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              setAnchorEl(e.currentTarget)
                              setSelectedItem(item)
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
          if (selectedItem) handleViewStudy(selectedItem)
          setAnchorEl(null)
        }}>
          <ViewIcon fontSize="small" sx={{ mr: 1 }} />
          Open in Viewer
        </MenuItem>
        <MenuItem onClick={() => {
          if (selectedItem) navigate(`/reporting?study=${selectedItem.studyInstanceUID}`)
          setAnchorEl(null)
        }}>
          <ReportIcon fontSize="small" sx={{ mr: 1 }} />
          Create Report
        </MenuItem>
        <MenuItem onClick={() => {
          if (selectedItem) navigate(`/reports/patient/${selectedItem.patientID}`)
          setAnchorEl(null)
        }}>
          <HistoryIcon fontSize="small" sx={{ mr: 1 }} />
          View Prior Studies
        </MenuItem>
        <MenuItem onClick={(e) => {
          e.stopPropagation()
          setAnchorEl(null)
        }}>
          {selectedItem && <ExportButton type="study" id={selectedItem.studyInstanceUID} label="Export Study" />}
        </MenuItem>
      </Menu>

      {/* Sync Dialog */}
      <Dialog open={syncDialog} onClose={() => setSyncDialog(false)}>
        <DialogTitle>Sync Worklist</DialogTitle>
        <DialogContent>
          <Typography>
            This will create worklist items for all studies in the database that don't have one yet.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSyncDialog(false)}>Cancel</Button>
          <Button onClick={handleSyncWorklist} variant="contained">
            Sync Now
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default EnhancedWorklistPage
