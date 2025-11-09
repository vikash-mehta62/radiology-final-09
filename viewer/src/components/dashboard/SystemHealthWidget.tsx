import React, { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  LinearProgress,
  Grid,
  Alert,
  IconButton,
  Tooltip,
  CircularProgress
} from '@mui/material'
import {
  CheckCircle as HealthyIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Storage as DatabaseIcon,
  Cloud as PacsIcon,
  Psychology as AiIcon,
  Security as SecurityIcon
} from '@mui/icons-material'

interface SystemHealth {
  overall: 'healthy' | 'warning' | 'error'
  services: {
    database: {
      status: 'healthy' | 'warning' | 'error'
      responseTime: number
      connections: number
    }
    pacs: {
      status: 'healthy' | 'warning' | 'error'
      responseTime: number
      studies: number
    }
    ai: {
      status: 'healthy' | 'warning' | 'error'
      modelsLoaded: number
      queueSize: number
    }
    security: {
      status: 'healthy' | 'warning' | 'error'
      activeUsers: number
      failedLogins: number
    }
  }
  metrics: {
    cpuUsage: number
    memoryUsage: number
    diskUsage: number
    uptime: number
  }
}

export const SystemHealthWidget: React.FC = () => {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSystemHealth = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/system-monitoring/health', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      })

      if (!response.ok) throw new Error('Failed to fetch system health')

      const data = await response.json()
      setHealth(data.health)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSystemHealth()
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchSystemHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <HealthyIcon color="success" />
      case 'warning': return <WarningIcon color="warning" />
      case 'error': return <ErrorIcon color="error" />
      default: return <CircularProgress size={20} />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'success'
      case 'warning': return 'warning'
      case 'error': return 'error'
      default: return 'default'
    }
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  if (loading && !health) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error" action={
            <IconButton size="small" onClick={fetchSystemHealth}>
              <RefreshIcon />
            </IconButton>
          }>
            {error}
          </Alert>
        </CardContent>
      </Card>
    )
  }

  if (!health) return null

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight="bold">
            System Health
          </Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <Chip
              icon={getStatusIcon(health.overall)}
              label={health.overall.toUpperCase()}
              color={getStatusColor(health.overall) as any}
              size="small"
            />
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={fetchSystemHealth} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Service Status */}
        <Grid container spacing={2} mb={3}>
          <Grid item xs={6} sm={3}>
            <Box textAlign="center">
              <DatabaseIcon color={health.services.database.status === 'healthy' ? 'success' : 'error'} />
              <Typography variant="caption" display="block">Database</Typography>
              <Typography variant="body2" fontWeight="bold">
                {health.services.database.responseTime}ms
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box textAlign="center">
              <PacsIcon color={health.services.pacs.status === 'healthy' ? 'success' : 'error'} />
              <Typography variant="caption" display="block">PACS</Typography>
              <Typography variant="body2" fontWeight="bold">
                {health.services.pacs.studies} studies
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box textAlign="center">
              <AiIcon color={health.services.ai.status === 'healthy' ? 'success' : 'error'} />
              <Typography variant="caption" display="block">AI Services</Typography>
              <Typography variant="body2" fontWeight="bold">
                {health.services.ai.modelsLoaded} models
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box textAlign="center">
              <SecurityIcon color={health.services.security.status === 'healthy' ? 'success' : 'error'} />
              <Typography variant="caption" display="block">Security</Typography>
              <Typography variant="body2" fontWeight="bold">
                {health.services.security.activeUsers} users
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* System Metrics */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            System Resources
          </Typography>
          
          <Box mb={1}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="caption">CPU Usage</Typography>
              <Typography variant="caption">{health.metrics.cpuUsage}%</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={health.metrics.cpuUsage}
              color={health.metrics.cpuUsage > 80 ? 'error' : health.metrics.cpuUsage > 60 ? 'warning' : 'primary'}
            />
          </Box>

          <Box mb={1}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="caption">Memory Usage</Typography>
              <Typography variant="caption">{health.metrics.memoryUsage}%</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={health.metrics.memoryUsage}
              color={health.metrics.memoryUsage > 80 ? 'error' : health.metrics.memoryUsage > 60 ? 'warning' : 'primary'}
            />
          </Box>

          <Box mb={2}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="caption">Disk Usage</Typography>
              <Typography variant="caption">{health.metrics.diskUsage}%</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={health.metrics.diskUsage}
              color={health.metrics.diskUsage > 80 ? 'error' : health.metrics.diskUsage > 60 ? 'warning' : 'primary'}
            />
          </Box>

          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">
              Uptime: {formatUptime(health.metrics.uptime)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Last updated: {new Date().toLocaleTimeString()}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}