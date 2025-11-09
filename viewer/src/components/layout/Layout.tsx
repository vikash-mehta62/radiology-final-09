import React from 'react'
import { Box, useTheme } from '@mui/material'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { useAppSelector } from '../../store/hooks'
import { selectSidebarOpen, selectSidebarWidth } from '../../store/slices/uiSlice'

interface LayoutProps {
  children: React.ReactNode
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const theme = useTheme()
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  const sidebarWidth = useAppSelector(selectSidebarWidth)

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main content area */}
      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          marginLeft: sidebarOpen ? `${sidebarWidth}px` : '64px',
          transition: theme.transitions.create(['margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <Header />
        
        {/* Page content */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            overflow: 'auto',
            backgroundColor: theme.palette.background.default,
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  )
}