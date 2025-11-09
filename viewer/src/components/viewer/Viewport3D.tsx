import React, { useEffect, useRef, useCallback } from 'react'
import { Box, CircularProgress, Typography, Alert } from '@mui/material'
import {
  TOOL_GROUP_IDS,
  VIEWPORT_TYPES,
} from '@/lib/cornerstone/config'

interface Viewport3DProps {
  /** Unique identifier for the viewport */
  viewportId: string
  /** Volume ID */
  volumeId: string
  /** Array of DICOM image IDs to create volume from */
  imageIds: string[]
  /** Viewport width */
  width?: number | string
  /** Viewport height */
  height?: number | string
  /** Loading state */
  isLoading?: boolean
  /** Error message */
  error?: string
  /** Volume rendering preset */
  preset?: 'CT-Bone' | 'CT-Chest' | 'CT-Abdomen' | 'MR-Default' | 'Custom'
  /** Custom volume rendering properties */
  volumeProperties?: {
    scalarOpacity?: number[][]
    colorTransfer?: number[][]
    gradientOpacity?: number[][]
  }
  /** Callback when viewport is ready */
  onViewportReady?: (viewport: any) => void
}

// Predefined volume rendering presets
const VOLUME_PRESETS = {
  'CT-Bone': {
    scalarOpacity: [
      [-3024, 0],
      [-16, 0],
      [641, 0.715686],
      [3071, 0.715686],
    ],
    colorTransfer: [
      [-3024, 0, 0, 0],
      [641, 1, 1, 1],
      [3071, 1, 1, 1],
    ],
    gradientOpacity: [
      [0, 1],
      [255, 1],
    ],
  },
  'CT-Chest': {
    scalarOpacity: [
      [-3024, 0],
      [-1000, 0],
      [-500, 0.1],
      [0, 0.2],
      [300, 0.3],
      [1500, 0.9],
      [3071, 0.9],
    ],
    colorTransfer: [
      [-3024, 0, 0, 0],
      [-1000, 0.3, 0.3, 1],
      [-500, 1, 0.5, 0.3],
      [0, 1, 0.5, 0.3],
      [300, 1, 1, 1],
      [1500, 1, 1, 1],
      [3071, 1, 1, 1],
    ],
    gradientOpacity: [
      [0, 1],
      [90, 0.5],
      [100, 1],
    ],
  },
  'CT-Abdomen': {
    scalarOpacity: [
      [-3024, 0],
      [-1000, 0],
      [-400, 0.1],
      [0, 0.2],
      [200, 0.4],
      [1000, 0.8],
      [3071, 0.8],
    ],
    colorTransfer: [
      [-3024, 0, 0, 0],
      [-1000, 0.3, 0.3, 1],
      [-400, 1, 0.5, 0.3],
      [0, 1, 0.5, 0.3],
      [200, 1, 1, 0.9],
      [1000, 1, 1, 1],
      [3071, 1, 1, 1],
    ],
    gradientOpacity: [
      [0, 1],
      [90, 0.5],
      [100, 1],
    ],
  },
  'MR-Default': {
    scalarOpacity: [
      [0, 0],
      [20, 0.1],
      [40, 0.2],
      [120, 0.4],
      [220, 0.8],
      [1024, 0.8],
    ],
    colorTransfer: [
      [0, 0, 0, 0],
      [20, 0.1, 0.1, 0.1],
      [40, 0.5, 0.5, 0.5],
      [120, 0.7, 0.7, 0.9],
      [220, 0.9, 0.9, 0.9],
      [1024, 1, 1, 1],
    ],
    gradientOpacity: [
      [0, 1],
      [90, 0.5],
      [100, 1],
    ],
  },
}

export const Viewport3D: React.FC<Viewport3DProps> = ({
  viewportId,
  volumeId,
  imageIds,
  width = '100%',
  height = '100%',
  isLoading = false,
  error,
  preset = 'CT-Bone',
  volumeProperties,
  onViewportReady,
}) => {
  const elementRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<any>(null)
  const isInitializedRef = useRef(false)

  // Initialize 3D viewport
  const initialize3DViewport = useCallback(async () => {
    if (!elementRef.current || !imageIds.length || isInitializedRef.current) {
      return
    }

    try {
      // Dynamically import utils to avoid early bundle evaluation
      const utils = await import('@/lib/cornerstone/utils')
      const { addTools, getRenderingEngineInstance, createViewportSpec, createToolGroup, loadVolume } = utils
      // Add tools if not already added
      await addTools()

      // Get rendering engine
      const renderingEngine = getRenderingEngineInstance()

      // Create viewport specification
      const viewportSpec = createViewportSpec(
        viewportId,
        VIEWPORT_TYPES.VOLUME_3D,
        elementRef.current
      )

      // Enable the viewport
      renderingEngine.enableElement(viewportSpec)

      // Get the viewport
      const viewport = renderingEngine.getViewport(viewportId) as any
      viewportRef.current = viewport

      // Create and configure tool group
      const toolGroup = createToolGroup(TOOL_GROUP_IDS.VOLUME_3D, 'VOLUME_3D_VIEWPORT')
      toolGroup.addViewport(viewportId, renderingEngine.id)

      // Load volume
      const volume = await loadVolume(volumeId, imageIds)

      // Set volume data
      await viewport.setVolumes([
        {
          volumeId: volume.volumeId,
          callback: ({ volumeActor }) => {
            // Apply volume rendering properties
            const properties = volumeProperties || VOLUME_PRESETS[preset]
            
            if (properties) {
              const volumeProperty = volumeActor.getProperty()
              
              // Set scalar opacity
              if (properties.scalarOpacity) {
                const scalarOpacity = volumeProperty.getScalarOpacity(0)
                scalarOpacity.removeAllPoints()
                properties.scalarOpacity.forEach(([value, opacity]) => {
                  scalarOpacity.addPoint(value, opacity)
                })
              }
              
              // Set color transfer function
              if (properties.colorTransfer) {
                const colorTransfer = volumeProperty.getRGBTransferFunction(0)
                colorTransfer.removeAllPoints()
                properties.colorTransfer.forEach(([value, r, g, b]) => {
                  colorTransfer.addRGBPoint(value, r, g, b)
                })
              }
              
              // Set gradient opacity
              if (properties.gradientOpacity) {
                const gradientOpacity = volumeProperty.getGradientOpacity(0)
                gradientOpacity.removeAllPoints()
                properties.gradientOpacity.forEach(([value, opacity]) => {
                  gradientOpacity.addPoint(value, opacity)
                })
              }
              
              // Enable volume rendering
              volumeProperty.setShade(true)
              volumeProperty.setAmbient(0.4)
              volumeProperty.setDiffuse(0.6)
              volumeProperty.setSpecular(0.2)
              volumeProperty.setSpecularPower(10)
              volumeProperty.setInterpolationTypeToLinear()
            }
          },
        },
      ])

      // Set initial camera position for better 3D view
      const camera = viewport.getCamera()
      const { focalPoint, position } = camera
      
      // Position camera at an angle for better 3D visualization
      const distance = Math.sqrt(
        Math.pow(position[0] - focalPoint[0], 2) +
        Math.pow(position[1] - focalPoint[1], 2) +
        Math.pow(position[2] - focalPoint[2], 2)
      )
      
      viewport.setCamera({
        ...camera,
        position: [
          focalPoint[0] + distance * 0.5,
          focalPoint[1] - distance * 0.5,
          focalPoint[2] + distance * 0.5,
        ],
        viewUp: [0, 0, 1],
      })

      viewport.render()

      isInitializedRef.current = true
      onViewportReady?.(viewport)

      console.log(`3D Viewport ${viewportId} initialized with volume ${volumeId}`)
    } catch (err) {
      console.error('Failed to initialize 3D viewport:', err)
    }
  }, [viewportId, volumeId, imageIds, preset, volumeProperties, onViewportReady])

  // Update volume properties when preset or custom properties change
  useEffect(() => {
    if (viewportRef.current && isInitializedRef.current) {
      const viewport = viewportRef.current
      const volumeActors = viewport.getActors()
      
      if (volumeActors.length > 0) {
        const volumeActor = volumeActors[0]
        const properties = volumeProperties || VOLUME_PRESETS[preset]
        
        if (properties) {
          const volumeProperty = volumeActor.getProperty()
          
          // Update scalar opacity
          if (properties.scalarOpacity) {
            const scalarOpacity = volumeProperty.getScalarOpacity(0)
            scalarOpacity.removeAllPoints()
            properties.scalarOpacity.forEach(([value, opacity]) => {
              scalarOpacity.addPoint(value, opacity)
            })
          }
          
          // Update color transfer function
          if (properties.colorTransfer) {
            const colorTransfer = volumeProperty.getRGBTransferFunction(0)
            colorTransfer.removeAllPoints()
            properties.colorTransfer.forEach(([value, r, g, b]) => {
              colorTransfer.addRGBPoint(value, r, g, b)
            })
          }
          
          // Update gradient opacity
          if (properties.gradientOpacity) {
            const gradientOpacity = volumeProperty.getGradientOpacity(0)
            gradientOpacity.removeAllPoints()
            properties.gradientOpacity.forEach(([value, opacity]) => {
              gradientOpacity.addPoint(value, opacity)
            })
          }
          
          viewport.render()
        }
      }
    }
  }, [preset, volumeProperties])

  // Initialize viewport when component mounts or imageIds change
  useEffect(() => {
    if (imageIds.length > 0 && !isLoading && !error) {
      initialize3DViewport()
    }

    return () => {
      // Cleanup on unmount
      if (isInitializedRef.current) {
        const renderingEngine = getRenderingEngineInstance()
        const toolGroup = (window as any).__csTools?.ToolGroupManager?.getToolGroup?.(TOOL_GROUP_IDS.VOLUME_3D)
        
        if (toolGroup) {
          toolGroup.removeViewports(renderingEngine.id, [viewportId])
        }
        
        renderingEngine.disableElement(viewportId)
        isInitializedRef.current = false
        viewportRef.current = null
      }
    }
  }, [imageIds, isLoading, error, initialize3DViewport, viewportId])

  // Render loading state
  if (isLoading) {
    return (
      <Box
        sx={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'grey.900',
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={40} />
          <Typography variant="body2" sx={{ mt: 2, color: 'grey.400' }}>
            Loading 3D volume...
          </Typography>
        </Box>
      </Box>
    )
  }

  // Render error state
  if (error) {
    return (
      <Box sx={{ width, height, p: 2 }}>
        <Alert severity="error" sx={{ height: '100%' }}>
          <Typography variant="h6" gutterBottom>
            Failed to load 3D volume
          </Typography>
          <Typography variant="body2">{error}</Typography>
        </Alert>
      </Box>
    )
  }

  // Render empty state
  if (!imageIds.length) {
    return (
      <Box
        sx={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'grey.900',
        }}
      >
        <Typography variant="body1" color="grey.400">
          No volume data to display
        </Typography>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        width,
        height,
        position: 'relative',
        bgcolor: 'black',
        '& canvas': {
          width: '100% !important',
          height: '100% !important',
        },
      }}
    >
      <div
        ref={elementRef}
        id={viewportId}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
        }}
      />
    </Box>
  )
}

export default Viewport3D