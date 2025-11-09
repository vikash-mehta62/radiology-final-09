/**
 * Enhanced Session Management Hook
 * HIPAA-compliant session handling with auto-timeout, activity monitoring, and token refresh
 * Requirements: 10.1-10.12, 11.1-11.10
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { authService } from '../services/authService'

interface SessionConfig {
  timeoutMinutes: number // Default: 30 minutes
  warningMinutes: number // Default: 5 minutes before timeout
  extendOnActivity: boolean // Default: true
  autoRefreshToken: boolean // Default: true
  refreshIntervalMinutes: number // Default: 10 minutes
}

interface SessionStatus {
  isActive: boolean
  status: 'active' | 'warning' | 'expired'
  timeLeft: number // in seconds
  showWarning: boolean
  lastActivity: Date
}

const DEFAULT_CONFIG: SessionConfig = {
  timeoutMinutes: 30,
  warningMinutes: 5,
  extendOnActivity: true,
  autoRefreshToken: true,
  refreshIntervalMinutes: 10
}

export const useSessionManagement = (
  onTimeout?: () => void,
  onWarning?: (minutesLeft: number) => void,
  config: Partial<SessionConfig> = {}
) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>({
    isActive: true,
    status: 'active',
    timeLeft: finalConfig.timeoutMinutes * 60,
    showWarning: false,
    lastActivity: new Date()
  })
  
  const timeoutRef = useRef<NodeJS.Timeout>()
  const warningRef = useRef<NodeJS.Timeout>()
  const refreshRef = useRef<NodeJS.Timeout>()
  const lastActivityRef = useRef<Date>(new Date())
  const countdownRef = useRef<NodeJS.Timeout>()

  // Reset session timer
  const resetTimer = useCallback(() => {
    lastActivityRef.current = new Date()
    
    setSessionStatus(prev => ({
      ...prev,
      isActive: true,
      status: 'active',
      timeLeft: finalConfig.timeoutMinutes * 60,
      showWarning: false,
      lastActivity: new Date()
    }))

    // Clear existing timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (warningRef.current) clearTimeout(warningRef.current)

    // Set warning timer (5 minutes before timeout)
    const warningTime = (finalConfig.timeoutMinutes - finalConfig.warningMinutes) * 60 * 1000
    warningRef.current = setTimeout(() => {
      setSessionStatus(prev => ({
        ...prev,
        status: 'warning',
        showWarning: true
      }))
      
      if (onWarning) {
        onWarning(finalConfig.warningMinutes)
      }
    }, warningTime)

    // Set timeout timer
    const timeoutTime = finalConfig.timeoutMinutes * 60 * 1000
    timeoutRef.current = setTimeout(() => {
      handleTimeout()
    }, timeoutTime)
  }, [finalConfig, onWarning])

  // Handle session timeout
  const handleTimeout = useCallback(() => {
    setSessionStatus(prev => ({
      ...prev,
      isActive: false,
      status: 'expired',
      timeLeft: 0
    }))
    
    // Dispatch custom event for session timeout
    const event = new CustomEvent('session-timeout', {
      detail: { lastActivity: lastActivityRef.current }
    })
    window.dispatchEvent(event)

    // Call timeout callback
    if (onTimeout) {
      onTimeout()
    }

    // Clear session data and logout
    authService.logout().catch(console.error)
  }, [onTimeout])

  // Track user activity
  const handleActivity = useCallback(() => {
    if (sessionStatus.isActive && finalConfig.extendOnActivity) {
      resetTimer()
    }
  }, [sessionStatus.isActive, finalConfig.extendOnActivity, resetTimer])

  // Auto-refresh token
  const refreshToken = useCallback(async () => {
    if (!finalConfig.autoRefreshToken) return

    // Skip in preview/dev when no backend URL is configured
    const env: any = (import.meta as any).env || {}
    const hasBackend = !!(env.VITE_API_URL || env.VITE_BACKEND_URL)
    if (!hasBackend) {
      console.warn('Skipping token refresh: backend URL not configured')
      return
    }

    try {
      const refreshToken = localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken')
      
      if (!refreshToken) {
        console.warn('No refresh token available')
        return
      }

      await authService.refreshToken(refreshToken)
      console.log('✅ Token auto-refreshed successfully')
    } catch (error) {
      console.error('❌ Token refresh failed:', error)
      // If refresh fails, let the session expire naturally
    }
  }, [finalConfig.autoRefreshToken])

  // Set up activity monitoring
  useEffect(() => {
    if (!finalConfig.extendOnActivity) return

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart']

    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    // Initial timer
    resetTimer()

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity)
      })
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (warningRef.current) clearTimeout(warningRef.current)
    }
  }, [finalConfig.extendOnActivity, handleActivity, resetTimer])

  // Set up auto token refresh
  useEffect(() => {
    if (!finalConfig.autoRefreshToken) return

    // Initial refresh
    refreshToken()

    // Set up periodic refresh
    const refreshInterval = finalConfig.refreshIntervalMinutes * 60 * 1000
    refreshRef.current = setInterval(refreshToken, refreshInterval)

    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current)
    }
  }, [finalConfig.autoRefreshToken, finalConfig.refreshIntervalMinutes, refreshToken])

  // Update time left countdown
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastActivityRef.current.getTime()) / 1000)
      const remaining = finalConfig.timeoutMinutes * 60 - elapsed
      
      setSessionStatus(prev => ({
        ...prev,
        timeLeft: Math.max(0, remaining)
      }))

      // Auto-expire if time runs out
      if (remaining <= 0 && sessionStatus.isActive) {
        handleTimeout()
      }
    }, 1000)

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [finalConfig.timeoutMinutes, sessionStatus.isActive, handleTimeout])

  // Extend session manually
  const extendSession = useCallback(async () => {
    try {
      // Refresh token to extend session
      await refreshToken()
      
      // Reset timer
      resetTimer()
      
      // Log session extension
      console.log('✅ Session extended successfully')
      
      // Optional: Call backend to log extension
      try {
        await fetch('/api/audit/session-extended', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authService.getStoredToken()}`
          },
          body: JSON.stringify({
            timestamp: new Date(),
            userId: JSON.parse(sessionStorage.getItem('user') || localStorage.getItem('user') || '{}').id
          })
        })
      } catch (auditError) {
        // Don't fail if audit logging fails
        console.warn('Failed to log session extension:', auditError)
      }
    } catch (error) {
      console.error('Failed to extend session:', error)
      throw error
    }
  }, [refreshToken, resetTimer])

  // End session manually
  const endSession = useCallback(() => {
    handleTimeout()
  }, [handleTimeout])

  // Format time left
  const formatTimeLeft = useCallback(() => {
    const minutes = Math.floor(sessionStatus.timeLeft / 60)
    const seconds = sessionStatus.timeLeft % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }, [sessionStatus.timeLeft])

  // Get session info
  const getSessionInfo = useCallback(() => {
    return {
      isActive: sessionStatus.isActive,
      status: sessionStatus.status,
      timeLeft: sessionStatus.timeLeft,
      timeLeftFormatted: formatTimeLeft(),
      showWarning: sessionStatus.showWarning,
      lastActivity: sessionStatus.lastActivity,
      expiresAt: new Date(lastActivityRef.current.getTime() + finalConfig.timeoutMinutes * 60 * 1000)
    }
  }, [sessionStatus, formatTimeLeft, finalConfig.timeoutMinutes])

  return {
    // Status
    isActive: sessionStatus.isActive,
    status: sessionStatus.status,
    timeLeft: sessionStatus.timeLeft,
    showWarning: sessionStatus.showWarning,
    lastActivity: sessionStatus.lastActivity,
    
    // Formatted values
    formatTimeLeft: formatTimeLeft(),
    
    // Actions
    extendSession,
    endSession,
    resetTimer,
    handleActivity,
    
    // Info
    getSessionInfo
  }
}

export default useSessionManagement
