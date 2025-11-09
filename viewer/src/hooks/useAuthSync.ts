import { useEffect } from 'react'
import { useAppDispatch } from '../store/hooks'
import { logout, clearAuth } from '../store/slices/authSlice'

/**
 * Hook to sync auth state with browser events
 * Handles token expiration and logout events
 */
export const useAuthSync = () => {
  const dispatch = useAppDispatch()

  useEffect(() => {
    // Handle logout required event (from axios interceptor)
    const handleLogoutRequired = () => {
      console.warn('⚠️ Auth token expired or invalid - logging out')
      dispatch(logout())
    }

    // Handle token expired event
    const handleTokenExpired = () => {
      console.warn('⚠️ Auth token expired')
      // The axios interceptor will try to refresh automatically
    }

    // Handle storage changes (logout from another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'accessToken' && !e.newValue) {
        // Token was removed in another tab
        console.warn('⚠️ Auth token removed in another tab - logging out')
        dispatch(clearAuth())
      }
    }

    // Add event listeners
    window.addEventListener('auth:logout-required', handleLogoutRequired)
    window.addEventListener('auth:token-expired', handleTokenExpired)
    window.addEventListener('storage', handleStorageChange)

    // Cleanup
    return () => {
      window.removeEventListener('auth:logout-required', handleLogoutRequired)
      window.removeEventListener('auth:token-expired', handleTokenExpired)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [dispatch])
}
