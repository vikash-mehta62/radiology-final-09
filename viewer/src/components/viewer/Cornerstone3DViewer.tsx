import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
    Box,
    Paper,
    Button,
    ButtonGroup,
    Typography,
    Divider,
    Alert,
    Chip,
} from '@mui/material'
import {
    PanTool as PanIcon,
    ZoomIn as ZoomIcon,
    Straighten as RulerIcon,
    Architecture as AngleIcon,
    CropFree as AreaIcon,
    Refresh as ResetIcon,
    PlayArrow as PlayIcon,
    Pause as PauseIcon,
    SkipNext as NextIcon,
    SkipPrevious as PrevIcon,
    Tune as WindowLevelIcon,
    ViewInAr as View3DIcon,
    Clear as ClearIcon,
} from '@mui/icons-material'

// IMPORTANT: Do NOT import '@cornerstonejs/tools' or '@cornerstonejs/core' statically in production.
// We will lazy-load them after mount to avoid build-time evaluation issues
// that can trigger TDZ errors like "Cannot access 'JX' before initialization" in production builds.
import { initializeCoreEnums } from '@/lib/cornerstone/config'

interface Cornerstone3DViewerProps {
    studyInstanceUID: string
    seriesInstanceUID?: string
    sopInstanceUIDs?: string[]
    dicomWebBaseUrl?: string
    mode?: 'stack' | 'volume' | 'mpr'
}

export const Cornerstone3DViewer: React.FC<Cornerstone3DViewerProps> = ({
    studyInstanceUID,
    seriesInstanceUID,
    sopInstanceUIDs = [],
    dicomWebBaseUrl = '/api/dicom',
    mode = 'stack',
}) => {
    const viewportRef = useRef<HTMLDivElement>(null)
    const [isInitialized, setIsInitialized] = useState(false)
    const [activeTool, setActiveTool] = useState<string>('Pan')
    const [currentFrame, setCurrentFrame] = useState(0)
    const [totalFrames, setTotalFrames] = useState(0)
    const [isPlaying, setIsPlaying] = useState(false)
    const [error, setError] = useState<string | null>(null)

  const csCoreRef = useRef<any>(null)
  const renderingEngineRef = useRef<any>(null)
  const toolGroupRef = useRef<any>(null)
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isInitializingRef = useRef(false)
  const toolsModuleRef = useRef<any>(null)
  const csToolsEnumsRef = useRef<any>(null)
  const toolNamesRef = useRef<{
    Pan: string
    Zoom: string
    WindowLevel: string
    Length: string
    Angle: string
    RectangleROI: string
    EllipticalROI: string
    ArrowAnnotate: string
  } | null>(null)

    // Initialize Cornerstone3D
    useEffect(() => {
        const initCornerstone = async () => {
            // Prevent multiple initializations
            if (isInitializingRef.current || isInitialized) {
                console.log('ℹ️ Cornerstone3D already initialized or initializing')
                return
            }

            isInitializingRef.current = true
            try {
                console.log('🚀 Initializing Cornerstone3D...')

                // Lazy-load Cornerstone3D Core (only once)
                csCoreRef.current = await import('@cornerstonejs/core')
                await csCoreRef.current.init()
                // Initialize config viewport enums from core at runtime
                initializeCoreEnums(csCoreRef.current.Enums)
                console.log('✅ Cornerstone3D Core initialized')

                // Lazy-load Cornerstone Tools and initialize (only once)
                toolsModuleRef.current = await import('@cornerstonejs/tools')
                toolsModuleRef.current.init()
                console.log('✅ Cornerstone3D Tools initialized')

                // Add tools (with duplicate check)
                const toolsToAdd = [
                    toolsModuleRef.current.PanTool,
                    toolsModuleRef.current.ZoomTool,
                    toolsModuleRef.current.StackScrollMouseWheelTool,
                    toolsModuleRef.current.LengthTool,
                    toolsModuleRef.current.AngleTool,
                    toolsModuleRef.current.RectangleROITool,
                    toolsModuleRef.current.EllipticalROITool,
                    toolsModuleRef.current.ArrowAnnotateTool,
                    toolsModuleRef.current.WindowLevelTool,
                ]

                toolsToAdd.forEach((ToolClass) => {
                    try {
                        toolsModuleRef.current.addTool(ToolClass)
                        console.log(`✅ Added tool: ${ToolClass.toolName}`)
                    } catch (err: any) {
                        // Ignore "already added" errors
                        if (err.message?.includes('already been added')) {
                            console.log(`ℹ️ Tool already added: ${ToolClass.toolName}`)
                        } else {
                            throw err
                        }
                    }
                })

                // Cache enums and tool names for later usage outside setup scope
                csToolsEnumsRef.current = toolsModuleRef.current.Enums
                toolNamesRef.current = {
                    Pan: toolsModuleRef.current.PanTool.toolName,
                    Zoom: toolsModuleRef.current.ZoomTool.toolName,
                    WindowLevel: toolsModuleRef.current.WindowLevelTool.toolName,
                    Length: toolsModuleRef.current.LengthTool.toolName,
                    Angle: toolsModuleRef.current.AngleTool.toolName,
                    RectangleROI: toolsModuleRef.current.RectangleROITool.toolName,
                    EllipticalROI: toolsModuleRef.current.EllipticalROITool.toolName,
                    ArrowAnnotate: toolsModuleRef.current.ArrowAnnotateTool.toolName,
                }

                console.log('✅ All tools ready')
                console.log('✅ Cornerstone3D initialized successfully')
                setIsInitialized(true)
            } catch (err) {
                console.error('❌ Failed to initialize Cornerstone3D:', err)
                console.error('Error details:', err)
                setError(`Initialization failed: ${err}`)
                isInitializingRef.current = false // Reset on error
            }
        }

        initCornerstone()

        return () => {
            // Cleanup
            if (renderingEngineRef.current) {
                renderingEngineRef.current.destroy()
            }
            if (playIntervalRef.current) {
                clearInterval(playIntervalRef.current)
            }
        }
    }, [])

    // Setup viewport and load images
    useEffect(() => {
        if (!isInitialized || !viewportRef.current || !studyInstanceUID) return

        const setupViewer = async () => {
            try {
                console.log('🎬 Setting up viewer for study:', studyInstanceUID)

                // Create rendering engine
                const renderingEngineId = 'myRenderingEngine'
                const RenderingEngine = csCoreRef.current.RenderingEngine
                const renderingEngine = new RenderingEngine(renderingEngineId)
                renderingEngineRef.current = renderingEngine

                // Create viewport
                const viewportId = 'CT_STACK'
                if (!viewportRef.current) {
                    throw new Error('Viewport element not found')
                }

                const viewportInput = {
                    viewportId,
                    type: csCoreRef.current.Enums.ViewportType.STACK,
                    element: viewportRef.current,
                    defaultOptions: {
                        background: [0, 0, 0] as [number, number, number],
                    },
                }

                renderingEngine.enableElement(viewportInput)

                // Create tool group
                const toolGroupId = 'myToolGroup'
                const ToolGroupManager = toolsModuleRef.current.ToolGroupManager
                let toolGroup = ToolGroupManager.getToolGroup(toolGroupId)

                if (!toolGroup) {
                    toolGroup = ToolGroupManager.createToolGroup(toolGroupId)
                }

                if (!toolGroup) {
                    throw new Error('Failed to create tool group')
                }

                toolGroupRef.current = toolGroup

                // Add tools to tool group
                toolGroup.addTool(toolNamesRef.current!.Pan)
                toolGroup.addTool(toolNamesRef.current!.Zoom)
                toolGroup.addTool(toolsModuleRef.current.StackScrollMouseWheelTool.toolName)
                toolGroup.addTool(toolNamesRef.current!.Length)
                toolGroup.addTool(toolNamesRef.current!.Angle)
                toolGroup.addTool(toolNamesRef.current!.RectangleROI)
                toolGroup.addTool(toolNamesRef.current!.EllipticalROI)
                toolGroup.addTool(toolNamesRef.current!.ArrowAnnotate)
                toolGroup.addTool(toolNamesRef.current!.WindowLevel)

                // Set initial tool states
                const csToolsEnums = csToolsEnumsRef.current
                toolGroup.setToolActive(toolNamesRef.current!.Pan, {
                    bindings: [{ mouseButton: csToolsEnums.MouseBindings.Auxiliary }],
                })
                toolGroup.setToolActive(toolNamesRef.current!.Zoom, {
                    bindings: [{ mouseButton: csToolsEnums.MouseBindings.Secondary }],
                })
                toolGroup.setToolActive(toolsModuleRef.current.StackScrollMouseWheelTool.toolName)
                toolGroup.setToolActive(toolNamesRef.current!.WindowLevel, {
                    bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }],
                })

                // Add viewport to tool group
                toolGroup.addViewport(viewportId, renderingEngineId)

                // Load images using DICOM wadouri IDs
                const imageIds = await loadImageIds()
                setTotalFrames(imageIds.length)

                const viewport = renderingEngine.getViewport(viewportId)
                if (viewport && imageIds.length > 0) {
                    await (viewport as any).setStack(imageIds, 0)
                    viewport.render()
                    console.log('✅ Images loaded and rendered')
                }
            } catch (err) {
                console.error('❌ Failed to setup viewer:', err)
                setError(`Setup failed: ${err}`)
            }
        }

        setupViewer()
    }, [isInitialized, studyInstanceUID])

    // Load image IDs from backend
    const loadImageIds = async (): Promise<string[]> => {
        try {
            // Prefer explicit SOP instance list if provided
            if (studyInstanceUID && seriesInstanceUID && sopInstanceUIDs?.length) {
                const { generateImageIds } = await import('@/lib/cornerstone/utils')
                const ids = generateImageIds(
                    studyInstanceUID,
                    seriesInstanceUID,
                    sopInstanceUIDs,
                    dicomWebBaseUrl
                )
                console.log(`📸 Generated ${ids.length} wadouri image IDs`)
                return ids
            }

            // Fallback: query backend for instance UIDs and build wadouri IDs
            if (studyInstanceUID && seriesInstanceUID) {
                const { globalImageLoader } = await import('@/lib/cornerstone/imageLoader')
                const ids = await globalImageLoader.createSeriesImageIds(
                    studyInstanceUID,
                    seriesInstanceUID
                )
                console.log(`📸 Loaded ${ids.length} image IDs from backend`)
                return ids
            }

            throw new Error('Missing seriesInstanceUID or SOP instance list for image loading')
        } catch (err) {
            console.error('Failed to load image IDs:', err)
            return []
        }
    }

    // Tool activation
    const activateTool = useCallback((toolName: string) => {
        if (!toolGroupRef.current) return

        const toolGroup = toolGroupRef.current

        // Deactivate all annotation tools
        const annotationTools = [
            toolNamesRef.current?.Length,
            toolNamesRef.current?.Angle,
            toolNamesRef.current?.RectangleROI,
            toolNamesRef.current?.EllipticalROI,
            toolNamesRef.current?.ArrowAnnotate,
        ].filter(Boolean) as string[]

        annotationTools.forEach(tool => {
            toolGroup.setToolPassive(tool)
        })

        // Activate selected tool
        if (annotationTools.includes(toolName)) {
            toolGroup.setToolActive(toolName, {
                bindings: [{ mouseButton: csToolsEnumsRef.current.MouseBindings.Primary }],
            })
            setActiveTool(toolName)
        } else if (toolName === toolNamesRef.current?.Pan) {
            toolGroup.setToolActive(toolNamesRef.current!.Pan, {
                bindings: [{ mouseButton: csToolsEnumsRef.current.MouseBindings.Primary }],
            })
            setActiveTool(toolNamesRef.current!.Pan)
        } else if (toolName === toolNamesRef.current?.Zoom) {
            toolGroup.setToolActive(toolNamesRef.current!.Zoom, {
                bindings: [{ mouseButton: csToolsEnumsRef.current.MouseBindings.Primary }],
            })
            setActiveTool(toolNamesRef.current!.Zoom)
        } else if (toolName === toolNamesRef.current?.WindowLevel) {
            toolGroup.setToolActive(toolNamesRef.current!.WindowLevel, {
                bindings: [{ mouseButton: csToolsEnumsRef.current.MouseBindings.Primary }],
            })
            setActiveTool(toolNamesRef.current!.WindowLevel)
        }

        console.log(`🔧 Activated tool: ${toolName}`)
    }, [])

    // Frame navigation
    const goToFrame = useCallback((frameIndex: number) => {
        if (!renderingEngineRef.current) return

        const viewport = renderingEngineRef.current.getViewport('CT_STACK') as any
        if (viewport) {
            const clampedIndex = Math.max(0, Math.min(totalFrames - 1, frameIndex))
            viewport.setImageIdIndex(clampedIndex)
            viewport.render()
            setCurrentFrame(clampedIndex)
        }
    }, [totalFrames])

    const nextFrame = useCallback(() => {
        goToFrame(currentFrame + 1)
    }, [currentFrame, goToFrame])

    const previousFrame = useCallback(() => {
        goToFrame(currentFrame - 1)
    }, [currentFrame, goToFrame])

    // Cine playback
    const togglePlayback = useCallback(() => {
        if (isPlaying) {
            if (playIntervalRef.current) {
                clearInterval(playIntervalRef.current)
                playIntervalRef.current = null
            }
            setIsPlaying(false)
        } else {
            playIntervalRef.current = setInterval(() => {
                setCurrentFrame(prev => {
                    const next = prev + 1
                    if (next >= totalFrames) {
                        return 0
                    }
                    goToFrame(next)
                    return next
                })
            }, 100)
            setIsPlaying(true)
        }
    }, [isPlaying, totalFrames, goToFrame])

    // Reset view
    const resetView = useCallback(() => {
        if (!renderingEngineRef.current) return

        const viewport = renderingEngineRef.current.getViewport('CT_STACK')
        if (viewport) {
            viewport.resetCamera()
            viewport.render()
        }
    }, [])

    // Clear annotations
    const clearAnnotations = useCallback(() => {
        if (!toolGroupRef.current || !viewportRef.current) return

        const annotationTools = [
            toolsModuleRef.current?.LengthTool?.toolName,
            toolsModuleRef.current?.AngleTool?.toolName,
            toolsModuleRef.current?.RectangleROITool?.toolName,
            toolsModuleRef.current?.EllipticalROITool?.toolName,
            toolsModuleRef.current?.ArrowAnnotateTool?.toolName,
        ].filter(Boolean)

        if (toolsModuleRef.current?.annotation?.state) {
            annotationTools.forEach((toolName: string) => {
                const annotations = toolsModuleRef.current.annotation.state.getAnnotations(toolName, viewportRef.current!)
                annotations?.forEach((annotation: any) => {
                    if (annotation.annotationUID) {
                        toolsModuleRef.current.annotation.state.removeAnnotation(annotation.annotationUID)
                    }
                })
            })
        }

        if (renderingEngineRef.current) {
            const viewport = renderingEngineRef.current.getViewport('CT_STACK')
            viewport?.render()
        }

        console.log('🗑️ Cleared all annotations')
    }, [])

    if (error) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error">
                    <Typography variant="h6">Cornerstone3D Error</Typography>
                    <Typography variant="body2">{error}</Typography>
                </Alert>
            </Box>
        )
    }

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#000' }}>
            {/* Toolbar */}
            <Paper
                elevation={2}
                sx={{
                    bgcolor: 'grey.900',
                    color: 'white',
                    borderRadius: 0,
                    p: 1,
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                            icon={<View3DIcon />}
                            label="Cornerstone3D Viewer"
                            color="primary"
                            size="small"
                        />
                        <Chip
                            label={`Study: ${studyInstanceUID.substring(0, 12)}...`}
                            size="small"
                            variant="outlined"
                            sx={{ color: 'white', borderColor: 'white' }}
                        />
                    </Box>

                    <Chip
                        label={`Frame ${currentFrame + 1} / ${totalFrames}`}
                        size="small"
                        color="secondary"
                    />
                </Box>

                {/* Tool Controls */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    {/* Navigation Tools */}
                    <ButtonGroup variant="outlined" size="small">
                        <Button
                            startIcon={<PanIcon />}
                            onClick={() => toolNamesRef.current && activateTool(toolNamesRef.current.Pan)}
                            variant={activeTool === toolNamesRef.current?.Pan ? 'contained' : 'outlined'}
                        >
                            Pan
                        </Button>
                        <Button
                            startIcon={<ZoomIcon />}
                            onClick={() => toolNamesRef.current && activateTool(toolNamesRef.current.Zoom)}
                            variant={activeTool === toolNamesRef.current?.Zoom ? 'contained' : 'outlined'}
                        >
                            Zoom
                        </Button>
                        <Button
                            startIcon={<WindowLevelIcon />}
                            onClick={() => toolNamesRef.current && activateTool(toolNamesRef.current.WindowLevel)}
                            variant={activeTool === toolNamesRef.current?.WindowLevel ? 'contained' : 'outlined'}
                        >
                            W/L
                        </Button>
                    </ButtonGroup>

                    <Divider orientation="vertical" flexItem sx={{ bgcolor: 'grey.600' }} />

                    {/* Measurement Tools */}
                    <ButtonGroup variant="outlined" size="small">
                        <Button
                            startIcon={<RulerIcon />}
                            onClick={() => toolNamesRef.current && activateTool(toolNamesRef.current.Length)}
                            variant={activeTool === toolNamesRef.current?.Length ? 'contained' : 'outlined'}
                        >
                            Length
                        </Button>
                        <Button
                            startIcon={<AngleIcon />}
                            onClick={() => toolNamesRef.current && activateTool(toolNamesRef.current.Angle)}
                            variant={activeTool === toolNamesRef.current?.Angle ? 'contained' : 'outlined'}
                        >
                            Angle
                        </Button>
                        <Button
                            startIcon={<AreaIcon />}
                            onClick={() => toolNamesRef.current && activateTool(toolNamesRef.current.RectangleROI)}
                            variant={activeTool === toolNamesRef.current?.RectangleROI ? 'contained' : 'outlined'}
                        >
                            ROI
                        </Button>
                    </ButtonGroup>

                    <Divider orientation="vertical" flexItem sx={{ bgcolor: 'grey.600' }} />

                    {/* Playback Controls */}
                    <ButtonGroup variant="outlined" size="small">
                        <Button startIcon={<PrevIcon />} onClick={previousFrame}>
                            Prev
                        </Button>
                        <Button
                            startIcon={isPlaying ? <PauseIcon /> : <PlayIcon />}
                            onClick={togglePlayback}
                            variant={isPlaying ? 'contained' : 'outlined'}
                            color={isPlaying ? 'error' : 'primary'}
                        >
                            {isPlaying ? 'Stop' : 'Play'}
                        </Button>
                        <Button startIcon={<NextIcon />} onClick={nextFrame}>
                            Next
                        </Button>
                    </ButtonGroup>

                    <Divider orientation="vertical" flexItem sx={{ bgcolor: 'grey.600' }} />

                    {/* View Controls */}
                    <ButtonGroup variant="outlined" size="small">
                        <Button startIcon={<ResetIcon />} onClick={resetView}>
                            Reset
                        </Button>
                        <Button startIcon={<ClearIcon />} onClick={clearAnnotations} color="error">
                            Clear
                        </Button>
                    </ButtonGroup>
                </Box>

                {/* Tool Instructions */}
                {activeTool !== 'Pan' && activeTool !== 'Zoom' && activeTool !== 'WindowLevel' && (
                    <Alert severity="info" sx={{ mt: 1, py: 0.5 }}>
                        <Typography variant="caption">
                            {activeTool === toolNamesRef.current?.Length && '📏 Click and drag to measure distance'}
                            {activeTool === toolNamesRef.current?.Angle && '📐 Click three points to measure angle'}
                            {activeTool === toolNamesRef.current?.RectangleROI && '▭ Click and drag to draw ROI'}
                            {activeTool === toolNamesRef.current?.EllipticalROI && '⭕ Click and drag to draw ellipse'}
                            {activeTool === toolNamesRef.current?.ArrowAnnotate && '➡️ Click and drag to draw arrow'}
                        </Typography>
                    </Alert>
                )}
            </Paper>

            {/* Viewport */}
            <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <div
                    ref={viewportRef}
                    style={{
                        width: '100%',
                        height: '100%',
                        backgroundColor: '#000',
                    }}
                />

                {!isInitialized && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'rgba(0, 0, 0, 0.8)',
                        }}
                    >
                        <Typography variant="h6" color="white">
                            Initializing Cornerstone3D...
                        </Typography>
                    </Box>
                )}
            </Box>
        </Box>
    )
}

export default Cornerstone3DViewer
