import React from 'react'
import { Box, Typography, Paper, Button } from '@mui/material'
import { useAuth } from '../../hooks/useAuth'

export const AuthDebug: React.FC = () => {
  const auth = useAuth()
  
  const handleTestLogin = async () => {
    try {
      await auth.login({ username: 'admin', password: 'admin123' })
    } catch (error) {
      console.error('Test login failed:', error)
    }
  }
  
  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom>
        🔧 Authentication Debug
      </Typography>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Auth State:
        </Typography>
        <pre style={{ fontSize: '12px', overflow: 'auto' }}>
          {JSON.stringify({
            isAuthenticated: auth.isAuthenticated,
            isLoading: auth.isLoading,
            error: auth.error,
            user: auth.user ? {
              id: auth.user.id,
              username: auth.user.username,
              firstName: auth.user.firstName,
              lastName: auth.user.lastName,
              roles: auth.user.roles
            } : null,
            hasAccessToken: !!auth.accessToken
          }, null, 2)}
        </pre>
      </Paper>
      
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button variant="contained" onClick={handleTestLogin}>
          Test Login (admin/admin123)
        </Button>
        <Button variant="outlined" onClick={auth.logout}>
          Test Logout
        </Button>
        <Button variant="outlined" onClick={() => window.location.reload()}>
          Reload Page
        </Button>
      </Box>
    </Box>
  )
}