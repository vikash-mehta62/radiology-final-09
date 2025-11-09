/**
 * Report Content Panel
 * Main editing area for report text fields
 */

import React from 'react';
import {
  Box,
  TextField,
  Typography,
  Divider,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { useReporting } from '../../../contexts/ReportingContext';
import QuickPhraseButton from '../QuickPhraseButton';
import { getQuickPhrases } from '../../../data/quickPhrases';

const ReportContentPanel: React.FC = () => {
  const { state, actions } = useReporting();
  
  const handleFieldChange = (field: keyof typeof state, value: string) => {
    actions.updateField(field, value);
  };
  
  // Get modality for quick phrases
  const modality = state.patientInfo?.modality || 'CT';
  
  // Helper to insert phrase into field
  const insertPhrase = (field: keyof typeof state, phrase: string) => {
    const currentValue = state[field] as string || '';
    const newValue = currentValue 
      ? `${currentValue}\n${phrase}` 
      : phrase;
    actions.updateField(field, newValue);
  };
  
  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
        Report Content
      </Typography>
      
      {/* Clinical History */}
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
            Clinical History
          </Typography>
          <QuickPhraseButton
            phrases={getQuickPhrases(modality, 'clinicalHistory')}
            onInsert={(phrase) => insertPhrase('clinicalHistory', phrase)}
            label="Common Indications"
          />
        </Box>
        <TextField
          fullWidth
          multiline
          rows={2}
          value={state.clinicalHistory}
          onChange={(e) => handleFieldChange('clinicalHistory', e.target.value)}
          placeholder="Enter clinical history and indication for study..."
          variant="outlined"
          sx={{ mt: 1 }}
        />
      </Paper>
      
      {/* Technique */}
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
            Technique
          </Typography>
          <QuickPhraseButton
            phrases={getQuickPhrases(modality, 'technique')}
            onInsert={(phrase) => insertPhrase('technique', phrase)}
            label="Common Techniques"
          />
        </Box>
        <TextField
          fullWidth
          multiline
          rows={2}
          value={state.technique}
          onChange={(e) => handleFieldChange('technique', e.target.value)}
          placeholder="Describe imaging technique, contrast, protocols..."
          variant="outlined"
          sx={{ mt: 1 }}
        />
      </Paper>
      
      {/* Structured Findings */}
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
            Structured Findings
          </Typography>
          <Tooltip title="Add Finding">
            <IconButton 
              size="small" 
              color="primary"
              onClick={() => {
                const newFinding = {
                  id: `finding-${Date.now()}`,
                  location: '',
                  description: '',
                  severity: 'normal' as const
                };
                actions.addFinding(newFinding);
              }}
            >
              <AddIcon />
            </IconButton>
          </Tooltip>
        </Box>
        
        {state.findings.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            No findings added yet. Click + to add a finding.
          </Typography>
        ) : (
          <List dense>
            {state.findings.map((finding) => (
              <ListItem 
                key={finding.id}
                sx={{ 
                  border: 1, 
                  borderColor: 'divider', 
                  borderRadius: 1, 
                  mb: 1,
                  bgcolor: 'background.default'
                }}
              >
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <strong>{finding.location || 'Location not specified'}</strong>
                      <Chip 
                        label={finding.severity} 
                        size="small" 
                        color={
                          finding.severity === 'critical' ? 'error' :
                          finding.severity === 'severe' ? 'warning' :
                          'default'
                        }
                      />
                      {finding.aiDetected && (
                        <Chip label="AI" size="small" color="info" />
                      )}
                    </Box>
                  }
                  secondary={finding.description || 'No description'}
                />
                <ListItemSecondaryAction>
                  <IconButton 
                    size="small" 
                    onClick={() => actions.deleteFinding(finding.id)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
      
      {/* Findings Text */}
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
            Findings (Free Text)
          </Typography>
          <QuickPhraseButton
            phrases={getQuickPhrases(modality, 'findings')}
            onInsert={(phrase) => insertPhrase('findingsText', phrase)}
            label="Common Findings"
          />
        </Box>
        <TextField
          fullWidth
          multiline
          rows={6}
          value={state.findingsText}
          onChange={(e) => handleFieldChange('findingsText', e.target.value)}
          placeholder="Describe detailed findings..."
          variant="outlined"
          sx={{ mt: 1 }}
        />
      </Paper>
      
      {/* Impression */}
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
            Impression *
          </Typography>
          <QuickPhraseButton
            phrases={getQuickPhrases(modality, 'impression')}
            onInsert={(phrase) => insertPhrase('impression', phrase)}
            label="Common Impressions"
          />
        </Box>
        <TextField
          fullWidth
          multiline
          rows={4}
          value={state.impression}
          onChange={(e) => handleFieldChange('impression', e.target.value)}
          placeholder="Enter impression and conclusions..."
          variant="outlined"
          required
          sx={{ mt: 1 }}
        />
      </Paper>
      
      {/* Recommendations */}
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
            Recommendations
          </Typography>
          <QuickPhraseButton
            phrases={getQuickPhrases(modality, 'recommendations')}
            onInsert={(phrase) => insertPhrase('recommendations', phrase)}
            label="Common Recommendations"
          />
        </Box>
        <TextField
          fullWidth
          multiline
          rows={3}
          value={state.recommendations}
          onChange={(e) => handleFieldChange('recommendations', e.target.value)}
          placeholder="Enter follow-up recommendations..."
          variant="outlined"
          sx={{ mt: 1 }}
        />
      </Paper>
      
      {/* Template Sections (if any) */}
      {Object.keys(state.sections).length > 0 && (
        <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
            Template Sections
          </Typography>
          {Object.entries(state.sections).map(([key, value]) => (
            <Box key={key} mb={2}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                {key.replace(/_/g, ' ').toUpperCase()}
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                value={value}
                onChange={(e) => actions.updateSection(key, e.target.value)}
                variant="outlined"
              />
            </Box>
          ))}
        </Paper>
      )}
    </Box>
  );
};

export default ReportContentPanel;
