import React, { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { CssBaseline } from '@mui/material'
import { Helmet } from 'react-helmet-async'

import { useAuth } from './hooks/useAuth'
import { useAuthSync } from './hooks/useAuthSync'
import { useSessionManagement } from './hooks/useSessionManagement'
import { LoadingScreen } from './components/ui/LoadingScreen'
import { AuthDebug } from './components/debug/AuthDebug'
import { getRoleBasedRedirect } from './utils/roleBasedRedirect'
import { AppProvider } from './contexts/AppContext'
import { WorkflowProvider } from './contexts/WorkflowContext'
import { WebSocketProvider } from './contexts/WebSocketContext'
import SessionTimeoutWarning from './components/session/SessionTimeoutWarning'
import SessionMonitor from './components/session/SessionMonitor'
import { initializeSoundSystem } from './utils/notificationSound'

// Route pages (heavy) - lazy loaded to reduce initial bundle
const ViewerPage = React.lazy(() => import('./pages/viewer/ViewerPage'))
const PatientsPage = React.lazy(() => import('./pages/patients/PatientsPage'))
const EnhancedWorklistPage = React.lazy(() => import('./pages/worklist/EnhancedWorklistPage'))
const PriorAuthPage = React.lazy(() => import('./pages/prior-auth/PriorAuthPage'))
const OrthancViewerPage = React.lazy(() => import('./pages/orthanc/OrthancViewerPage'))
const SystemDashboard = React.lazy(() => import('./pages/dashboard/SystemDashboard'))
const EnhancedDashboard = React.lazy(() => import('./pages/dashboard/EnhancedDashboard'))
const MainLayout = React.lazy(() => import('./components/layout/MainLayout'))
const UsersPage = React.lazy(() => import('./pages/users/UsersPage'))
const SuperAdminDashboard = React.lazy(() => import('./pages/superadmin/SuperAdminDashboard'))
const SettingsPage = React.lazy(() => import('./pages/settings/SettingsPage'))
const ProfilePage = React.lazy(() => import('./pages/profile/ProfilePage'))
const BillingPage = React.lazy(() => import('./pages/billing/BillingPage'))
const FollowUpPage = React.lazy(() => import('./pages/followup/FollowUpPage'))
const ReportingPage = React.lazy(() => import('./pages/ReportingPage'))
const ConnectionManagerPage = React.lazy(() => import('./pages/ConnectionManagerPage'))
const AuditLogPage = React.lazy(() => import('./pages/audit/AuditLogPage'))
const AnonymizationPage = React.lazy(() => import('./pages/admin/AnonymizationPage'))
const IPWhitelistPage = React.lazy(() => import('./pages/admin/IPWhitelistPage'))
const DataRetentionPage = React.lazy(() => import('./pages/admin/DataRetentionPage'))

// Simple pages without complex dependencies
const LoginPage = React.lazy(() => import('./pages/auth/LoginPage'))
const RegisterPage = React.lazy(() => import('./pages/auth/RegisterPage'))

// Landing page components
import LandingLayout from './landing/LandingLayout'
import LandingHome from './landing/pages/LandingHome'
import SimpleLanding from './landing/pages/SimpleLanding'
import About from './landing/pages/About'
import ServicesPageLanding from './landing/pages/ServicesPage'
import Contact from './landing/pages/Contact'
import Blog from './landing/pages/Blog'
import TestPage from './landing/pages/TestPage'



// Simple Protected Route
const SimpleProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth()

  if (import.meta.env.DEV) {
    console.log('SimpleProtectedRoute:', { isAuthenticated, isLoading, user })
  }

  if (isLoading) {
    return <LoadingScreen message="Checking authentication..." />
  }

  if (!isAuthenticated) {
    if (import.meta.env.DEV) {
      console.log('Not authenticated, redirecting to login')
    }
    return <Navigate to="/login" replace />
  }

  if (import.meta.env.DEV) {
    console.log('Authenticated, showing protected content')
  }
  return <>{children}</>
}

// Super Admin Protected Route
const SuperAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth()

  if (import.meta.env.DEV) {
    console.log('SuperAdminRoute:', { isAuthenticated, isLoading, user, roles: user?.roles })
  }

  if (isLoading) {
    return <LoadingScreen message="Checking authentication..." />
  }

  if (!isAuthenticated) {
    if (import.meta.env.DEV) {
      console.log('Not authenticated, redirecting to login')
    }
    return <Navigate to="/login" replace />
  }

  // Check if user has super admin role
  const isSuperAdmin = user?.roles?.includes('system:admin') || user?.roles?.includes('super_admin')

  if (!isSuperAdmin) {
    if (import.meta.env.DEV) {
      console.log('Not a super admin, redirecting to dashboard')
    }
    return <Navigate to="/dashboard" replace />
  }

  if (import.meta.env.DEV) {
    console.log('Super admin authenticated, showing protected content')
  }
  return <>{children}</>
}

function App() {
  const { isAuthenticated, isLoading, user, error, logout } = useAuth()
  const navigate = useNavigate()

  // Detect backend presence once and reuse throughout component
  const hasBackend = !!(import.meta.env.VITE_API_URL || (import.meta as any).env?.VITE_BACKEND_URL)

  // Sync auth state with browser events
  useAuthSync()

  // Initialize notification sound system after user interaction
  useEffect(() => {
    if (isAuthenticated) {
      // Initialize sound system after a short delay to ensure user has interacted
      const timer = setTimeout(() => {
        initializeSoundSystem().catch(err => {
          console.warn('Failed to initialize sound system:', err);
        });
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated])



  useEffect(() => {
    if (!hasBackend) {
      console.warn('Skipping token refresh: backend URL not configured')
      return
    }
    // Function to get a specific cookie value
    function getCookie(name: string) {
      const value = `; ${document.cookie}`
      const parts = value.split(`; ${name}=`)
      if (parts.length === 2) return parts.pop()!.split(';').shift()!
      return undefined
    }

    console.log('📦 All cookies:', document.cookie)

    // Get refresh_token from cookies
    const refreshTokenCookie = getCookie('refresh_token')

    // If token exists, persist as refreshToken (not accessToken)
    if (refreshTokenCookie) {
      localStorage.setItem('refreshToken', refreshTokenCookie)
      console.log('✅ Refresh token persisted to localStorage')

      // If no access token yet, attempt to refresh to obtain one
      const hasAccessToken = !!(localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken'))
      if (!hasAccessToken) {
        import('./services/authService').then(({ authService }) => {
          authService
            .refreshToken(refreshTokenCookie)
            .then((res) => {
              if (res?.success) {
                console.log('🔄 Access token obtained via cookie refresh')
              } else {
                console.warn('⚠️ Token refresh via cookie did not succeed')
              }
            })
            .catch((err) => {
              console.warn('⚠️ Failed to refresh token from cookie:', err)
            })
        })
      }
    } else {
      console.warn('⚠️ refresh_token not found in cookies')
    }
  }, [])
  // Session management with auto-timeout and token refresh
  const {
    status: sessionStatus,
    timeLeft,
    showWarning,
    extendSession,
    handleActivity
  } = useSessionManagement(
    // onTimeout callback
    () => {
      console.log('Session timed out')
      logout()
      navigate('/login?reason=timeout')
    },
    // onWarning callback
    (minutesLeft) => {
      console.log(`Session expiring in ${minutesLeft} minutes`)
    },
    // config
    {
      timeoutMinutes: 30,
      warningMinutes: 5,
      extendOnActivity: true,
      // Disable auto-refresh when backend is missing to reduce preview noise
      autoRefreshToken: hasBackend,
      refreshIntervalMinutes: 10
    }
  )

  if (import.meta.env.DEV) {
    console.log('App render:', { isAuthenticated, isLoading, user, error, sessionStatus })
  }

  // Determine whether to auto-connect WebSocket (requires backend + valid stored token)
  const shouldAutoConnectWs = isAuthenticated && hasBackend && (
    !!localStorage.getItem('accessToken') || !!sessionStorage.getItem('accessToken')
  )

  // Show loading screen while checking authentication
  if (isLoading) {
    if (import.meta.env.DEV) {
      console.log('App showing loading screen')
    }
    return <LoadingScreen message="Initializing application..." />
  }

  // Show error if authentication failed
  if (error) {
    console.error('Authentication error:', error)
  }

  // Handle session timeout warning
  const handleExtendSession = async () => {
    try {
      await extendSession()
      console.log('Session extended successfully')
    } catch (error) {
      console.error('Failed to extend session:', error)
      logout()
      navigate('/login?reason=session-expired')
    }
  }

  const handleLogoutNow = () => {
    logout()
    navigate('/login')
  }

  return (
    <WorkflowProvider>
      <AppProvider>
        <WebSocketProvider autoConnect={shouldAutoConnectWs}>
          <Helmet>
            <title>Medical Imaging Viewer</title>
            <meta name="description" content="Advanced medical imaging viewer with AI-powered analysis" />
          </Helmet>

          <CssBaseline />

          {/* Session Timeout Warning Dialog */}
          {isAuthenticated && (
            <SessionTimeoutWarning
              open={showWarning}
              timeRemaining={timeLeft}
              onExtendSession={handleExtendSession}
              onLogoutNow={handleLogoutNow}
            />
          )}

          {/* Session Monitor (hidden by default, can be shown in dev mode) */}
          {isAuthenticated && process.env.NODE_ENV === 'development' && (
            <SessionMonitor
              sessionStatus={sessionStatus}
              timeRemaining={timeLeft}
              onActivity={handleActivity}
              showIndicator={true}
            />
          )}

        <React.Suspense fallback={<LoadingScreen message="Loading page..." />}>
          <Routes>
            {/* Landing Page Routes - Public */}
            <Route path="/" element={<LandingLayout />}>
              <Route index element={<LandingHome />} />
              <Route path="simple" element={<SimpleLanding />} />
              <Route path="about" element={<About />} />
              <Route path="services" element={<ServicesPageLanding />} />
              <Route path="contact" element={<Contact />} />
              <Route path="blog" element={<Blog />} />
              <Route path="test" element={<TestPage />} />
            </Route>

            {/* App Routes - Authentication */}
            <Route
              path="/app/login"
              element={
                isAuthenticated ? (
                  <Navigate to={getRoleBasedRedirect(user?.roles?.[0] || null, user?.roles || [])} replace />
                ) : (
                  <LoginPage />
                )
              }
            />

            <Route
              path="/app/register"
              element={
                isAuthenticated ? (
                  <Navigate to={getRoleBasedRedirect(user?.roles?.[0] || null, user?.roles || [])} replace />
                ) : (
                  <RegisterPage />
                )
              }
            />

            {/* Legacy login redirect */}
            <Route
              path="/login"
              element={<Navigate to="/app/login" replace />}
            />

            {/* Debug route */}
            <Route
              path="/debug"
              element={<AuthDebug />}
            />

            {/* 🎯 UNIFIED REPORTING SYSTEM - Single route for all reporting */}
            <Route
              path="/app/reporting"
              element={
                <SimpleProtectedRoute>
                  <ReportingPage />
                </SimpleProtectedRoute>
              }
            />
            {/* Legacy routes redirect to unified reporting */}
            <Route path="/reporting" element={<Navigate to="/app/reporting" replace />} />
            <Route path="/test-reporting" element={<Navigate to="/app/reporting" replace />} />
            <Route path="/reports/*" element={<Navigate to="/app/reporting" replace />} />

            {/* App Dashboard - redirect from /app */}
            <Route
              path="/app"
              element={
                isAuthenticated ? (
                  <Navigate to="/app/dashboard" replace />
                ) : (
                  <Navigate to="/app/login" replace />
                )
              }
            />

            {/* Protected routes with layout */}
            <Route
              path="/app/dashboard"
              element={
                <SimpleProtectedRoute>
                  <MainLayout>
                    <EnhancedDashboard />
                  </MainLayout>
                </SimpleProtectedRoute>
              }
            />

            {/* Legacy dashboard redirect */}
            <Route
              path="/dashboard"
              element={<Navigate to="/app/dashboard" replace />}
            />

            <Route
              path="/app/patients"
              element={
                <SimpleProtectedRoute>
                  <MainLayout>
                    <PatientsPage />
                  </MainLayout>
                </SimpleProtectedRoute>
              }
            />

            <Route
              path="/app/worklist"
              element={
                <SimpleProtectedRoute>
                  <MainLayout>
                    <EnhancedWorklistPage />
                  </MainLayout>
                </SimpleProtectedRoute>
              }
            />

            <Route
              path="/app/followups"
              element={
                <SimpleProtectedRoute>
                  <MainLayout>
                    <FollowUpPage />
                  </MainLayout>
                </SimpleProtectedRoute>
              }
            />

            <Route
              path="/app/prior-auth"
              element={
                <SimpleProtectedRoute>
                  <MainLayout>
                    <PriorAuthPage />
                  </MainLayout>
                </SimpleProtectedRoute>
              }
            />
            <Route
              path="/app/setting"
              element={
                <SimpleProtectedRoute>
                  <MainLayout>
                    <SettingsPage />
                  </MainLayout>
                </SimpleProtectedRoute>
              }
            />

            <Route
              path="/app/billing"
              element={
                <SimpleProtectedRoute>
                  <MainLayout>
                    <BillingPage />
                  </MainLayout>
                </SimpleProtectedRoute>
              }
            />

            <Route
              path="/app/system-monitoring"
              element={
                <SimpleProtectedRoute>
                  <MainLayout>
                    <SystemDashboard />
                  </MainLayout>
                </SimpleProtectedRoute>
              }
            />

            <Route
              path="/app/users"
              element={
                <SimpleProtectedRoute>
                  <MainLayout>
                    <UsersPage />
                  </MainLayout>
                </SimpleProtectedRoute>
              }
            />

            <Route
              path="/app/users/:type"
              element={
                <SimpleProtectedRoute>
                  <MainLayout>
                    <UsersPage />
                  </MainLayout>
                </SimpleProtectedRoute>
              }
            />

            <Route
              path="/app/superadmin"
              element={
                <SuperAdminRoute>
                  <MainLayout>
                    <SuperAdminDashboard />
                  </MainLayout>
                </SuperAdminRoute>
              }
            />

            <Route
              path="/app/audit-logs"
              element={
                <SimpleProtectedRoute>
                  <MainLayout>
                    <AuditLogPage />
                  </MainLayout>
                </SimpleProtectedRoute>
              }
            />

            <Route
              path="/app/admin/anonymization"
              element={
                <SimpleProtectedRoute>
                  <MainLayout>
                    <AnonymizationPage />
                  </MainLayout>
                </SimpleProtectedRoute>
              }
            />

            <Route
              path="/app/admin/ip-whitelist"
              element={
                <SimpleProtectedRoute>
                  <MainLayout>
                    <IPWhitelistPage />
                  </MainLayout>
                </SimpleProtectedRoute>
              }
            />

            <Route
              path="/app/admin/data-retention"
              element={
                <SimpleProtectedRoute>
                  <MainLayout>
                    <DataRetentionPage />
                  </MainLayout>
                </SimpleProtectedRoute>
              }
            />

            <Route
              path="/app/settings"
              element={
                <SimpleProtectedRoute>
                  <MainLayout>
                    <SettingsPage />
                  </MainLayout>
                </SimpleProtectedRoute>
              }
            />

            <Route
              path="/app/profile"
              element={
                <SimpleProtectedRoute>
                  <MainLayout>
                    <ProfilePage />
                  </MainLayout>
                </SimpleProtectedRoute>
              }
            />

            <Route
              path="/app/viewer/:studyInstanceUID"
              element={
                <SimpleProtectedRoute>
                  <ViewerPage />
                </SimpleProtectedRoute>
              }
            />

            <Route
              path="/app/patient/studies/:studyInstanceUID"
              element={
                <SimpleProtectedRoute>
                  <ViewerPage />
                </SimpleProtectedRoute>
              }
            />

            {/* Orthanc Viewer - Direct access to Orthanc studies */}
            <Route
              path="/app/orthanc"
              element={
                <SimpleProtectedRoute>
                  <MainLayout>
                    <OrthancViewerPage />
                  </MainLayout>
                </SimpleProtectedRoute>
              }
            />

            {/* Connection Manager - Easy PACS setup */}
            <Route
              path="/app/connection-manager"
              element={
                <SimpleProtectedRoute>
                  <ConnectionManagerPage />
                </SimpleProtectedRoute>
              }
            />

            {/* AI Medical Image Analysis */}
           

            {/* Catch all - redirect to home */}
            <Route
              path="*"
              element={<Navigate to="/" replace />}
            />
          </Routes>
        </React.Suspense>
        </WebSocketProvider>
      </AppProvider>
    </WorkflowProvider>
  )
}

export default App