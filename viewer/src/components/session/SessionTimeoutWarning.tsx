/**
 * Session Timeout Warning Component
 * Shows warning dialog 5 minutes before session timeout
 * Requirements: 10.3, 10.4
 */

import React, { useEffect, useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  LinearProgress
} from '@mui/material'
import WarningIcon from '@mui/icons-material/Warning'
import AccessTimeIcon from '@mui/icons-material/AccessTime'

interface SessionTimeoutWarningProps {
  open: boolean
  timeRemaining: number // in seconds
  onExtendSession: () => void
  onLogoutNow: () => void
}

export const SessionTimeoutWarning: React.FC<SessionTimeoutWarningProps> = ({
  open,
  timeRemaining,
  onExtendSession,
  onLogoutNow
}) => {
  const [countdown, setCountdown] = useState(timeRemaining)

  useEffect(() => {
    setCountdown(timeRemaining)
  }, [timeRemaining])

  useEffect(() => {
    if (!open) return

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [open])

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const progressValue = (countdown / timeRemaining) * 100

  return (
    <Dialog
      open={open}
      onClose={() => {}} // Prevent closing by clicking outside
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <WarningIcon color="warning" fontSize="large" />
          <Typography variant="h6" component="span">
            Session Expiring Soon
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body1" gutterBottom>
            Your session will expire due to inactivity.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Click "Stay Logged In" to continue your session, or you will be automatically logged out.
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            p: 3,
            bgcolor: 'warning.light',
            borderRadius: 1,
            mb: 2
          }}
        >
          <AccessTimeIcon sx={{ fontSize: 40, color: 'warning.dark' }} />
          <Typography
            variant="h3"
            component="div"
            sx={{ fontWeight: 'bold', color: 'warning.dark' }}
          >
            {formatTime(countdown)}
          </Typography>
        </Box>

        <LinearProgress
          variant="determinate"
          value={progressValue}
          color="warning"
          sx={{ height: 8, borderRadius: 1 }}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onLogoutNow}
          color="inherit"
          variant="outlined"
        >
          Logout Now
        </Button>
        <Button
          onClick={onExtendSession}
          variant="contained"
          color="primary"
          autoFocus
        >
          Stay Logged In
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default SessionTimeoutWarning
