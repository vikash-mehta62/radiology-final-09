import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { LoadingScreen } from '../ui/LoadingScreen'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredPermission?: string
  requiredRole?: string
  requiredRoles?: string[]
  fallback?: React.ReactNode
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  requiredRole,
  requiredRoles,
  fallback
}) => {
  const { isAuthenticated, isLoading, hasPermission, hasRole, hasAnyRole } = useAuth()
  const location = useLocation()

  // Show loading while checking authentication
  if (isLoading) {
    return <LoadingScreen />
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Check permission if required
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return fallback || <Navigate to="/dashboard" replace />
  }

  // Check single role if required
  if (requiredRole && !hasRole(requiredRole)) {
    return fallback || <Navigate to="/dashboard" replace />
  }

  // Check multiple roles if required
  if (requiredRoles && !hasAnyRole(requiredRoles)) {
    return fallback || <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}