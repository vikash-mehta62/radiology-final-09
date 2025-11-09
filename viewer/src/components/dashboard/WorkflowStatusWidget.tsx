import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  Chip,
  Button,
  LinearProgress,
  Divider,
  Alert,
} from '@mui/material';
import {
  TrendingUp,
  Warning,
  CheckCircle,
  Schedule,
  Assignment,
  People,
  CalendarToday,
  ArrowForward,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import ApiService from '../../services/ApiService';

interface WorkflowStats {
  worklist: {
    pending: number;
    inProgress: number;
    stat: number;
    urgent: number;
  };
  followups: {
    total: number;
    overdue: number;
    upcoming: number;
    completionRate: number;
  };
  reports: {
    draft: number;
    pending: number;
    finalized: number;
  };
  patients: {
    total: number;
    newToday: number;
  };
}

const WorkflowStatusWidget: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<WorkflowStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      
      // Fetch all stats in parallel
      const [worklistStats, followUpStats] = await Promise.all([
        ApiService.getWorklistStats().catch(() => ({ data: { byStatus: { pending: 0, inProgress: 0 }, byPriority: { stat: 0, urgent: 0 } } })),
        ApiService.getFollowUpStatistics().catch(() => ({ data: { total: 0, overdue: 0, completionRate: '0%' } })),
      ]);

      setStats({
        worklist: {
          pending: worklistStats.data?.byStatus?.pending || 0,
          inProgress: worklistStats.data?.byStatus?.inProgress || 0,
          stat: worklistStats.data?.byPriority?.stat || 0,
          urgent: worklistStats.data?.byPriority?.urgent || 0,
        },
        followups: {
          total: followUpStats.data?.total || 0,
          overdue: followUpStats.data?.overdue || 0,
          upcoming: followUpStats.data?.upcoming || 0,
          completionRate: parseFloat(followUpStats.data?.completionRate || '0'),
        },
        reports: {
          draft: 0,
          pending: 0,
          finalized: 0,
        },
        patients: {
          total: 0,
          newToday: 0,
        },
      });
    } catch (error) {
      console.error('Error loading workflow stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Workflow Status
          </Typography>
          <LinearProgress />
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  const hasUrgentItems = stats.worklist.stat > 0 || stats.worklist.urgent > 0 || stats.followups.overdue > 0;

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Workflow Status
          </Typography>
          <Chip
            icon={hasUrgentItems ? <Warning /> : <CheckCircle />}
            label={hasUrgentItems ? 'Action Required' : 'On Track'}
            color={hasUrgentItems ? 'error' : 'success'}
            size="small"
          />
        </Box>

        {hasUrgentItems && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            You have urgent items requiring attention
          </Alert>
        )}

        <Grid container spacing={2}>
          {/* Worklist Section */}
          <Grid item xs={12} md={6}>
            <Box
              sx={{
                p: 2,
                bgcolor: 'background.default',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box display="flex" alignItems="center" mb={1}>
                <Assignment sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="subtitle2" fontWeight="bold">
                  Worklist
                </Typography>
              </Box>
              
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2" color="text.secondary">
                  Pending Studies
                </Typography>
                <Chip label={stats.worklist.pending} size="small" color="default" />
              </Box>
              
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2" color="text.secondary">
                  In Progress
                </Typography>
                <Chip label={stats.worklist.inProgress} size="small" color="info" />
              </Box>
              
              {stats.worklist.stat > 0 && (
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2" color="error.main" fontWeight="bold">
                    STAT Priority
                  </Typography>
                  <Chip label={stats.worklist.stat} size="small" color="error" />
                </Box>
              )}
              
              {stats.worklist.urgent > 0 && (
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2" color="warning.main">
                    Urgent Priority
                  </Typography>
                  <Chip label={stats.worklist.urgent} size="small" color="warning" />
                </Box>
              )}
              
              <Button
                fullWidth
                size="small"
                endIcon={<ArrowForward />}
                onClick={() => navigate('/app/worklist')}
                sx={{ mt: 1 }}
              >
                Open Worklist
              </Button>
            </Box>
          </Grid>

          {/* Follow-ups Section */}
          <Grid item xs={12} md={6}>
            <Box
              sx={{
                p: 2,
                bgcolor: 'background.default',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box display="flex" alignItems="center" mb={1}>
                <CalendarToday sx={{ mr: 1, color: 'secondary.main' }} />
                <Typography variant="subtitle2" fontWeight="bold">
                  Follow-ups
                </Typography>
              </Box>
              
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2" color="text.secondary">
                  Total Active
                </Typography>
                <Chip label={stats.followups.total} size="small" color="default" />
              </Box>
              
              {stats.followups.overdue > 0 && (
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2" color="error.main" fontWeight="bold">
                    Overdue
                  </Typography>
                  <Chip label={stats.followups.overdue} size="small" color="error" />
                </Box>
              )}
              
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2" color="text.secondary">
                  Upcoming (7 days)
                </Typography>
                <Chip label={stats.followups.upcoming} size="small" color="info" />
              </Box>
              
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2" color="text.secondary">
                  Completion Rate
                </Typography>
                <Typography variant="body2" fontWeight="bold" color="success.main">
                  {stats.followups.completionRate.toFixed(0)}%
                </Typography>
              </Box>
              
              <Button
                fullWidth
                size="small"
                endIcon={<ArrowForward />}
                onClick={() => navigate('/followups')}
                sx={{ mt: 1 }}
              >
                Manage Follow-ups
              </Button>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        {/* Quick Actions */}
        <Box display="flex" gap={1} flexWrap="wrap">
          <Button
            size="small"
            startIcon={<People />}
            onClick={() => navigate('/app/patients')}
            variant="outlined"
          >
            Patients
          </Button>
          <Button
            size="small"
            startIcon={<Assignment />}
            onClick={() => navigate('/app/worklist')}
            variant="outlined"
          >
            Worklist
          </Button>
          <Button
            size="small"
            startIcon={<TrendingUp />}
            onClick={() => navigate('/billing')}
            variant="outlined"
          >
            Billing
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default WorkflowStatusWidget;
