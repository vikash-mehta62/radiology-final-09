import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Typography,
  Box,
  CircularProgress,
  SelectChangeEvent,
  Chip
} from '@mui/material'
import { 
  VerifiedUser as VerifiedUserIcon,
  Lock as LockIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material'
import { signatureService } from '../../services/signatureService'

export interface SignatureModalProps {
  open: boolean
  reportId: string
  onClose: () => void
  onSigned: (signature: any) => void
}

type SignatureMeaning = 'author' | 'reviewer' | 'approver'

interface SignaturePermissions {
  allowedSignatureMeanings: SignatureMeaning[]
  canSignAsAuthor: boolean
  canSignAsReviewer: boolean
  canSignAsApprover: boolean
}

export const SignatureModal: React.FC<SignatureModalProps> = ({
  open,
  reportId,
  onClose,
  onSigned
}) => {
  const [meaning, setMeaning] = useState<SignatureMeaning>('author')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<SignaturePermissions | null>(null)
  const [loadingPermissions, setLoadingPermissions] = useState(true)

  // Load user's signature permissions on mount
  useEffect(() => {
    const loadPermissions = async () => {
      if (!open) return
      
      setLoadingPermissions(true)
      try {
        const response = await signatureService.getSignaturePermissions()
        if (response.success && response.data) {
          setPermissions(response.data)
          
          // Set default meaning to first allowed option
          if (response.data.allowedSignatureMeanings && response.data.allowedSignatureMeanings.length > 0) {
            setMeaning(response.data.allowedSignatureMeanings[0])
          }
        } else {
          setError(response.message || 'Failed to load signature permissions')
        }
      } catch (err: any) {
        console.error('Failed to load signature permissions:', err)
        setError('Failed to load signature permissions. Please try again.')
      } finally {
        setLoadingPermissions(false)
      }
    }

    loadPermissions()
  }, [open])

  const handleMeaningChange = (event: SelectChangeEvent<SignatureMeaning>) => {
    setMeaning(event.target.value as SignatureMeaning)
  }

  const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value)
    if (error) setError(null)
  }

  const handleSign = async () => {
    if (!password) {
      setError('Password is required')
      return
    }

    // Check if user has permission for selected meaning
    if (permissions && permissions.allowedSignatureMeanings && !permissions.allowedSignatureMeanings.includes(meaning)) {
      setError(`You do not have permission to sign as ${meaning}`)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await signatureService.signReport(reportId, meaning, password)
      
      // Check if the result indicates failure
      if (!result.success) {
        setError(result.message || result.error || 'Failed to sign report. Please try again.')
        return
      }
      
      onSigned(result)
      handleClose()
    } catch (err: any) {
      console.error('Sign report error:', err)
      setError(err.message || 'Failed to sign report. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const isMeaningAllowed = (meaningToCheck: SignatureMeaning): boolean => {
    return permissions?.allowedSignatureMeanings?.includes(meaningToCheck) ?? false
  }

  const handleClose = () => {
    if (!loading) {
      setPassword('')
      setError(null)
      onClose()
    }
  }

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && password && !loading) {
      handleSign()
    }
  }

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={loading}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <VerifiedUserIcon color="primary" />
          <Typography variant="h6">Sign Report</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            By signing this report, you certify that the information is accurate and complete.
            This signature is legally binding and complies with FDA 21 CFR Part 11.
          </Typography>

          {loadingPermissions ? (
            <Box display="flex" justifyContent="center" alignItems="center" py={4}>
              <CircularProgress size={40} />
              <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                Loading signature permissions...
              </Typography>
            </Box>
          ) : permissions && permissions.allowedSignatureMeanings && permissions.allowedSignatureMeanings.length === 0 ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              <Typography variant="body2">
                You do not have permission to sign reports. Please contact your administrator.
              </Typography>
            </Alert>
          ) : (
            <>
              <FormControl fullWidth margin="normal" disabled={loading}>
                <InputLabel id="signature-meaning-label">Signature Meaning</InputLabel>
                <Select
                  labelId="signature-meaning-label"
                  id="signature-meaning"
                  value={meaning}
                  label="Signature Meaning"
                  onChange={handleMeaningChange}
                >
                  <MenuItem 
                    value="author" 
                    disabled={!isMeaningAllowed('author')}
                  >
                    <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
                      <Box>
                        <Typography variant="body1">Author</Typography>
                        <Typography variant="caption" color="text.secondary">
                          I am the original author of this report
                        </Typography>
                      </Box>
                      {isMeaningAllowed('author') ? (
                        <CheckCircleIcon color="success" fontSize="small" />
                      ) : (
                        <LockIcon color="disabled" fontSize="small" />
                      )}
                    </Box>
                  </MenuItem>
                  <MenuItem 
                    value="reviewer" 
                    disabled={!isMeaningAllowed('reviewer')}
                  >
                    <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
                      <Box>
                        <Typography variant="body1">Reviewer</Typography>
                        <Typography variant="caption" color="text.secondary">
                          I have reviewed and verified this report
                        </Typography>
                      </Box>
                      {isMeaningAllowed('reviewer') ? (
                        <CheckCircleIcon color="success" fontSize="small" />
                      ) : (
                        <LockIcon color="disabled" fontSize="small" />
                      )}
                    </Box>
                  </MenuItem>
                  <MenuItem 
                    value="approver" 
                    disabled={!isMeaningAllowed('approver')}
                  >
                    <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
                      <Box>
                        <Typography variant="body1">Approver</Typography>
                        <Typography variant="caption" color="text.secondary">
                          I approve this report for final release
                        </Typography>
                      </Box>
                      {isMeaningAllowed('approver') ? (
                        <CheckCircleIcon color="success" fontSize="small" />
                      ) : (
                        <LockIcon color="disabled" fontSize="small" />
                      )}
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>

              {permissions && (
                <Box sx={{ mt: 1, mb: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Your signature permissions:
                  </Typography>
                  <Box display="flex" gap={1} mt={0.5}>
                    {permissions.allowedSignatureMeanings?.map((perm) => (
                      <Chip
                        key={perm}
                        label={perm.charAt(0).toUpperCase() + perm.slice(1)}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </>
          )}

          <TextField
            fullWidth
            type="password"
            label="Confirm Password"
            value={password}
            onChange={handlePasswordChange}
            onKeyPress={handleKeyPress}
            margin="normal"
            disabled={loading}
            error={!!error}
            helperText={error || 'Enter your password to confirm your identity'}
            autoComplete="current-password"
            autoFocus
          />

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>FDA 21 CFR Part 11 Compliance:</strong>
            </Typography>
            <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
              • This signature is legally binding and equivalent to a handwritten signature
              <br />
              • The signed report cannot be modified without invalidating the signature
              <br />
              • All signature operations are logged in a tamper-proof audit trail
              <br />
              • You are responsible for maintaining the confidentiality of your credentials
            </Typography>
          </Alert>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button 
          onClick={handleClose} 
          disabled={loading}
          color="inherit"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSign}
          variant="contained"
          disabled={
            !password || 
            loading || 
            loadingPermissions || 
            !permissions || 
            (permissions.allowedSignatureMeanings?.length ?? 0) === 0 ||
            !isMeaningAllowed(meaning)
          }
          startIcon={loading ? <CircularProgress size={20} /> : <VerifiedUserIcon />}
        >
          {loading ? 'Signing...' : 'Sign Report'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
