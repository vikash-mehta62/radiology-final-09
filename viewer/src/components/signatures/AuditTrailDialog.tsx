import React, { useEffect, useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  Typography,
  Box,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material'
import { signatureService } from '../../services/signatureService'

interface AuditEvent {
  timestamp: string
  action: string
  userId: string
  userName: string
  ipAddress: string
  result: string
  details?: any
}

interface AuditTrailDialogProps {
  open: boolean
  onClose: () => void
  reportId: string
}

export const AuditTrailDialog: React.FC<AuditTrailDialogProps> = ({
  open,
  onClose,
  reportId
}) => {
  const [auditTrail, setAuditTrail] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      fetchAuditTrail()
    }
  }, [open, reportId])

  const fetchAuditTrail = async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await signatureService.getAuditTrail(reportId)
      
      if (result.success) {
        setAuditTrail(result.data.events)
      } else {
        setError(result.message || 'Failed to load audit trail')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const getActionColor = (action: string) => {
    const colors: Record<string, 'success' | 'info' | 'warning' | 'error'> = {
      sign: 'success',
      verify: 'info',
      revoke: 'error',
      view: 'info'
    }
    return colors[action] || 'default'
  }

  const getResultColor = (result: string) => {
    return result === 'success' ? 'success' : 'error'
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Audit Trail - Report Signatures
      </DialogTitle>
      <DialogContent>
        {loading && (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && auditTrail.length === 0 && (
          <Alert severity="info">
            No audit events found for this report.
          </Alert>
        )}

        {!loading && !error && auditTrail.length > 0 && (
          <List>
            {auditTrail.map((event, index) => (
              <ListItem
                key={index}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1,
                  flexDirection: 'column',
                  alignItems: 'flex-start'
                }}
              >
                <Box display="flex" justifyContent="space-between" width="100%" mb={1}>
                  <Box display="flex" gap={1} alignItems="center">
                    <Chip
                      label={event.action}
                      size="small"
                      color={getActionColor(event.action)}
                    />
                    <Chip
                      label={event.result}
                      size="small"
                      color={getResultColor(event.result)}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(event.timestamp).toLocaleString()}
                  </Typography>
                </Box>

                <ListItemText
                  primary={
                    <Typography variant="body2">
                      <strong>{event.userName}</strong> ({event.userId})
                    </Typography>
                  }
                  secondary={
                    <Box>
                      <Typography variant="caption" display="block">
                        IP Address: {event.ipAddress}
                      </Typography>
                      {event.details && (
                        <Typography variant="caption" display="block" color="text.secondary">
                          {JSON.stringify(event.details, null, 2)}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
