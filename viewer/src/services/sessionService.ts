/**
 * Session Service
 * Handles session management, token refresh, and activity tracking
 */

import axios, { AxiosError } from 'axios'
import { authService } from './authService'

export interface SessionStatus {
  status: 'active' | 'warning' | 'expired'
  expiresIn: number
  lastActivity: Date
  sessionId?: string
}

export interface Session {
  id: string
  userId: string
  deviceInfo: {
    userAgent: string
    ipAddress: string
    deviceId: string
    location?: string
  }
  createdAt: Date
  lastActivity: Date
  expiresAt: Date
  status: 'active' | 'expired' | 'revoked'
}

interface RetryOptions {
  maxRetries?: number
  retryDelay?: number
  backoffMultiplier?: number
}

class SessionService {
  private baseURL: string
  private readonly defaultRetryOptions: RetryOptions = {
    maxRetries: 3,
    retryDelay: 1000,
    backoffMultiplier: 2,
  }
  private activityTimer: NodeJS.Timeout | null = null
  private lastActivityTime: number = Date.now()
  private readonly ACTIVITY_UPDATE_INTERVAL = 60000 // 1 minute
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes
  private readonly WARNING_TIME = 5 * 60 * 1000 // 5 minutes

  constructor() {
    const env = (import.meta as any).env || {}
    const apiBaseRaw = env.VITE_API_URL || env.VITE_BACKEND_URL || ''
    if (apiBaseRaw) {
      const trimmed = apiBaseRaw.replace(/\/$/, '').replace(/\/api\/?$/, '')
      this.baseURL = `${trimmed}/auth`
    } else {
      if (!env.DEV) {
        this.baseURL = 'http://localhost:8001/auth'
      } else {
        this.baseURL = '/auth'
      }
    }
  }

  /**
   * Retry wrapper with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const { maxRetries, retryDelay, backoffMultiplier } = {
      ...this.defaultRetryOptions,
      ...options,
    }

    let lastError: Error | null = null
    let delay = retryDelay!

    for (let attempt = 0; attempt <= maxRetries!; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error as Error
        
        // Don't retry on validation errors (4xx except 408, 429)
        if (axios.isAxiosError(error)) {
          const status = error.response?.status
          if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
            throw error
          }
        }
        
        if (attempt < maxRetries!) {
          console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`, error)
          await new Promise(resolve => setTimeout(resolve, delay))
          delay *= backoffMultiplier!
        }
      }
    }

    throw lastError || new Error('Operation failed after retries')
  }

  /**
   * Initialize session monitoring
   */
  initializeSessionMonitoring(): void {
    // Track user activity
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart']
    
    const updateActivity = () => {
      this.lastActivityTime = Date.now()
    }
    
    activityEvents.forEach(event => {
      window.addEventListener(event, updateActivity, { passive: true })
    })

    // Periodically update activity on server
    this.activityTimer = setInterval(() => {
      this.updateActivity().catch(error => {
        console.error('Failed to update activity:', error)
      })
    }, this.ACTIVITY_UPDATE_INTERVAL)

    console.log('✅ Session monitoring initialized')
  }

  /**
   * Stop session monitoring
   */
  stopSessionMonitoring(): void {
    if (this.activityTimer) {
      clearInterval(this.activityTimer)
      this.activityTimer = null
    }

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart']
    activityEvents.forEach(event => {
      window.removeEventListener(event, () => {})
    })

    console.log('✅ Session monitoring stopped')
  }

  /**
   * Update activity timestamp
   */
  async updateActivity(): Promise<void> {
    try {
      await this.retryWithBackoff(async () => {
        await axios.post(`${this.baseURL}/activity`, {
          timestamp: new Date().toISOString()
        })
      })
    } catch (error) {
      console.error('Error updating activity:', error)
      // Don't throw - activity updates are not critical
    }
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(): Promise<string> {
    try {
      const refreshToken = localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken')
      
      if (!refreshToken) {
        throw new Error('No refresh token available')
      }

      const response = await authService.refreshToken(refreshToken)
      
      if (!response.success) {
        throw new Error('Token refresh failed')
      }

      return response.accessToken
    } catch (error) {
      console.error('Error refreshing token:', error)
      throw error
    }
  }

  /**
   * Get current session status
   */
  async getSessionStatus(): Promise<SessionStatus> {
    try {
      return await this.retryWithBackoff(async () => {
        const response = await axios.get(`${this.baseURL}/session-status`)
        const data = response.data.data || response.data
        
        return {
          ...data,
          lastActivity: new Date(data.lastActivity),
        }
      })
    } catch (error) {
      console.error('Error fetching session status:', error)
      
      // Fallback to local calculation
      const timeSinceActivity = Date.now() - this.lastActivityTime
      const expiresIn = Math.max(0, this.SESSION_TIMEOUT - timeSinceActivity)
      
      let status: 'active' | 'warning' | 'expired' = 'active'
      if (expiresIn === 0) {
        status = 'expired'
      } else if (expiresIn < this.WARNING_TIME) {
        status = 'warning'
      }
      
      return {
        status,
        expiresIn,
        lastActivity: new Date(this.lastActivityTime),
      }
    }
  }

  /**
   * Extend current session
   */
  async extendSession(): Promise<boolean> {
    try {
      await this.retryWithBackoff(async () => {
        const response = await axios.post(`${this.baseURL}/extend-session`)
        
        if (!response.data.success) {
          throw new Error('Failed to extend session')
        }
      })
      
      this.lastActivityTime = Date.now()
      return true
    } catch (error) {
      console.error('Error extending session:', error)
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.message
        throw new Error(`Failed to extend session: ${message}`)
      }
      throw error
    }
  }

  /**
   * Validate current session
   */
  async validateSession(): Promise<boolean> {
    try {
      return await this.retryWithBackoff(async () => {
        const response = await axios.post(`${this.baseURL}/validate`)
        return response.data.success || false
      })
    } catch (error) {
      console.error('Error validating session:', error)
      return false
    }
  }

  /**
   * Get all active sessions for current user
   */
  async getSessions(): Promise<Session[]> {
    try {
      return await this.retryWithBackoff(async () => {
        const response = await axios.get(`${this.baseURL}/sessions`)
        const data = response.data.data || response.data
        
        return data.map((session: any) => ({
          ...session,
          createdAt: new Date(session.createdAt),
          lastActivity: new Date(session.lastActivity),
          expiresAt: new Date(session.expiresAt),
        }))
      })
    } catch (error) {
      console.error('Error fetching sessions:', error)
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.message
        throw new Error(`Failed to fetch sessions: ${message}`)
      }
      throw error
    }
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string): Promise<void> {
    if (!sessionId || sessionId.trim() === '') {
      throw new Error('Session ID is required')
    }

    try {
      await this.retryWithBackoff(async () => {
        await axios.delete(`${this.baseURL}/sessions/${sessionId}`)
      })
    } catch (error) {
      console.error('Error revoking session:', error)
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.message
        throw new Error(`Failed to revoke session: ${message}`)
      }
      throw error
    }
  }

  /**
   * Logout and clear session
   */
  async logout(): Promise<void> {
    try {
      this.stopSessionMonitoring()
      await authService.logout()
    } catch (error) {
      console.error('Error during logout:', error)
      throw error
    }
  }

  /**
   * Get time until session expires
   */
  getTimeUntilExpiry(): number {
    const timeSinceActivity = Date.now() - this.lastActivityTime
    return Math.max(0, this.SESSION_TIMEOUT - timeSinceActivity)
  }

  /**
   * Check if session is about to expire
   */
  isSessionExpiringSoon(): boolean {
    return this.getTimeUntilExpiry() < this.WARNING_TIME
  }

  /**
   * Check if session has expired
   */
  isSessionExpired(): boolean {
    return this.getTimeUntilExpiry() === 0
  }
}

export const sessionService = new SessionService()
export default sessionService
