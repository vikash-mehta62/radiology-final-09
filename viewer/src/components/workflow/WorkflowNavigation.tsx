import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  ButtonGroup,
  Tooltip,
  Paper,
  Typography,
  Divider,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PatientsIcon,
  Assignment as WorklistIcon,
  CalendarToday as FollowUpIcon,
  Visibility as ViewerIcon,
  Description as ReportIcon,
  Payment as BillingIcon,
  ArrowForward as NextIcon,
} from '@mui/icons-material';

interface WorkflowNavigationProps {
  currentPage: 'dashboard' | 'patients' | 'worklist' | 'viewer' | 'reporting' | 'followups' | 'billing';
  context?: {
    patientId?: string;
    studyInstanceUID?: string;
    reportId?: string;
    followUpId?: string;
  };
  showSuggestions?: boolean;
}

const WorkflowNavigation: React.FC<WorkflowNavigationProps> = ({
  currentPage,
  context = {},
  showSuggestions = true,
}) => {
  const navigate = useNavigate();

  // Define workflow suggestions based on current page
  const getWorkflowSuggestions = () => {
    switch (currentPage) {
      case 'patients':
        return [
          { label: 'View Worklist', icon: <WorklistIcon />, path: '/worklist', tooltip: 'See all pending studies' },
          { label: 'Check Follow-ups', icon: <FollowUpIcon />, path: '/followups', tooltip: 'Review patient follow-ups' },
        ];
      
      case 'worklist':
        return [
          { label: 'View Study', icon: <ViewerIcon />, path: context.studyInstanceUID ? `/app/viewer/${context.studyInstanceUID}` : null, tooltip: 'Open in viewer', disabled: !context.studyInstanceUID },
          { label: 'Create Report', icon: <ReportIcon />, path: context.studyInstanceUID ? `/app/reporting?studyUID=${context.studyInstanceUID}` : null, tooltip: 'Generate report', disabled: !context.studyInstanceUID },
        ];
      
      case 'viewer':
        return [
          { label: 'Create Report', icon: <ReportIcon />, path: context.studyInstanceUID ? `/app/reporting?studyUID=${context.studyInstanceUID}` : null, tooltip: 'Generate report for this study', disabled: !context.studyInstanceUID },
          { label: 'Back to Worklist', icon: <WorklistIcon />, path: '/app/worklist', tooltip: 'Return to worklist' },
        ];
      
      case 'reporting':
        return [
          { label: 'Check Follow-ups', icon: <FollowUpIcon />, path: '/followups', tooltip: 'Review follow-up needs' },
          { label: 'Generate Invoice', icon: <BillingIcon />, path: '/billing', tooltip: 'Create billing record' },
          { label: 'Back to Worklist', icon: <WorklistIcon />, path: '/worklist', tooltip: 'Return to worklist' },
        ];
      
      case 'followups':
        return [
          { label: 'View Patients', icon: <PatientsIcon />, path: '/patients', tooltip: 'Patient management' },
          { label: 'Check Worklist', icon: <WorklistIcon />, path: '/worklist', tooltip: 'See if new studies arrived' },
        ];
      
      case 'billing':
        return [
          { label: 'Back to Worklist', icon: <WorklistIcon />, path: '/worklist', tooltip: 'Return to worklist' },
          { label: 'View Dashboard', icon: <DashboardIcon />, path: '/dashboard', tooltip: 'See overview' },
        ];
      
      default:
        return [];
    }
  };

  const suggestions = getWorkflowSuggestions();

  if (!showSuggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        mb: 2,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
      }}
    >
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="subtitle2" sx={{ opacity: 0.9, mb: 0.5 }}>
            Next Steps
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            Suggested workflow actions
          </Typography>
        </Box>
        
        <ButtonGroup variant="contained" size="small">
          {suggestions.map((suggestion, index) => (
            <Tooltip key={index} title={suggestion.tooltip} arrow>
              <span>
                <Button
                  startIcon={suggestion.icon}
                  onClick={() => suggestion.path && navigate(suggestion.path)}
                  disabled={suggestion.disabled}
                  sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.3)',
                    },
                    '&:disabled': {
                      bgcolor: 'rgba(255, 255, 255, 0.1)',
                      color: 'rgba(255, 255, 255, 0.5)',
                    },
                  }}
                >
                  {suggestion.label}
                </Button>
              </span>
            </Tooltip>
          ))}
        </ButtonGroup>
      </Box>
    </Paper>
  );
};

export default WorkflowNavigation;
