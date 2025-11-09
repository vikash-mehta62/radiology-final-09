/**
 * AI Assistant Panel
 * AI-powered suggestions and auto-population
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  AutoAwesome as AIIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';
import { useReporting } from '../../../contexts/ReportingContext';

interface AISuggestion {
  id: string;
  type: 'finding' | 'impression' | 'recommendation';
  content: string;
  confidence: number;
  applied: boolean;
}

const AIAssistantPanel: React.FC = () => {
  const { state, actions } = useReporting();
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Load AI analysis if available
  useEffect(() => {
    if (state.analysisId) {
      loadAIAnalysis();
    }
  }, [state.analysisId]);
  
  const loadAIAnalysis = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
      const response = await fetch(`/api/ai-analysis/${state.analysisId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load AI analysis');
      }
      
      const data = await response.json();
      
      // Convert AI detections to suggestions
      const aiSuggestions: AISuggestion[] = [];
      
      if (data.detections) {
        data.detections.forEach((detection: any, index: number) => {
          aiSuggestions.push({
            id: `ai-${index}`,
            type: 'finding',
            content: `${detection.type}: ${detection.description} (Confidence: ${(detection.confidence * 100).toFixed(0)}%)`,
            confidence: detection.confidence,
            applied: false
          });
        });
      }
      
      if (data.impression) {
        aiSuggestions.push({
          id: 'ai-impression',
          type: 'impression',
          content: data.impression,
          confidence: 0.9,
          applied: false
        });
      }
      
      setSuggestions(aiSuggestions);
    } catch (err: any) {
      console.error('Failed to load AI analysis:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const applySuggestion = (suggestion: AISuggestion) => {
    switch (suggestion.type) {
      case 'finding':
        // Add as structured finding
        const finding = {
          id: `finding-${Date.now()}`,
          location: 'AI Detected',
          description: suggestion.content,
          severity: 'normal' as const,
          aiDetected: true
        };
        actions.addFinding(finding);
        break;
        
      case 'impression':
        // Append to impression
        const currentImpression = state.impression;
        actions.updateField('impression', 
          currentImpression ? `${currentImpression}\n\n${suggestion.content}` : suggestion.content
        );
        break;
        
      case 'recommendation':
        // Append to recommendations
        const currentRecs = state.recommendations;
        actions.updateField('recommendations',
          currentRecs ? `${currentRecs}\n\n${suggestion.content}` : suggestion.content
        );
        break;
    }
    
    // Mark as applied
    setSuggestions(suggestions.map(s => 
      s.id === suggestion.id ? { ...s, applied: true } : s
    ));
  };
  
  const applyAllSuggestions = () => {
    suggestions.filter(s => !s.applied).forEach(suggestion => {
      applySuggestion(suggestion);
    });
  };
  
  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
        AI Assistant
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {/* AI Status */}
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <AIIcon color="primary" />
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
            AI Analysis Status
          </Typography>
        </Box>
        
        {state.analysisId ? (
          <Box>
            <Chip label="AI Available" color="success" size="small" />
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              Analysis ID: {state.analysisId.slice(0, 20)}...
            </Typography>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No AI analysis available for this study
          </Typography>
        )}
      </Paper>
      
      {/* Actions */}
      {state.analysisId && (
        <Box display="flex" gap={1} mb={2}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadAIAnalysis}
            disabled={loading}
            size="small"
            fullWidth
          >
            Refresh AI
          </Button>
          
          {suggestions.length > 0 && (
            <Button
              variant="contained"
              startIcon={<CheckIcon />}
              onClick={applyAllSuggestions}
              disabled={suggestions.every(s => s.applied)}
              size="small"
              fullWidth
            >
              Apply All
            </Button>
          )}
        </Box>
      )}
      
      {/* Loading */}
      {loading && (
        <Box display="flex" justifyContent="center" p={3}>
          <CircularProgress />
        </Box>
      )}
      
      {/* Suggestions List */}
      {!loading && suggestions.length > 0 && (
        <>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
            AI Suggestions ({suggestions.filter(s => !s.applied).length} pending)
          </Typography>
          
          <List dense>
            {suggestions.map(suggestion => (
              <ListItem
                key={suggestion.id}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1,
                  bgcolor: suggestion.applied ? 'action.selected' : 'background.default',
                  opacity: suggestion.applied ? 0.6 : 1
                }}
              >
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Chip 
                        label={suggestion.type} 
                        size="small" 
                        color="primary"
                        variant="outlined"
                      />
                      {suggestion.applied && (
                        <Chip label="Applied" size="small" color="success" />
                      )}
                    </Box>
                  }
                  secondary={suggestion.content}
                />
                <ListItemSecondaryAction>
                  {!suggestion.applied && (
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => applySuggestion(suggestion)}
                    >
                      <AddIcon />
                    </IconButton>
                  )}
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </>
      )}
      
      {/* No Suggestions */}
      {!loading && suggestions.length === 0 && state.analysisId && (
        <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No AI suggestions available. Click "Refresh AI" to load.
          </Typography>
        </Paper>
      )}
      
      {/* Info */}
      <Paper elevation={1} sx={{ p: 2, mt: 2, bgcolor: 'info.light' }}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
          💡 About AI Assistant
        </Typography>
        <Typography variant="caption" component="div">
          • AI analyzes images and suggests findings
        </Typography>
        <Typography variant="caption" component="div">
          • Review all suggestions before applying
        </Typography>
        <Typography variant="caption" component="div">
          • AI is assistive, not diagnostic
        </Typography>
        <Typography variant="caption" component="div">
          • Final report is radiologist's responsibility
        </Typography>
      </Paper>
    </Box>
  );
};

export default AIAssistantPanel;
