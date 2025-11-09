/**
 * AI Analysis Control Panel
 * Phase 1: Manual control + Phase 2: Batch processing UI
 */

import React, { useState, useEffect } from 'react'
import {
  Box,
  Paper,
  Typography,
  Button,
  ButtonGroup,
  FormControlLabel,
  Switch,
  Slider,
  LinearProgress,
  Chip,
  Divider,
  IconButton,
  Tooltip,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import InfoIcon from '@mui/icons-material/Info'
import {
  Psychology as AIIcon,
  PlayArrow as StartIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Refresh as RetryIcon,
  Delete as ClearIcon,
  Settings as SettingsIcon,
  CheckCircle as CompleteIcon,
  Error as ErrorIcon,
  HourglassEmpty as QueuedIcon,
  Close as CloseIcon,
} from '@mui/icons-material'
import { aiAnalysisQueue, QueueStats } from '../../services/AIAnalysisQueue'
import { autoAnalysisService } from '../../services/AutoAnalysisService'

interface AIAnalysisControlProps {
  studyInstanceUID: string
  seriesInstanceUID?: string
  currentFrameIndex: number
  totalFrames: number
  onClose?: () => void
}

export const AIAnalysisControl: React.FC<AIAnalysisControlProps> = ({
  studyInstanceUID,
  seriesInstanceUID,
  currentFrameIndex,
  totalFrames,
  onClose
}) => {
  // Mode selection
  const [analysisMode, setAnalysisMode] = useState<'manual' | 'batch' | 'auto'>('manual')
  
  // Batch options
  const [batchMode, setBatchMode] = useState<'current-series' | 'smart-sample' | 'all-slices'>('current-series')
  const [smartSampleInterval, setSmartSampleInterval] = useState(10)
  const [enableSmartDetail, setEnableSmartDetail] = useState(true)
  
  // Queue stats
  const [queueStats, setQueueStats] = useState<QueueStats>({
    total: 0,
    queued: 0,
    processing: 0,
    complete: 0,
    failed: 0,
    progress: 0
  })

  // Settings dialog
  const [showSettings, setShowSettings] = useState(false)
  
  // Status
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  // Subscribe to queue updates
  useEffect(() => {
    const unsubscribe = aiAnalysisQueue.subscribe((stats) => {
      setQueueStats(stats)
      setIsAnalyzing(stats.processing > 0 || stats.queued > 0)
    })

    return unsubscribe
  }, [])

  /**
   * Phase 1: Analyze current slice (manual)
   */
  const handleAnalyzeCurrent = async () => {
    setStatusMessage('Analyzing current slice...')
    setIsAnalyzing(true)

    try {
      await autoAnalysisService.autoAnalyze({
        studyInstanceUID,
        seriesInstanceUID,
        slices: [currentFrameIndex],
        mode: 'single'
      })

      setStatusMessage('✅ Analysis complete! Check Analysis Panel for results.')
      
      // Notify parent to open Analysis Panel
      if (onClose) {
        // Close this panel and let parent open Analysis Panel
        setTimeout(() => {
          onClose()
          // Trigger a custom event to open Analysis Panel
          window.dispatchEvent(new CustomEvent('openAnalysisPanel'))
        }, 1000)
      }
      
      setTimeout(() => setStatusMessage(''), 5000)
    } catch (error) {
      console.error('Analysis failed:', error)
      setStatusMessage('❌ Analysis failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
      setTimeout(() => setStatusMessage(''), 5000)
    } finally {
      setIsAnalyzing(false)
    }
  }

  /**
   * Phase 2: Start batch analysis
   */
  const handleStartBatch = () => {
    let slicesToAnalyze: number[] = []

    switch (batchMode) {
      case 'current-series':
        // Analyze all slices in current series
        slicesToAnalyze = Array.from({ length: totalFrames }, (_, i) => i)
        break

      case 'smart-sample':
        // Smart sampling: every Nth slice
        slicesToAnalyze = Array.from(
          { length: Math.ceil(totalFrames / smartSampleInterval) },
          (_, i) => i * smartSampleInterval
        ).filter(i => i < totalFrames)
        break

      case 'all-slices':
        // All slices (same as current-series for now)
        slicesToAnalyze = Array.from({ length: totalFrames }, (_, i) => i)
        break
    }

    // Add to queue
    const jobIds = aiAnalysisQueue.addBatch(
      slicesToAnalyze,
      studyInstanceUID,
      seriesInstanceUID,
      'normal'
    )

    setStatusMessage(`📋 Queued ${jobIds.length} slices for analysis`)
    setTimeout(() => setStatusMessage(''), 3000)
  }

  /**
   * Pause/Resume queue
   */
  const handlePauseResume = () => {
    // TODO: Implement pause/resume in queue
    console.log('Pause/Resume not yet implemented')
  }

  /**
   * Cancel all queued jobs
   */
  const handleCancelAll = () => {
    aiAnalysisQueue.cancelAll()
    setStatusMessage('🚫 Cancelled all queued jobs')
    setTimeout(() => setStatusMessage(''), 3000)
  }

  /**
   * Retry failed jobs
   */
  const handleRetryFailed = () => {
    aiAnalysisQueue.retryFailed()
    setStatusMessage('🔄 Retrying failed jobs')
    setTimeout(() => setStatusMessage(''), 3000)
  }

  /**
   * Clear completed jobs
   */
  const handleClearCompleted = () => {
    aiAnalysisQueue.clearCompleted()
    setStatusMessage('🗑️ Cleared completed jobs')
    setTimeout(() => setStatusMessage(''), 3000)
  }

  return (
    <Paper elevation={3} sx={{ p: 2, maxWidth: 500 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AIIcon color="primary" />
          <Typography variant="h6">AI Analysis Control</Typography>
        </Box>
        {onClose && (
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        )}
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Mode Selection */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Analysis Mode
        </Typography>
        <ButtonGroup fullWidth variant="outlined" size="small">
          <Button
            variant={analysisMode === 'manual' ? 'contained' : 'outlined'}
            onClick={() => setAnalysisMode('manual')}
          >
            Manual
          </Button>
          <Button
            variant={analysisMode === 'batch' ? 'contained' : 'outlined'}
            onClick={() => setAnalysisMode('batch')}
          >
            Batch
          </Button>
          <Button
            variant={analysisMode === 'auto' ? 'contained' : 'outlined'}
            onClick={() => setAnalysisMode('auto')}
            disabled
          >
            Auto (Soon)
          </Button>
        </ButtonGroup>
      </Box>

      {/* Phase 1: Manual Mode */}
      {analysisMode === 'manual' && (
        <Box sx={{ mb: 3 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Analyze the current slice only. 100% reliable.
          </Alert>
          
          <Button
            fullWidth
            variant="contained"
            startIcon={<AIIcon />}
            onClick={handleAnalyzeCurrent}
            disabled={isAnalyzing}
            size="large"
          >
            Analyze Current Slice ({currentFrameIndex + 1}/{totalFrames})
          </Button>
        </Box>
      )}

      {/* Phase 2: Batch Mode */}
      {analysisMode === 'batch' && (
        <Box sx={{ mb: 3 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Process multiple slices with smart queue management.
          </Alert>

          {/* Batch Options */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Batch Options
            </Typography>
            
            <FormControlLabel
              control={
                <Switch
                  checked={batchMode === 'smart-sample'}
                  onChange={(e) => setBatchMode(e.target.checked ? 'smart-sample' : 'current-series')}
                />
              }
              label="Smart Sampling (faster)"
            />

            {batchMode === 'smart-sample' && (
              <Box sx={{ mt: 2, px: 2 }}>
                <Typography variant="caption" gutterBottom>
                  Sample Interval: Every {smartSampleInterval} slices
                </Typography>
                <Slider
                  value={smartSampleInterval}
                  onChange={(_, value) => setSmartSampleInterval(value as number)}
                  min={5}
                  max={20}
                  step={5}
                  marks
                  valueLabelDisplay="auto"
                />
                <Typography variant="caption" color="text.secondary">
                  Will analyze ~{Math.ceil(totalFrames / smartSampleInterval)} slices
                </Typography>
              </Box>
            )}

            <FormControlLabel
              control={
                <Switch
                  checked={enableSmartDetail}
                  onChange={(e) => setEnableSmartDetail(e.target.checked)}
                />
              }
              label="Auto-detail around findings"
            />
          </Box>

          {/* Start Batch Button */}
          <Button
            fullWidth
            variant="contained"
            color="primary"
            startIcon={<StartIcon />}
            onClick={handleStartBatch}
            disabled={isAnalyzing}
            size="large"
          >
            Start Batch Analysis
          </Button>
        </Box>
      )}

      {/* Phase 3: Auto Mode (Coming Soon) */}
      {analysisMode === 'auto' && (
        <Box sx={{ mb: 3 }}>
          <Alert severity="warning">
            Auto-analysis mode coming in Phase 3. This will enable automatic analysis on study open with smart triggers.
          </Alert>
        </Box>
      )}

      {/* Queue Status */}
      {queueStats.total > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2">
                Queue Progress
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {queueStats.complete}/{queueStats.total} complete
              </Typography>
            </Box>
            
            <LinearProgress
              variant="determinate"
              value={queueStats.progress}
              sx={{ height: 8, borderRadius: 4 }}
            />

            <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
              <Chip
                icon={<QueuedIcon />}
                label={`${queueStats.queued} Queued`}
                size="small"
                color="default"
              />
              <Chip
                icon={<StartIcon />}
                label={`${queueStats.processing} Processing`}
                size="small"
                color="primary"
              />
              <Chip
                icon={<CompleteIcon />}
                label={`${queueStats.complete} Complete`}
                size="small"
                color="success"
              />
              {queueStats.failed > 0 && (
                <Chip
                  icon={<ErrorIcon />}
                  label={`${queueStats.failed} Failed`}
                  size="small"
                  color="error"
                />
              )}
            </Box>
          </Box>

          {/* Queue Controls */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Cancel All">
              <IconButton size="small" onClick={handleCancelAll} disabled={queueStats.queued === 0}>
                <StopIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Retry Failed">
              <IconButton size="small" onClick={handleRetryFailed} disabled={queueStats.failed === 0}>
                <RetryIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Clear Completed">
              <IconButton size="small" onClick={handleClearCompleted} disabled={queueStats.complete === 0}>
                <ClearIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Settings">
              <IconButton size="small" onClick={() => setShowSettings(true)}>
                <SettingsIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </>
      )}

      {/* Status Message */}
      {statusMessage && (
        <Alert 
          severity={statusMessage.includes('✅') ? 'success' : statusMessage.includes('❌') ? 'error' : 'info'} 
          sx={{ mt: 2 }}
        >
          {statusMessage}
        </Alert>
      )}

      {/* Help Text */}
      {!statusMessage && analysisMode === 'manual' && (
        <Alert severity="info" icon={<InfoIcon />} sx={{ mt: 2 }}>
          <Typography variant="caption">
            💡 <strong>Tip:</strong> After analysis completes, results will appear in the <strong>Analysis Panel</strong> on the right side of the screen.
          </Typography>
        </Alert>
      )}

      {/* Settings Dialog */}
      <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Queue Settings</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle2" gutterBottom>
            Rate Limiting
          </Typography>
          <Typography variant="caption" color="text.secondary" paragraph>
            Configure how fast the queue processes jobs to avoid overwhelming the AI service.
          </Typography>
          
          <Alert severity="info">
            Advanced settings coming soon. Current defaults:
            <ul>
              <li>Max concurrent: 3 jobs</li>
              <li>Delay between: 2 seconds</li>
              <li>Max per minute: 15 jobs</li>
            </ul>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}

export default AIAnalysisControl
