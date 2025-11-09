import React, { useState, useEffect, useRef } from 'react'
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  Chip,
  Grid,
} from '@mui/material'
import {
  CompareArrows as CompareIcon,
  Close as CloseIcon,
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
  SwapHoriz as SwapIcon,
} from '@mui/icons-material'
import { format } from 'date-fns'

interface Study {
  studyInstanceUID: string
  studyDate: string
  studyDescription: string
  modality: string
  patientName: string
  seriesCount: number
}

interface ComparisonViewerProps {
  currentStudy: Study
  availablePriorStudies: Study[]
  onClose?: () => void
  onStudyLoad?: (studyUID: string, position: 'left' | 'right') => void
}

export const ComparisonViewer: React.FC<ComparisonViewerProps> = ({
  currentStudy,
  availablePriorStudies,
  onClose,
  onStudyLoad,
}) => {
  const [leftStudy, setLeftStudy] = useState<Study>(currentStudy)
  const [rightStudy, setRightStudy] = useState<Study | null>(
    availablePriorStudies.length > 0 ? availablePriorStudies[0] : null
  )
  const [syncScroll, setSyncScroll] = useState(true)
  const [syncWindowLevel, setSyncWindowLevel] = useState(true)
  const [syncZoom, setSyncZoom] = useState(true)
  
  const leftViewportRef = useRef<HTMLDivElement>(null)
  const rightViewportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (leftStudy) {
      onStudyLoad?.(leftStudy.studyInstanceUID, 'left')
    }
  }, [leftStudy, onStudyLoad])

  useEffect(() => {
    if (rightStudy) {
      onStudyLoad?.(rightStudy.studyInstanceUID, 'right')
    }
  }, [rightStudy, onStudyLoad])

  const handleSwapStudies = () => {
    const temp = leftStudy
    setLeftStudy(rightStudy!)
    setRightStudy(temp)
  }

  const formatStudyDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy')
    } catch {
      return dateString
    }
  }

  const getStudyAge = (studyDate: string) => {
    try {
      const date = new Date(studyDate)
      const now = new Date()
      const diffTime = Math.abs(now.getTime() - date.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      if (diffDays < 30) return `${diffDays}d ago`
      if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
      return `${Math.floor(diffDays / 365)}y ago`
    } catch {
      return ''
    }
  }

  return (
    <Paper elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CompareIcon color="primary" />
            <Typography variant="h6">Study Comparison</Typography>
            <Chip label={currentStudy.patientName} size="small" />
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {rightStudy && (
              <Tooltip title="Swap studies">
                <IconButton onClick={handleSwapStudies} size="small">
                  <SwapIcon />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Close comparison">
              <IconButton onClick={onClose} size="small">
                <CloseIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Sync Controls */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <FormControlLabel
            control={
              <Switch
                checked={syncScroll}
                onChange={(e) => setSyncScroll(e.target.checked)}
                size="small"
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {syncScroll ? <LinkIcon fontSize="small" /> : <LinkOffIcon fontSize="small" />}
                <Typography variant="caption">Sync Scroll</Typography>
              </Box>
            }
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={syncWindowLevel}
                onChange={(e) => setSyncWindowLevel(e.target.checked)}
                size="small"
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {syncWindowLevel ? <LinkIcon fontSize="small" /> : <LinkOffIcon fontSize="small" />}
                <Typography variant="caption">Sync W/L</Typography>
              </Box>
            }
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={syncZoom}
                onChange={(e) => setSyncZoom(e.target.checked)}
                size="small"
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {syncZoom ? <LinkIcon fontSize="small" /> : <LinkOffIcon fontSize="small" />}
                <Typography variant="caption">Sync Zoom</Typography>
              </Box>
            }
          />
        </Box>
      </Box>

      {/* Study Selectors */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Left Study</InputLabel>
              <Select
                value={leftStudy.studyInstanceUID}
                label="Left Study"
                onChange={(e) => {
                  const study = [currentStudy, ...availablePriorStudies].find(
                    s => s.studyInstanceUID === e.target.value
                  )
                  if (study) setLeftStudy(study)
                }}
              >
                <MenuItem value={currentStudy.studyInstanceUID}>
                  <Box>
                    <Typography variant="body2">
                      {formatStudyDate(currentStudy.studyDate)} - {currentStudy.modality}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Current Study
                    </Typography>
                  </Box>
                </MenuItem>
                {availablePriorStudies.map((study) => (
                  <MenuItem key={study.studyInstanceUID} value={study.studyInstanceUID}>
                    <Box>
                      <Typography variant="body2">
                        {formatStudyDate(study.studyDate)} - {study.modality}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {getStudyAge(study.studyDate)} • {study.studyDescription}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Right Study</InputLabel>
              <Select
                value={rightStudy?.studyInstanceUID || ''}
                label="Right Study"
                onChange={(e) => {
                  const study = [currentStudy, ...availablePriorStudies].find(
                    s => s.studyInstanceUID === e.target.value
                  )
                  if (study) setRightStudy(study)
                }}
              >
                <MenuItem value={currentStudy.studyInstanceUID}>
                  <Box>
                    <Typography variant="body2">
                      {formatStudyDate(currentStudy.studyDate)} - {currentStudy.modality}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Current Study
                    </Typography>
                  </Box>
                </MenuItem>
                {availablePriorStudies.map((study) => (
                  <MenuItem key={study.studyInstanceUID} value={study.studyInstanceUID}>
                    <Box>
                      <Typography variant="body2">
                        {formatStudyDate(study.studyDate)} - {study.modality}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {getStudyAge(study.studyDate)} • {study.studyDescription}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Box>

      {/* Viewports */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Viewport */}
        <Box sx={{ flex: 1, position: 'relative', borderRight: 1, borderColor: 'divider' }}>
          <Box sx={{ position: 'absolute', top: 8, left: 8, zIndex: 1 }}>
            <Chip
              label={`${formatStudyDate(leftStudy.studyDate)} - ${leftStudy.modality}`}
              size="small"
              sx={{ bgcolor: 'rgba(0,0,0,0.7)', color: 'white' }}
            />
          </Box>
          <div
            ref={leftViewportRef}
            id="comparison-viewport-left"
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#000',
            }}
          />
        </Box>

        {/* Right Viewport */}
        <Box sx={{ flex: 1, position: 'relative' }}>
          {rightStudy ? (
            <>
              <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}>
                <Chip
                  label={`${formatStudyDate(rightStudy.studyDate)} - ${rightStudy.modality}`}
                  size="small"
                  sx={{ bgcolor: 'rgba(0,0,0,0.7)', color: 'white' }}
                />
              </Box>
              <div
                ref={rightViewportRef}
                id="comparison-viewport-right"
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: '#000',
                }}
              />
            </>
          ) : (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'grey.900',
              }}
            >
              <Typography variant="body1" color="grey.400">
                No prior study selected
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Paper>
  )
}

export default ComparisonViewer
