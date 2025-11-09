import React from 'react'
import { Box, Typography, Button, useTheme } from '@mui/material'
import { Home, ArrowBack } from '@mui/icons-material'
import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'

const NotFoundPage: React.FC = () => {
  const theme = useTheme()
  const navigate = useNavigate()

  return (
    <>
      <Helmet>
        <title>Page Not Found - Medical Imaging Viewer</title>
      </Helmet>
      
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          textAlign: 'center',
          p: 3,
        }}
      >
        <Typography
          variant="h1"
          sx={{
            fontSize: '6rem',
            fontWeight: 'bold',
            color: theme.palette.primary.main,
            mb: 2,
          }}
        >
          404
        </Typography>
        
        <Typography variant="h4" gutterBottom>
          Page Not Found
        </Typography>
        
        <Typography variant="body1" color="text.secondary" paragraph>
          The page you're looking for doesn't exist or has been moved.
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
          <Button
            variant="contained"
            startIcon={<Home />}
            onClick={() => navigate('/app/dashboard')}
          >
            Go Home
          </Button>
          
          <Button
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={() => navigate(-1)}
          >
            Go Back
          </Button>
        </Box>
      </Box>
    </>
  )
}

export default NotFoundPage