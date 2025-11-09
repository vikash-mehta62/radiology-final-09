/**
 * Voice Dictation Panel
 * Voice-to-text for hands-free reporting
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Chip,
  Alert
} from '@mui/material';
import {
  Mic as MicIcon,
  Stop as StopIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon
} from '@mui/icons-material';
import { useReporting } from '../../../contexts/ReportingContext';

const VoiceDictationPanel: React.FC = () => {
  const { state, actions } = useReporting();
  const [isListening, setIsListening] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [targetField, setTargetField] = useState<string>('findingsText');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  
  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';
      
      recognitionRef.current.onresult = (event: any) => {
        let interim = '';
        let final = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript + ' ';
          } else {
            interim += transcript;
          }
        }
        
        if (final) {
          setTranscript(prev => prev + final);
          setInterimTranscript('');
          
          // Update the target field
          const currentValue = state[targetField as keyof typeof state] as string || '';
          actions.updateField(targetField as any, currentValue + final);
        } else {
          setInterimTranscript(interim);
        }
      };
      
      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setError(`Error: ${event.error}`);
        setIsListening(false);
      };
      
      recognitionRef.current.onend = () => {
        if (isListening && !isPaused) {
          // Restart if still supposed to be listening
          recognitionRef.current.start();
        }
      };
    } else {
      setError('Speech recognition is not supported in this browser');
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);
  
  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setError(null);
      setTranscript('');
      setInterimTranscript('');
      recognitionRef.current.start();
      setIsListening(true);
      setIsPaused(false);
    }
  };
  
  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setIsPaused(false);
      setInterimTranscript('');
    }
  };
  
  const pauseListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsPaused(true);
    }
  };
  
  const resumeListening = () => {
    if (recognitionRef.current && isPaused) {
      recognitionRef.current.start();
      setIsPaused(false);
    }
  };
  
  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
        Voice Dictation
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {/* Target Field Selector */}
      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel>Dictate to Field</InputLabel>
        <Select
          value={targetField}
          label="Dictate to Field"
          onChange={(e) => setTargetField(e.target.value)}
          disabled={isListening}
        >
          <MenuItem value="clinicalHistory">Clinical History</MenuItem>
          <MenuItem value="technique">Technique</MenuItem>
          <MenuItem value="findingsText">Findings</MenuItem>
          <MenuItem value="impression">Impression</MenuItem>
          <MenuItem value="recommendations">Recommendations</MenuItem>
        </Select>
      </FormControl>
      
      {/* Status */}
      <Paper elevation={1} sx={{ p: 2, mb: 2, bgcolor: isListening ? 'success.light' : 'background.default' }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="body2">
            Status: {isListening ? (isPaused ? 'Paused' : 'Listening...') : 'Stopped'}
          </Typography>
          {isListening && (
            <Chip 
              label="LIVE" 
              color="error" 
              size="small"
              sx={{ animation: 'pulse 1.5s infinite' }}
            />
          )}
        </Box>
      </Paper>
      
      {/* Controls */}
      <Box display="flex" gap={1} justifyContent="center" mb={2}>
        {!isListening ? (
          <Button
            variant="contained"
            color="primary"
            startIcon={<MicIcon />}
            onClick={startListening}
            size="large"
          >
            Start Dictation
          </Button>
        ) : (
          <>
            {!isPaused ? (
              <IconButton
                color="warning"
                onClick={pauseListening}
                size="large"
              >
                <PauseIcon />
              </IconButton>
            ) : (
              <IconButton
                color="success"
                onClick={resumeListening}
                size="large"
              >
                <PlayIcon />
              </IconButton>
            )}
            
            <IconButton
              color="error"
              onClick={stopListening}
              size="large"
            >
              <StopIcon />
            </IconButton>
          </>
        )}
      </Box>
      
      {/* Live Transcript */}
      {(transcript || interimTranscript) && (
        <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
            Live Transcript
          </Typography>
          <Typography variant="body2">
            {transcript}
            <span style={{ color: '#999', fontStyle: 'italic' }}>
              {interimTranscript}
            </span>
          </Typography>
        </Paper>
      )}
      
      {/* Tips */}
      <Paper elevation={1} sx={{ p: 2, bgcolor: 'info.light' }}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
          💡 Tips
        </Typography>
        <Typography variant="caption" component="div">
          • Speak clearly and at a normal pace
        </Typography>
        <Typography variant="caption" component="div">
          • Use "period" for punctuation
        </Typography>
        <Typography variant="caption" component="div">
          • Say "new line" for line breaks
        </Typography>
        <Typography variant="caption" component="div">
          • Pause briefly between sentences
        </Typography>
      </Paper>
      
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </Box>
  );
};

export default VoiceDictationPanel;
