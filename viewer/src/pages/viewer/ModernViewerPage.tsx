import React, { useState, useEffect } from 'react'
import {
    Box,
    Typography,
    IconButton,
    Paper,
    Chip,
    Stack,
    Tooltip,
    Fade,
    Slide,
    alpha,
    useTheme,
    Avatar,
    Divider,
    ButtonBase,
} from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { MedicalImageViewer } from '../../components/viewer/MedicalImageViewer'
import Cornerstone3DViewer from '../../components/viewer/Cornerstone3DViewer'
import { VolumeViewer3D } from '../../components/viewer/VolumeViewer3D'
import { ProductionReportEditor } from '../../components/reports'
import SmartModalityViewer from '../../components/viewer/SmartModalityViewer'
import ApiService from '../../services/ApiService'
import { ViewReportButton } from '../../components/viewer/ViewReportButton'
import {
    ArrowBack,
    Layers,
    ViewInAr,
    Psychology,
    ImageSearch,
    Description,
    Fullscreen,
    FullscreenExit,
    Settings,
    Share,
    Download,
    Print,
    ZoomIn,
    ZoomOut,
    RotateRight,
    Contrast,
    Brightness7,
    GridOn,
    Close,
} from '@mui/icons-material'

interface ViewMode {
    id: string
    label: string
    icon: React.ReactNode
    component: React.ComponentType<any>
}

const ModernViewerPage: React.FC = () => {
    const theme = useTheme()
    const { studyInstanceUID } = useParams<{ studyInstanceUID: string }>()
    const { user } = useAuth()
    const navigate = useNavigate()

    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [studyData, setStudyData] = useState<any>(null)
    const [activeMode, setActiveMode] = useState<string>('2d')
    const [activePanel, setActivePanel] = useState<string | null>(null)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [showToolbar, setShowToolbar] = useState(true)
    const [selectedSeries, setSelectedSeries] = useState<any>(null)

    const viewModes: ViewMode[] = [
        { id: '2d', label: '2D Stack', icon: <Layers />, component: MedicalImageViewer },
        { id: 'cornerstone', label: 'Cornerstone', icon: <GridOn />, component: Cornerstone3DViewer },
        { id: '3d', label: '3D Volume', icon: <ViewInAr />, component: VolumeViewer3D },
    ]

    const panels = [
        { id: 'report', label: 'Report', icon: <Description />, component: ProductionReportEditor },
    ]

    useEffect(() => {
        const loadStudyData = async () => {
            if (!studyInstanceUID) return
            try {
                setIsLoading(true)
                setError(null)

                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('API call timeout')), 5000)
                })

                const result = await Promise.race([
                    ApiService.getStudyMetadata(studyInstanceUID),
                    timeoutPromise
                ])

                setStudyData(result?.data)
                if (result?.data?.series?.[0]) {
                    setSelectedSeries(result.data.series[0])
                }
            } catch (err: any) {
                console.error('Error loading study:', err)
                setError(err.message)
            } finally {
                setIsLoading(false)
            }
        }

        loadStudyData()
    }, [studyInstanceUID])

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen()
            setIsFullscreen(true)
        } else {
            document.exitFullscreen()
            setIsFullscreen(false)
        }
    }

    const ActiveViewerComponent = viewModes.find(m => m.id === activeMode)?.component || MedicalImageViewer
    const ActivePanelComponent = panels.find(p => p.id === activePanel)?.component

    if (isLoading || !studyInstanceUID) {
        return (
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                bgcolor: '#000',
            }}>
                <Box sx={{ textAlign: 'center' }}>
                    <Box
                        sx={{
                            width: 60,
                            height: 60,
                            borderRadius: '50%',
                            border: '3px solid',
                            borderColor: `${alpha(theme.palette.primary.main, 0.3)}`,
                            borderTopColor: theme.palette.primary.main,
                            animation: 'spin 1s linear infinite',
                            mx: 'auto',
                            mb: 2,
                            '@keyframes spin': {
                                '0%': { transform: 'rotate(0deg)' },
                                '100%': { transform: 'rotate(360deg)' },
                            },
                        }}
                    />
                    <Typography variant="h6" sx={{ color: 'white', fontWeight: 300 }}>
                        Loading Study...
                    </Typography>
                </Box>
            </Box>
        )
    }

    if (error) {
        return (
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                bgcolor: '#000',
            }}>
                <Paper sx={{ p: 4, maxWidth: 500, textAlign: 'center' }}>
                    <Typography variant="h5" color="error" gutterBottom>
                        Error Loading Study
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                        {error}
                    </Typography>
                    <IconButton onClick={() => navigate('/app/dashboard')} sx={{ bgcolor: 'primary.main', color: 'white' }}>
                        <ArrowBack />
                    </IconButton>
                </Paper>
            </Box>
        )
    }

    return (
        <>
            <Helmet>
                <title>{`Viewer - ${studyData?.studyDescription || 'Medical Study'}`}</title>
            </Helmet>

            <Box sx={{
                height: '100vh',
                bgcolor: '#000',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}>
                {/* Modern Header */}
                <Fade in={showToolbar}>
                    <Box
                        sx={{
                            position: 'relative',
                            zIndex: 1000,
                            backdropFilter: 'blur(20px)',
                            bgcolor: alpha('#000', 0.8),
                            borderBottom: `1px solid ${alpha('#fff', 0.1)}`,
                        }}
                    >
                        <Box sx={{
                            px: 3,
                            py: 1.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}>
                            {/* Left Section */}
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Tooltip title="Back">
                                    <IconButton
                                        onClick={() => navigate('/app/dashboard')}
                                        sx={{
                                            color: 'white',
                                            bgcolor: alpha('#fff', 0.1),
                                            '&:hover': { bgcolor: alpha('#fff', 0.2) },
                                            width: 36,
                                            height: 36,
                                        }}
                                    >
                                        <ArrowBack fontSize="small" />
                                    </IconButton>
                                </Tooltip>

                                <Box>
                                    <Typography variant="body1" sx={{ color: 'white', fontWeight: 600, fontSize: '0.95rem' }}>
                                        {studyData?.patientName?.replace('^', ', ') || 'Unknown Patient'}
                                    </Typography>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <Typography variant="caption" sx={{ color: alpha('#fff', 0.6) }}>
                                            ID: {studyData?.patientID || 'N/A'}
                                        </Typography>
                                        <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: alpha('#fff', 0.4) }} />
                                        <Typography variant="caption" sx={{ color: alpha('#fff', 0.6) }}>
                                            {studyData?.studyDate ?
                                                new Date(studyData.studyDate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')).toLocaleDateString()
                                                : 'N/A'
                                            }
                                        </Typography>
                                        <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: alpha('#fff', 0.4) }} />
                                        <Chip
                                            label={studyData?.modality || 'Unknown'}
                                            size="small"
                                            sx={{
                                                height: 20,
                                                fontSize: '0.7rem',
                                                bgcolor: alpha(theme.palette.primary.main, 0.2),
                                                color: theme.palette.primary.light,
                                                border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                                            }}
                                        />
                                    </Stack>
                                </Box>
                            </Stack>

                            {/* Center Section - View Mode Selector */}
                            <Stack direction="row" spacing={0.5} sx={{
                                bgcolor: alpha('#fff', 0.05),
                                borderRadius: 2,
                                p: 0.5,
                            }}>
                                {viewModes.map((mode) => (
                                    <Tooltip key={mode.id} title={mode.label}>
                                        <ButtonBase
                                            onClick={() => setActiveMode(mode.id)}
                                            sx={{
                                                px: 2,
                                                py: 1,
                                                borderRadius: 1.5,
                                                color: activeMode === mode.id ? 'white' : alpha('#fff', 0.6),
                                                bgcolor: activeMode === mode.id ? alpha(theme.palette.primary.main, 0.3) : 'transparent',
                                                transition: 'all 0.2s',
                                                '&:hover': {
                                                    bgcolor: activeMode === mode.id ? alpha(theme.palette.primary.main, 0.4) : alpha('#fff', 0.1),
                                                    color: 'white',
                                                },
                                            }}
                                        >
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                {mode.icon}
                                                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                                    {mode.label}
                                                </Typography>
                                            </Stack>
                                        </ButtonBase>
                                    </Tooltip>
                                ))}
                            </Stack>

                            {/* Right Section - Actions */}
                            <Stack direction="row" spacing={1}>
                                {/* View/Create Report Button */}
                                {studyInstanceUID && studyData && (
                                    <ViewReportButton
                                        studyInstanceUID={studyInstanceUID}
                                        patientID={studyData.patientID}
                                        patientName={studyData.patientName}
                                        modality={studyData.modality}
                                    />
                                )}
                                
                                <Divider orientation="vertical" flexItem sx={{ bgcolor: alpha('#fff', 0.1), mx: 0.5 }} />
                                
                                {panels.map((panel) => (
                                    <Tooltip key={panel.id} title={panel.label}>
                                        <IconButton
                                            onClick={() => setActivePanel(activePanel === panel.id ? null : panel.id)}
                                            sx={{
                                                color: activePanel === panel.id ? theme.palette.primary.light : alpha('#fff', 0.6),
                                                bgcolor: activePanel === panel.id ? alpha(theme.palette.primary.main, 0.2) : alpha('#fff', 0.05),
                                                '&:hover': {
                                                    bgcolor: alpha(theme.palette.primary.main, 0.3),
                                                    color: 'white',
                                                },
                                                width: 36,
                                                height: 36,
                                            }}
                                        >
                                            {panel.icon}
                                        </IconButton>
                                    </Tooltip>
                                ))}

                                <Divider orientation="vertical" flexItem sx={{ bgcolor: alpha('#fff', 0.1), mx: 0.5 }} />

                                <Tooltip title="Share">
                                    <IconButton
                                        sx={{
                                            color: alpha('#fff', 0.6),
                                            bgcolor: alpha('#fff', 0.05),
                                            '&:hover': { bgcolor: alpha('#fff', 0.1), color: 'white' },
                                            width: 36,
                                            height: 36,
                                        }}
                                    >
                                        <Share fontSize="small" />
                                    </IconButton>
                                </Tooltip>

                                <Tooltip title="Download">
                                    <IconButton
                                        sx={{
                                            color: alpha('#fff', 0.6),
                                            bgcolor: alpha('#fff', 0.05),
                                            '&:hover': { bgcolor: alpha('#fff', 0.1), color: 'white' },
                                            width: 36,
                                            height: 36,
                                        }}
                                    >
                                        <Download fontSize="small" />
                                    </IconButton>
                                </Tooltip>

                                <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                                    <IconButton
                                        onClick={toggleFullscreen}
                                        sx={{
                                            color: alpha('#fff', 0.6),
                                            bgcolor: alpha('#fff', 0.05),
                                            '&:hover': { bgcolor: alpha('#fff', 0.1), color: 'white' },
                                            width: 36,
                                            height: 36,
                                        }}
                                    >
                                        {isFullscreen ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
                                    </IconButton>
                                </Tooltip>
                            </Stack>
                        </Box>
                    </Box>
                </Fade>

                {/* Main Content Area */}
                <Box sx={{
                    flex: 1,
                    display: 'flex',
                    position: 'relative',
                    overflow: 'hidden',
                }}>
                    {/* Viewer Area */}
                    <Box sx={{
                        flex: 1,
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <SmartModalityViewer
                            instanceId={studyData?.series?.[0]?.instances?.[0]?.orthancInstanceId || ''}
                            metadata={{
                                Modality: studyData?.modality,
                                NumberOfFrames: studyData?.series?.[0]?.numberOfInstances,
                                ...studyData
                            }}
                        >
                            <ActiveViewerComponent
                                studyInstanceUID={studyInstanceUID}
                                studyData={studyData}
                            />
                        </SmartModalityViewer>

                        {/* Floating Toolbar */}
                        <Fade in={showToolbar}>
                            <Paper
                                sx={{
                                    position: 'absolute',
                                    bottom: 24,
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    backdropFilter: 'blur(20px)',
                                    bgcolor: alpha('#000', 0.7),
                                    border: `1px solid ${alpha('#fff', 0.1)}`,
                                    borderRadius: 3,
                                    px: 2,
                                    py: 1,
                                    display: 'flex',
                                    gap: 1,
                                }}
                            >
                                <Tooltip title="Zoom In">
                                    <IconButton size="small" sx={{ color: 'white' }}>
                                        <ZoomIn fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Zoom Out">
                                    <IconButton size="small" sx={{ color: 'white' }}>
                                        <ZoomOut fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <Divider orientation="vertical" flexItem sx={{ bgcolor: alpha('#fff', 0.2), mx: 0.5 }} />
                                <Tooltip title="Rotate">
                                    <IconButton size="small" sx={{ color: 'white' }}>
                                        <RotateRight fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Contrast">
                                    <IconButton size="small" sx={{ color: 'white' }}>
                                        <Contrast fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Brightness">
                                    <IconButton size="small" sx={{ color: 'white' }}>
                                        <Brightness7 fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <Divider orientation="vertical" flexItem sx={{ bgcolor: alpha('#fff', 0.2), mx: 0.5 }} />
                                <Tooltip title="Settings">
                                    <IconButton size="small" sx={{ color: 'white' }}>
                                        <Settings fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Paper>
                        </Fade>
                    </Box>

                    {/* Side Panel */}
                    <Slide direction="left" in={!!activePanel} mountOnEnter unmountOnExit>
                        <Paper
                            sx={{
                                width: 400,
                                height: '100%',
                                bgcolor: alpha('#000', 0.95),
                                backdropFilter: 'blur(20px)',
                                borderLeft: `1px solid ${alpha('#fff', 0.1)}`,
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                            }}
                        >
                            {/* Panel Header */}
                            <Box sx={{
                                p: 2,
                                borderBottom: `1px solid ${alpha('#fff', 0.1)}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            }}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    {panels.find(p => p.id === activePanel)?.icon}
                                    <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
                                        {panels.find(p => p.id === activePanel)?.label}
                                    </Typography>
                                </Stack>
                                <IconButton
                                    onClick={() => setActivePanel(null)}
                                    size="small"
                                    sx={{
                                        color: alpha('#fff', 0.6),
                                        '&:hover': { color: 'white', bgcolor: alpha('#fff', 0.1) },
                                    }}
                                >
                                    <Close fontSize="small" />
                                </IconButton>
                            </Box>

                            {/* Panel Content */}
                            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                                {activePanel === 'report' && (
                                    <ProductionReportEditor 
                                        studyInstanceUID={studyInstanceUID || ''} 
                                        patientInfo={{
                                            patientID: studyData?.patientID || '',
                                            patientName: studyData?.patientName || '',
                                            modality: studyData?.modality || ''
                                        }}
                                        onClose={() => setActivePanel(null)}
                                    />
                                )}
                            </Box>
                        </Paper>
                    </Slide>
                </Box>

                {/* Series Thumbnails Strip */}
                {studyData?.series && studyData.series.length > 1 && (
                    <Fade in={showToolbar}>
                        <Box
                            sx={{
                                position: 'absolute',
                                left: 16,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                backdropFilter: 'blur(20px)',
                                bgcolor: alpha('#000', 0.7),
                                border: `1px solid ${alpha('#fff', 0.1)}`,
                                borderRadius: 2,
                                p: 1,
                                maxHeight: '60vh',
                                overflow: 'auto',
                                '&::-webkit-scrollbar': {
                                    width: 4,
                                },
                                '&::-webkit-scrollbar-thumb': {
                                    bgcolor: alpha('#fff', 0.3),
                                    borderRadius: 2,
                                },
                            }}
                        >
                            <Stack spacing={1}>
                                {studyData.series.map((series: any, index: number) => (
                                    <Tooltip key={series.seriesInstanceUID} title={series.seriesDescription} placement="right">
                                        <ButtonBase
                                            onClick={() => setSelectedSeries(series)}
                                            sx={{
                                                width: 80,
                                                height: 80,
                                                borderRadius: 1.5,
                                                border: `2px solid ${selectedSeries?.seriesInstanceUID === series.seriesInstanceUID
                                                    ? theme.palette.primary.main
                                                    : alpha('#fff', 0.2)
                                                    }`,
                                                bgcolor: alpha('#fff', 0.05),
                                                overflow: 'hidden',
                                                transition: 'all 0.2s',
                                                '&:hover': {
                                                    border: `2px solid ${theme.palette.primary.light}`,
                                                    transform: 'scale(1.05)',
                                                },
                                            }}
                                        >
                                            <Box sx={{
                                                width: '100%',
                                                height: '100%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexDirection: 'column',
                                                p: 1,
                                            }}>
                                                <Typography variant="caption" sx={{ color: 'white', fontWeight: 600 }}>
                                                    #{series.seriesNumber}
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: alpha('#fff', 0.6), fontSize: '0.65rem' }}>
                                                    {series.numberOfInstances} img
                                                </Typography>
                                            </Box>
                                        </ButtonBase>
                                    </Tooltip>
                                ))}
                            </Stack>
                        </Box>
                    </Fade>
                )}
            </Box>
        </>
    )
}

export default ModernViewerPage
