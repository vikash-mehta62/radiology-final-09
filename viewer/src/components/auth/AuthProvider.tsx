import React, { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { authService } from '../../services/authService'
import { LoadingScreen } from '../ui/LoadingScreen'

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { isAuthenticated, accessToken, fetchCurrentUser } = useAuth()
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Set auth token if available
        if (accessToken) {
          authService.setAuthToken(accessToken)
          
          // Fetch current user data if we have a token but no user data
          if (isAuthenticated) {
            await fetchCurrentUser()
          }
        }
      } catch (error) {
        console.warn('Failed to initialize auth:', error)
        // Don't throw error here, let the app continue
      } finally {
        setIsInitializing(false)
      }
    }

    initializeAuth()
  }, [accessToken, isAuthenticated, fetchCurrentUser])

  // Show loading screen while initializing
  if (isInitializing) {
    return <LoadingScreen />
  }

  return <>{children}</>
}