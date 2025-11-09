import React, { useCallback, useMemo, useState, useEffect } from 'react'
import {
  Paper,
  IconButton,
  Typography,
  Box,
  Divider,
  Card,
  CardContent,
  Chip,
  styled,
  LinearProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  Straighten as RulerIcon,
  Architecture as AngleIcon,
  CropFree as AreaIcon,
  Psychology as AIIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  HourglassEmpty as PendingIcon,
} from '@mui/icons-material'
import { autoAnalysisService } from '../../services/AutoAnalysisService'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { ANALYSIS_PANEL_STYLES, TRANSITION_DURATION, EASING } from './selectionStyles'
import { debounce } from '../../utils/debounce'
import {
  selectMeasurements,
  selectAnnotations,
  selectSelectedMeasurementId,
  selectSelectedAnnotationId,
  selectMeasurement,
  selectAnnotation,
  removeMeasurementWithSync,
  removeAnnotationWithSync,
  selectActionHistory,
} from '../../store/slices/viewerSlice'
import selectionSyncService from '../../services/selectionSyncService'

// Styled component for smooth transitions
const SelectionTransition = styled(Card)(({ theme }) => ({
  transition: theme.transitions.create(
    ['background-color', 'border-color', 'box-shadow', 'transform'],
    {
      duration: TRANSITION_DURATION.short,
      easing: EASING.easeInOut,
    }
  ),
  '&:hover': {
    transform: 'translateX(-2px)',
    boxShadow: theme.shadows[4],
  },
}))

// Types from viewer
interface Measurement {
  id: string
  type: string
  data: any
  createdAt: string
}

interface Annotation {
  id: string
  type: string
  text: string
  data: any
  createdAt: string
}

interface MeasurementsListProps {
  measurements: Measurement[]
  selectedId: string | null
  onSelect: (id: string) => void
  onRemove: (id: string) => void
}

const MeasurementsList: React.FC<MeasurementsListProps> = ({
  measurements,
  selectedId,
  onSelect,
  onRemove,
}) => {
  const getMeasurementIcon = (type: string) => {
    switch (type) {
      case 'length':
        return <RulerIcon fontSize="small" />
      case 'angle':
        return <AngleIcon fontSize="small" />
      case 'area':
        return <AreaIcon fontSize="small" />
      default:
        return <RulerIcon fontSize="small" />
    }
  }

  const getMeasurementLabel = (measurement: Measurement) => {
    // Extract value from data if available
    const value = measurement.data?.value || 'N/A'
    const unit = measurement.data?.unit || ''
    return `${value} ${unit}`.trim()
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {measurements.map((measurement) => {
        const isSelected = measurement.id === selectedId
        
        return (
          <SelectionTransition
            key={measurement.id}
            sx={{
              cursor: 'pointer',
              bgcolor: isSelected ? ANALYSIS_PANEL_STYLES.selected.backgroundColor : ANALYSIS_PANEL_STYLES.normal.backgroundColor,
              borderLeft: isSelected ? ANALYSIS_PANEL_STYLES.selected.borderLeft : '4px solid transparent',
              '&:hover': {
                bgcolor: isSelected ? 'rgba(0, 255, 65, 0.3)' : ANALYSIS_PANEL_STYLES.hovered.backgroundColor,
              },
            }}
            onClick={() => onSelect(measurement.id)}
          >
            <CardContent sx={{ py: 1, px: 2, '&:last-child': { pb: 1 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                  {getMeasurementIcon(measurement.type)}
                  <Box>
                    <Typography variant="body2" fontWeight={isSelected ? 600 : 400}>
                      {measurement.type.charAt(0).toUpperCase() + measurement.type.slice(1)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {getMeasurementLabel(measurement)}
                    </Typography>
                  </Box>
                </Box>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(measurement.id)
                  }}
                  sx={{ color: 'error.main' }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            </CardContent>
          </SelectionTransition>
        )
      })}
    </Box>
  )
}

interface AnnotationsListProps {
  annotations: Annotation[]
  selectedId: string | null
  onSelect: (id: string) => void
  onRemove: (id: string) => void
}

const AnnotationsList: React.FC<AnnotationsListProps> = ({
  annotations,
  selectedId,
  onSelect,
  onRemove,
}) => {
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp)
      return date.toLocaleTimeString()
    } catch {
      return 'N/A'
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {annotations.map((annotation) => {
        const isSelected = annotation.id === selectedId
        
        return (
          <SelectionTransition
            key={annotation.id}
            sx={{
              cursor: 'pointer',
              bgcolor: isSelected ? ANALYSIS_PANEL_STYLES.selected.backgroundColor : ANALYSIS_PANEL_STYLES.normal.backgroundColor,
              borderLeft: isSelected ? ANALYSIS_PANEL_STYLES.selected.borderLeft : '4px solid transparent',
              '&:hover': {
                bgcolor: isSelected ? 'rgba(0, 255, 65, 0.3)' : ANALYSIS_PANEL_STYLES.hovered.backgroundColor,
              },
            }}
            onClick={() => onSelect(annotation.id)}
          >
            <CardContent sx={{ py: 1, px: 2, '&:last-child': { pb: 1 } }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <Box sx={{ flex: 1, mr: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Chip
                      label={annotation.type}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.7rem',
                        bgcolor: 'primary.main',
                        color: 'white',
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {formatTimestamp(annotation.createdAt)}
                    </Typography>
                  </Box>
                  {annotation.text && (
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: isSelected ? 600 : 400,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {annotation.text}
                    </Typography>
                  )}
                </Box>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(annotation.id)
                  }}
                  sx={{ color: 'error.main' }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            </CardContent>
          </SelectionTransition>
        )
      })}
    </Box>
  )
}

interface AnalysisPanelProps {
  isOpen: boolean
  onClose: () => void
  measurements?: any[]
  annotations?: any[]
  currentFrameIndex?: number
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ 
  isOpen, 
  onClose, 
  measurements: propMeasurements, 
  annotations: propAnnotations,
  currentFrameIndex = 0
}) => {
  const dispatch = useAppDispatch()
  
  // Use props if provided, otherwise fallback to Redux
  const reduxMeasurements = useAppSelector(selectMeasurements)
  const reduxAnnotations = useAppSelector(selectAnnotations)
  const measurements = propMeasurements || reduxMeasurements
  const annotations = propAnnotations || reduxAnnotations
  const selectedMeasurementId = useAppSelector(selectSelectedMeasurementId)
  const selectedAnnotationId = useAppSelector(selectSelectedAnnotationId)
  const actionHistory = useAppSelector(selectActionHistory) || []

  // AI Analysis Results State
  const [aiAnalysis, setAiAnalysis] = useState<any>(null)
  const [aiAnalysisStatus, setAiAnalysisStatus] = useState<'idle' | 'analyzing' | 'complete' | 'failed'>('idle')

  // Subscribe to AI analysis updates for current frame
  useEffect(() => {
    const updateAIAnalysis = () => {
      const analysis = autoAnalysisService.getSliceAnalysis(currentFrameIndex)
      if (analysis) {
        setAiAnalysisStatus(analysis.status as any)
        if (analysis.status === 'complete' && analysis.results) {
          setAiAnalysis(analysis.results)
        } else if (analysis.status === 'failed') {
          setAiAnalysis(null)
        }
      } else {
        setAiAnalysisStatus('idle')
        setAiAnalysis(null)
      }
    }

    // Initial update
    updateAIAnalysis()

    // Subscribe to changes
    const unsubscribe = autoAnalysisService.subscribe(updateAIAnalysis)
    return unsubscribe
  }, [currentFrameIndex])

  // Debounced sync functions (300ms delay to prevent excessive API calls)
  const debouncedSyncSelection = useMemo(
    () => debounce((itemId: string, itemType: 'measurement' | 'annotation', action: 'select' | 'deselect') => {
      selectionSyncService.syncSelection(itemId, itemType, action).catch(err => {
        console.error('Failed to sync selection:', err)
      })
    }, 300),
    []
  )

  // Measurement selection handler
  const handleMeasurementClick = useCallback((id: string) => {
    dispatch(selectMeasurement(id))
    // Sync to server (debounced)
    debouncedSyncSelection(id, 'measurement', 'select')
  }, [dispatch, debouncedSyncSelection])

  // Annotation selection handler
  const handleAnnotationClick = useCallback((id: string) => {
    dispatch(selectAnnotation(id))
    // Sync to server (debounced)
    debouncedSyncSelection(id, 'annotation', 'select')
  }, [dispatch, debouncedSyncSelection])

  // Measurement removal handler
  const handleMeasurementRemove = useCallback((id: string) => {
    const measurement = measurements.find(m => m.id === id)
    dispatch(removeMeasurementWithSync(id))
    // Sync to server
    selectionSyncService.syncRemoval(id, 'measurement', measurement).catch(err => {
      console.error('Failed to sync measurement removal:', err)
    })
  }, [dispatch, measurements])

  // Annotation removal handler
  const handleAnnotationRemove = useCallback((id: string) => {
    const annotation = annotations.find(a => a.id === id)
    dispatch(removeAnnotationWithSync(id))
    // Sync to server
    selectionSyncService.syncRemoval(id, 'annotation', annotation).catch(err => {
      console.error('Failed to sync annotation removal:', err)
    })
  }, [dispatch, annotations])

  // Memoized selected items (avoid re-computing on every render)
  const selectedMeasurement = useMemo(
    () => measurements.find(m => m.id === selectedMeasurementId),
    [measurements, selectedMeasurementId]
  )

  const selectedAnnotation = useMemo(
    () => annotations.find(a => a.id === selectedAnnotationId),
    [annotations, selectedAnnotationId]
  )

  // Debug logging
  console.log('[ANALYSIS RECEIVE]', {
    isOpen,
    measurementsCount: measurements?.length || 0,
    annotationsCount: annotations?.length || 0,
    actionHistoryCount: actionHistory?.length || 0,
    latestAction: actionHistory?.length > 0 ? actionHistory[actionHistory.length - 1] : null,
  })

  // Debug logging
  console.log('[ANALYSIS PANEL]', {
    isOpen,
    measurementsCount: measurements?.length || 0,
    annotationsCount: annotations?.length || 0,
    actionHistoryCount: actionHistory?.length || 0,
    measurements,
    annotations,
  })

  if (!isOpen) {
    return null
  }

  return (
    <Paper
      sx={{
        position: 'fixed',
        top: 120,
        right: 20,
        width: 300,
        maxHeight: 400,
        overflow: 'auto',
        bgcolor: 'background.paper',
        boxShadow: 3,
        zIndex: 1000,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          bgcolor: 'primary.main',
          color: 'white',
        }}
      >
        <Typography variant="h6">Analysis</Typography>
        <IconButton
          size="small"
          onClick={onClose}
          sx={{ color: 'white' }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      <Box sx={{ p: 2 }}>
        {/* AI Analysis Results Section */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <AIIcon color="primary" fontSize="small" />
            <Typography variant="subtitle2">
              AI Analysis (Slice {currentFrameIndex + 1})
            </Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />

          {aiAnalysisStatus === 'idle' && (
            <Alert severity="info" icon={<AIIcon />}>
              No AI analysis for this slice. Click "AI Control" to analyze.
            </Alert>
          )}

          {aiAnalysisStatus === 'analyzing' && (
            <Box>
              <Alert severity="info" icon={<PendingIcon />}>
                Analyzing slice...
              </Alert>
              <LinearProgress sx={{ mt: 1 }} />
            </Box>
          )}

          {aiAnalysisStatus === 'failed' && (
            <Alert severity="error" icon={<ErrorIcon />}>
              Analysis failed. Please try again.
            </Alert>
          )}

          {aiAnalysisStatus === 'complete' && aiAnalysis && (
            <Box>
              {/* Classification Results */}
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckIcon color="success" fontSize="small" />
                    <Typography variant="body2" fontWeight="bold">
                      Classification
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      <strong>Result:</strong> {aiAnalysis.classification?.label || 'Unknown'}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography variant="body2">
                        <strong>Confidence:</strong>
                      </Typography>
                      <Chip
                        label={`${((aiAnalysis.classification?.confidence || 0) * 100).toFixed(1)}%`}
                        size="small"
                        color={
                          (aiAnalysis.classification?.confidence || 0) > 0.8 ? 'success' :
                          (aiAnalysis.classification?.confidence || 0) > 0.5 ? 'warning' : 'error'
                        }
                      />
                    </Box>
                    {aiAnalysis.classification?.topPredictions && aiAnalysis.classification.topPredictions.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Top Predictions:
                        </Typography>
                        {aiAnalysis.classification.topPredictions.slice(0, 3).map((pred: any, idx: number) => (
                          <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                            <Typography variant="caption">
                              {pred.label || pred.class}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {((pred.confidence || pred.score) * 100).toFixed(1)}%
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                </AccordionDetails>
              </Accordion>

              {/* Findings */}
              {aiAnalysis.findings && aiAnalysis.findings.length > 0 && (
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="body2" fontWeight="bold">
                      Findings ({aiAnalysis.findings.length})
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box>
                      {aiAnalysis.findings.map((finding: any, idx: number) => (
                        <Card key={idx} sx={{ mb: 1, bgcolor: 'background.default' }}>
                          <CardContent sx={{ py: 1, px: 2, '&:last-child': { pb: 1 } }}>
                            <Typography variant="body2" fontWeight="bold">
                              {finding.type || finding.label}
                            </Typography>
                            {finding.description && (
                              <Typography variant="caption" color="text.secondary">
                                {finding.description}
                              </Typography>
                            )}
                            {finding.confidence && (
                              <Chip
                                label={`${(finding.confidence * 100).toFixed(0)}%`}
                                size="small"
                                sx={{ mt: 0.5 }}
                              />
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              )}

              {/* Clinical Report */}
              {aiAnalysis.report && (
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="body2" fontWeight="bold">
                      Clinical Report
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box>
                      {aiAnalysis.report.findings && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="caption" fontWeight="bold" color="primary">
                            FINDINGS:
                          </Typography>
                          <Typography variant="caption" component="div" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>
                            {aiAnalysis.report.findings}
                          </Typography>
                        </Box>
                      )}
                      {aiAnalysis.report.impression && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="caption" fontWeight="bold" color="primary">
                            IMPRESSION:
                          </Typography>
                          <Typography variant="caption" component="div" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>
                            {aiAnalysis.report.impression}
                          </Typography>
                        </Box>
                      )}
                      {aiAnalysis.report.recommendations && aiAnalysis.report.recommendations.length > 0 && (
                        <Box>
                          <Typography variant="caption" fontWeight="bold" color="primary">
                            RECOMMENDATIONS:
                          </Typography>
                          <Box component="ul" sx={{ mt: 0.5, pl: 2, mb: 0 }}>
                            {aiAnalysis.report.recommendations.map((rec: string, idx: number) => (
                              <Typography key={idx} variant="caption" component="li">
                                {rec}
                              </Typography>
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              )}

              {/* Analysis Metadata */}
              <Box sx={{ mt: 1, p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Analysis ID: {aiAnalysis.analysisId}
                </Typography>
                <br />
                <Typography variant="caption" color="text.secondary">
                  Analyzed: {new Date(aiAnalysis.analyzedAt).toLocaleString()}
                </Typography>
              </Box>
            </Box>
          )}
        </Box>

        {/* Measurements Section - Placeholder for subtask 5.2 */}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Measurements ({measurements.length})
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        {measurements.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            No measurements
          </Typography>
        ) : (
          <Box sx={{ mb: 2 }}>
            <MeasurementsList
              measurements={measurements}
              selectedId={selectedMeasurementId}
              onSelect={handleMeasurementClick}
              onRemove={handleMeasurementRemove}
            />
          </Box>
        )}

        {/* Annotations Section - Placeholder for subtask 5.3 */}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Annotations ({annotations.length})
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        {annotations.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            No annotations
          </Typography>
        ) : (
          <Box sx={{ mb: 2 }}>
            <AnnotationsList
              annotations={annotations}
              selectedId={selectedAnnotationId}
              onSelect={handleAnnotationClick}
              onRemove={handleAnnotationRemove}
            />
          </Box>
        )}

        {/* Action History Section */}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Recent Actions ({actionHistory.length})
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        {actionHistory.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No actions yet
          </Typography>
        ) : (
          <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
            {actionHistory.slice(-10).reverse().map((action) => {
              const getActionColor = () => {
                switch (action.actionType) {
                  case 'create': return 'success'
                  case 'delete': return 'error'
                  case 'move': return 'info'
                  case 'text-edit': return 'warning'
                  default: return 'default'
                }
              }
              
              const getActionLabel = () => {
                const type = action.actionType.charAt(0).toUpperCase() + action.actionType.slice(1)
                const itemType = action.itemType === 'measurement' ? 'Measurement' : 'Annotation'
                return `${type} ${itemType}`
              }
              
              const formatTime = (timestamp: number) => {
                const now = Date.now()
                const diff = now - timestamp
                if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
                if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
                return `${Math.floor(diff / 3600000)}h ago`
              }
              
              return (
                <Card key={action.id} sx={{ mb: 1, bgcolor: 'background.default' }}>
                  <CardContent sx={{ py: 1, px: 2, '&:last-child': { pb: 1 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Chip 
                          label={getActionLabel()} 
                          size="small" 
                          color={getActionColor()}
                          sx={{ mr: 1 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {formatTime(action.timestamp)}
                        </Typography>
                      </Box>
                    </Box>
                    {action.metadata?.text && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        "{action.metadata.text}"
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </Box>
        )}
      </Box>
    </Paper>
  )
}

export default AnalysisPanel
