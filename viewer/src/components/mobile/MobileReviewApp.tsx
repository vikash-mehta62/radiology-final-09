/**
 * Mobile Review App Component
 * Responsive mobile interface for report review and approval
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  IconButton,
  Chip,
  Avatar,
  Divider,
  SwipeableDrawer,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Badge,
  Fab
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Comment as CommentIcon,
  Notifications as NotificationIcon,
  Menu as MenuIcon,
  Person as PatientIcon,
  Assignment as ReportIcon,
  Schedule as PendingIcon
} from '@mui/icons-material';

interface MobileReviewAppProps {
  reports?: any[];
  onApprove?: (reportId: string) => void;
  onReject?: (reportId: string, reason: string) => void;
  onComment?: (reportId: string, comment: string) => void;
}

const MobileReviewApp: React.FC<MobileReviewAppProps> = ({
  reports = [],
  onApprove,
  onReject,
  onComment
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    setPendingCount(reports.filter(r => r.status === 'pending').length);
  }, [reports]);

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      bgcolor: 'background.default',
      pb: 8 // Space for FAB
    }}>
      {/* Mobile Header */}
      <Paper elevation={2} sx={{ p: 2, borderRadius: 0 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <IconButton onClick={() => setDrawerOpen(true)}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6">Report Review</Typography>
          <Badge badgeContent={pendingCount} color="error">
            <NotificationIcon />
          </Badge>
        </Box>
      </Paper>

      {/* Report List */}
      <Box p={2}>
        {reports.map((report) => (
          <Card key={report.id} sx={{ mb: 2 }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                <Box>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {report.patientName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ID: {report.patientId} • {report.modality}
                  </Typography>
                </Box>
                <Chip 
                  label={report.status}
                  color={report.status === 'pending' ? 'warning' : 'success'}
                  size="small"
                />
              </Box>
              
              <Typography variant="body2" sx={{ mb: 2 }}>
                {report.findings?.substring(0, 100)}...
              </Typography>
              
              <Box display="flex" gap={1}>
                <Button
                  size="small"
                  startIcon={<ApproveIcon />}
                  color="success"
                  onClick={() => onApprove?.(report.id)}
                >
                  Approve
                </Button>
                <Button
                  size="small"
                  startIcon={<RejectIcon />}
                  color="error"
                  onClick={() => onReject?.(report.id, 'Needs revision')}
                >
                  Reject
                </Button>
                <Button
                  size="small"
                  startIcon={<CommentIcon />}
                  onClick={() => onComment?.(report.id, 'Mobile comment')}
                >
                  Comment
                </Button>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Navigation Drawer */}
      <SwipeableDrawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onOpen={() => setDrawerOpen(true)}
      >
        <Box sx={{ width: 250 }}>
          <List>
            <ListItem>
              <ListItemIcon><ReportIcon /></ListItemIcon>
              <ListItemText primary="All Reports" />
            </ListItem>
            <ListItem>
              <ListItemIcon><PendingIcon /></ListItemIcon>
              <ListItemText primary="Pending Review" />
              <Badge badgeContent={pendingCount} color="error" />
            </ListItem>
          </List>
        </Box>
      </SwipeableDrawer>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={() => console.log('Quick action')}
      >
        <NotificationIcon />
      </Fab>
    </Box>
  );
};

export default MobileReviewApp;