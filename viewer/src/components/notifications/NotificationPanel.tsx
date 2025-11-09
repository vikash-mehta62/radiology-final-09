/**
 * NotificationPanel Component
 * Displays notifications in a drawer/panel with grouping by severity
 */

import React, { useState, useMemo } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  DoneAll as DoneAllIcon,
} from '@mui/icons-material';
import { useNotifications } from '../../hooks/useNotifications';
import { CriticalNotification } from '../../types/notifications';
import { formatDistanceToNow } from 'date-fns';

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ open, onClose }) => {
  const {
    notifications,
    unreadCount,
    loading,
    error,
    acknowledgeNotification,
    refreshNotifications,
    markAllAsRead,
  } = useNotifications();

  const [selectedTab, setSelectedTab] = useState(0);
  const [acknowledgingIds, setAcknowledgingIds] = useState<Set<string>>(new Set());

  // Group notifications by severity
  const groupedNotifications = useMemo(() => {
    const groups = {
      critical: [] as CriticalNotification[],
      high: [] as CriticalNotification[],
      medium: [] as CriticalNotification[],
      all: notifications,
    };

    notifications.forEach(notification => {
      if (notification.severity === 'critical') {
        groups.critical.push(notification);
      } else if (notification.severity === 'high') {
        groups.high.push(notification);
      } else {
        groups.medium.push(notification);
      }
    });

    return groups;
  }, [notifications]);

  // Get notifications for selected tab
  const displayedNotifications = useMemo(() => {
    switch (selectedTab) {
      case 0:
        return groupedNotifications.all;
      case 1:
        return groupedNotifications.critical;
      case 2:
        return groupedNotifications.high;
      case 3:
        return groupedNotifications.medium;
      default:
        return groupedNotifications.all;
    }
  }, [selectedTab, groupedNotifications]);

  const handleAcknowledge = async (notificationId: string) => {
    setAcknowledgingIds(prev => new Set(prev).add(notificationId));
    
    try {
      await acknowledgeNotification(notificationId);
    } catch (err) {
      console.error('Failed to acknowledge notification:', err);
    } finally {
      setAcknowledgingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(notificationId);
        return newSet;
      });
    }
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead();
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <ErrorIcon color="error" />;
      case 'high':
        return <WarningIcon color="warning" />;
      case 'medium':
        return <InfoIcon color="info" />;
      default:
        return <InfoIcon />;
    }
  };

  const getSeverityColor = (severity: string): 'error' | 'warning' | 'info' => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      default:
        return 'info';
    }
  };

  const formatTimestamp = (date: Date) => {
    try {
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return 'Recently';
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: { xs: '100%', sm: 450 },
          maxWidth: '100%',
        },
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6">Notifications</Typography>
            {unreadCount > 0 && (
              <Chip
                label={unreadCount}
                size="small"
                color="error"
                sx={{ height: 24, minWidth: 24 }}
              />
            )}
          </Box>
          <Box>
            <Tooltip title="Refresh">
              <IconButton
                color="inherit"
                onClick={refreshNotifications}
                disabled={loading}
                size="small"
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            {unreadCount > 0 && (
              <Tooltip title="Mark all as read">
                <IconButton
                  color="inherit"
                  onClick={handleMarkAllAsRead}
                  size="small"
                >
                  <DoneAllIcon />
                </IconButton>
              </Tooltip>
            )}
            <IconButton color="inherit" onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Tabs */}
        <Tabs
          value={selectedTab}
          onChange={(_, newValue) => setSelectedTab(newValue)}
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                All
                {groupedNotifications.all.length > 0 && (
                  <Chip size="small" label={groupedNotifications.all.length} />
                )}
              </Box>
            }
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                Critical
                {groupedNotifications.critical.length > 0 && (
                  <Chip size="small" label={groupedNotifications.critical.length} color="error" />
                )}
              </Box>
            }
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                High
                {groupedNotifications.high.length > 0 && (
                  <Chip size="small" label={groupedNotifications.high.length} color="warning" />
                )}
              </Box>
            }
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                Medium
                {groupedNotifications.medium.length > 0 && (
                  <Chip size="small" label={groupedNotifications.medium.length} color="info" />
                )}
              </Box>
            }
          />
        </Tabs>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {error && (
            <Box sx={{ p: 2 }}>
              <Alert severity="error">{error}</Alert>
            </Box>
          )}

          {!loading && !error && displayedNotifications.length === 0 && (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No notifications
              </Typography>
              <Typography variant="body2" color="text.secondary">
                You're all caught up!
              </Typography>
            </Box>
          )}

          {!loading && !error && displayedNotifications.length > 0 && (
            <List sx={{ p: 0 }}>
              {displayedNotifications.map((notification, index) => (
                <React.Fragment key={notification.id}>
                  <ListItem
                    sx={{
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      bgcolor:
                        notification.status !== 'acknowledged'
                          ? 'action.hover'
                          : 'transparent',
                      borderLeft: 4,
                      borderColor: `${getSeverityColor(notification.severity)}.main`,
                      '&:hover': {
                        bgcolor: 'action.selected',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', width: '100%', gap: 1 }}>
                      <ListItemIcon sx={{ minWidth: 40, mt: 0.5 }}>
                        {getSeverityIcon(notification.severity)}
                      </ListItemIcon>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {notification.title}
                          </Typography>
                          <Chip
                            label={notification.severity.toUpperCase()}
                            size="small"
                            color={getSeverityColor(notification.severity)}
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {notification.message}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                          <Chip
                            label={`Patient: ${notification.patientId}`}
                            size="small"
                            variant="outlined"
                          />
                          <Chip
                            label={`Study: ${notification.studyId}`}
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                        {notification.findingDetails && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {notification.findingDetails.location} - {notification.findingDetails.description}
                          </Typography>
                        )}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            {formatTimestamp(notification.createdAt)}
                          </Typography>
                          {notification.escalationLevel > 0 && (
                            <Chip
                              label={`Escalation Level ${notification.escalationLevel}`}
                              size="small"
                              color="warning"
                              sx={{ height: 20, fontSize: '0.65rem' }}
                            />
                          )}
                        </Box>
                      </Box>
                    </Box>
                    {notification.status !== 'acknowledged' && (
                      <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                          size="small"
                          variant="contained"
                          color="primary"
                          startIcon={<CheckCircleIcon />}
                          onClick={() => handleAcknowledge(notification.id)}
                          disabled={acknowledgingIds.has(notification.id)}
                        >
                          {acknowledgingIds.has(notification.id) ? 'Acknowledging...' : 'Acknowledge'}
                        </Button>
                      </Box>
                    )}
                    {notification.status === 'acknowledged' && notification.acknowledgedAt && (
                      <Box sx={{ mt: 1 }}>
                        <Chip
                          icon={<CheckCircleIcon />}
                          label={`Acknowledged ${formatTimestamp(notification.acknowledgedAt)}`}
                          size="small"
                          color="success"
                          variant="outlined"
                        />
                      </Box>
                    )}
                  </ListItem>
                  {index < displayedNotifications.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>
      </Box>
    </Drawer>
  );
};

export default NotificationPanel;
