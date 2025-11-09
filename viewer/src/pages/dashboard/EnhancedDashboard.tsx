import React, { useState, useEffect } from 'react'
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  LinearProgress,
  Chip,
  Avatar,
  Stack,
  Paper,
  alpha,
  useTheme,
  Fade,
  Grow,
  Skeleton,
} from '@mui/material'
import {
  Refresh as RefreshIcon,
  TrendingUp,
  TrendingDown,
  Computer as MachineIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon,
  Timeline as TimelineIcon,
  CloudUpload,
  Visibility,
  People,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  MoreVert,
} from '@mui/icons-material'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { SystemHealthWidget } from '../../components/dashboard/SystemHealthWidget'
import { IntegrationStatusWidget } from '../../components/dashboard/IntegrationStatusWidget'

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

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  trend?: number
  color?: string
  loading?: boolean
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'primary',
  loading = false,
}) => {
  const theme = useTheme()
  
  return (
    <Grow in timeout={500}>
      <Card
        sx={{
          height: '100%',
          background: `linear-gradient(135deg, ${alpha(theme.palette[color as keyof typeof theme.palette].main || theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette[color as keyof typeof theme.palette].main || theme.palette.primary.main, 0.02)} 100%)`,
          border: `1px solid ${alpha(theme.palette[color as keyof typeof theme.palette].main || theme.palette.primary.main, 0.1)}`,
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: theme.shadows[8],
            border: `1px solid ${alpha(theme.palette[color as keyof typeof theme.palette].main || theme.palette.primary.main, 0.3)}`,
          },
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ mb: 1 }}>
                {title}
              </Typography>
              {loading ? (
                <Skeleton width={100} height={40} />
              ) : (
                <Typography variant="h4" fontWeight="bold" sx={{ mb: 0.5 }}>
                  {typeof value === 'number' ? value.toLocaleString() : value}
                </Typography>
              )}
              {subtitle && (
                <Typography variant="caption" color="text.secondary">
                  {subtitle}
                </Typography>
              )}
            </Box>
            <Avatar
              sx={{
                bgcolor: alpha(theme.palette[color as keyof typeof theme.palette].main || theme.palette.primary.main, 0.1),
                color: theme.palette[color as keyof typeof theme.palette].main || theme.palette.primary.main,
                width: 56,
                height: 56,
              }}
            >
              {icon}
            </Avatar>
          </Box>
          
          {trend !== undefined && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {trend > 0 ? (
                <TrendingUp fontSize="small" color="success" />
              ) : (
                <TrendingDown fontSize="small" color="error" />
              )}
              <Typography
                variant="caption"
                color={trend > 0 ? 'success.main' : 'error.main'}
                fontWeight={600}
              >
                {Math.abs(trend)}% vs last period
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Grow>
  )
}

interface StatusCardProps {
  status: string
  machines: MachineStats[]
  loading?: boolean
}

const StatusCard: React.FC<StatusCardProps> = ({ status, machines, loading }) => {
  const theme = useTheme()
  const activeMachines = machines.filter(m => m.status === 'active').length
  const totalMachines = machines.length
  const percentage = totalMachines > 0 ? (activeMachines / totalMachines) * 100 : 0
  
  const getStatusConfig = () => {
    switch (status) {
      case 'healthy':
        return { color: 'success', icon: <CheckCircle />, label: 'System Healthy' }
      case 'low-activity':
        return { color: 'info', icon: <Warning />, label: 'Low Activity' }
      case 'high-load':
        return { color: 'warning', icon: <Warning />, label: 'High Load' }
      default:
        return { color: 'error', icon: <ErrorIcon />, label: 'System Error' }
    }
  }
  
  const config = getStatusConfig()
  
  return (
    <Grow in timeout={600}>
      <Card
        sx={{
          height: '100%',
          background: `linear-gradient(135deg, ${alpha(theme.palette[config.color].main, 0.05)} 0%, ${alpha(theme.palette[config.color].main, 0.02)} 100%)`,
          border: `1px solid ${alpha(theme.palette[config.color].main, 0.1)}`,
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              System Status
            </Typography>
            <Chip
              icon={config.icon}
              label={config.label}
              color={config.color}
              size="small"
              sx={{ fontWeight: 600 }}
            />
          </Box>
          
          {loading ? (
            <Skeleton variant="circular" width={120} height={120} sx={{ mx: 'auto' }} />
          ) : (
            <Box sx={{ position: 'relative', display: 'inline-flex', width: '100%', justifyContent: 'center', mb: 2 }}>
              <Box sx={{ position: 'relative' }}>
                <svg width="140" height="140">
                  <circle
                    cx="70"
                    cy="70"
                    r="60"
                    fill="none"
                    stroke={alpha(theme.palette[config.color].main, 0.1)}
                    strokeWidth="12"
                  />
                  <circle
                    cx="70"
                    cy="70"
                    r="60"
                    fill="none"
                    stroke={theme.palette[config.color].main}
                    strokeWidth="12"
                    strokeDasharray={`${(percentage / 100) * 377} 377`}
                    strokeLinecap="round"
                    transform="rotate(-90 70 70)"
                    style={{ transition: 'stroke-dasharray 1s ease' }}
                  />
                </svg>
                <Box
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="h3" fontWeight="bold" color={config.color}>
                    {activeMachines}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    of {totalMachines}
                  </Typography>
                </Box>
              </Box>
            </Box>
          )}
          
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Active Machines
          </Typography>
        </CardContent>
      </Card>
    </Grow>
  )
}

export const EnhancedDashboard: React.FC = () => {
  const navigate = useNavigate()
  const theme = useTheme()
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
      const interval = setInterval(fetchData, 30000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, timeRange])

  return (
    <Box sx={{ p: 3, bgcolor: 'background.default', minHeight: '100vh' }}>
      {/* Header */}
      <Fade in timeout={300}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              System Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Real-time monitoring and analytics
            </Typography>
          </Box>
          <Stack direction="row" spacing={2} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 140 }}>
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
            <Tooltip title="Refresh Data">
              <IconButton
                onClick={fetchData}
                color="primary"
                sx={{
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) },
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      </Fade>

      {/* Metrics Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            title="Total Studies"
            value={systemHealth?.metrics.totalStudies || 0}
            subtitle={`${systemHealth?.metrics.recentStudies24h || 0} in last 24h`}
            icon={<TimelineIcon />}
            trend={12.5}
            color="primary"
            loading={loading}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            title="Storage Used"
            value={`${systemHealth?.metrics.totalStorageGB || 0} GB`}
            subtitle={`${systemHealth?.metrics.totalInstances.toLocaleString() || 0} images`}
            icon={<StorageIcon />}
            trend={-3.2}
            color="secondary"
            loading={loading}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            title="Avg Studies/Hour"
            value={systemHealth?.metrics.avgStudiesPerHour || '0'}
            subtitle="Processing rate"
            icon={<SpeedIcon />}
            trend={8.7}
            color="success"
            loading={loading}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} lg={3}>
          <StatusCard
            status={systemHealth?.systemStatus || 'unknown'}
            machines={machines}
            loading={loading}
          />
        </Grid>
      </Grid>

      {/* System Health Widget */}
      {/* <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} lg={6}>
          <SystemHealthWidget />
        </Grid>
        <Grid item xs={12} lg={6}>
          <IntegrationStatusWidget />
        </Grid>
      </Grid> */}

      {/* Machine Cards */}
      <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
        Connected Machines
      </Typography>
      
      <Grid container spacing={3}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Grid item xs={12} sm={6} lg={3} key={i}>
              <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
            </Grid>
          ))
        ) : machines.length === 0 ? (
          <Grid item xs={12}>
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <MachineIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No machine activity in selected time range
              </Typography>
            </Paper>
          </Grid>
        ) : (
          machines.map((machine, index) => (
            <Grid item xs={12} sm={6} lg={3} key={machine.modality}>
              <Grow in timeout={300 + index * 100}>
                <Card
                  sx={{
                    height: '100%',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: theme.shadows[8],
                    },
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar
                          sx={{
                            bgcolor: machine.status === 'active' 
                              ? alpha(theme.palette.success.main, 0.1)
                              : alpha(theme.palette.warning.main, 0.1),
                            color: machine.status === 'active' 
                              ? theme.palette.success.main
                              : theme.palette.warning.main,
                          }}
                        >
                          <MachineIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {machine.machineName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {machine.modality}
                          </Typography>
                        </Box>
                      </Box>
                      <Chip
                        label={machine.status}
                        size="small"
                        color={machine.status === 'active' ? 'success' : 'warning'}
                        sx={{ fontWeight: 600 }}
                      />
                    </Box>
                    
                    <Stack spacing={1.5} sx={{ mt: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">Studies</Typography>
                        <Typography variant="caption" fontWeight="bold">
                          {machine.totalStudies.toLocaleString()}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">Images</Typography>
                        <Typography variant="caption" fontWeight="bold">
                          {machine.totalInstances.toLocaleString()}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">Patients</Typography>
                        <Typography variant="caption" fontWeight="bold">
                          {machine.uniquePatients}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">Avg/Hour</Typography>
                        <Typography variant="caption" fontWeight="bold">
                          {machine.avgStudiesPerHour}
                        </Typography>
                      </Box>
                    </Stack>
                    
                    <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                      <Typography variant="caption" color="text.secondary">
                        Last activity: {new Date(machine.lastActivity).toLocaleString()}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grow>
            </Grid>
          ))
        )}
      </Grid>
    </Box>
  )
}

export default EnhancedDashboard
