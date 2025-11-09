import React, { useState } from 'react'
import { Button, CircularProgress } from '@mui/material'
import { VerifiedUser as SignatureIcon } from '@mui/icons-material'
import { SignatureModal } from './SignatureModal'
import { signatureService } from '../../services/signatureService'

interface SignatureButtonProps {
  reportId: string
  onSigned?: () => void
  disabled?: boolean
}

export const SignatureButton: React.FC<SignatureButtonProps> = ({
  reportId,
  onSigned,
  disabled = false
}) => {
  const [open, setOpen] = useState(false)
  // Signing is handled inside SignatureModal

  return (
    <>
      <Button
        variant="contained"
        color="primary"
        startIcon={<SignatureIcon />}
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        Sign Report 
      </Button>

      <SignatureModal
        open={open}
        reportId={reportId}
        onClose={() => setOpen(false)}
        onSigned={() => {
          setOpen(false)
          onSigned?.()
        }}
      />
    </>
  )
}
