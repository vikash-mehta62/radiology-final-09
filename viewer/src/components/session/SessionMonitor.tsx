/**
 * Session Monitor Component
 * Monitors user activity and tracks session expiration
 * Requirements: 10.1-10.12, 13.1-13.10
 */

import React, { useEffect, useCallback, useRef } from 'react'
import { Box, Chip, Tooltip } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningIcon from '@mui/icons-material/Warning'
import ErrorIcon from '@mui/icons-material/Error'

interface SessionMonitorProps {
  sessionStatus: 'active' | 'warning' | 'expired'
  timeRemaining: number // in seconds
  onActivity: () => void
  showIndicator?: boolean
}

export const SessionMonitor: React.FC<SessionMonitorProps> = ({
  sessionStatus,
  timeRemaining,
  onActivity,
  showIndicator = false
}) => {
  const lastActivityRef = useRef<Date>(new Date())
  const activityThrottleRef = useRef<NodeJS.Timeout | null>(null)

  // Activity events to monitor
  const activityEvents = [
    'mousedown',
    'keydown',
    'scroll',
    'touchstart',
    'mousemove',
    'click'
  ]

  // Throttled activity handler to avoid excessive updates
  const handleActivity = useCallback(() => {
    // Throttle activity updates to once per 10 seconds
    if (activityThrottleRef.current) return

    lastActivityRef.current = new Date()
    onActivity()

    activityThrottleRef.current = setTimeout(() => {
      activityThrottleRef.current = null
    }, 10000) // 10 seconds throttle
  }, [onActivity])

  // Set up activity listeners
  useEffect(() => {
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity)
      })
      if (activityThrottleRef.current) {
        clearTimeout(activityThrottleRef.current)
      }
    }
  }, [handleActivity])

  // Monitor for session expiration
  useEffect(() => {
    if (sessionStatus === 'expired') {
      // Dispatch custom event for session expiration
      const event = new CustomEvent('session-expired', {
        detail: { lastActivity: lastActivityRef.current }
      })
      window.dispatchEvent(event)
    }
  }, [sessionStatus])

  // Log activity for debugging (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Session Monitor:', {
        status: sessionStatus,
        timeRemaining,
        lastActivity: lastActivityRef.current
      })
    }
  }, [sessionStatus, timeRemaining])

  // Format time remaining
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  // Get status icon and color
  const getStatusConfig = () => {
    switch (sessionStatus) {
      case 'active':
        return {
          icon: <CheckCircleIcon fontSize="small" />,
          color: 'success' as const,
          label: 'Session Active',
          tooltip: `Session active - ${formatTime(timeRemaining)} remaining`
        }
      case 'warning':
        return {
          icon: <WarningIcon fontSize="small" />,
          color: 'warning' as const,
          label: 'Session Expiring',
          tooltip: `Session expiring in ${formatTime(timeRemaining)}`
        }
      case 'expired':
        return {
          icon: <ErrorIcon fontSize="small" />,
          color: 'error' as const,
          label: 'Session Expired',
          tooltip: 'Session has expired'
        }
      default:
        return {
          icon: <CheckCircleIcon fontSize="small" />,
          color: 'default' as const,
          label: 'Unknown',
          tooltip: 'Session status unknown'
        }
    }
  }

  const statusConfig = getStatusConfig()

  // Don't render indicator if not requested
  if (!showIndicator) {
    return null
  }

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
      <Tooltip title={statusConfig.tooltip} arrow>
        <Chip
          icon={statusConfig.icon}
          label={statusConfig.label}
          color={statusConfig.color}
          size="small"
          variant="outlined"
          sx={{
            cursor: 'help',
            '& .MuiChip-icon': {
              marginLeft: '8px'
            }
          }}
        />
      </Tooltip>
    </Box>
  )
}

export default SessionMonitor
