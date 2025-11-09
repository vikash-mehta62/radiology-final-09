import React, { useRef, useEffect, useState } from 'react'
import { Box, Paper, Typography, Button, ButtonGroup, Slider, Chip, Alert, CircularProgress } from '@mui/material'
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Refresh as ResetIcon,
  Tune as TuneIcon,
  ViewInAr as View3DIcon,
} from '@mui/icons-material'
import { useVolumeRenderer } from '../../hooks/useVolumeRenderer'
import { TRANSFER_FUNCTIONS } from '../../utils/volumeRenderer'

interface VolumeViewer3DProps {
  studyInstanceUID: string
  frameUrls: string[]
  totalFrames: number
}

export const VolumeViewer3D: React.FC<VolumeViewer3DProps> = ({
  studyInstanceUID,
  frameUrls,
  totalFrames,
}) => {
  const canvas3DRef = useRef<HTMLCanvasElement>(null)
  const container3DRef = useRef<HTMLDivElement>(null)
  const [is3DStarted, setIs3DStarted] = useState(false)
  const [renderMode, setRenderMode] = useState<'mip' | 'volume' | 'isosurface'>('volume')
  const [opacity, setOpacity] = useState(1.0)
  const [preset, setPreset] = useState<keyof typeof TRANSFER_FUNCTIONS>('CT-Bone')

  const volumeRenderer = useVolumeRenderer({
    frameUrls,
    canvasRef: canvas3DRef,
    containerRef: container3DRef,
    enabled: is3DStarted,
    useProgressiveLoading: totalFrames > 100,
  })

  const handleStart3D = () => {
    setIs3DStarted(true)
  }

  const presets = Object.keys(TRANSFER_FUNCTIONS) as Array<keyof typeof TRANSFER_FUNCTIONS>

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#000' }}>
      {/* 3D Controls Bar */}
      <Paper sx={{ p: 2, borderRadius: 0, bgcolor: 'grey.900' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          {/* Renderer Info */}
          <Chip
            label={volumeRenderer.rendererType === 'vtk' ? '🚀 VTK.js (GPU)' : '🎨 Canvas (CPU)'}
            color={volumeRenderer.rendererType === 'vtk' ? 'success' : 'warning'}
            size="small"
          />

          {/* Render Mode */}
          <ButtonGroup size="small" variant="outlined">
            <Button
              variant={renderMode === 'mip' ? 'contained' : 'outlined'}
              onClick={() => {
                setRenderMode('mip')
                volumeRenderer.setRenderMode('mip')
              }}
            >
              MIP
            </Button>
            <Button
              variant={renderMode === 'volume' ? 'contained' : 'outlined'}
              onClick={() => {
                setRenderMode('volume')
                volumeRenderer.setRenderMode('volume')
              }}
            >
              Volume
            </Button>
            <Button
              variant={renderMode === 'isosurface' ? 'contained' : 'outlined'}
              onClick={() => {
                setRenderMode('isosurface')
                volumeRenderer.setRenderMode('isosurface')
              }}
            >
              Isosurface
            </Button>
          </ButtonGroup>

          {/* Transfer Function Presets */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TuneIcon sx={{ color: 'grey.400' }} />
            <ButtonGroup size="small" variant="outlined">
              {presets.map((p) => (
                <Button
                  key={p}
                  variant={preset === p ? 'contained' : 'outlined'}
                  onClick={() => {
                    setPreset(p)
                    volumeRenderer.setPreset(p)
                  }}
                  sx={{ fontSize: '0.75rem' }}
                >
                  {p.replace('CT-', '')}
                </Button>
              ))}
            </ButtonGroup>
          </Box>

          {/* Opacity Control */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 150 }}>
            <Typography variant="caption" color="grey.400">
              Opacity:
            </Typography>
            <Slider
              value={opacity}
              onChange={(_, value) => {
                setOpacity(value as number)
                volumeRenderer.setOpacity(value as number)
              }}
              min={0}
              max={1}
              step={0.1}
              size="small"
              sx={{ flex: 1 }}
            />
          </Box>

          {/* Auto-rotation */}
          <Button
            size="small"
            variant={volumeRenderer.isRotating ? 'contained' : 'outlined'}
            onClick={() => {
              if (volumeRenderer.isRotating) {
                volumeRenderer.stopAutoRotation()
              } else {
                volumeRenderer.startAutoRotation()
              }
            }}
            startIcon={volumeRenderer.isRotating ? <PauseIcon /> : <PlayIcon />}
          >
            {volumeRenderer.isRotating ? 'Stop' : 'Rotate'}
          </Button>

          {/* Reset Camera */}
          <Button
            size="small"
            variant="outlined"
            onClick={volumeRenderer.resetCamera}
            startIcon={<ResetIcon />}
          >
            Reset
          </Button>

          {/* Performance Metrics */}
          {volumeRenderer.rendererType === 'vtk' && (
            <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
              <Chip label={`${volumeRenderer.fps.toFixed(0)} FPS`} size="small" color="info" />
              <Chip label={`${volumeRenderer.renderTime.toFixed(0)}ms`} size="small" />
              {volumeRenderer.gpuMemoryMB > 0 && (
                <Chip label={`${volumeRenderer.gpuMemoryMB.toFixed(0)}MB GPU`} size="small" />
              )}
            </Box>
          )}
        </Box>

        {/* Loading Progress */}
        {volumeRenderer.isLoading && (
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="grey.400">
                Loading volume... {volumeRenderer.loadProgress.toFixed(0)}%
              </Typography>
              {volumeRenderer.loadingStage && (
                <Chip label={`${volumeRenderer.loadingStage} quality`} size="small" />
              )}
            </Box>
          </Box>
        )}

        {/* Performance Warning */}
        {volumeRenderer.performanceWarning && (
          <Alert
            severity="warning"
            sx={{ mt: 2 }}
            onClose={volumeRenderer.clearPerformanceWarning}
          >
            {volumeRenderer.performanceWarning.message}
          </Alert>
        )}
      </Paper>

      {/* 3D Viewport */}
      <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {!is3DStarted ? (
          // Start Screen
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(0,0,0,0.8)',
              zIndex: 10,
            }}
          >
            <View3DIcon sx={{ fontSize: 64, mb: 2, color: 'primary.main' }} />
            <Typography variant="h5" gutterBottom color="white">
              3D Volume Rendering
            </Typography>
            <Typography variant="body2" color="grey.400" sx={{ mb: 3, maxWidth: 400, textAlign: 'center' }}>
              {volumeRenderer.rendererType === 'vtk'
                ? `Hardware-accelerated 3D rendering with VTK.js. ${totalFrames} frames will be loaded.`
                : `Software-based 3D rendering. ${totalFrames} frames will be loaded.`}
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={handleStart3D}
              startIcon={<View3DIcon />}
            >
              Start 3D Rendering
            </Button>
          </Box>
        ) : null}

        {/* VTK.js Container (for WebGL rendering) */}
        <div
          ref={container3DRef}
          style={{
            width: '100%',
            height: '100%',
            display: volumeRenderer.rendererType === 'vtk' ? 'block' : 'none',
          }}
        />

        {/* Canvas Fallback (for software rendering) */}
        <canvas
          ref={canvas3DRef}
          style={{
            width: '100%',
            height: '100%',
            display: volumeRenderer.rendererType === 'canvas' ? 'block' : 'none',
            cursor: 'grab',
          }}
          onMouseDown={volumeRenderer.handleMouseDown}
          onMouseMove={volumeRenderer.handleMouseMove}
          onMouseUp={volumeRenderer.handleMouseUp}
        />

        {/* Instructions Overlay */}
        {is3DStarted && !volumeRenderer.isLoading && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              bgcolor: 'rgba(0,0,0,0.7)',
              p: 2,
              borderRadius: 1,
            }}
          >
            <Typography variant="caption" color="grey.300">
              💡 Click and drag to rotate • Scroll to zoom
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}
