import React, { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Box,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material'
import { Lock as LockIcon } from '@mui/icons-material'
import { QRCodeSVG } from 'qrcode.react'

export const MFASettings: React.FC = () => {
  const [mfaStatus, setMfaStatus] = useState<any>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [manualKey, setManualKey] = useState<string>('')
  const [verificationCode, setVerificationCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchMFAStatus()
  }, [])

  const fetchMFAStatus = async () => {
    try {
      const response = await fetch('/api/mfa/status', {
        credentials: 'include'
      })
      const data = await response.json()
      if (data.success) {
        setMfaStatus(data.data)
      }
    } catch (err: any) {
      console.error('Error fetching MFA status:', err)
    }
  }

  const setupMFA = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/mfa/totp/setup', {
        method: 'POST',
        credentials: 'include'
      })
      const data = await response.json()
      if (data.success) {
        setQrCode(data.data.qrCode)
        setManualKey(data.data.manualEntryKey)
      } else {
        setError(data.message || 'Failed to setup MFA')
      }
    } catch (err: any) {
      setError(err.message || 'Error setting up MFA')
    } finally {
      setLoading(false)
    }
  }

  const verifySetup = async () => {
    if (verificationCode.length !== 6) {
      setError('Please enter a 6-digit code')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/mfa/totp/verify-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: verificationCode })
      })
      const data = await response.json()
      if (data.success) {
        setSuccess('✅ MFA enabled successfully!')
        setQrCode(null)
        setVerificationCode('')
        fetchMFAStatus()
      } else {
        setError(data.message || 'Invalid verification code')
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  const disableMFA = async () => {
    const password = prompt('Enter your password to disable MFA:')
    if (!password) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/mfa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password })
      })
      const data = await response.json()
      if (data.success) {
        setSuccess('MFA disabled successfully')
        fetchMFAStatus()
      } else {
        setError(data.message || 'Failed to disable MFA')
      }
    } catch (err: any) {
      setError(err.message || 'Error disabling MFA')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <LockIcon color="primary" />
          <Typography variant="h6">Multi-Factor Authentication</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" paragraph>
          Add an extra layer of security to your account with two-factor authentication
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {!mfaStatus?.enabled && !qrCode && (
          <Button
            variant="contained"
            onClick={setupMFA}
            disabled={loading}
            fullWidth
          >
            {loading ? <CircularProgress size={24} /> : 'Enable MFA'}
          </Button>
        )}

        {qrCode && (
          <Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              Scan this QR code with Google Authenticator, Authy, or any TOTP app
            </Alert>
            <Box display="flex" justifyContent="center" my={3}>
              <QRCodeSVG value={qrCode} size={200} />
            </Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Can't scan? Enter this key manually:
            </Typography>
            <TextField
              fullWidth
              value={manualKey}
              InputProps={{ readOnly: true }}
              sx={{ mb: 3 }}
              size="small"
            />
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" gutterBottom>
              Enter the 6-digit code from your app:
            </Typography>
            <TextField
              label="Verification Code"
              value={verificationCode}
              onChange={(e) =>
                setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
              fullWidth
              sx={{ mb: 2 }}
              placeholder="000000"
              inputProps={{ maxLength: 6 }}
            />
            <Button
              variant="contained"
              onClick={verifySetup}
              disabled={loading || verificationCode.length !== 6}
              fullWidth
            >
              {loading ? <CircularProgress size={24} /> : 'Verify & Enable'}
            </Button>
          </Box>
        )}

        {mfaStatus?.enabled && (
          <Box>
            <Alert severity="success" sx={{ mb: 2 }}>
              ✅ MFA is enabled and active
            </Alert>
            <Button
              variant="outlined"
              color="error"
              onClick={disableMFA}
              disabled={loading}
              fullWidth
            >
              Disable MFA
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
