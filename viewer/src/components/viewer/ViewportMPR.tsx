import React, { useEffect, useRef, useCallback } from 'react'
import { Box, Grid, CircularProgress, Typography, Alert } from '@mui/material'
import { Types, Enums } from '@cornerstonejs/core'

import {
  getRenderingEngineInstance,
  createToolGroup,
  createViewportSpec,
  setVolumeViewportData,
  loadVolume,
  addTools,
} from '@/lib/cornerstone/utils'
import {
  TOOL_GROUP_IDS,
  VIEWPORT_TYPES,
  VIEWPORT_IDS,
} from '@/lib/cornerstone/config'

interface ViewportMPRProps {
  /** Unique identifier for the MPR viewport set */
  baseViewportId: string
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
  /** Callback when viewports are ready */
  onViewportsReady?: (viewports: {
    axial: Types.IVolumeViewport
    sagittal: Types.IVolumeViewport
    coronal: Types.IVolumeViewport
  }) => void
}

export const ViewportMPR: React.FC<ViewportMPRProps> = ({
  baseViewportId,
  volumeId,
  imageIds,
  width = '100%',
  height = '100%',
  isLoading = false,
  error,
  onViewportsReady,
}) => {
  const axialRef = useRef<HTMLDivElement>(null)
  const sagittalRef = useRef<HTMLDivElement>(null)
  const coronalRef = useRef<HTMLDivElement>(null)
  const viewportsRef = useRef<{
    axial: Types.IVolumeViewport | null
    sagittal: Types.IVolumeViewport | null
    coronal: Types.IVolumeViewport | null
  }>({
    axial: null,
    sagittal: null,
    coronal: null,
  })
  const isInitializedRef = useRef(false)

  // Generate viewport IDs
  const axialViewportId = `${baseViewportId}-axial`
  const sagittalViewportId = `${baseViewportId}-sagittal`
  const coronalViewportId = `${baseViewportId}-coronal`

  // Initialize MPR viewports
  const initializeMPRViewports = useCallback(async () => {
    if (
      !axialRef.current ||
      !sagittalRef.current ||
      !coronalRef.current ||
      !imageIds.length ||
      isInitializedRef.current
    ) {
      return
    }

    try {
      // Add tools if not already added
      await addTools()

      // Get rendering engine
      const renderingEngine = getRenderingEngineInstance()

      // Create viewport specifications
      const axialSpec = createViewportSpec(
        axialViewportId,
        VIEWPORT_TYPES.ORTHOGRAPHIC,
        axialRef.current,
        Enums.OrientationAxis.AXIAL
      )

      const sagittalSpec = createViewportSpec(
        sagittalViewportId,
        VIEWPORT_TYPES.ORTHOGRAPHIC,
        sagittalRef.current,
        Enums.OrientationAxis.SAGITTAL
      )

      const coronalSpec = createViewportSpec(
        coronalViewportId,
        VIEWPORT_TYPES.ORTHOGRAPHIC,
        coronalRef.current,
        Enums.OrientationAxis.CORONAL
      )

      // Enable viewports
      renderingEngine.setViewports([axialSpec, sagittalSpec, coronalSpec])

      // Get viewport instances
      const axialViewport = renderingEngine.getViewport(axialViewportId) as Types.IVolumeViewport
      const sagittalViewport = renderingEngine.getViewport(sagittalViewportId) as Types.IVolumeViewport
      const coronalViewport = renderingEngine.getViewport(coronalViewportId) as Types.IVolumeViewport

      viewportsRef.current = {
        axial: axialViewport,
        sagittal: sagittalViewport,
        coronal: coronalViewport,
      }

      // Create and configure tool group
      const toolGroup = createToolGroup(TOOL_GROUP_IDS.VOLUME, 'VOLUME_VIEWPORT')
      toolGroup.addViewport(axialViewportId, renderingEngine.id)
      toolGroup.addViewport(sagittalViewportId, renderingEngine.id)
      toolGroup.addViewport(coronalViewportId, renderingEngine.id)

      // Load volume
      const volume = await loadVolume(volumeId, imageIds)

      // Set volume data for each viewport
      await Promise.all([
        setVolumeViewportData(renderingEngine, axialViewportId, volume, Enums.OrientationAxis.AXIAL),
        setVolumeViewportData(renderingEngine, sagittalViewportId, volume, Enums.OrientationAxis.SAGITTAL),
        setVolumeViewportData(renderingEngine, coronalViewportId, volume, Enums.OrientationAxis.CORONAL),
      ])

      // Synchronize crosshairs between viewports
      toolGroup.setToolActive('Crosshairs', {
        bindings: [{ mouseButton: 1 }],
      })

      isInitializedRef.current = true
      onViewportsReady?.({
        axial: axialViewport,
        sagittal: sagittalViewport,
        coronal: coronalViewport,
      })

      console.log(`MPR Viewports ${baseViewportId} initialized with volume ${volumeId}`)
    } catch (err) {
      console.error('Failed to initialize MPR viewports:', err)
    }
  }, [baseViewportId, volumeId, imageIds, axialViewportId, sagittalViewportId, coronalViewportId, onViewportsReady])

  // Initialize viewports when component mounts or imageIds change
  useEffect(() => {
    if (imageIds.length > 0 && !isLoading && !error) {
      initializeMPRViewports()
    }

    return () => {
      // Cleanup on unmount
      if (isInitializedRef.current) {
        const renderingEngine = getRenderingEngineInstance()
        const toolGroup = (window as any).__csTools?.ToolGroupManager?.getToolGroup?.(TOOL_GROUP_IDS.VOLUME)
        
        if (toolGroup) {
          toolGroup.removeViewports(renderingEngine.id, [
            axialViewportId,
            sagittalViewportId,
            coronalViewportId,
          ])
        }
        
        renderingEngine.disableElement(axialViewportId)
        renderingEngine.disableElement(sagittalViewportId)
        renderingEngine.disableElement(coronalViewportId)
        
        isInitializedRef.current = false
        viewportsRef.current = {
          axial: null,
          sagittal: null,
          coronal: null,
        }
      }
    }
  }, [imageIds, isLoading, error, initializeMPRViewports, axialViewportId, sagittalViewportId, coronalViewportId])

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
            Loading volume...
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
            Failed to load volume
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
    <Box sx={{ width, height, bgcolor: 'black' }}>
      <Grid container sx={{ height: '100%' }}>
        <Grid item xs={6} sx={{ height: '50%', position: 'relative' }}>
          <Box sx={{ position: 'relative', width: '100%', height: '100%', border: '1px solid #333' }}>
            <Typography
              variant="caption"
              sx={{
                position: 'absolute',
                top: 8,
                left: 8,
                color: 'white',
                zIndex: 1,
                bgcolor: 'rgba(0,0,0,0.5)',
                px: 1,
                py: 0.5,
                borderRadius: 1,
              }}
            >
              Axial
            </Typography>
            <div
              ref={axialRef}
              id={axialViewportId}
              style={{
                width: '100%',
                height: '100%',
                position: 'relative',
              }}
            />
          </Box>
        </Grid>
        
        <Grid item xs={6} sx={{ height: '50%', position: 'relative' }}>
          <Box sx={{ position: 'relative', width: '100%', height: '100%', border: '1px solid #333' }}>
            <Typography
              variant="caption"
              sx={{
                position: 'absolute',
                top: 8,
                left: 8,
                color: 'white',
                zIndex: 1,
                bgcolor: 'rgba(0,0,0,0.5)',
                px: 1,
                py: 0.5,
                borderRadius: 1,
              }}
            >
              Sagittal
            </Typography>
            <div
              ref={sagittalRef}
              id={sagittalViewportId}
              style={{
                width: '100%',
                height: '100%',
                position: 'relative',
              }}
            />
          </Box>
        </Grid>
        
        <Grid item xs={12} sx={{ height: '50%', position: 'relative' }}>
          <Box sx={{ position: 'relative', width: '100%', height: '100%', border: '1px solid #333' }}>
            <Typography
              variant="caption"
              sx={{
                position: 'absolute',
                top: 8,
                left: 8,
                color: 'white',
                zIndex: 1,
                bgcolor: 'rgba(0,0,0,0.5)',
                px: 1,
                py: 0.5,
                borderRadius: 1,
              }}
            >
              Coronal
            </Typography>
            <div
              ref={coronalRef}
              id={coronalViewportId}
              style={{
                width: '100%',
                height: '100%',
                position: 'relative',
              }}
            />
          </Box>
        </Grid>
      </Grid>
    </Box>
  )
}

export default ViewportMPR