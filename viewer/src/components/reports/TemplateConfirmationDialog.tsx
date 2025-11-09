/**
 * Template Confirmation Dialog
 * Shows AI-suggested template with option to change
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  RadioGroup,
  FormControlLabel,
  Radio,
  Divider
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  AutoAwesome as AIIcon,
  Description as TemplateIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { REPORT_TEMPLATES, type ReportTemplate } from '../../data/reportTemplates';
import type { TemplateMatchResult } from '../../utils/templateMatcher';

interface TemplateConfirmationDialogProps {
  open: boolean;
  suggestedTemplate: TemplateMatchResult | null;
  modality: string;
  onConfirm: (template: ReportTemplate) => void;
  onCancel: () => void;
}

const TemplateConfirmationDialog: React.FC<TemplateConfirmationDialogProps> = ({
  open,
  suggestedTemplate,
  modality,
  onConfirm,
  onCancel
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    suggestedTemplate?.template.id || ''
  );
  const [showAllTemplates, setShowAllTemplates] = useState(false);

  // Get templates for this modality
  const modalityTemplates = REPORT_TEMPLATES.filter(t =>
    t.modality.includes(modality.toUpperCase())
  );

  const selectedTemplate = REPORT_TEMPLATES.find(t => t.id === selectedTemplateId);

  const handleConfirm = () => {
    if (selectedTemplate) {
      onConfirm(selectedTemplate);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '400px' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <AIIcon color="primary" />
          <Typography variant="h6">Select Report Template</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* AI Suggestion */}
        {suggestedTemplate && (
          <Alert
            severity="info"
            icon={<AIIcon />}
            sx={{ mb: 3 }}
          >
            <Typography variant="subtitle2" fontWeight="bold">
              AI Recommendation
            </Typography>
            <Typography variant="body2">
              {suggestedTemplate.reason}
              <Chip
                label={`${(suggestedTemplate.confidence * 100).toFixed(0)}% confidence`}
                size="small"
                color="primary"
                sx={{ ml: 1 }}
              />
            </Typography>
          </Alert>
        )}

        {/* Suggested Template Card */}
        {suggestedTemplate && !showAllTemplates && (
          <Card
            variant="outlined"
            sx={{
              mb: 2,
              border: 2,
              borderColor: 'primary.main',
              bgcolor: 'primary.50'
            }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <Typography variant="h4">{suggestedTemplate.template.icon}</Typography>
                <Box flex={1}>
                  <Typography variant="h6" fontWeight="bold">
                    {suggestedTemplate.template.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {suggestedTemplate.template.category}
                  </Typography>
                </Box>
                <CheckIcon color="primary" fontSize="large" />
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom>
                Template Sections:
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {suggestedTemplate.template.sections.map(section => (
                  <Chip
                    key={section.id}
                    label={section.title}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Box>

              <Typography variant="subtitle2" sx={{ mt: 2 }} gutterBottom>
                Quick Findings Available: {suggestedTemplate.template.findings.length}
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* Option to show all templates */}
        {!showAllTemplates && modalityTemplates.length > 1 && (
          <Box textAlign="center" mb={2}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<EditIcon />}
              onClick={() => setShowAllTemplates(true)}
            >
              Choose Different Template ({modalityTemplates.length - 1} more available)
            </Button>
          </Box>
        )}

        {/* All Templates List */}
        {showAllTemplates && (
          <>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
              Available Templates for {modality}:
            </Typography>
            <RadioGroup
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
            >
              <Grid container spacing={2}>
                {modalityTemplates.map(template => (
                  <Grid item xs={12} key={template.id}>
                    <Card
                      variant="outlined"
                      sx={{
                        cursor: 'pointer',
                        border: selectedTemplateId === template.id ? 2 : 1,
                        borderColor: selectedTemplateId === template.id ? 'primary.main' : 'divider',
                        '&:hover': { borderColor: 'primary.light' }
                      }}
                      onClick={() => setSelectedTemplateId(template.id)}
                    >
                      <CardContent>
                        <FormControlLabel
                          value={template.id}
                          control={<Radio />}
                          label={
                            <Box display="flex" alignItems="center" gap={2} width="100%">
                              <Typography variant="h5">{template.icon}</Typography>
                              <Box flex={1}>
                                <Typography variant="subtitle1" fontWeight="bold">
                                  {template.name}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {template.category} • {template.sections.length} sections
                                </Typography>
                              </Box>
                              {template.id === suggestedTemplate?.template.id && (
                                <Chip label="AI Suggested" color="primary" size="small" />
                              )}
                            </Box>
                          }
                          sx={{ width: '100%', m: 0 }}
                        />
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </RadioGroup>

            <Box textAlign="center" mt={2}>
              <Button
                variant="text"
                size="small"
                onClick={() => {
                  setShowAllTemplates(false);
                  setSelectedTemplateId(suggestedTemplate?.template.id || '');
                }}
              >
                Back to AI Suggestion
              </Button>
            </Box>
          </>
        )}

        {/* No templates available */}
        {modalityTemplates.length === 0 && (
          <Alert severity="warning">
            No templates available for modality: {modality}
            <br />
            You can create a basic report without a template.
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onCancel} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={!selectedTemplate}
          startIcon={<CheckIcon />}
        >
          Use This Template
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TemplateConfirmationDialog;
