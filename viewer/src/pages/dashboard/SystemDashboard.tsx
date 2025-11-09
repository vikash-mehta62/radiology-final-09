import React, { useState, useEffect } from 'react'
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  LinearProgress,
  Button,
} from '@mui/material'
import {
  Refresh as RefreshIcon,
  Computer as MachineIcon,
  CheckCircle as ActiveIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon,
  Timeline as TimelineIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

interface MachineStats {
  modality: string
  machineName: string
  totalStudies: number
  totalSeries: number
  totalInstances: number
  uniquePatients: number
  lastActivity: string
  status: 'active' | 'idle'
  avgStudiesPerHour: string
}

interface SystemHealth {
  systemStatus: string
  metrics: {
    totalStudies: number
    totalSeries: number
    totalInstances: number
    recentStudies24h: number
    avgStudiesPerHour: string
    totalStorageGB: string
  }
  recentActivity: any[]
  timestamp: string
}

export const SystemDashboard: React.FC = () => {
  const navigate = useNavigate()
  const [machines, setMachines] = useState<MachineStats[]>([])
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState('24h')
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchData = async () => {
    try {
      setError(null)
      const [machinesRes, healthRes] = await Promise.all([
        axios.get(`/api/monitoring/machines?timeRange=${timeRange}`),
        axios.get('/api/monitoring/system-health')
      ])

      if (machinesRes.data.success) {
        setMachines(machinesRes.data.data.machines)
      }

      if (healthRes.data.success) {
        setSystemHealth(healthRes.data.data)
      }
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err)
      setError(err.response?.data?.message || 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [timeRange])

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchData, 30000) // Refresh every 30 seconds
      return () => clearInterval(interval)
    }
  }, [autoRefresh, timeRange])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success'
      case 'idle': return 'warning'
      case 'error': return 'error'
      default: return 'default'
    }
  }

  const getSystemStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'success'
      case 'low-activity': return 'info'
      case 'high-load': return 'warning'
      default: return 'default'
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          System Monitoring
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              label="Time Range"
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <MenuItem value="1h">Last Hour</MenuItem>
              <MenuItem value="24h">Last 24 Hours</MenuItem>
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="30d">Last 30 Days</MenuItem>
            </Select>
          </FormControl>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchData} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* System Health Overview */}
      {systemHealth && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <SpeedIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">System Status</Typography>
                </Box>
                <Chip
                  label={systemHealth.systemStatus.toUpperCase()}
                  color={getSystemStatusColor(systemHealth.systemStatus)}
                  sx={{ mt: 1 }}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <TimelineIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">Total Studies</Typography>
                </Box>
                <Typography variant="h4" fontWeight="bold">
                  {systemHealth.metrics.totalStudies.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {systemHealth.metrics.recentStudies24h} in last 24h
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <StorageIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">Storage Used</Typography>
                </Box>
                <Typography variant="h4" fontWeight="bold">
                  {systemHealth.metrics.totalStorageGB} GB
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {systemHealth.metrics.totalInstances.toLocaleString()} images
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <MachineIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">Active Machines</Typography>
                </Box>
                <Typography variant="h4" fontWeight="bold">
                  {machines.filter(m => m.status === 'active').length} / {machines.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Avg: {systemHealth.metrics.avgStudiesPerHour} studies/hour
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Machine Statistics Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Connected Machines ({timeRange})
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Machine</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Studies</TableCell>
                  <TableCell align="right">Series</TableCell>
                  <TableCell align="right">Images</TableCell>
                  <TableCell align="right">Patients</TableCell>
                  <TableCell align="right">Avg/Hour</TableCell>
                  <TableCell>Last Activity</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {machines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography color="text.secondary">
                        No machine activity in selected time range
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  machines.map((machine) => (
                    <TableRow key={machine.modality}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <MachineIcon sx={{ mr: 1, color: 'primary.main' }} />
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              {machine.machineName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {machine.modality}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={machine.status}
                          color={getStatusColor(machine.status)}
                          icon={machine.status === 'active' ? <ActiveIcon /> : <WarningIcon />}
                        />
                      </TableCell>
                      <TableCell align="right">{machine.totalStudies.toLocaleString()}</TableCell>
                      <TableCell align="right">{machine.totalSeries.toLocaleString()}</TableCell>
                      <TableCell align="right">{machine.totalInstances.toLocaleString()}</TableCell>
                      <TableCell align="right">{machine.uniquePatients}</TableCell>
                      <TableCell align="right">{machine.avgStudiesPerHour}</TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {new Date(machine.lastActivity).toLocaleString()}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  )
}

export default SystemDashboard
