import React, { useState, useEffect } from 'react'
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Avatar,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  Snackbar,
  SelectChangeEvent,
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Block as BlockIcon,
  CheckCircle as ActiveIcon,
  LockReset as ResetPasswordIcon,
} from '@mui/icons-material'
import ApiService from '../../services/ApiService'

interface User {
  _id: string
  username: string
  email: string
  firstName: string
  lastName: string
  roles: string[]
  isActive: boolean
  lastLogin?: string
}

interface UserFormData {
  username: string
  email: string
  firstName: string
  lastName: string
  roles: string[]
  password?: string
}

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [selectedTab, setSelectedTab] = useState(0)
  const [openDialog, setOpenDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // Form state
  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    roles: [],
    password: '',
  })

  // Load users from API
  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    filterUsers()
  }, [selectedTab, users])

  const loadUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await ApiService.getUsers()
      
      if (response.success) {
        setUsers(response.data || [])
        setFilteredUsers(response.data || [])
      } else {
        throw new Error(response.message || 'Failed to load users')
      }
    } catch (err: any) {
      console.error('Error loading users:', err)
      setError(err.message || 'Failed to load users')
      setUsers([])
      setFilteredUsers([])
    } finally {
      setLoading(false)
    }
  }

  const filterUsers = () => {
    let filtered = users
    switch (selectedTab) {
      case 1: // Providers
        filtered = users.filter(u => 
          u.roles.includes('provider') || 
          u.roles.includes('radiologist') ||
          u.roles.includes('doctor')
        )
        break
      case 2: // Staff
        filtered = users.filter(u => 
          u.roles.includes('staff') || 
          u.roles.includes('nurse') ||
          u.roles.includes('receptionist')
        )
        break
      case 3: // Technicians
        filtered = users.filter(u => u.roles.includes('technician'))
        break
      case 4: // Admins
        filtered = users.filter(u => 
          u.roles.includes('admin') || 
          u.roles.includes('system:admin')
        )
        break
      default: // All
        filtered = users
    }
    setFilteredUsers(filtered)
  }

  const getRoleColor = (role: string) => {
    const colors: Record<string, any> = {
      radiologist: 'primary',
      provider: 'primary',
      doctor: 'primary',
      technician: 'secondary',
      staff: 'info',
      nurse: 'info',
      receptionist: 'info',
      admin: 'error',
      'system:admin': 'error',
    }
    return colors[role] || 'default'
  }

  const handleAddUser = () => {
    setEditingUser(null)
    setFormData({
      username: '',
      email: '',
      firstName: '',
      lastName: '',
      roles: [],
      password: '',
    })
    setOpenDialog(true)
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setFormData({
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
    })
    setOpenDialog(true)
  }

  const handleCloseDialog = () => {
    setOpenDialog(false)
    setEditingUser(null)
    setFormData({
      username: '',
      email: '',
      firstName: '',
      lastName: '',
      roles: [],
      password: '',
    })
  }

  const handleFormChange = (field: keyof UserFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleRolesChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value
    setFormData(prev => ({
      ...prev,
      roles: typeof value === 'string' ? value.split(',') : value
    }))
  }

  const handleSaveUser = async () => {
    try {
      setError(null)
      
      // Validation
      if (!formData.username || !formData.email || !formData.firstName || !formData.lastName) {
        setError('Please fill in all required fields')
        return
      }
      
      if (!editingUser && !formData.password) {
        setError('Password is required for new users')
        return
      }
      
      if (formData.roles.length === 0) {
        setError('Please select at least one role')
        return
      }
      
      const userData = {
        username: formData.username,
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        roles: formData.roles,
        ...(formData.password && { password: formData.password })
      }
      
      let response
      if (editingUser) {
        response = await ApiService.updateUser(editingUser._id, userData)
      } else {
        response = await ApiService.createUser(userData)
      }
      
      if (response.success) {
        setSuccess(editingUser ? 'User updated successfully' : 'User created successfully')
        handleCloseDialog()
        loadUsers()
      } else {
        throw new Error(response.message || 'Failed to save user')
      }
    } catch (err: any) {
      console.error('Error saving user:', err)
      setError(err.message || 'Failed to save user')
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) {
      return
    }
    
    try {
      const response = await ApiService.deleteUser(userId)
      
      if (response.success) {
        setSuccess('User deleted successfully')
        loadUsers()
      } else {
        throw new Error(response.message || 'Failed to delete user')
      }
    } catch (err: any) {
      console.error('Error deleting user:', err)
      setError(err.message || 'Failed to delete user')
    }
  }

  const handleToggleStatus = async (userId: string) => {
    try {
      const response = await ApiService.toggleUserStatus(userId)
      
      if (response.success) {
        setSuccess('User status updated successfully')
        loadUsers()
      } else {
        throw new Error(response.message || 'Failed to update user status')
      }
    } catch (err: any) {
      console.error('Error toggling user status:', err)
      setError(err.message || 'Failed to update user status')
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          User Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddUser}
        >
          Add User
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 3 }}>
        <Tabs value={selectedTab} onChange={(_, v) => setSelectedTab(v)}>
          <Tab label={`All Users (${users.length})`} />
          <Tab label="Providers" />
          <Tab label="Staff" />
          <Tab label="Technicians" />
          <Tab label="Administrators" />
        </Tabs>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Roles</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last Login</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                    No users found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user._id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                        {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight="bold">
                          {user.firstName} {user.lastName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          @{user.username}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {user.roles.map((role) => (
                        <Chip
                          key={role}
                          label={role}
                          size="small"
                          color={getRoleColor(role)}
                        />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={user.isActive ? <ActiveIcon /> : <BlockIcon />}
                      label={user.isActive ? 'Active' : 'Inactive'}
                      color={user.isActive ? 'success' : 'default'}
                      size="small"
                      onClick={() => handleToggleStatus(user._id)}
                      sx={{ cursor: 'pointer' }}
                    />
                  </TableCell>
                  <TableCell>
                    {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleEditUser(user)} title="Edit User">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton 
                      size="small" 
                      color="error" 
                      onClick={() => handleDeleteUser(user._id)}
                      title="Delete User"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit User Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingUser ? 'Edit User' : 'Add New User'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="First Name"
              fullWidth
              required
              value={formData.firstName}
              onChange={(e) => handleFormChange('firstName', e.target.value)}
            />
            <TextField
              label="Last Name"
              fullWidth
              required
              value={formData.lastName}
              onChange={(e) => handleFormChange('lastName', e.target.value)}
            />
            <TextField
              label="Username"
              fullWidth
              required
              value={formData.username}
              onChange={(e) => handleFormChange('username', e.target.value)}
              disabled={!!editingUser}
              helperText={editingUser ? "Username cannot be changed" : ""}
            />
            <TextField
              label="Email"
              type="email"
              fullWidth
              required
              value={formData.email}
              onChange={(e) => handleFormChange('email', e.target.value)}
            />
            <FormControl fullWidth required>
              <InputLabel>Roles</InputLabel>
              <Select
                multiple
                value={formData.roles}
                onChange={handleRolesChange}
                label="Roles"
              >
                <MenuItem value="radiologist">Radiologist</MenuItem>
                <MenuItem value="provider">Provider</MenuItem>
                <MenuItem value="doctor">Doctor</MenuItem>
                <MenuItem value="technician">Technician</MenuItem>
                <MenuItem value="staff">Staff</MenuItem>
                <MenuItem value="nurse">Nurse</MenuItem>
                <MenuItem value="receptionist">Receptionist</MenuItem>
                <MenuItem value="admin">Administrator</MenuItem>
              </Select>
            </FormControl>
            {!editingUser && (
              <TextField
                label="Password"
                type="password"
                fullWidth
                required
                value={formData.password}
                onChange={(e) => handleFormChange('password', e.target.value)}
                helperText="Minimum 8 characters"
              />
            )}
            {editingUser && (
              <Alert severity="info">
                To reset password, use the "Reset Password" button after saving
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSaveUser} variant="contained">
            {editingUser ? 'Save Changes' : 'Add User'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Snackbar */}
      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
        message={success}
      />
    </Box>
  )
}

export default UsersPage
