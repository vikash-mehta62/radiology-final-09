/**
 * Advanced Voice-to-Text Dictation System
 * Medical terminology support with real-time transcription
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  IconButton,
  Chip,
  Alert,
  LinearProgress,
  Tooltip,
  Menu,
  MenuItem,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Mic as MicIcon,
  MicOff as MicOffIcon,
  Stop as StopIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Settings as SettingsIcon,
  VolumeUp as VolumeIcon,
  Clear as ClearIcon
} from '@mui/icons-material';

interface VoiceDictationProps {
  onTextUpdate: (text: string) => void;
  initialText?: string;
  placeholder?: string;
  medicalMode?: boolean;
}

interface RecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

// Medical terminology dictionary for better recognition
const MEDICAL_TERMS = [
  'pneumonia', 'atelectasis', 'consolidation', 'pleural effusion',
  'cardiomegaly', 'aortic', 'pulmonary', 'mediastinal',
  'thoracic', 'lumbar', 'cervical', 'vertebral',
  'fracture', 'dislocation', 'stenosis', 'sclerosis',
  'hypertrophy', 'atrophy', 'edema', 'hemorrhage',
  'ischemia', 'infarction', 'thrombosis', 'embolism'
];

const VoiceDictationAdvanced: React.FC<VoiceDictationProps> = ({
  onTextUpdate,
  initialText = '',
  placeholder = 'Click microphone to start dictation...',
  medicalMode = true
}) => {
  // State
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState(initialText);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(null);
  
  // Settings
  const [continuousMode, setContinuousMode] = useState(true);
  const [autoCapitalize, setAutoCapitalize] = useState(true);
  const [medicalTermsEnabled, setMedicalTermsEnabled] = useState(medicalMode);
  const [language, setLanguage] = useState('en-US');

  // Refs
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Initialize speech recognition
   */
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        setIsSupported(true);
        const recognition = new SpeechRecognition();
        
        // Configure recognition
        recognition.continuous = continuousMode;
        recognition.interimResults = true;
        recognition.lang = language;
        recognition.maxAlternatives = 3;
        
        // Event handlers
        recognition.onstart = () => {
          console.log('🎤 Voice recognition started');
          setIsListening(true);
          setError(null);
          setIsProcessing(true);
        };

        recognition.onresult = (event) => {
          let finalTranscript = '';
          let interimText = '';
          let maxConfidence = 0;

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const text = result[0].transcript;
            const conf = result[0].confidence || 0.8;

            if (result.isFinal) {
              finalTranscript += processText(text);
              maxConfidence = Math.max(maxConfidence, conf);
            } else {
              interimText += text;
            }
          }

          if (finalTranscript) {
            const newTranscript = transcript + finalTranscript;
            setTranscript(newTranscript);
            onTextUpdate(newTranscript);
            setConfidence(maxConfidence);
          }

          setInterimTranscript(interimText);
          setIsProcessing(false);
        };

        recognition.onerror = (event) => {
          console.error('🎤 Speech recognition error:', event.error);
          setError(`Recognition error: ${event.error}`);
          setIsListening(false);
          setIsProcessing(false);
        };

        recognition.onend = () => {
          console.log('🎤 Voice recognition ended');
          setIsListening(false);
          setIsProcessing(false);
          setInterimTranscript('');
          
          // Auto-restart in continuous mode
          if (continuousMode && !error) {
            timeoutRef.current = setTimeout(() => {
              startListening();
            }, 1000);
          }
        };

        recognitionRef.current = recognition;
      } else {
        setIsSupported(false);
        setError('Speech recognition not supported in this browser');
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [continuousMode, language, transcript, onTextUpdate, error]);

  /**
   * Process and enhance recognized text
   */
  const processText = useCallback((text: string): string => {
    let processed = text;

    // Auto-capitalize sentences
    if (autoCapitalize) {
      processed = processed.replace(/(^|\. )([a-z])/g, (match, p1, p2) => p1 + p2.toUpperCase());
    }

    // Medical terminology corrections
    if (medicalTermsEnabled) {
      MEDICAL_TERMS.forEach(term => {
        const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        processed = processed.replace(regex, term);
      });
    }

    // Add punctuation
    processed = processed.replace(/\s+/g, ' ').trim();
    if (processed && !processed.match(/[.!?]$/)) {
      processed += '. ';
    }

    return processed;
  }, [autoCapitalize, medicalTermsEnabled]);

  /**
   * Start listening
   */
  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Failed to start recognition:', error);
        setError('Failed to start voice recognition');
      }
    }
  }, [isListening]);

  /**
   * Stop listening
   */
  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  }, [isListening]);

  /**
   * Clear transcript
   */
  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    onTextUpdate('');
  }, [onTextUpdate]);

  /**
   * Handle settings menu
   */
  const handleSettingsClick = (event: React.MouseEvent<HTMLElement>) => {
    setSettingsAnchor(event.currentTarget);
  };

  const handleSettingsClose = () => {
    setSettingsAnchor(null);
  };

  if (!isSupported) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        Voice dictation is not supported in this browser. Please use Chrome, Edge, or Safari.
      </Alert>
    );
  }

  return (
    <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" display="flex" alignItems="center" gap={1}>
          <VolumeIcon color="primary" />
          Voice Dictation
          {medicalTermsEnabled && (
            <Chip label="Medical Mode" size="small" color="primary" />
          )}
        </Typography>
        
        <Box display="flex" alignItems="center" gap={1}>
          {confidence > 0 && (
            <Chip 
              label={`${Math.round(confidence * 100)}% confidence`}
              size="small"
              color={confidence > 0.8 ? 'success' : confidence > 0.6 ? 'warning' : 'error'}
            />
          )}
          
          <Tooltip title="Settings">
            <IconButton onClick={handleSettingsClick}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Controls */}
      <Box display="flex" alignItems="center" gap={2} mb={2}>
        <Tooltip title={isListening ? 'Stop Dictation' : 'Start Dictation'}>
          <Button
            variant={isListening ? 'contained' : 'outlined'}
            color={isListening ? 'error' : 'primary'}
            startIcon={isListening ? <StopIcon /> : <MicIcon />}
            onClick={isListening ? stopListening : startListening}
            disabled={isProcessing}
          >
            {isListening ? 'Stop' : 'Start'} Dictation
          </Button>
        </Tooltip>

        <Tooltip title="Clear Text">
          <IconButton onClick={clearTranscript} disabled={!transcript && !interimTranscript}>
            <ClearIcon />
          </IconButton>
        </Tooltip>

        {continuousMode && isListening && (
          <Chip 
            label="Continuous Mode" 
            size="small" 
            color="info"
            icon={<MicIcon />}
          />
        )}
      </Box>

      {/* Processing indicator */}
      {isProcessing && (
        <Box mb={2}>
          <LinearProgress />
          <Typography variant="caption" color="text.secondary" mt={1}>
            Processing speech...
          </Typography>
        </Box>
      )}

      {/* Error display */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Transcript display */}
      <Box
        sx={{
          minHeight: 100,
          p: 2,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'background.paper',
          fontFamily: 'monospace',
          fontSize: '0.9rem',
          lineHeight: 1.6
        }}
      >
        {transcript || interimTranscript ? (
          <>
            <span>{transcript}</span>
            {interimTranscript && (
              <span style={{ color: '#666', fontStyle: 'italic' }}>
                {interimTranscript}
              </span>
            )}
          </>
        ) : (
          <Typography variant="body2" color="text.secondary" fontStyle="italic">
            {placeholder}
          </Typography>
        )}
      </Box>

      {/* Settings Menu */}
      <Menu
        anchorEl={settingsAnchor}
        open={Boolean(settingsAnchor)}
        onClose={handleSettingsClose}
      >
        <MenuItem>
          <FormControlLabel
            control={
              <Switch
                checked={continuousMode}
                onChange={(e) => setContinuousMode(e.target.checked)}
              />
            }
            label="Continuous Mode"
          />
        </MenuItem>
        
        <MenuItem>
          <FormControlLabel
            control={
              <Switch
                checked={autoCapitalize}
                onChange={(e) => setAutoCapitalize(e.target.checked)}
              />
            }
            label="Auto Capitalize"
          />
        </MenuItem>
        
        <MenuItem>
          <FormControlLabel
            control={
              <Switch
                checked={medicalTermsEnabled}
                onChange={(e) => setMedicalTermsEnabled(e.target.checked)}
              />
            }
            label="Medical Terminology"
          />
        </MenuItem>
      </Menu>
    </Paper>
  );
};

export default VoiceDictationAdvanced;