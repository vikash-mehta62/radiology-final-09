import React, { useEffect, useRef, useCallback } from 'react'
import { Box, CircularProgress, Typography, Alert } from '@mui/material'
import { Types, Enums } from '@cornerstonejs/core'

import {
  getRenderingEngineInstance,
  createToolGroup,
  createViewportSpec,
  setStackViewportData,
  addTools,
} from '@/lib/cornerstone/utils'
import {
  TOOL_GROUP_IDS,
  VIEWPORT_TYPES,
} from '@/lib/cornerstone/config'

interface Viewport2DProps {
  /** Unique identifier for the viewport */
  viewportId: string
  /** Array of DICOM image IDs to display */
  imageIds: string[]
  /** Current image index */
  currentImageIndex?: number
  /** Viewport width */
  width?: number | string
  /** Viewport height */
  height?: number | string
  /** Loading state */
  isLoading?: boolean
  /** Error message */
  error?: string
  /** Callback when viewport is ready */
  onViewportReady?: (viewport: Types.IStackViewport) => void
  /** Callback when image changes */
  onImageChange?: (imageIndex: number) => void
}

export const Viewport2D: React.FC<Viewport2DProps> = ({
  viewportId,
  imageIds,
  currentImageIndex = 0,
  width = '100%',
  height = '100%',
  isLoading = false,
  error,
  onViewportReady,
  onImageChange,
}) => {
  const elementRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<Types.IStackViewport | null>(null)
  const isInitializedRef = useRef(false)
  const imageRenderedHandlerRef = useRef<((evt?: any) => void) | null>(null)

  // Initialize viewport
  const initializeViewport = useCallback(async () => {
    if (!elementRef.current || !imageIds.length || isInitializedRef.current) {
      return
    }

    try {
      // Add tools if not already added
      await addTools()

      // Get rendering engine
      const renderingEngine = getRenderingEngineInstance()

      // Create viewport specification
      const viewportSpec = createViewportSpec(
        viewportId,
        VIEWPORT_TYPES.STACK,
        elementRef.current
      )

      // Enable the viewport
      renderingEngine.enableElement(viewportSpec)

      // Get the viewport
      const viewport = renderingEngine.getViewport(viewportId) as Types.IStackViewport
      viewportRef.current = viewport

      // Create and configure tool group
      const toolGroup = createToolGroup(TOOL_GROUP_IDS.STACK, 'STACK_VIEWPORT')
      toolGroup.addViewport(viewportId, renderingEngine.id)

      // Set stack data
      await setStackViewportData(renderingEngine, viewportId, imageIds, currentImageIndex)

      // Set up event listeners on the viewport event bus (safer than DOM element)
      const handleImageRendered = () => {
        const currentIndex = viewport.getCurrentImageIdIndex()
        onImageChange?.(currentIndex)
      }
      imageRenderedHandlerRef.current = handleImageRendered
      const imageRenderedEventName = (Enums as any)?.Events?.IMAGE_RENDERED ?? 'IMAGE_RENDERED'
      ;(viewport as any)?.addEventListener?.(imageRenderedEventName, handleImageRendered)

      isInitializedRef.current = true
      onViewportReady?.(viewport)

      console.log(`2D Viewport ${viewportId} initialized with ${imageIds.length} images`)
    } catch (err) {
      console.error('Failed to initialize 2D viewport:', err)
    }
  }, [viewportId, imageIds, currentImageIndex, onViewportReady, onImageChange])

  // Update current image when prop changes
  useEffect(() => {
    if (viewportRef.current && isInitializedRef.current) {
      const viewport = viewportRef.current
      const currentIndex = viewport.getCurrentImageIdIndex()
      
      if (currentIndex !== currentImageIndex) {
        viewport.setImageIdIndex(currentImageIndex)
        viewport.render()
      }
    }
  }, [currentImageIndex])

  // Initialize viewport when component mounts or imageIds change
  useEffect(() => {
    if (imageIds.length > 0 && !isLoading && !error) {
      initializeViewport()
    }

    return () => {
      // Cleanup on unmount
      if (isInitializedRef.current) {
        const renderingEngine = getRenderingEngineInstance()
        const toolGroup = (window as any).__csTools?.ToolGroupManager?.getToolGroup?.(TOOL_GROUP_IDS.STACK)
        
        if (toolGroup) {
          toolGroup.removeViewports(renderingEngine.id, [viewportId])
        }

        // Remove image rendered handler if it was added
        const viewport = viewportRef.current as any
        if (viewport && imageRenderedHandlerRef.current) {
          const imageRenderedEventName = (Enums as any)?.Events?.IMAGE_RENDERED ?? 'IMAGE_RENDERED'
          viewport.removeEventListener?.(imageRenderedEventName, imageRenderedHandlerRef.current)
          imageRenderedHandlerRef.current = null
        }
        
        renderingEngine.disableElement(viewportId)
        isInitializedRef.current = false
        viewportRef.current = null
      }
    }
  }, [imageIds, isLoading, error, initializeViewport, viewportId])

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
            Loading images...
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
            Failed to load images
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
          No images to display
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

export default Viewport2D