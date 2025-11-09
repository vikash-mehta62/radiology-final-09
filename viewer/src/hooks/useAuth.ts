import { useEffect } from 'react'
import { useAppSelector, useAppDispatch } from '../store/hooks'
import { 
  login as loginAction,
  logout as logoutAction,
  refreshToken as refreshTokenAction,
  getCurrentUser,
  updateProfile as updateProfileAction,
  clearError,
  updateLastActivity,
  selectAuth,
  selectUser,
  selectIsAuthenticated,
  selectAuthLoading,
  selectAuthError,
  selectAccessToken
} from '../store/slices/authSlice'
import type { LoginCredentials, User } from '../types/auth'

export const useAuth = () => {
  const dispatch = useAppDispatch()
  const auth = useAppSelector(selectAuth)
  const user = useAppSelector(selectUser)
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const isLoading = useAppSelector(selectAuthLoading)
  const error = useAppSelector(selectAuthError)
  const accessToken = useAppSelector(selectAccessToken)

  // Auto-refresh token when it's about to expire
  useEffect(() => {
    if (!isAuthenticated || !accessToken) return

    const checkTokenExpiry = () => {
      try {
        // Decode JWT to check expiry (simplified - in production use a proper JWT library)
        const payload = JSON.parse(atob(accessToken.split('.')[1]))
        const expiryTime = payload.exp * 1000 // Convert to milliseconds
        const currentTime = Date.now()
        const timeUntilExpiry = expiryTime - currentTime
        
        // Refresh token if it expires in less than 5 minutes
        if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
          dispatch(refreshTokenAction())
        }
      } catch (error) {
        console.warn('Failed to decode token:', error)
      }
    }

    // Check token expiry every minute
    const interval = setInterval(checkTokenExpiry, 60 * 1000)
    
    // Check immediately
    checkTokenExpiry()

    return () => clearInterval(interval)
  }, [isAuthenticated, accessToken, dispatch])

  // Listen for token expiry events from axios interceptor
  useEffect(() => {
    const handleTokenExpired = () => {
      if (auth.refreshToken) {
        dispatch(refreshTokenAction())
      } else {
        dispatch(logoutAction())
      }
    }

    window.addEventListener('auth:token-expired', handleTokenExpired)
    return () => window.removeEventListener('auth:token-expired', handleTokenExpired)
  }, [auth.refreshToken, dispatch])

  // Update last activity on user interaction
  useEffect(() => {
    if (!isAuthenticated) return

    const updateActivity = () => {
      dispatch(updateLastActivity())
    }

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart']
    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true })
    })

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity)
      })
    }
  }, [isAuthenticated, dispatch])

  // Auto-logout after inactivity
  useEffect(() => {
    if (!isAuthenticated) return

    const checkInactivity = () => {
      const inactivityTimeout = 30 * 60 * 1000 // 30 minutes
      const timeSinceLastActivity = Date.now() - auth.lastActivity
      
      if (timeSinceLastActivity > inactivityTimeout) {
        dispatch(logoutAction())
      }
    }

    const interval = setInterval(checkInactivity, 60 * 1000) // Check every minute
    return () => clearInterval(interval)
  }, [isAuthenticated, auth.lastActivity, dispatch])

  const login = async (credentials: LoginCredentials) => {
    const result = await dispatch(loginAction(credentials))
    return result
  }

  const logout = async () => {
    await dispatch(logoutAction())
  }

  const refreshToken = async () => {
    if (auth.refreshToken) {
      const result = await dispatch(refreshTokenAction())
      return result
    }
    throw new Error('No refresh token available')
  }

  const fetchCurrentUser = async () => {
    const result = await dispatch(getCurrentUser())
    return result
  }

  const updateProfile = async (profileData: Partial<User>) => {
    const result = await dispatch(updateProfileAction(profileData))
    return result
  }

  const clearAuthError = () => {
    dispatch(clearError())
  }

  const hasPermission = (permission: string): boolean => {
    if (!user?.permissions) return false
    
    // Check for exact permission or wildcard
    return user.permissions.includes(permission) || 
           user.permissions.includes('*') ||
           user.permissions.some(p => {
             const [namespace] = permission.split(':')
             return p === `${namespace}:*`
           })
  }

  const hasRole = (role: string): boolean => {
    return user?.roles?.includes(role) || false
  }

  const hasAnyRole = (roles: string[]): boolean => {
    if (!user?.roles) return false
    return roles.some(role => user.roles.includes(role))
  }

  return {
    // State
    user,
    isAuthenticated,
    isLoading,
    error,
    accessToken,
    
    // Actions
    login,
    logout,
    refreshToken,
    fetchCurrentUser,
    updateProfile,
    clearAuthError,
    
    // Utilities
    hasPermission,
    hasRole,
    hasAnyRole,
  }
}