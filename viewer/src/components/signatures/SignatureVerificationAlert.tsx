import React from 'react';
import { Alert, AlertTitle, Box, Chip, Typography, Button, Collapse } from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';

interface SignatureValidation {
  valid: boolean;
  signed: boolean;
  message: string;
  signatures?: Array<{
    signatureId: string;
    meaning: string;
    signer: string;
    valid: boolean;
    reason: string;
  }>;
}

interface SignatureVerificationAlertProps {
  validation: SignatureValidation;
  reportId: string;
}

/**
 * Component to display signature verification status
 * Shows alerts when signatures are invalid or missing
 * Implements FDA 21 CFR Part 11 requirement for signature verification display
 */
export const SignatureVerificationAlert: React.FC<SignatureVerificationAlertProps> = ({
  validation,
  reportId
}) => {
  const [expanded, setExpanded] = React.useState(false);

  if (!validation) {
    return null;
  }

  // Report is not signed - no alert needed
  if (!validation.signed) {
    return null;
  }

  // All signatures are valid - show success
  if (validation.valid) {
    return (
      <Alert 
        severity="success" 
        icon={<CheckCircleIcon />}
        sx={{ mb: 2 }}
      >
        <AlertTitle>Signatures Verified</AlertTitle>
        All digital signatures on this report have been verified and are valid.
        {validation.signatures && validation.signatures.length > 0 && (
          <Box sx={{ mt: 1 }}>
            {validation.signatures.map((sig, index) => (
              <Chip
                key={index}
                label={`${sig.meaning}: ${sig.signer}`}
                size="small"
                color="success"
                sx={{ mr: 1, mt: 0.5 }}
              />
            ))}
          </Box>
        )}
      </Alert>
    );
  }

  // Signatures are invalid - show critical alert
  return (
    <Alert 
      severity="error" 
      icon={<ErrorIcon />}
      sx={{ mb: 2 }}
    >
      <AlertTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>⚠️ Signature Verification Failed</span>
          <Button
            size="small"
            onClick={() => setExpanded(!expanded)}
            endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          >
            Details
          </Button>
        </Box>
      </AlertTitle>
      
      <Typography variant="body2" sx={{ mb: 1 }}>
        {validation.message}
      </Typography>

      <Typography variant="body2" color="error" sx={{ fontWeight: 'bold' }}>
        This report may have been modified after signing or the signature may be compromised.
        Do not rely on this report for clinical decisions.
      </Typography>

      <Collapse in={expanded}>
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Signature Details:
          </Typography>
          {validation.signatures && validation.signatures.map((sig, index) => (
            <Box 
              key={index} 
              sx={{ 
                p: 1, 
                mb: 1, 
                bgcolor: sig.valid ? 'success.light' : 'error.light',
                borderRadius: 1,
                border: 1,
                borderColor: sig.valid ? 'success.main' : 'error.main'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                {sig.valid ? (
                  <CheckCircleIcon color="success" fontSize="small" sx={{ mr: 1 }} />
                ) : (
                  <ErrorIcon color="error" fontSize="small" sx={{ mr: 1 }} />
                )}
                <Typography variant="body2" fontWeight="bold">
                  {sig.meaning}: {sig.signer}
                </Typography>
              </Box>
              <Typography variant="caption" display="block">
                Status: {sig.valid ? 'Valid' : 'Invalid'}
              </Typography>
              {!sig.valid && (
                <Typography variant="caption" display="block" color="error">
                  Reason: {sig.reason}
                </Typography>
              )}
            </Box>
          ))}

          <Box sx={{ mt: 2, p: 1, bgcolor: 'warning.light', borderRadius: 1 }}>
            <Typography variant="caption" display="block">
              <strong>FDA 21 CFR Part 11 Compliance Notice:</strong>
            </Typography>
            <Typography variant="caption" display="block">
              This signature verification failure has been logged in the audit trail.
              Please contact your system administrator immediately.
            </Typography>
          </Box>
        </Box>
      </Collapse>
    </Alert>
  );
};

/**
 * Compact signature status badge for display in lists
 */
export const SignatureStatusBadge: React.FC<{ validation: SignatureValidation }> = ({ 
  validation 
}) => {
  if (!validation || !validation.signed) {
    return (
      <Chip
        label="Unsigned"
        size="small"
        variant="outlined"
      />
    );
  }

  if (validation.valid) {
    return (
      <Chip
        icon={<CheckCircleIcon />}
        label="Verified"
        size="small"
        color="success"
      />
    );
  }

  return (
    <Chip
      icon={<ErrorIcon />}
      label="Invalid Signature"
      size="small"
      color="error"
    />
  );
};

export default SignatureVerificationAlert;
