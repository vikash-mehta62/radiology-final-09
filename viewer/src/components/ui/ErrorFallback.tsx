import React from 'react'
import { 
  Box, 
  Typography, 
  Button, 
  Paper, 
  useTheme,
  Alert,
  AlertTitle 
} from '@mui/material'
import { ErrorOutline, Refresh } from '@mui/icons-material'

interface ErrorFallbackProps {
  error: Error
  resetErrorBoundary: () => void
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({ 
  error, 
  resetErrorBoundary 
}) => {
  const theme = useTheme()

  const handleReload = () => {
    window.location.reload()
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        backgroundColor: theme.palette.background.default,
        p: 3,
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          maxWidth: 600,
          width: '100%',
          textAlign: 'center',
        }}
      >
        <ErrorOutline 
          sx={{ 
            fontSize: 64, 
            color: theme.palette.error.main, 
            mb: 2 
          }} 
        />
        
        <Typography variant="h4" gutterBottom>
          Something went wrong
        </Typography>
        
        <Typography variant="body1" color="text.secondary" paragraph>
          We're sorry, but something unexpected happened. Please try refreshing the page or contact support if the problem persists.
        </Typography>

        {import.meta.env.DEV && (
          <Alert severity="error" sx={{ mt: 2, mb: 2, textAlign: 'left' }}>
            <AlertTitle>Error Details (Development Mode)</AlertTitle>
            <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
              {error.message}
            </Typography>
            {error.stack && (
              <Typography variant="caption" component="pre" sx={{ 
                whiteSpace: 'pre-wrap',
                mt: 1,
                fontSize: '0.75rem',
                opacity: 0.8
              }}>
                {error.stack}
              </Typography>
            )}
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 3 }}>
          <Button
            variant="contained"
            startIcon={<Refresh />}
            onClick={resetErrorBoundary}
          >
            Try Again
          </Button>
          
          <Button
            variant="outlined"
            onClick={handleReload}
          >
            Reload Page
          </Button>
        </Box>
      </Paper>
    </Box>
  )
}