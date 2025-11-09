import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Typography,
  useTheme,
} from '@mui/material'
import {
  Dashboard,
  List as ListIcon,
  Visibility,
  Settings,
  Person,
  Analytics,
  People,
  CalendarToday,
  Security,
  AdminPanelSettings,
  VpnLock,
  Storage,
} from '@mui/icons-material'
import { useAppSelector } from '../../store/hooks'
import { selectSidebarOpen, selectSidebarWidth } from '../../store/slices/uiSlice'
import { useAuth } from '../../hooks/useAuth'

interface NavigationItem {
  id: string
  label: string
  icon: React.ReactNode
  path: string
  permission?: string
  role?: string
}

const navigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <Dashboard />,
    path: '/app/dashboard',
  },
  {
    id: 'worklist',
    label: 'Worklist',
    icon: <ListIcon />,
    path: '/app/worklist',
    permission: 'studies:read',
  },
  {
    id: 'patients',
    label: 'Patients',
    icon: <People />,
    path: '/app/patients',
    permission: 'studies:read',
  },
  {
    id: 'followups',
    label: 'Follow-ups',
    icon: <CalendarToday />,
    path: '/app/followups',
    permission: 'studies',
  },
  {
    id: 'viewer',
    label: 'Viewer',
    icon: <Visibility />,
    path: '/app/viewer',
    permission: 'studies:read',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: <Analytics />,
    path: '/app/analytics',
    permission: 'analytics:read',
  },
  {
    id: 'audit-logs',
    label: 'Audit Logs',
    icon: <Security />,
    path: '/app/audit-logs',
    permission: 'audit:read',
  },
]

const adminItems: NavigationItem[] = [
  {
    id: 'anonymization',
    label: 'Anonymization',
    icon: <AdminPanelSettings />,
    path: '/app/admin/anonymization',
    permission: 'admin:manage',
  },
  {
    id: 'ip-whitelist',
    label: 'IP Whitelist',
    icon: <VpnLock />,
    path: '/app/admin/ip-whitelist',
    permission: 'admin:manage',
  },
  {
    id: 'data-retention',
    label: 'Data Retention',
    icon: <Storage />,
    path: '/app/admin/data-retention',
    permission: 'admin:manage',
  },
]

const userItems: NavigationItem[] = [
  {
    id: 'profile',
    label: 'Profile',
    icon: <Person />,
    path: '/app/profile',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <Settings />,
    path: '/app/settings',
  },
]

export const Sidebar: React.FC = () => {
  const theme = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  const sidebarWidth = useAppSelector(selectSidebarWidth)
  const { hasPermission, hasRole } = useAuth()

  const handleNavigation = (path: string) => {
    navigate(path)
  }

  const isItemVisible = (item: NavigationItem): boolean => {
    if (item.permission && !hasPermission(item.permission)) {
      return false
    }
    if (item.role && !hasRole(item.role)) {
      return false
    }
    return true
  }

  const isItemActive = (path: string): boolean => {
    if (path === '/viewer') {
      return location.pathname.startsWith('/viewer')
    }
    return location.pathname === path
  }

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: sidebarOpen ? sidebarWidth : 64,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: sidebarOpen ? sidebarWidth : 64,
          boxSizing: 'border-box',
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
          overflowX: 'hidden',
          backgroundColor: theme.palette.background.paper,
          borderRight: `1px solid ${theme.palette.divider}`,
        },
      }}
    >
      {/* Logo/Brand */}
      <Box
        sx={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarOpen ? 'flex-start' : 'center',
          px: sidebarOpen ? 2 : 1,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        {sidebarOpen ? (
          <Typography
            variant="h6"
            noWrap
            sx={{
              fontWeight: 600,
              color: theme.palette.primary.main,
            }}
          >
            ScanFlowAI
          </Typography>
        ) : (
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1,
              backgroundColor: theme.palette.primary.main,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '1.2rem',
            }}
          >
            M
          </Box>
        )}
      </Box>

      {/* Main Navigation */}
      <List sx={{ px: 1, py: 1 }}>
        {navigationItems
          .filter(isItemVisible)
          .map((item) => (
            <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => handleNavigation(item.path)}
                selected={isItemActive(item.path)}
                sx={{
                  minHeight: 48,
                  justifyContent: sidebarOpen ? 'initial' : 'center',
                  px: 2.5,
                  borderRadius: 1,
                  '&.Mui-selected': {
                    backgroundColor: theme.palette.primary.main,
                    color: theme.palette.primary.contrastText,
                    '&:hover': {
                      backgroundColor: theme.palette.primary.dark,
                    },
                    '& .MuiListItemIcon-root': {
                      color: theme.palette.primary.contrastText,
                    },
                  },
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: sidebarOpen ? 3 : 'auto',
                    justifyContent: 'center',
                    color: isItemActive(item.path)
                      ? theme.palette.primary.contrastText
                      : theme.palette.text.secondary,
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  sx={{
                    opacity: sidebarOpen ? 1 : 0,
                    '& .MuiListItemText-primary': {
                      fontSize: '0.875rem',
                      fontWeight: isItemActive(item.path) ? 600 : 400,
                    },
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
      </List>

      {/* Spacer */}
      <Box sx={{ flexGrow: 1 }} />

      {/* Admin Section */}
      {adminItems.filter(isItemVisible).length > 0 && (
        <Box>
          <Divider sx={{ mx: 1 }} />
          {sidebarOpen && (
            <Typography
              variant="caption"
              sx={{
                px: 3,
                py: 1,
                display: 'block',
                color: 'text.secondary',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Admin
            </Typography>
          )}
          <List sx={{ px: 1, py: 1 }}>
            {adminItems
              .filter(isItemVisible)
              .map((item) => (
                <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    onClick={() => handleNavigation(item.path)}
                    selected={isItemActive(item.path)}
                    sx={{
                      minHeight: 48,
                      justifyContent: sidebarOpen ? 'initial' : 'center',
                      px: 2.5,
                      borderRadius: 1,
                      '&.Mui-selected': {
                        backgroundColor: theme.palette.primary.main,
                        color: theme.palette.primary.contrastText,
                        '&:hover': {
                          backgroundColor: theme.palette.primary.dark,
                        },
                        '& .MuiListItemIcon-root': {
                          color: theme.palette.primary.contrastText,
                        },
                      },
                      '&:hover': {
                        backgroundColor: theme.palette.action.hover,
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 0,
                        mr: sidebarOpen ? 3 : 'auto',
                        justifyContent: 'center',
                        color: isItemActive(item.path)
                          ? theme.palette.primary.contrastText
                          : theme.palette.text.secondary,
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      sx={{
                        opacity: sidebarOpen ? 1 : 0,
                        '& .MuiListItemText-primary': {
                          fontSize: '0.875rem',
                          fontWeight: isItemActive(item.path) ? 600 : 400,
                        },
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
          </List>
        </Box>
      )}

      {/* User Section */}
      <Box>
        <Divider sx={{ mx: 1 }} />
        <List sx={{ px: 1, py: 1 }}>
          {userItems.map((item) => (
            <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => handleNavigation(item.path)}
                selected={isItemActive(item.path)}
                sx={{
                  minHeight: 48,
                  justifyContent: sidebarOpen ? 'initial' : 'center',
                  px: 2.5,
                  borderRadius: 1,
                  '&.Mui-selected': {
                    backgroundColor: theme.palette.primary.main,
                    color: theme.palette.primary.contrastText,
                    '&:hover': {
                      backgroundColor: theme.palette.primary.dark,
                    },
                    '& .MuiListItemIcon-root': {
                      color: theme.palette.primary.contrastText,
                    },
                  },
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: sidebarOpen ? 3 : 'auto',
                    justifyContent: 'center',
                    color: isItemActive(item.path)
                      ? theme.palette.primary.contrastText
                      : theme.palette.text.secondary,
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  sx={{
                    opacity: sidebarOpen ? 1 : 0,
                    '& .MuiListItemText-primary': {
                      fontSize: '0.875rem',
                      fontWeight: isItemActive(item.path) ? 600 : 400,
                    },
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
    </Drawer>
  )
}