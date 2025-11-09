import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  IconButton,
  Slider,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  SkipNext,
  SkipPrevious,
  Repeat,
  RepeatOne,
  Speed
} from '@mui/icons-material';

interface EnhancedCineControlsProps {
  currentFrame: number;
  totalFrames: number;
  isPlaying: boolean;
  fps: number;
  onFrameChange: (frame: number) => void;
  onPlayPause: () => void;
  onFpsChange: (fps: number) => void;
}

const EnhancedCineControls: React.FC<EnhancedCineControlsProps> = ({
  currentFrame,
  totalFrames,
  isPlaying,
  fps,
  onFrameChange,
  onPlayPause,
  onFpsChange
}) => {
  const [loopMode, setLoopMode] = useState<'loop' | 'once' | 'bounce'>('loop');
  const [direction, setDirection] = useState<1 | -1>(1);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-play with configurable FPS
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        onFrameChange((prev) => {
          if (loopMode === 'loop') {
            return (prev + direction + totalFrames) % totalFrames;
          } else if (loopMode === 'once') {
            const next = prev + direction;
            if (next >= totalFrames || next < 0) {
              onPlayPause(); // Stop at end
              return prev;
            }
            return next;
          } else { // bounce
            const next = prev + direction;
            if (next >= totalFrames || next < 0) {
              setDirection(d => -d as 1 | -1);
              return prev + (-direction);
            }
            return next;
          }
        });
      }, 1000 / fps);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, fps, totalFrames, loopMode, direction, onFrameChange, onPlayPause]);

  const handlePrevFrame = () => {
    onFrameChange(Math.max(0, currentFrame - 1));
  };

  const handleNextFrame = () => {
    onFrameChange(Math.min(totalFrames - 1, currentFrame + 1));
  };

  const fpsPresets = [1, 5, 10, 15, 24, 30, 60];

  return (
    <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
      {/* Playback Controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Tooltip title="Previous Frame">
          <IconButton onClick={handlePrevFrame} size="small">
            <SkipPrevious />
          </IconButton>
        </Tooltip>

        <Tooltip title={isPlaying ? 'Pause' : 'Play'}>
          <IconButton onClick={onPlayPause} color="primary">
            {isPlaying ? <Pause /> : <PlayArrow />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Next Frame">
          <IconButton onClick={handleNextFrame} size="small">
            <SkipNext />
          </IconButton>
        </Tooltip>

        <Box sx={{ flex: 1, mx: 2 }}>
          <Slider
            value={currentFrame}
            min={0}
            max={totalFrames - 1}
            onChange={(_, value) => onFrameChange(value as number)}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `Frame ${value + 1}/${totalFrames}`}
          />
        </Box>

        <Typography variant="body2" sx={{ minWidth: 80, textAlign: 'right' }}>
          {currentFrame + 1} / {totalFrames}
        </Typography>
      </Box>

      {/* Loop Mode */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Typography variant="caption">Loop Mode:</Typography>
        <ToggleButtonGroup
          value={loopMode}
          exclusive
          onChange={(_, value) => value && setLoopMode(value)}
          size="small"
        >
          <ToggleButton value="loop">
            <Tooltip title="Continuous Loop">
              <Repeat fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="once">
            <Tooltip title="Play Once">
              <RepeatOne fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="bounce">
            <Tooltip title="Bounce Back">
              <Speed fontSize="small" />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* FPS Control */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="caption">Speed (FPS):</Typography>
        <ToggleButtonGroup
          value={fps}
          exclusive
          onChange={(_, value) => value && onFpsChange(value)}
          size="small"
        >
          {fpsPresets.map(preset => (
            <ToggleButton key={preset} value={preset}>
              {preset}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Typography variant="caption" sx={{ ml: 'auto' }}>
          {fps} FPS
        </Typography>
      </Box>
    </Box>
  );
};

export default EnhancedCineControls;
