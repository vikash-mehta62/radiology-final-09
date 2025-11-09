import React from 'react'
import { Box, CircularProgress, Typography, useTheme } from '@mui/material'

interface LoadingScreenProps {
  message?: string
  size?: number
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message = 'Loading...', 
  size = 60 
}) => {
  const theme = useTheme()

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        backgroundColor: theme.palette.background.default,
        color: theme.palette.text.primary,
      }}
    >
      <CircularProgress 
        size={size} 
        sx={{ 
          color: theme.palette.primary.main,
          mb: 2 
        }} 
      />
      <Typography 
        variant="body1" 
        sx={{ 
          color: theme.palette.text.secondary,
          textAlign: 'center'
        }}
      >
        {message}
      </Typography>
    </Box>
  )
}