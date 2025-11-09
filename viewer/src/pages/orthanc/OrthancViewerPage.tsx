import React, { useState, useEffect } from 'react'
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Typography,
  TextField,
  InputAdornment,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Button,
  ButtonGroup,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import PersonIcon from '@mui/icons-material/Person'
import ImageIcon from '@mui/icons-material/Image'
import FolderIcon from '@mui/icons-material/Folder'
import VisibilityIcon from '@mui/icons-material/Visibility'
import InfoIcon from '@mui/icons-material/Info'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import SpeedIcon from '@mui/icons-material/Speed'
import SettingsIcon from '@mui/icons-material/Settings'
import { useNavigate } from 'react-router-dom'
import {
  getOrthancStudies,
  getOrthancStudy,
  getOrthancStats,
  getOrthancSeriesPreviewUrl,
} from '../../services/ApiService'

interface Study {
  id: string
  patientID: string
  patientName: string
  studyDate: string
  studyTime: string
  studyDescription: string
  modality: string
  studyInstanceUID: string
  seriesCount: number
  instancesCount: number
  series: string[]
  source?: 'orthanc' | 'database' | 'both'
  hasOrthancData?: boolean
  hasDatabaseData?: boolean
  cloudinaryUrl?: string
  dbId?: string
}

interface SeriesDetails {
  id: string
  seriesInstanceUID: string
  seriesDescription: string
  seriesNumber: string
  modality: string
  instancesCount: number
  instances: string[]
}

interface StudyDetails extends Study {
  seriesDetails: SeriesDetails[]
  previewInstanceId?: string
}

interface Stats {
  orthanc?: {
    CountStudies: number
    CountSeries: number
    CountInstances: number
  }
  database?: {
    studies: number
    instances: number
  }
  combined?: {
    totalStudies: number
    totalInstances: number
  }
}

const OrthancViewerPage: React.FC = () => {
  const navigate = useNavigate()
  const [studies, setStudies] = useState<Study[]>([])
  const [filteredStudies, setFilteredStudies] = useState<Study[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStudy, setSelectedStudy] = useState<StudyDetails | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [viewerDialog, setViewerDialog] = useState<{
    open: boolean
    study: Study | null
  }>({ open: false, study: null })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    filterStudies()
  }, [searchQuery, studies])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [studiesResponse, statsResponse] = await Promise.all([
        getOrthancStudies(),
        getOrthancStats(),
      ])

      if (studiesResponse.success) {
        setStudies(studiesResponse.studies)
        setFilteredStudies(studiesResponse.studies)
      }

      if (statsResponse.success && statsResponse.statistics) {
        setStats(statsResponse.statistics)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load studies')
    } finally {
      setLoading(false)
    }
  }

  const filterStudies = () => {
    if (!searchQuery) {
      setFilteredStudies(studies)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = studies.filter(
      (study) =>
        study.patientName.toLowerCase().includes(query) ||
        study.patientID.toLowerCase().includes(query) ||
        study.studyDescription.toLowerCase().includes(query)
    )
    setFilteredStudies(filtered)
  }

  const handleStudyClick = async (studyId: string) => {
    try {
      const response = await getOrthancStudy(studyId)
      if (response.success) {
        setSelectedStudy(response.study)
        setModalOpen(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load study details')
    }
  }

  const handleViewInCornerstone = (studyInstanceUID: string) => {
    navigate(`/app/viewer/${studyInstanceUID}`)
  }

  const openInStoneViewer = (orthancStudyId: string) => {
    // Try Stone viewer first, fallback to basic Orthanc viewer
    const stoneUrl = `http://69.62.70.102:8042/stone-webviewer/index.html?study=${orthancStudyId}`
    const basicUrl = `http://69.62.70.102:8042/app/explorer.html#study?uuid=${orthancStudyId}`
    
    // Try to detect if Stone viewer is available
    fetch('http://69.62.70.102:8042/stone-webviewer/')
      .then(() => {
        // Stone viewer is available
        window.open(stoneUrl, '_blank', 'width=1400,height=900')
      })
      .catch(() => {
        // Stone viewer not available, use basic viewer
        window.open(basicUrl, '_blank', 'width=1200,height=800')
      })
  }

  const handleViewStudy = (study: Study) => {
    setViewerDialog({ open: true, study })
  }

  const formatDate = (dateStr: string): string => {
    if (!dateStr || dateStr.length < 8) return 'N/A'
    const year = dateStr.substring(0, 4)
    const month = dateStr.substring(4, 6)
    const day = dateStr.substring(6, 8)
    return `${day}/${month}/${year}`
  }

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        bgcolor="#f5f5f5"
      >
        <CircularProgress size={60} />
      </Box>
    )
  }

  return (
    <Box bgcolor="#f5f5f5" minHeight="100vh" py={4}>
      <Container maxWidth="xl">
        {/* Header */}
        <Box mb={4}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h3" fontWeight="bold" color="primary">
              🏥 DICOM Study Browser
            </Typography>
            <Box display="flex" gap={2}>
              <Button
                variant="outlined"
                onClick={() => navigate('/app/dashboard')}
              >
                Dashboard
              </Button>
              <Button
                variant="outlined"
                onClick={() => window.open('http://69.62.70.102:8042/app/explorer.html', '_blank')}
              >
                Orthanc UI
              </Button>
              <Button
                variant="outlined"
                onClick={() => window.open('http://localhost:8001/pacs-upload', '_blank')}
              >
                Upload Files
              </Button>
            </Box>
          </Box>
          
          {/* Stats */}
          {stats && (
            <Grid container spacing={2} mb={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h4" color="primary" fontWeight="bold">
                      {stats.combined?.totalStudies || stats.orthanc?.CountStudies || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Studies
                    </Typography>
                    {stats.orthanc && stats.database && (
                      <Typography variant="caption" color="text.secondary">
                        Orthanc: {stats.orthanc.CountStudies} | DB: {stats.database.studies}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h4" color="primary" fontWeight="bold">
                      {stats.orthanc?.CountSeries || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Series
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h4" color="primary" fontWeight="bold">
                      {stats.combined?.totalInstances || stats.orthanc?.CountInstances || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Images
                    </Typography>
                    {stats.orthanc && stats.database && (
                      <Typography variant="caption" color="text.secondary">
                        Orthanc: {stats.orthanc.CountInstances} | DB: {stats.database.instances}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h4" color="success.main" fontWeight="bold">
                      {studies.filter(s => s.source === 'both').length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Synced Studies
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {/* Search */}
          <TextField
            fullWidth
            variant="outlined"
            placeholder="🔍 Search by patient name, ID, or study description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ bgcolor: 'white', borderRadius: 2 }}
          />
        </Box>

        {/* Error */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Studies Grid */}
        {filteredStudies.length === 0 ? (
          <Box textAlign="center" py={8}>
            <Typography variant="h5" color="text.secondary">
              No studies found
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={1}>
              Upload DICOM files to Orthanc to get started
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {filteredStudies.map((study) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={study.id}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 6,
                    },
                  }}
                  onClick={() => handleViewStudy(study)}
                >
                  <CardMedia
                    component="div"
                    sx={{
                      height: 200,
                      bgcolor: '#f0f0f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {study.series && study.series[0] ? (
                      <img
                        src={getOrthancSeriesPreviewUrl(study.series[0])}
                        alt="Study preview"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain',
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <ImageIcon sx={{ fontSize: 60, color: '#ccc' }} />
                    )}
                  </CardMedia>
                  <CardContent>
                    <Typography variant="h6" gutterBottom noWrap>
                      {study.patientName || 'Unknown'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      <PersonIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                      ID: {study.patientID || 'Unknown'}
                    </Typography>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Date
                        </Typography>
                        <Typography variant="body2">
                          {formatDate(study.studyDate)}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Modality
                        </Typography>
                        <Chip label={study.modality || 'N/A'} size="small" color="primary" />
                      </Box>
                    </Box>
                    <Box display="flex" gap={0.5} mt={1} flexWrap="wrap">
                      {study.hasOrthancData && (
                        <Chip label="Orthanc" size="small" color="success" variant="outlined" />
                      )}
                      {study.hasDatabaseData && (
                        <Chip label="Database" size="small" color="info" variant="outlined" />
                      )}
                      {study.cloudinaryUrl && (
                        <Chip label="Cloud" size="small" color="warning" variant="outlined" />
                      )}
                    </Box>
                    <Box display="flex" justifyContent="space-between" mt={2}>
                      <Typography variant="caption" color="text.secondary">
                        <FolderIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                        {study.seriesCount} series
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        <ImageIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                        {study.instancesCount} images
                      </Typography>
                    </Box>
                    {study.studyDescription && (
                      <Typography variant="caption" color="text.secondary" mt={1} display="block" noWrap>
                        {study.studyDescription}
                      </Typography>
                    )}
                  </CardContent>
                  <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                    <Button
                      size="small"
                      startIcon={<InfoIcon />}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleStudyClick(study.id)
                      }}
                      sx={{ textTransform: 'none' }}
                    >
                      Details
                    </Button>
                    <ButtonGroup size="small">
                      <Button
                        variant="outlined"
                        startIcon={<OpenInNewIcon />}
                        onClick={(e) => {
                          e.stopPropagation()
                          openInStoneViewer(study.id)
                        }}
                        sx={{ textTransform: 'none' }}
                      >
                        Quick
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={<VisibilityIcon />}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleViewInCornerstone(study.studyInstanceUID)
                        }}
                        sx={{ textTransform: 'none' }}
                      >
                        Advanced
                      </Button>
                    </ButtonGroup>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Study Details Modal */}
        <Dialog
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          maxWidth="lg"
          fullWidth
        >
          {selectedStudy && (
            <>
              <DialogTitle>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="h5">
                    {selectedStudy.patientName} - {formatDate(selectedStudy.studyDate)}
                  </Typography>
                  <IconButton onClick={() => setModalOpen(false)}>
                    <CloseIcon />
                  </IconButton>
                </Box>
              </DialogTitle>
              <DialogContent>
                <Box mb={3}>
                  <Typography variant="h6" gutterBottom>
                    Study Information
                  </Typography>
                  <Typography variant="body2">
                    <strong>Patient ID:</strong> {selectedStudy.patientID}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Study Date:</strong> {formatDate(selectedStudy.studyDate)}{' '}
                    {selectedStudy.studyTime}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Description:</strong> {selectedStudy.studyDescription || 'N/A'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Modality:</strong> {selectedStudy.modality || 'N/A'}
                  </Typography>
                </Box>

                <Typography variant="h6" gutterBottom>
                  Series ({selectedStudy.seriesDetails?.length || 0}) 1235
                </Typography>
                <Grid container spacing={2}>
                  {selectedStudy.seriesDetails?.map((series) => (
                    <Grid item xs={12} sm={6} md={4} key={series.id}>
                      <Card>
                        <CardMedia
                          component="div"
                          sx={{
                            height: 150,
                            bgcolor: '#f0f0f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <img
                            src={getOrthancSeriesPreviewUrl(series.id)}
                            alt="Series preview"
                            style={{
                              maxWidth: '100%',
                              maxHeight: '100%',
                              objectFit: 'contain',
                            }}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        </CardMedia>
                        <CardContent>
                          <Typography variant="subtitle2" gutterBottom>
                            {series.seriesDescription || `Series ${series.seriesNumber}`}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {series.instancesCount} images
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {series.modality}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </DialogContent>
            </>
          )}
        </Dialog>

        {/* Viewer Selection Dialog */}
        <Dialog
          open={viewerDialog.open}
          onClose={() => setViewerDialog({ open: false, study: null })}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Choose Viewer</DialogTitle>
          <DialogContent>
            <List>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => {
                    if (viewerDialog.study) {
                      openInStoneViewer(viewerDialog.study.id)
                      setViewerDialog({ open: false, study: null })
                    }
                  }}
                >
                  <ListItemIcon>
                    <SpeedIcon color="primary" fontSize="large" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Quick View (Orthanc Viewer)"
                    secondary="Fast viewing with cine mode, window/level, zoom/pan. Opens in new tab."
                    primaryTypographyProps={{ fontWeight: 'bold' }}
                  />
                </ListItemButton>
              </ListItem>

              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => {
                    if (viewerDialog.study) {
                      handleViewInCornerstone(viewerDialog.study.studyInstanceUID)
                      setViewerDialog({ open: false, study: null })
                    }
                  }}
                >
                  <ListItemIcon>
                    <SettingsIcon color="secondary" fontSize="large" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Advanced Viewer (Cornerstone)"
                    secondary="Full diagnostic tools: measurements, annotations, 3D rendering, MPR. Best for detailed analysis."
                    primaryTypographyProps={{ fontWeight: 'bold' }}
                  />
                </ListItemButton>
              </ListItem>

              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => {
                    if (viewerDialog.study) {
                      handleStudyClick(viewerDialog.study.id)
                      setViewerDialog({ open: false, study: null })
                    }
                  }}
                >
                  <ListItemIcon>
                    <InfoIcon color="info" fontSize="large" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Details Only"
                    secondary="View study metadata, series information, and preview images without opening full viewer."
                    primaryTypographyProps={{ fontWeight: 'bold' }}
                  />
                </ListItemButton>
              </ListItem>
            </List>
          </DialogContent>
        </Dialog>
      </Container>
    </Box>
  )
}

export default OrthancViewerPage
