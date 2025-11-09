/**
 * NotificationBell Component
 * Displays notification bell icon with unread count badge
 */

import React, { useState } from 'react';
import { IconButton, Badge, Tooltip } from '@mui/material';
import { Notifications as NotificationsIcon } from '@mui/icons-material';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationPanel from './NotificationPanel';

export const NotificationBell: React.FC = () => {
  const [panelOpen, setPanelOpen] = useState(false);
  const { unreadCount } = useNotifications();

  const handleClick = () => {
    setPanelOpen(true);
  };

  const handleClose = () => {
    setPanelOpen(false);
  };

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton
          color="inherit"
          onClick={handleClick}
          aria-label={`${unreadCount} unread notifications`}
          sx={{
            ml: 1,
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            },
          }}
        >
          <Badge
            badgeContent={unreadCount}
            color="error"
            max={99}
            sx={{
              '& .MuiBadge-badge': {
                animation: unreadCount > 0 ? 'pulse 2s infinite' : 'none',
                '@keyframes pulse': {
                  '0%': {
                    transform: 'scale(1)',
                    opacity: 1,
                  },
                  '50%': {
                    transform: 'scale(1.1)',
                    opacity: 0.8,
                  },
                  '100%': {
                    transform: 'scale(1)',
                    opacity: 1,
                  },
                },
              },
            }}
          >
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <NotificationPanel open={panelOpen} onClose={handleClose} />
    </>
  );
};

export default NotificationBell;
