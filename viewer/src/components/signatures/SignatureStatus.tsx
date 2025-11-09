import React, { useEffect, useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert
} from '@mui/material'
import {
  VerifiedUser as VerifiedIcon,
  Cancel as RevokedIcon,
  Info as InfoIcon,
  Visibility as ViewIcon
} from '@mui/icons-material'
import { signatureService } from '../../services/signatureService'
import { AuditTrailDialog } from './AuditTrailDialog'

interface Signature {
  id: string
  signerName: string
  signerRole: string
  meaning: 'author' | 'reviewer' | 'approver'
  timestamp: string
  status: 'valid' | 'revoked'
  algorithm: string
  keySize: number
}

interface SignatureStatusProps {
  reportId: string
  onUpdate?: () => void
}

export const SignatureStatus: React.FC<SignatureStatusProps> = ({
  reportId,
  onUpdate
}) => {
  const [signatures, setSignatures] = useState<Signature[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [auditDialogOpen, setAuditDialogOpen] = useState(false)

  useEffect(() => {
    fetchSignatures()
  }, [reportId])

  const fetchSignatures = async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await signatureService.getReportSignatures(reportId)
      
      if (result.success) {
        setSignatures(result.data.signatures)
      } else {
        setError(result.message || 'Failed to load signatures')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const getMeaningLabel = (meaning: string) => {
    const labels: Record<string, string> = {
      author: 'Author',
      reviewer: 'Reviewer',
      approver: 'Approver'
    }
    return labels[meaning] || meaning
  }

  const getMeaningColor = (meaning: string) => {
    const colors: Record<string, 'primary' | 'secondary' | 'success'> = {
      author: 'primary',
      reviewer: 'secondary',
      approver: 'success'
    }
    return colors[meaning] || 'default'
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={2}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    )
  }

  if (signatures.length === 0) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        This report has not been signed yet.
      </Alert>
    )
  }

  return (
    <>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Digital Signatures ({signatures.length})
            </Typography>
            <Tooltip title="View Audit Trail">
              <IconButton onClick={() => setAuditDialogOpen(true)} size="small">
                <InfoIcon />
              </IconButton>
            </Tooltip>
          </Box>

          <List>
            {signatures.map((signature) => (
              <ListItem
                key={signature.id}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1
                }}
              >
                <ListItemIcon>
                  {signature.status === 'valid' ? (
                    <VerifiedIcon color="success" />
                  ) : (
                    <RevokedIcon color="error" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="subtitle2">
                        {signature.signerName}
                      </Typography>
                      <Chip
                        label={getMeaningLabel(signature.meaning)}
                        size="small"
                        color={getMeaningColor(signature.meaning)}
                      />
                      {signature.status === 'revoked' && (
                        <Chip
                          label="Revoked"
                          size="small"
                          color="error"
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="caption" display="block">
                        Role: {signature.signerRole}
                      </Typography>
                      <Typography variant="caption" display="block">
                        Signed: {new Date(signature.timestamp).toLocaleString()}
                      </Typography>
                      <Typography variant="caption" display="block" color="text.secondary">
                        {signature.algorithm} ({signature.keySize} bits)
                      </Typography>
                    </Box>
                  }
                />
                <Tooltip title="Verify Signature">
                  <IconButton
                    size="small"
                    onClick={() => handleVerifySignature(signature.id)}
                  >
                    <ViewIcon />
                  </IconButton>
                </Tooltip>
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>

      <AuditTrailDialog
        open={auditDialogOpen}
        onClose={() => setAuditDialogOpen(false)}
        reportId={reportId}
      />
    </>
  )

  async function handleVerifySignature(signatureId: string) {
    try {
      const result = await signatureService.verifySignature(signatureId)
      
      if (result.success && result.data.valid) {
        alert('✅ Signature is valid and verified')
      } else {
        alert(`❌ Signature verification failed: ${result.data.reason || 'Unknown reason'}`)
      }
    } catch (err: any) {
      alert(`Error verifying signature: ${err.message}`)
    }
  }
}
