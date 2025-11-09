import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  Chip,
  Collapse,
} from '@mui/material'
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Computer as ComputerIcon,
  Folder as FolderIcon,
  Assessment as AssessmentIcon,
  Assignment as AssignmentIcon,
  Settings as SettingsIcon,
  Person as PersonIcon,
  ExitToApp as LogoutIcon,
  ExpandLess,
  ExpandMore,
  Group as GroupIcon,
  AdminPanelSettings as AdminIcon,
  MedicalServices as MedicalIcon,
  LocalHospital as HospitalIcon,
  Science as ScienceIcon,
  AttachMoney as BillingIcon,
  Cable as ConnectionIcon,
  Psychology as AIIcon,
} from '@mui/icons-material'
import { useAppDispatch } from '../../store/hooks'
import { logout } from '../../store/slices/authSlice'
import { Calendar1Icon } from 'lucide-react'
import { NotificationBell } from '../notifications/NotificationBell'
import { useAuth } from '../../hooks/useAuth'

const drawerWidth = 280

interface MainLayoutProps {
  children: React.ReactNode
}

interface SubMenuItem {
  text: string
  icon: React.ReactElement
  path: string
}

interface MenuItem {
  text: string
  icon: React.ReactElement
  path?: string
  requiredRoles?: string[]
  requiredPermissions?: string[]
  submenu?: SubMenuItem[]
}

interface MenuSection {
  title: string
  items: MenuItem[]
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useAppDispatch()
  const { user, hasRole, hasAnyRole, hasPermission } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null)
  const [usersMenuOpen, setUsersMenuOpen] = useState(false)

  // Get current user info from auth
  const currentUser = {
    name: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username : 'User',
    role: user?.roles?.[0] || 'User',
    email: user?.email || '',
    avatar: '/avatar.jpg'
  }

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
  }

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget)
  }

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null)
  }

  const handleLogout = async () => {
    try {
      await dispatch(logout()).unwrap()
      navigate('/login', { replace: true })
    } catch (error) {
      console.error('Logout failed:', error)
      // Force navigation even if logout fails
      navigate('/login', { replace: true })
    }
  }

  const isActive = (path: string) => {
    return location.pathname === path
  }

  // Check if user can access menu item based on roles/permissions
  const canAccessMenuItem = (item: MenuItem): boolean => {
    // If no requiredRoles or requiredPermissions specified, allow access
    if (!item.requiredRoles && !item.requiredPermissions) {
      return true
    }

    // Check roles
    if (item.requiredRoles && hasAnyRole(item.requiredRoles)) {
      return true
    }

    // Check permissions
    if (item.requiredPermissions && item.requiredPermissions.some((p: string) => hasPermission(p))) {
      return true
    }

    return false
  }

  const menuItems: MenuSection[] = [
    {
      title: 'Main',
      items: [
        { text: 'Dashboard', icon: <DashboardIcon />, path: '/app/dashboard' },
        { text: 'Worklist', icon: <AssignmentIcon />, path: '/app/worklist' },
        { text: 'Patients', icon: <PeopleIcon />, path: '/app/patients' },
        { text: 'Follow Ups', icon: <Calendar1Icon />, path: '/app/followups' },
        { text: 'Studies', icon: <FolderIcon />, path: '/app/orthanc' },
        // { text: 'AI Analysis', icon: <AIIcon />, path: '/app/ai-analysis' },
        { text: 'Prior Auth', icon: <MedicalIcon />, path: '/app/prior-auth' },
        { text: 'Billing', icon: <BillingIcon />, path: '/app/billing' },
      ]
    },
    {
      title: 'System',
      items: [
        { 
          text: 'System Monitoring', 
          icon: <ComputerIcon />, 
          path: '/app/system-monitoring',
          requiredRoles: ['admin', 'system:admin']
        },
        { 
          text: 'Device to PACS Setup', 
          icon: <ConnectionIcon />, 
          path: '/app/connection-manager',
          requiredRoles: ['admin', 'system:admin', 'technician']
        },
        { text: 'Reports', icon: <AssessmentIcon />, path: '/app/reports' },
      ]
    },
    {
      title: 'Administration',
      items: [
        { 
          text: 'User Management', 
          icon: <GroupIcon />,
          requiredRoles: ['admin', 'system:admin'],
          requiredPermissions: ['users:read', 'users:write'],
          submenu: [
            { text: 'All Users', icon: <PeopleIcon />, path: '/app/users' },
            { text: 'Providers', icon: <MedicalIcon />, path: '/app/users/providers' },
            { text: 'Staff', icon: <HospitalIcon />, path: '/app/users/staff' },
            { text: 'Technicians', icon: <ScienceIcon />, path: '/app/users/technicians' },
            { text: 'Administrators', icon: <AdminIcon />, path: '/app/users/admins' },
          ]
        },
        { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
      ]
    },
  ]

  // Filter menu items based on user permissions
  const filteredMenuItems = menuItems.map(section => ({
    ...section,
    items: section.items.filter(item => canAccessMenuItem(item))
  })).filter(section => section.items.length > 0) // Remove empty sections

  const drawer = (
    <Box>
      {/* Logo/Header */}
      <Toolbar sx={{ bgcolor: 'primary.main', color: 'white' }}>
        <MedicalIcon sx={{ mr: 1 }} />
        <Typography variant="h6" noWrap component="div">
          Radiology System
        </Typography>
      </Toolbar>
      <Divider />

      {/* User Info */}
      <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Avatar sx={{ width: 40, height: 40, mr: 1.5, bgcolor: 'primary.main' }}>
            {currentUser.name.charAt(0)}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" noWrap>
              {currentUser.name}
            </Typography>
            <Chip 
              label={currentUser.role} 
              size="small" 
              color="primary" 
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          </Box>
        </Box>
      </Box>
      <Divider />

      {/* Navigation Menu */}
      <List sx={{ px: 1 }}>
        {filteredMenuItems.map((section, sectionIndex) => (
          <Box key={sectionIndex}>
            <ListItem sx={{ pt: 2, pb: 0.5 }}>
              <Typography variant="caption" color="text.secondary" fontWeight="bold">
                {section.title}
              </Typography>
            </ListItem>
            {section.items.map((item, itemIndex) => (
              <Box key={itemIndex}>
                {item.submenu ? (
                  <>
                    <ListItemButton
                      onClick={() => setUsersMenuOpen(!usersMenuOpen)}
                      sx={{
                        borderRadius: 1,
                        mb: 0.5,
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText primary={item.text} />
                      {usersMenuOpen ? <ExpandLess /> : <ExpandMore />}
                    </ListItemButton>
                    <Collapse in={usersMenuOpen} timeout="auto" unmountOnExit>
                      <List component="div" disablePadding>
                        {item.submenu.map((subItem, subIndex) => (
                          <ListItemButton
                            key={subIndex}
                            onClick={() => navigate(subItem.path)}
                            selected={isActive(subItem.path)}
                            sx={{
                              pl: 4,
                              borderRadius: 1,
                              mb: 0.5,
                              ml: 2,
                              '&.Mui-selected': {
                                bgcolor: 'primary.light',
                                color: 'primary.contrastText',
                                '&:hover': {
                                  bgcolor: 'primary.main',
                                },
                              },
                            }}
                          >
                            <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}>
                              {subItem.icon}
                            </ListItemIcon>
                            <ListItemText 
                              primary={subItem.text}
                              primaryTypographyProps={{ variant: 'body2' }}
                            />
                          </ListItemButton>
                        ))}
                      </List>
                    </Collapse>
                  </>
                ) : (
                  <ListItemButton
                    onClick={() => navigate(item.path)}
                    selected={isActive(item.path)}
                    sx={{
                      borderRadius: 1,
                      mb: 0.5,
                      '&.Mui-selected': {
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        '&:hover': {
                          bgcolor: 'primary.dark',
                        },
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40, color: isActive(item.path) ? 'inherit' : 'action.active' }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText primary={item.text} />
                  </ListItemButton>
                )}
              </Box>
            ))}
            {sectionIndex < filteredMenuItems.length - 1 && <Divider sx={{ my: 1 }} />}
          </Box>
        ))}
      </List>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {location.pathname === '/app/dashboard' && 'Dashboard'}
            {location.pathname === '/app/worklist' && 'Study Worklist'}
            {location.pathname === '/app/patients' && 'Patients'}
            {location.pathname === '/app/followups' && 'Follow Ups'}
            {location.pathname === '/app/system-monitoring' && 'System Monitoring'}
            {location.pathname === '/app/orthanc' && 'Studies'}
            {location.pathname === '/app/billing' && 'Billing & Superbills'}
            {location.pathname.startsWith('/app/users') && 'User Management'}
            {location.pathname === '/app/settings' && 'Settings'}
          </Typography>
          <NotificationBell />
          <IconButton
            onClick={handleUserMenuOpen}
            size="small"
            sx={{ ml: 2 }}
          >
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
              {currentUser.name.charAt(0)}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={userMenuAnchor}
            open={Boolean(userMenuAnchor)}
            onClose={handleUserMenuClose}
          >
            <MenuItem onClick={() => { navigate('/profile'); handleUserMenuClose(); }}>
              <ListItemIcon>
                <PersonIcon fontSize="small" />
              </ListItemIcon>
              Profile
            </MenuItem>
            <MenuItem onClick={() => { navigate('/settings'); handleUserMenuClose(); }}>
              <ListItemIcon>
                <SettingsIcon fontSize="small" />
              </ListItemIcon>
              Settings
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Drawer */}
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better mobile performance
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        {/* Desktop drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: 8,
        }}
      >
        {children}
      </Box>
    </Box>
  )
}

export default MainLayout
