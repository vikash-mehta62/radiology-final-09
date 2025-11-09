/**
 * NotificationPermissionPrompt Component
 * Displays a user-friendly prompt to request notification permission
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  IconButton,
} from '@mui/material';
import {
  NotificationsActive as NotificationsIcon,
  Close as CloseIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import {
  requestNotificationPermission,
  shouldShowPermissionPrompt,
  getPermissionState,
  getBrowserInstructions,
  NotificationPermissionStatus,
} from '../../utils/notificationPermission';

interface NotificationPermissionPromptProps {
  /** Show prompt automatically if permission is needed */
  autoShow?: boolean;
  /** Callback when permission is granted */
  onGranted?: () => void;
  /** Callback when permission is denied */
  onDenied?: () => void;
  /** Callback when prompt is dismissed */
  onDismiss?: () => void;
}

export const NotificationPermissionPrompt: React.FC<NotificationPermissionPromptProps> = ({
  autoShow = false,
  onGranted,
  onDenied,
  onDismiss,
}) => {
  const [open, setOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermissionStatus>('default');

  useEffect(() => {
    const state = getPermissionState();
    setPermissionStatus(state.permission);

    // Auto-show if enabled and permission is needed
    if (autoShow && shouldShowPermissionPrompt()) {
      // Delay showing to avoid interrupting user immediately
      const timer = setTimeout(() => {
        setOpen(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [autoShow]);

  const handleRequestPermission = async () => {
    setRequesting(true);
    
    try {
      const permission = await requestNotificationPermission();
      setPermissionStatus(permission);
      
      if (permission === 'granted') {
        onGranted?.();
        setOpen(false);
      } else if (permission === 'denied') {
        onDenied?.();
        setShowInstructions(true);
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      onDenied?.();
    } finally {
      setRequesting(false);
    }
  };

  const handleDismiss = () => {
    setOpen(false);
    onDismiss?.();
  };

  const handleClose = () => {
    if (!requesting) {
      handleDismiss();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <NotificationsIcon color="primary" sx={{ fontSize: 32 }} />
            <Typography variant="h6">Enable Notifications</Typography>
          </Box>
          <IconButton
            onClick={handleClose}
            disabled={requesting}
            size="small"
            sx={{ color: 'text.secondary' }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {!showInstructions ? (
          <>
            <Typography variant="body1" gutterBottom>
              Stay informed about critical findings and urgent cases with real-time notifications.
            </Typography>

            <Box sx={{ mt: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                You'll receive notifications for:
              </Typography>
              <Box component="ul" sx={{ mt: 1, pl: 2 }}>
                <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                  Critical findings requiring immediate attention
                </Typography>
                <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                  Urgent case reviews and escalations
                </Typography>
                <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                  Important system alerts
                </Typography>
              </Box>
            </Box>

            <Alert severity="info" icon={<InfoIcon />} sx={{ mt: 2 }}>
              You can customize notification preferences in your settings at any time.
            </Alert>
          </>
        ) : (
          <>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Notifications have been blocked. To enable them, you'll need to update your browser settings.
            </Alert>

            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
              How to enable notifications:
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {getBrowserInstructions()}
            </Typography>

            <Alert severity="info">
              After updating your browser settings, refresh this page to start receiving notifications.
            </Alert>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        {!showInstructions ? (
          <>
            <Button
              onClick={handleDismiss}
              disabled={requesting}
              color="inherit"
            >
              Not Now
            </Button>
            <Button
              onClick={handleRequestPermission}
              variant="contained"
              disabled={requesting}
              startIcon={<NotificationsIcon />}
            >
              {requesting ? 'Requesting...' : 'Enable Notifications'}
            </Button>
          </>
        ) : (
          <Button onClick={handleDismiss} variant="contained">
            Got It
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default NotificationPermissionPrompt;
