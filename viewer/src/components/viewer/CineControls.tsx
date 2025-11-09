// Enhanced Cine Mode Controls
import React from 'react'
import {
  Box,
  IconButton,
  Slider,
  Typography,
  Tooltip,
  Chip
} from '@mui/material'
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  SkipPrevious as PrevIcon,
  SkipNext as NextIcon,
  FirstPage as FirstIcon,
  LastPage as LastIcon,
  Repeat as LoopIcon,
  RepeatOne as OnceIcon
} from '@mui/icons-material'

interface CineControlsProps {
  isPlaying: boolean
  currentFrame: number
  totalFrames: number
  fps: number
  loop: boolean
  onPlayPause: () => void
  onStop: () => void
  onPrevFrame: () => void
  onNextFrame: () => void
  onFirstFrame: () => void
  onLastFrame: () => void
  onFpsChange: (fps: number) => void
  onLoopToggle: () => void
  onFrameChange: (frame: number) => void
}

export const CineControls: React.FC<CineControlsProps> = ({
  isPlaying,
  currentFrame,
  totalFrames,
  fps,
  loop,
  onPlayPause,
  onStop,
  onPrevFrame,
  onNextFrame,
  onFirstFrame,
  onLastFrame,
  onFpsChange,
  onLoopToggle,
  onFrameChange
}) => {
  const fpsMarks = [
    { value: 1, label: '1' },
    { value: 15, label: '15' },
    { value: 30, label: '30' },
    { value: 60, label: '60' }
  ]

  return (
    <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
      {/* Playback Controls */}
      <Box display="flex" alignItems="center" justifyContent="center" gap={1} mb={2}>
        <Tooltip title="First Frame">
          <IconButton size="small" onClick={onFirstFrame}>
            <FirstIcon />
          </IconButton>
        </Tooltip>
        
        <Tooltip title="Previous Frame">
          <IconButton size="small" onClick={onPrevFrame}>
            <PrevIcon />
          </IconButton>
        </Tooltip>
        
        <Tooltip title={isPlaying ? 'Pause' : 'Play'}>
          <IconButton 
            size="large" 
            onClick={onPlayPause}
            color="primary"
            sx={{ 
              bgcolor: isPlaying ? 'primary.main' : 'transparent',
              color: isPlaying ? 'white' : 'primary.main',
              '&:hover': {
                bgcolor: isPlaying ? 'primary.dark' : 'action.hover'
              }
            }}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </IconButton>
        </Tooltip>
        
        <Tooltip title="Stop">
          <IconButton size="small" onClick={onStop}>
            <StopIcon />
          </IconButton>
        </Tooltip>
        
        <Tooltip title="Next Frame">
          <IconButton size="small" onClick={onNextFrame}>
            <NextIcon />
          </IconButton>
        </Tooltip>
        
        <Tooltip title="Last Frame">
          <IconButton size="small" onClick={onLastFrame}>
            <LastIcon />
          </IconButton>
        </Tooltip>
        
        <Tooltip title={loop ? 'Loop On' : 'Loop Off'}>
          <IconButton 
            size="small" 
            onClick={onLoopToggle}
            color={loop ? 'primary' : 'default'}
          >
            {loop ? <LoopIcon /> : <OnceIcon />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Frame Counter */}
      <Box display="flex" justifyContent="center" alignItems="center" gap={2} mb={2}>
        <Chip 
          label={`Frame: ${currentFrame + 1} / ${totalFrames}`}
          color="primary"
          variant="outlined"
          size="small"
        />
        <Chip 
          label={`${fps} FPS`}
          color="secondary"
          variant="outlined"
          size="small"
        />
      </Box>

      {/* Frame Slider */}
      <Box px={2} mb={2}>
        <Slider
          value={currentFrame}
          min={0}
          max={totalFrames - 1}
          onChange={(_, value) => onFrameChange(value as number)}
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => `Frame ${value + 1}`}
          sx={{ width: '100%' }}
        />
      </Box>

      {/* FPS Control */}
      <Box px={2}>
        <Typography variant="caption" color="text.secondary" gutterBottom>
          Playback Speed (FPS)
        </Typography>
        <Slider
          value={fps}
          min={1}
          max={60}
          marks={fpsMarks}
          onChange={(_, value) => onFpsChange(value as number)}
          valueLabelDisplay="auto"
          sx={{ width: '100%' }}
        />
      </Box>
    </Box>
  )
}

export default CineControls
