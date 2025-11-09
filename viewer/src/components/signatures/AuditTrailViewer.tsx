import React, { useEffect, useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material'
import {
  Create as CreateIcon,
  Verified as VerifiedIcon,
  Block as BlockIcon,
  Error as ErrorIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material'

export interface SignatureAuditEvent {
  action: 'created' | 'verified' | 'revoked' | 'validation_failed'
  userId: string
  userName?: string
  timestamp: string
  ipAddress: string
  result: 'success' | 'failure'
  details: string
  metadata?: Record<string, any>
}

export interface AuditTrailViewerProps {
  reportId: string
  signatureId?: string
  maxHeight?: number | string
  showExport?: boolean
}

export const AuditTrailViewer: React.FC<AuditTrailViewerProps> = ({
  reportId,
  signatureId,
  maxHeight = 600,
  showExport = true
}) => {
  const [auditEvents, setAuditEvents] = useState<SignatureAuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    fetchAuditTrail()
  }, [reportId, signatureId])

  const fetchAuditTrail = async () => {
    setLoading(true)
    setError(null)

    try {
      // TODO: Replace with actual API call
      // const events = await signatureService.getAuditTrail(reportId, signatureId)
      
      // Simulated API call for now
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const mockEvents: SignatureAuditEvent[] = [
        {
          action: 'created',
          userId: 'user-123',
          userName: 'Dr. John Smith',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          ipAddress: '192.168.1.100',
          result: 'success',
          details: 'Report signed by Dr. John Smith as author'
        },
        {
          action: 'verified',
          userId: 'user-456',
          userName: 'Dr. Jane Doe',
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          ipAddress: '192.168.1.101',
          result: 'success',
          details: 'Signature verified successfully'
        },
        {
          action: 'verified',
          userId: 'user-789',
          userName: 'System Admin',
          timestamp: new Date(Date.now() - 900000).toISOString(),
          ipAddress: '192.168.1.102',
          result: 'success',
          details: 'Automatic signature verification on report access'
        }
      ]

      setAuditEvents(mockEvents)
    } catch (err: any) {
      setError(err.message || 'Failed to load audit trail')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)

    try {
      // TODO: Replace with actual export service call
      // await signatureService.exportAuditTrail(reportId, signatureId)
      
      // Simulated export for now
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Create CSV content
      const csvContent = [
        ['Action', 'User', 'Timestamp', 'IP Address', 'Result', 'Details'].join(','),
        ...auditEvents.map(event => [
          event.action,
          event.userName || event.userId,
          new Date(event.timestamp).toLocaleString(),
          event.ipAddress,
          event.result,
          `"${event.details}"`
        ].join(','))
      ].join('\n')

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-trail-${reportId}-${Date.now()}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err.message || 'Failed to export audit trail')
    } finally {
      setExporting(false)
    }
  }

  const getActionIcon = (action: SignatureAuditEvent['action']) => {
    switch (action) {
      case 'created':
        return <CreateIcon />
      case 'verified':
        return <VerifiedIcon />
      case 'revoked':
        return <BlockIcon />
      case 'validation_failed':
        return <ErrorIcon />
      default:
        return <ErrorIcon />
    }
  }

  const getActionColor = (action: SignatureAuditEvent['action'], result: string) => {
    if (result === 'failure') return 'error'
    
    switch (action) {
      case 'created':
        return 'primary'
      case 'verified':
        return 'success'
      case 'revoked':
        return 'warning'
      case 'validation_failed':
        return 'error'
      default:
        return 'default'
    }
  }

  const getActionLabel = (action: SignatureAuditEvent['action']) => {
    switch (action) {
      case 'created':
        return 'Signature Created'
      case 'verified':
        return 'Signature Verified'
      case 'revoked':
        return 'Signature Revoked'
      case 'validation_failed':
        return 'Validation Failed'
      default:
        return action
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString()
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={4}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Alert 
        severity="error" 
        action={
          <Button color="inherit" size="small" onClick={fetchAuditTrail}>
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    )
  }

  if (auditEvents.length === 0) {
    return (
      <Alert severity="info">
        No audit events found for this report.
      </Alert>
    )
  }

  return (
    <Paper elevation={2} sx={{ p: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">
          Signature Audit Trail
        </Typography>
        <Box display="flex" gap={1}>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={fetchAuditTrail} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {showExport && (
            <Button
              size="small"
              startIcon={exporting ? <CircularProgress size={16} /> : <DownloadIcon />}
              onClick={handleExport}
              disabled={exporting}
              variant="outlined"
            >
              {exporting ? 'Exporting...' : 'Export'}
            </Button>
          )}
        </Box>
      </Box>

      <Divider sx={{ mb: 2 }} />

      <Box sx={{ maxHeight, overflowY: 'auto' }}>
        <Timeline position="right">
          {auditEvents.map((event, index) => {
            const { date, time } = formatTimestamp(event.timestamp)
            const isLast = index === auditEvents.length - 1

            return (
              <TimelineItem key={index}>
                <TimelineOppositeContent color="text.secondary" sx={{ flex: 0.3 }}>
                  <Typography variant="caption" display="block">
                    {date}
                  </Typography>
                  <Typography variant="caption" display="block" fontWeight="bold">
                    {time}
                  </Typography>
                </TimelineOppositeContent>

                <TimelineSeparator>
                  <TimelineDot 
                    color={getActionColor(event.action, event.result) as any}
                    variant={event.result === 'success' ? 'filled' : 'outlined'}
                  >
                    {getActionIcon(event.action)}
                  </TimelineDot>
                  {!isLast && <TimelineConnector />}
                </TimelineSeparator>

                <TimelineContent>
                  <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Typography variant="subtitle2">
                        {getActionLabel(event.action)}
                      </Typography>
                      <Chip
                        label={event.result}
                        size="small"
                        color={event.result === 'success' ? 'success' : 'error'}
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </Box>

                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {event.details}
                    </Typography>

                    <Box mt={1}>
                      <Typography variant="caption" color="text.secondary">
                        User: {event.userName || event.userId}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        IP: {event.ipAddress}
                      </Typography>
                    </Box>

                    {event.metadata && Object.keys(event.metadata).length > 0 && (
                      <Box mt={1} pt={1} borderTop={1} borderColor="divider">
                        <Typography variant="caption" color="text.secondary">
                          Additional Information:
                        </Typography>
                        {Object.entries(event.metadata).map(([key, value]) => (
                          <Typography key={key} variant="caption" display="block">
                            {key}: {String(value)}
                          </Typography>
                        ))}
                      </Box>
                    )}
                  </Paper>
                </TimelineContent>
              </TimelineItem>
            )
          })}
        </Timeline>
      </Box>

      <Box mt={2} pt={2} borderTop={1} borderColor="divider">
        <Typography variant="caption" color="text.secondary">
          Total Events: {auditEvents.length} • Report ID: {reportId}
          {signatureId && ` • Signature ID: ${signatureId}`}
        </Typography>
      </Box>
    </Paper>
  )
}
