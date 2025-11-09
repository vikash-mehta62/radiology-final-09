import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Divider,
  useTheme,
} from '@mui/material'
import { Helmet } from 'react-helmet-async'
import axios from 'axios'

interface RegisterPayload {
  username: string
  email: string
  password: string
  firstName: string
  lastName: string
  hospitalName: string
}

const RegisterPage: React.FC = () => {
  const theme = useTheme()
  const navigate = useNavigate()

  const [form, setForm] = useState<RegisterPayload>({
    username: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    hospitalName: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleChange = (field: keyof RegisterPayload) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setForm(prev => ({ ...prev, [field]: event.target.value }))
    if (error) setError(null)
    if (success) setSuccess(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      const response = await axios.post('/auth/register', form, {
        headers: { 'Content-Type': 'application/json' }
      })

      const data = response.data
      if (data?.success) {
        setSuccess('Registration successful! Redirecting to login...')
        // Redirect after short delay
        setTimeout(() => navigate('/app/login'), 2000)
      } else {
        setError(data?.message || 'Registration failed')
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Helmet>
        <title>Register - Medical Imaging Viewer</title>
      </Helmet>

      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.palette.background.default,
          backgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          p: 3,
        }}
      >
        <Paper elevation={8} sx={{ p: 4, width: '100%', maxWidth: 500, borderRadius: 2 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography variant="h4" sx={{ fontWeight: 600, color: theme.palette.primary.main }}>
              Create Your Account
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sign up to start using ScanFlowAI
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField fullWidth label="Username" value={form.username} onChange={handleChange('username')} margin="normal" required />
            <TextField fullWidth label="Email" type="email" value={form.email} onChange={handleChange('email')} margin="normal" required />
            <TextField fullWidth label="Password" type="password" value={form.password} onChange={handleChange('password')} margin="normal" required />
            <TextField fullWidth label="First Name" value={form.firstName} onChange={handleChange('firstName')} margin="normal" required />
            <TextField fullWidth label="Last Name" value={form.lastName} onChange={handleChange('lastName')} margin="normal" required />
            <TextField fullWidth label="Hospital Name" value={form.hospitalName} onChange={handleChange('hospitalName')} margin="normal" required />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={isLoading}
              sx={{ mt: 3, mb: 2, py: 1.5 }}
            >
              {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Register'}
            </Button>

            <Button fullWidth variant="text" onClick={() => navigate('/app/login')}>
              Already have an account? Sign In
            </Button>
          </Box>

          <Divider sx={{ my: 3 }} />
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              By registering, you agree to our Terms of Service.
            </Typography>
          </Box>
        </Paper>
      </Box>
    </>
  )
}

export default RegisterPage
