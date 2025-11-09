import React from 'react'
import { Box, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'

const ProfilePage: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>Profile - Medical Imaging Viewer</title>
      </Helmet>
      
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Profile
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Profile management will be implemented in future iterations.
        </Typography>
      </Box>
    </>
  )
}

export default ProfilePage