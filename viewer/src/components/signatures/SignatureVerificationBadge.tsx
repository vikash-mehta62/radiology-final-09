import React, { useEffect, useState } from 'react'
import {
  Chip,
  Tooltip,
  Box,
  Typography,
  CircularProgress,
  Paper
} from '@mui/material'
import {
  Verified as VerifiedIcon,
  Error as ErrorIcon,
  Block as BlockIcon,
  HourglassEmpty as PendingIcon
} from '@mui/icons-material'

export interface SignatureVerificationResult {
  valid: boolean
  signature: {
    id: string
    reportId: string
    signerId: string
    signerName: string
    signerRole: string
    timestamp: string
    meaning: 'author' | 'reviewer' | 'approver'
    status: 'valid' | 'invalid' | 'revoked'
    algorithm: string
    revocationReason?: string
    revokedBy?: string
    revokedAt?: string
  }
  reportHash: string
  verifiedAt: string
  errors?: string[]
}

export interface SignatureVerificationBadgeProps {
  signatureId: string
  reportId?: string
  showDetails?: boolean
  size?: 'small' | 'medium'
  onVerificationComplete?: (result: SignatureVerificationResult) => void
}

export const SignatureVerificationBadge: React.FC<SignatureVerificationBadgeProps> = ({
  signatureId,
  reportId,
  showDetails = true,
  size = 'medium',
  onVerificationComplete
}) => {
  const [verification, setVerification] = useState<SignatureVerificationResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    verifySignature()
  }, [signatureId])

  const verifySignature = async () => {
    setLoading(true)
    setError(null)

    try {
      // TODO: Replace with actual signature service call
      // const result = await signatureService.verifySignature(signatureId)
      
      // Simulated API call for now
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const mockResult: SignatureVerificationResult = {
        valid: true,
        signature: {
          id: signatureId,
          reportId: reportId || 'unknown',
          signerId: 'user-123',
          signerName: 'Dr. John Smith',
          signerRole: 'Radiologist',
          timestamp: new Date().toISOString(),
          meaning: 'author',
          status: 'valid',
          algorithm: 'RSA-SHA256'
        },
        reportHash: 'abc123...',
        verifiedAt: new Date().toISOString()
      }

      setVerification(mockResult)
      onVerificationComplete?.(mockResult)
    } catch (err: any) {
      setError(err.message || 'Failed to verify signature')
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = () => {
    if (loading) return <PendingIcon />
    if (error) return <ErrorIcon />
    if (!verification) return <ErrorIcon />

    switch (verification.signature.status) {
      case 'valid':
        return verification.valid ? <VerifiedIcon /> : <ErrorIcon />
      case 'revoked':
        return <BlockIcon />
      case 'invalid':
        return <ErrorIcon />
      default:
        return <ErrorIcon />
    }
  }

  const getStatusColor = (): 'success' | 'error' | 'warning' | 'default' => {
    if (loading) return 'default'
    if (error) return 'error'
    if (!verification) return 'error'

    switch (verification.signature.status) {
      case 'valid':
        return verification.valid ? 'success' : 'error'
      case 'revoked':
        return 'warning'
      case 'invalid':
        return 'error'
      default:
        return 'error'
    }
  }

  const getStatusLabel = () => {
    if (loading) return 'Verifying...'
    if (error) return 'Verification Failed'
    if (!verification) return 'Unknown'

    switch (verification.signature.status) {
      case 'valid':
        return verification.valid ? 'Signature Valid' : 'Signature Invalid'
      case 'revoked':
        return 'Signature Revoked'
      case 'invalid':
        return 'Signature Invalid'
      default:
        return 'Unknown Status'
    }
  }

  const getTooltipContent = () => {
    if (loading) {
      return (
        <Box p={1}>
          <Typography variant="body2">Verifying signature...</Typography>
        </Box>
      )
    }

    if (error) {
      return (
        <Box p={1}>
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        </Box>
      )
    }

    if (!verification) {
      return (
        <Box p={1}>
          <Typography variant="body2">No verification data available</Typography>
        </Box>
      )
    }

    const { signature } = verification

    return (
      <Paper elevation={3} sx={{ p: 2, maxWidth: 400 }}>
        <Typography variant="subtitle2" gutterBottom>
          Signature Details
        </Typography>
        
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Signer:
          </Typography>
          <Typography variant="body2">
            {signature.signerName} ({signature.signerRole})
          </Typography>
        </Box>

        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Meaning:
          </Typography>
          <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
            {signature.meaning}
          </Typography>
        </Box>

        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Signed At:
          </Typography>
          <Typography variant="body2">
            {new Date(signature.timestamp).toLocaleString()}
          </Typography>
        </Box>

        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Algorithm:
          </Typography>
          <Typography variant="body2">
            {signature.algorithm}
          </Typography>
        </Box>

        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Verified At:
          </Typography>
          <Typography variant="body2">
            {new Date(verification.verifiedAt).toLocaleString()}
          </Typography>
        </Box>

        {signature.status === 'revoked' && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Revocation Reason:
            </Typography>
            <Typography variant="body2" color="warning.main">
              {signature.revocationReason || 'Not specified'}
            </Typography>
            {signature.revokedBy && (
              <Typography variant="caption" color="text.secondary">
                Revoked by: {signature.revokedBy} on{' '}
                {new Date(signature.revokedAt!).toLocaleString()}
              </Typography>
            )}
          </Box>
        )}

        {verification.errors && verification.errors.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="error">
              Errors:
            </Typography>
            {verification.errors.map((err, idx) => (
              <Typography key={idx} variant="body2" color="error">
                • {err}
              </Typography>
            ))}
          </Box>
        )}

        <Box sx={{ mt: 2, pt: 1, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">
            Signature ID: {signature.id}
          </Typography>
        </Box>
      </Paper>
    )
  }

  if (loading) {
    return (
      <Chip
        icon={<CircularProgress size={16} />}
        label="Verifying..."
        size={size}
        variant="outlined"
      />
    )
  }

  return (
    <Tooltip 
      title={showDetails ? getTooltipContent() : getStatusLabel()}
      arrow
      placement="top"
    >
      <Chip
        icon={getStatusIcon()}
        label={getStatusLabel()}
        color={getStatusColor()}
        size={size}
        variant={verification?.valid ? 'filled' : 'outlined'}
        sx={{
          cursor: 'pointer',
          '&:hover': {
            opacity: 0.8
          }
        }}
      />
    </Tooltip>
  )
}
