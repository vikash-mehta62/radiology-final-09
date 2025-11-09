import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { store } from '../../store'
import './MedicalImageViewer.css'
import {
  selectMeasurement,
  selectAnnotation,
  setHoveredMeasurement,
  setHoveredAnnotation,
  clearAllSelections,
  selectSelectedMeasurementId,
  selectSelectedAnnotationId,
  selectHoveredMeasurementId,
  selectHoveredAnnotationId,
  selectMeasurements,
  selectAnnotations,
  addMeasurement as addMeasurementToRedux,
  addAnnotation as addAnnotationToRedux,
  removeMeasurement as removeMeasurementFromRedux,
  removeAnnotation as removeAnnotationFromRedux,
  addToolAction,
  clearMeasurementsAndAnnotations,
} from '../../store/slices/viewerSlice'
import selectionSyncService from '../../services/selectionSyncService'
import { screenshotService } from '../../services/screenshotService'
import InlineTextEditor from './InlineTextEditor'
import type { ControlPoint, HistoryEntry } from '../../types/viewer'
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Alert,
  Button,
  ButtonGroup,
  Chip,
  Divider,
  Slider,
  FormControlLabel,
  Switch,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Card,
  CardContent,
  Badge,
} from '@mui/material'
import {
  ViewInAr as View3DIcon,
  GridView as MPRIcon,
  Image as StackIcon,
  Settings as SettingsIcon,
  PanTool as PanIcon,
  ZoomIn as ZoomIcon,
  Straighten as RulerIcon,
  Architecture as AngleIcon,
  CropFree as AreaIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Refresh as ResetIcon,
  Tune as WindowLevelIcon,
  Info as InfoIcon,
  Clear as ClearIcon,
  SkipPrevious as PrevIcon,
  SkipNext as NextIcon,
  Fullscreen as FullscreenIcon,
  TextFields as TextIcon,
  NearMe as ArrowIcon,
  Brush as FreehandIcon,
  CropDin as RectangleIcon,
  RadioButtonUnchecked as CircleIcon,
  Timeline as PolygonIcon,
  BookmarkBorder as BookmarkIcon,
  MedicalServices as ClinicalIcon,
  Comment as CommentIcon,
  Palette as ColorIcon,
  Save as SaveIcon,
  Visibility as ViewIcon,
  VisibilityOff as HideIcon,
  CloudUpload as UploadIcon,
  Folder as StudyIcon,
  Folder as FolderIcon,
  List as ListIcon,
  Check as CheckIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Assignment as ReportIcon,
  Description as DescriptionIcon,
  Download as DownloadIcon,
  CameraAlt as CameraIcon,
  Visibility as ShowAIIcon,
  VisibilityOff as HideAIIcon,
  PhotoCamera as PhotoCameraIcon,
  Psychology as AIIcon,
  AutoAwesome as MagicIcon,
} from '@mui/icons-material'
import { StructuredReportingUnified } from '../reporting'
import { ProductionReportEditor } from '../reports'
import ReportExportService from '../../services/ReportExportService'
import { reportsApi } from '../../services/ReportsApi'
import ApiService from '../../services/ApiService'
import WindowLevelPresets, { WINDOW_LEVEL_PRESETS, WindowLevelPreset } from './WindowLevelPresets'
import CineControls from './CineControls'
import KeyboardShortcutsHelp from './KeyboardShortcutsHelp'
import HelpIcon from '@mui/icons-material/Help'
import AnalysisPanel from './AnalysisPanel'
import ToolsHistory from './ToolsHistory'
import ToastNotification from '../common/ToastNotification'
import { useVolumeRenderer } from '../../hooks/useVolumeRenderer'
import { TRANSFER_FUNCTIONS } from '../../utils/volumeRenderer'
import { validateAnnotationColor, MEDICAL_ANNOTATION_COLORS } from '../../utils/colorUtils'
import AIAnalysisControl from './AIAnalysisControl'
import BackgroundJobsPanel from './BackgroundJobsPanel'
import CapturedImagesGallery from './CapturedImagesGallery'
import { aiAnalysisQueue, QueueStats } from '../../services/AIAnalysisQueue'
import { autoAnalysisService } from '../../services/AutoAnalysisService'

// Types for medical imaging
interface MedicalImageViewerProps {
  /** Study instance UID */
  studyInstanceUID: string
  /** Series instance UID */
  seriesInstanceUID: string
  /** Array of SOP instance UIDs */
  sopInstanceUIDs: string[]
  /** Base URL for DICOM web services */
  dicomWebBaseUrl?: string
  /** Initial viewer mode */
  initialMode?: 'stack' | 'mpr' | '3d'
  /** Loading state */
  isLoading?: boolean
  /** Error message */
  error?: string
}

type ViewerMode = 'stack' | 'mpr' | '3d'
type Tool = 'pan' | 'zoom' | 'windowLevel' | 'length' | 'angle' | 'area' | 'scroll' |
  'textAnnotation' | 'arrowAnnotation' | 'freehand' | 'rectangle' | 'circle' | 'polygon' | 'leader' | 'clinical'

interface Point {
  x: number
  y: number
}

// Transform utilities for coordinate conversion
interface ImageTransform {
  offsetX: number
  offsetY: number
  drawWidth: number
  drawHeight: number
  originalWidth: number
  originalHeight: number
}

interface Measurement {
  id: string
  type: 'length' | 'angle' | 'area'
  points: Point[] // Stored in normalized coordinates (0-1) for zoom/pan independence
  value: number
  unit: string
  frameIndex: number
  isSelected?: boolean
  isHovered?: boolean
  label?: string // Custom user label
  isEditingLabel?: boolean // Track if label is being edited
  normalized?: boolean // Flag to indicate if points are in normalized coordinates
}

interface Annotation {
  id: string
  type: 'text' | 'arrow' | 'freehand' | 'rectangle' | 'circle' | 'polygon' | 'clinical' | 'leader'
  points: Point[] // Stored in normalized coordinates (0-1) for zoom/pan independence
  text?: string
  color: string
  fontSize?: number
  strokeWidth: number
  frameIndex: number
  timestamp: string
  author: string
  category?: 'finding' | 'measurement' | 'note' | 'critical'
  clinicalCode?: string // ICD-10 or other clinical coding
  isKeyImage?: boolean
  normalized?: boolean // Flag to indicate if points are in normalized coordinates
  isSelected?: boolean // Selection state
  isHovered?: boolean // Hover state
  isEditingText?: boolean // Text editing state
  // Leader/callout specific properties
  anchor?: Point // Anchor point for leader (normalized)
  textPos?: Point // Text position for leader (normalized)
  showArrow?: boolean // Show arrowhead on leader
}

// Action history for undo/redo
type ActionType =
  | 'create'
  | 'delete'
  | 'move'
  | 'resize'
  | 'text-edit'
  | 'handle-drag'
  | 'leader-anchor-move'
  | 'leader-textPos-move'
  | 'finalize-draw'

interface HistoryAction {
  type: ActionType
  annotationId: string
  beforeState: Annotation | null // null for create actions
  afterState: Annotation | null // null for delete actions
  timestamp: number
  description: string
}

interface ActionHistory {
  actions: HistoryAction[]
  currentIndex: number
  maxSize: number
}

interface DicomMetadata {
  patient_info: {
    name: string
    id: string
    birth_date: string
    sex: string
    age: string
    weight: string
  }
  study_info: {
    study_date: string
    study_time: string
    study_description: string
    modality: string
  }
  image_info: {
    rows: number
    columns: number
    number_of_frames: number
    pixel_spacing: number[]
    pixel_min: number
    pixel_max: number
    pixel_mean: number
    pixel_std: number
  }
  technical_info: {
    window_center: number[]
    window_width: number[]
    bits_allocated: number
    photometric_interpretation: string
  }
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`viewer-tabpanel-${index}`}
      aria-labelledby={`viewer-tab-${index}`}
      style={{ height: '100%' }}
      {...other}
    >
      {value === index && <Box sx={{ height: '100%' }}>{children}</Box>}
    </div>
  )
}

// Professional Medical DICOM Viewer Component
export const MedicalImageViewer: React.FC<MedicalImageViewerProps> = ({
  studyInstanceUID,
  seriesInstanceUID,
  sopInstanceUIDs,
  dicomWebBaseUrl = '/api/dicom',
  initialMode = 'stack',
  isLoading = false,
  error,
}) => {
  // Core viewer state
  const [viewerMode, setViewerMode] = useState<ViewerMode>(initialMode)
  const [is3DRenderingStarted, setIs3DRenderingStarted] = useState(false)
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0)
  // Initialize totalFrames from sopInstanceUIDs if available
  const [totalFrames, setTotalFrames] = useState(sopInstanceUIDs?.length || 1)
  const [activeTool, setActiveTool] = useState<Tool>('pan')
  const [isPlaying, setIsPlaying] = useState(false)
  const [playSpeed, setPlaySpeed] = useState(200) // ms between frames

  // Image display state
  const [zoom, setZoom] = useState(1.0)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [windowWidth, setWindowWidth] = useState(256)
  const [windowLevel, setWindowLevel] = useState(128)

  // New features state
  const [currentPreset, setCurrentPreset] = useState<string | null>(null)
  const [cineLoop, setCineLoop] = useState(true)
  const [cineFps, setCineFps] = useState(15)
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)

  // Redux hooks
  const dispatch = useAppDispatch()
  const selectedMeasurementId = useAppSelector(selectSelectedMeasurementId)
  const selectedAnnotationId = useAppSelector(selectSelectedAnnotationId)
  const hoveredMeasurementId = useAppSelector(selectHoveredMeasurementId)
  const hoveredAnnotationId = useAppSelector(selectHoveredAnnotationId)

  // Dual state: local for canvas rendering + Redux for Analysis Panel
  const [localMeasurements, setLocalMeasurements] = useState<Measurement[]>([])
  const reduxMeasurements = useAppSelector(selectMeasurements)
  const measurements = localMeasurements // Use local for canvas
  const [activeMeasurement, setActiveMeasurement] = useState<Measurement | null>(null)

  // Wrapper to sync local state to Redux
  const setMeasurements = useCallback((newMeasurements: Measurement[] | ((prev: Measurement[]) => Measurement[])) => {
    const updated = typeof newMeasurements === 'function' ? newMeasurements(localMeasurements) : newMeasurements
    setLocalMeasurements(updated)
    // Sync to Redux (clear and re-add all)
    // Note: This is a temporary solution, ideally we should have proper Redux actions for each operation
  }, [localMeasurements])
  const [measurementPoints, setMeasurementPoints] = useState<Point[]>([])
  const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(null)
  const [draggingMeasurementId, setDraggingMeasurementId] = useState<string | null>(null)
  const [previewPoint, setPreviewPoint] = useState<Point | null>(null)
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null)
  const [editingLabelText, setEditingLabelText] = useState('')
  const [measurementHistory, setMeasurementHistory] = useState<Measurement[][]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  // Dual state: local for canvas rendering + Redux for Analysis Panel
  const [localAnnotations, setLocalAnnotations] = useState<Annotation[]>([])
  const reduxAnnotations = useAppSelector(selectAnnotations)
  const annotations = localAnnotations // Use local for canvas
  const [activeAnnotation, setActiveAnnotation] = useState<Annotation | null>(null)

  // Wrapper to sync local state to Redux
  const setAnnotations = useCallback((newAnnotations: Annotation[] | ((prev: Annotation[]) => Annotation[])) => {
    const updated = typeof newAnnotations === 'function' ? newAnnotations(localAnnotations) : newAnnotations
    setLocalAnnotations(updated)
    // Sync to Redux happens via addAnnotationToRedux calls
  }, [localAnnotations])
  const [annotationPoints, setAnnotationPoints] = useState<Point[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [annotationText, setAnnotationText] = useState('')
  const [selectedColor, setSelectedColor] = useState('#00ff41')
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [fontSize, setFontSize] = useState(14)
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null)
  const [editingAnnotationText, setEditingAnnotationText] = useState('')
  const [draggingAnnotationId, setDraggingAnnotationId] = useState<string | null>(null)
  const [draggingAnnotationPointIndex, setDraggingAnnotationPointIndex] = useState<number | null>(null)
  const [leaderStep, setLeaderStep] = useState<'anchor' | 'text' | null>(null) // Track leader drawing step

  // Text editor state
  const [showTextEditor, setShowTextEditor] = useState(false)
  const [textEditorPosition, setTextEditorPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [textEditorAnnotation, setTextEditorAnnotation] = useState<Annotation | null>(null)

  // Action history for undo/redo
  const [actionHistory, setActionHistory] = useState<ActionHistory>({
    actions: [],
    currentIndex: -1,
    maxSize: 100
  })
  const [dragStartState, setDragStartState] = useState<Annotation | null>(null) // For grouping drag actions
  const [undoToast, setUndoToast] = useState<string | null>(null) // Toast message for undo/redo
  const [isTextInputFocused, setIsTextInputFocused] = useState(false) // Track if text input is focused

  // UI state
  const [showMetadata, setShowMetadata] = useState(false)
  const [showAnnotations, setShowAnnotations] = useState(false)
  const [showClinicalFindings, setShowClinicalFindings] = useState(false)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [showStructuredReporting, setShowStructuredReporting] = useState(false)
  const [showAIOverlay, setShowAIOverlay] = useState(true)
  const [showScreenshotDialog, setShowScreenshotDialog] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [showStudySelector, setShowStudySelector] = useState(false)
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false)
  const [radiologistSignature, setRadiologistSignature] = useState('')
  const [metadata, setMetadata] = useState<DicomMetadata | null>(null)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [annotationMenuEl, setAnnotationMenuEl] = useState<null | HTMLElement>(null)
  const [pixelSpacing] = useState([0.35, 0.35]) // From real DICOM metadata
  const [isAnalysisPanelOpen, setIsAnalysisPanelOpen] = useState(false) // Analysis panel toggle - opens via button
  const [isToolsHistoryOpen, setIsToolsHistoryOpen] = useState(false) // Tools history toggle

  // AI Assistant states
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false)
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiFindings, setAiFindings] = useState<any[]>([])
  const [selectedAIModel, setSelectedAIModel] = useState<'medsigclip' | 'medgemma'>('medsigclip')

  // Enhanced AI Analysis Tracking (slice-wise)
  const [sliceAnalysisData, setSliceAnalysisData] = useState<Map<number, any>>(new Map())
  const [sliceAnalysisStatus, setSliceAnalysisStatus] = useState<Map<number, 'pending' | 'analyzing' | 'complete' | 'error'>>(new Map())
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null)
  const [multiSliceAnalysisIds, setMultiSliceAnalysisIds] = useState<string[]>([])
  const [isDownloadReady, setIsDownloadReady] = useState(false)
  const [downloadReportId, setDownloadReportId] = useState<string | null>(null)

  // AutoAnalysisPopup states (DIRECT MODE)
  const [autoAnalysisOpen, setAutoAnalysisOpen] = useState(false)
  const [autoAnalysisMode, setAutoAnalysisMode] = useState<'single' | 'all'>('single')
  const [autoAnalysisSlices, setAutoAnalysisSlices] = useState<number[]>([])

  // AI Analysis Control (Phase 1 & 2)
  const [showAIControl, setShowAIControl] = useState(false)
  const [showBackgroundJobs, setShowBackgroundJobs] = useState(false)
  const [showCapturedImages, setShowCapturedImages] = useState(false)
  const [queueStats, setQueueStats] = useState<QueueStats>({
    total: 0,
    queued: 0,
    processing: 0,
    complete: 0,
    failed: 0,
    progress: 0
  })

  // Study management
  const [availableStudies, setAvailableStudies] = useState<any[]>([])
  const [currentStudyId, setCurrentStudyId] = useState(studyInstanceUID)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')

  // Structured Reporting
  const reportExportService = ReportExportService.getInstance()
  const [currentReport, setCurrentReport] = useState<any>(null)
  const [currentReportId, setCurrentReportId] = useState<string | null>(null)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const canvas3DRef = useRef<HTMLCanvasElement>(null)
  const container3DRef = useRef<HTMLDivElement>(null) // For VTK.js renderer
  const containerRef = useRef<HTMLDivElement>(null)
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const imageCache = useRef<Map<number, HTMLImageElement>>(new Map())
  const frameUrls = useMemo(() => {
    if (!currentStudyId || totalFrames <= 0) return []
    // Generate DICOM frame URLs for the current series
    return Array.from({ length: totalFrames }, (_, i) =>
      ApiService.getFrameImageUrl(currentStudyId, i, seriesInstanceUID)
    )
  }, [totalFrames, currentStudyId, seriesInstanceUID])
  // Real 3D Volume Renderer
  const volumeRenderer = useVolumeRenderer({
    frameUrls,
    canvasRef: canvas3DRef,
    containerRef: container3DRef,
    enabled: viewerMode === '3d' && is3DRenderingStarted
  })

  // Removed Cornerstone integration state - using canvas-based rendering instead

  // Normalize backend study metadata response to DicomMetadata shape
  const normalizeMetadataResponse = useCallback((resp: any): DicomMetadata | null => {
    const data = resp?.metadata ?? resp?.data ?? resp
    if (!data) return null

    const meta: Partial<DicomMetadata> = {
      patient_info: {
        name: data.patientName ?? data.patient_info?.name,
        id: data.patientID ?? data.patient_info?.id,
        birth_date: data.patient_info?.birth_date,
        sex: data.patient_info?.sex,
        age: data.patient_info?.age,
        weight: data.patient_info?.weight,
      },
      study_info: {
        study_date: data.studyDate ?? data.study_info?.study_date,
        study_time: data.studyTime ?? data.study_info?.study_time,
        modality: data.modality ?? data.study_info?.modality,
        study_description: data.studyDescription ?? data.study_info?.study_description,
      },
      image_info: {
        rows: data.image_info?.rows,
        columns: data.image_info?.columns,
        number_of_frames: data.numberOfInstances ?? data.image_info?.number_of_frames ?? 0,
        pixel_spacing: data.image_info?.pixel_spacing,
        pixel_min: data.image_info?.pixel_min,
        pixel_max: data.image_info?.pixel_max,
        pixel_mean: data.image_info?.pixel_mean,
        pixel_std: data.image_info?.pixel_std,
      },
      technical_info: {
        window_center: data.technical_info?.window_center,
        window_width: data.technical_info?.window_width,
        bits_allocated: data.technical_info?.bits_allocated,
        photometric_interpretation: data.technical_info?.photometric_interpretation,
      },
    }

    return meta as DicomMetadata
  }, [])

  // Generate frame URLs based on current study


  // Load comprehensive DICOM metadata
  useEffect(() => {
    const loadMetadata = async () => {
      if (!currentStudyId) return
      try {
        const result = await ApiService.getStudyDetailedMetadata(currentStudyId)
        if (result?.success) {
          const normalized = normalizeMetadataResponse(result.data ?? result.metadata)
          if (normalized) {
            setMetadata(normalized)

            const framesFromMeta = normalized.image_info?.number_of_frames
            if (typeof framesFromMeta === 'number' && framesFromMeta > 0) {
              setTotalFrames(framesFromMeta)
              console.log(`📊 Updated total frames to: ${framesFromMeta}`)
            }

            const ww = normalized.technical_info?.window_width?.[0]
            const wc = normalized.technical_info?.window_center?.[0]
            if (typeof ww === 'number') setWindowWidth(ww)
            if (typeof wc === 'number') setWindowLevel(wc)

            console.log('✅ DICOM metadata loaded:', normalized)
          }
        }
      } catch (err) {
        console.error('Failed to load metadata:', err)
      }
    }

    loadMetadata()
  }, [currentStudyId, normalizeMetadataResponse])

  // Update currentStudyId when prop changes
  useEffect(() => {
    if (studyInstanceUID && studyInstanceUID !== currentStudyId) {
      setCurrentStudyId(studyInstanceUID)

      // Clear measurements and annotations when study changes
      setLocalMeasurements([])
      setLocalAnnotations([])
      dispatch(clearMeasurementsAndAnnotations())
      console.log('[STUDY CHANGE] Cleared measurements and annotations')
    }
  }, [studyInstanceUID, currentStudyId, dispatch])

  // Set frame count from sopInstanceUIDs prop (most reliable)
  useEffect(() => {
    if (sopInstanceUIDs && sopInstanceUIDs.length > 0) {
      const frameCount = sopInstanceUIDs.length
      setTotalFrames(frameCount)
      console.log('═══════════════════════════════════════════════════════');
      console.log('[SERIES IDENTIFIER] 🎯 Frame count set from sopInstanceUIDs');
      console.log('[SERIES IDENTIFIER] Series UID:', seriesInstanceUID);
      console.log('[SERIES IDENTIFIER] Frame Count:', frameCount);
      console.log('═══════════════════════════════════════════════════════');
    }
    // Note: We ONLY use sopInstanceUIDs, no API fallback to avoid race conditions
  }, [sopInstanceUIDs, seriesInstanceUID])

  // Preload images for smooth navigation
  const preloadImages = useCallback((startIndex: number, count: number = 10) => {
    for (let i = 0; i < count; i++) {
      const index = (startIndex + i) % totalFrames
      if (!imageCache.current.has(index) && frameUrls[index]) {
        const img = new Image()
        img.onload = () => {
          imageCache.current.set(index, img)
          // Force re-render when image loads during playback
          if (isPlaying && index === currentFrameIndex) {
            setCurrentFrameIndex(prev => prev) // Trigger re-render
          }
        }
        img.onerror = () => {
          console.warn(`Failed to load image at index ${index}: ${frameUrls[index]}`)
        }
        img.src = frameUrls[index]
      }
    }
  }, [frameUrls, totalFrames, isPlaying, currentFrameIndex])

  // Enhanced preloading strategy
  useEffect(() => {
    // Preload current frame and more surrounding frames for smooth playback
    const preloadStart = Math.max(0, currentFrameIndex - 5)
    preloadImages(preloadStart, 10)

    // Also preload next batch if we're near the end
    if (currentFrameIndex > totalFrames - 10) {
      preloadImages(0, 10) // Preload beginning for smooth loop
    }
  }, [currentFrameIndex, preloadImages, totalFrames])

  // Draw current frame with measurements
  const drawFrame = useCallback(async (frameIndex: number) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    try {
      // Get or load image
      let img = imageCache.current.get(frameIndex)

      if (!img) {
        img = new Image()
        const frameUrl = frameUrls[frameIndex]
        console.log(`🖼️ Loading frame ${frameIndex} from: ${frameUrl}`)
        img.src = frameUrl

        await new Promise((resolve, reject) => {
          img!.onload = () => {
            console.log(`✅ Frame ${frameIndex} loaded successfully (${img!.width}x${img!.height})`)
            resolve(null)
          }
          img!.onerror = (error) => {
            console.error(`❌ Failed to load frame ${frameIndex} from: ${frameUrl}`)
            console.error('   Error:', error)
            console.error('   Check if backend is running and frame endpoint is accessible')
            reject(error)
          }
        })
        imageCache.current.set(frameIndex, img)
      }

      // Calculate display dimensions
      const containerWidth = canvas.width
      const containerHeight = canvas.height
      const imgAspect = img.width / img.height
      const containerAspect = containerWidth / containerHeight

      let drawWidth, drawHeight, offsetX, offsetY

      if (imgAspect > containerAspect) {
        drawWidth = containerWidth * zoom
        drawHeight = (containerWidth / imgAspect) * zoom
      } else {
        drawHeight = containerHeight * zoom
        drawWidth = (containerHeight * imgAspect) * zoom
      }

      offsetX = (containerWidth - drawWidth) / 2 + panOffset.x
      offsetY = (containerHeight - drawHeight) / 2 + panOffset.y

      // Apply window/level (simplified)
      ctx.globalAlpha = 1.0

      // Smart image smoothing based on zoom level
      // Enable smoothing when zoomed in to prevent pixelation
      // Disable when at 1:1 or zoomed out for crisp details
      if (zoom > 1.2) {
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
      } else {
        ctx.imageSmoothingEnabled = false
      }

      // Draw image
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)

      // Store dimensions for measurements
      canvas.dataset.imageWidth = drawWidth.toString()
      canvas.dataset.imageHeight = drawHeight.toString()
      canvas.dataset.offsetX = offsetX.toString()
      canvas.dataset.offsetY = offsetY.toString()
      canvas.dataset.originalWidth = img.width.toString()
      canvas.dataset.originalHeight = img.height.toString()

      // Draw measurements for this frame (inlined to avoid circular dependency)
      const frameMeasurements = measurements.filter(m => m.frameIndex === frameIndex)
      frameMeasurements.forEach(measurement => {
        drawSingleMeasurement(ctx, measurement, '#00ff41')
      })

      // Draw active measurement being created
      if (activeMeasurement && activeMeasurement.frameIndex === frameIndex) {
        drawSingleMeasurement(ctx, activeMeasurement, '#ffff00')
      }

      // Draw AI overlay if enabled
      if (showAIOverlay) {
        drawAIOverlay(ctx, frameIndex)
      }

      // Draw preview point for length tool
      if (previewPoint && activeMeasurement && activeMeasurement.points.length === 1) {
        // Convert normalized coordinates to canvas coordinates
        const startCanvas = imageToCanvasCoords(activeMeasurement.points[0])
        const previewCanvas = imageToCanvasCoords(previewPoint)
        ctx.strokeStyle = '#ffff00'
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        ctx.moveTo(startCanvas.x, startCanvas.y)
        ctx.lineTo(previewCanvas.x, previewCanvas.y)
        ctx.stroke()
        ctx.setLineDash([])
      }

      // Draw annotations for this frame (only visible ones)
      const frameAnnotations = annotations.filter(a => a.frameIndex === frameIndex && a.metadata.visible)
      frameAnnotations.forEach(annotation => {
        drawSingleAnnotation(ctx, annotation, false)
      })

      // Draw active annotation being created
      if (activeAnnotation && activeAnnotation.frameIndex === frameIndex) {
        drawSingleAnnotation(ctx, activeAnnotation, true)
      }

      // Draw control points for selected annotation
      if (selectedAnnotationId) {
        const selectedAnnotation = frameAnnotations.find(a => a.id === selectedAnnotationId)
        if (selectedAnnotation) {
          const controlPoints = controlPointManager.generateControlPoints(selectedAnnotation, imageToCanvasCoords)
          drawControlPoints(ctx, controlPoints, null) // TODO: Add hovered control point tracking
        }
      }

      // Draw leader preview if in leader mode
      if (activeTool === 'leader' && leaderStep === 'anchor' && activeAnnotation) {
        // Show preview line from anchor to current mouse position
        if (previewPoint) {
          const anchorCanvas = activeAnnotation.anchor ? imageToCanvasCoords(activeAnnotation.anchor) : null
          const previewCanvas = imageToCanvasCoords(previewPoint)
          if (anchorCanvas) {
            ctx.strokeStyle = '#ffff00'
            ctx.lineWidth = 2
            ctx.setLineDash([5, 5])
            ctx.beginPath()
            ctx.moveTo(anchorCanvas.x, anchorCanvas.y)
            ctx.lineTo(previewCanvas.x, previewCanvas.y)
            ctx.stroke()
            ctx.setLineDash([])
          }
        }
      }

    } catch (err) {
      console.error(`Failed to draw frame ${frameIndex}:`, err)

      // Draw error placeholder
      ctx.fillStyle = '#333'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#fff'
      ctx.font = '16px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(`Frame ${frameIndex + 1} not available`, canvas.width / 2, canvas.height / 2)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameUrls, zoom, panOffset, windowWidth, windowLevel, measurements, activeMeasurement, annotations, activeAnnotation, previewPoint, selectedMeasurementId, hoveredMeasurementId, editingLabelId, editingLabelText, activeTool, leaderStep, showAIOverlay])

  // Coordinate transformation utilities
  const getImageTransform = useCallback((): ImageTransform | null => {
    const canvas = canvasRef.current
    if (!canvas) return null

    return {
      offsetX: parseFloat(canvas.dataset.offsetX || '0'),
      offsetY: parseFloat(canvas.dataset.offsetY || '0'),
      drawWidth: parseFloat(canvas.dataset.imageWidth || '0'),
      drawHeight: parseFloat(canvas.dataset.imageHeight || '0'),
      originalWidth: parseFloat(canvas.dataset.originalWidth || '512'),
      originalHeight: parseFloat(canvas.dataset.originalHeight || '512'),
    }
  }, [])

  // Convert canvas coordinates to normalized image coordinates (0-1)
  const canvasToImageCoords = useCallback((canvasPoint: Point): Point => {
    const transform = getImageTransform()
    if (!transform) return canvasPoint

    const { offsetX, offsetY, drawWidth, drawHeight } = transform

    // Convert to image-relative coordinates (0-1)
    const relX = (canvasPoint.x - offsetX) / drawWidth
    const relY = (canvasPoint.y - offsetY) / drawHeight

    return { x: relX, y: relY }
  }, [getImageTransform])

  // Convert normalized image coordinates (0-1) to canvas coordinates
  const imageToCanvasCoords = useCallback((imagePoint: Point): Point => {
    const transform = getImageTransform()
    if (!transform) return imagePoint

    const { offsetX, offsetY, drawWidth, drawHeight } = transform

    // Convert from image-relative (0-1) to canvas coordinates
    const canvasX = imagePoint.x * drawWidth + offsetX
    const canvasY = imagePoint.y * drawHeight + offsetY

    return { x: canvasX, y: canvasY }
  }, [getImageTransform])

  // Calculate distance in millimeters
  const calculateDistance = useCallback((p1: Point, p2: Point): number => {
    const canvas = canvasRef.current
    if (!canvas) return 0

    const pixelDistance = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
    const imageWidth = parseFloat(canvas.dataset.imageWidth || '0')
    const originalWidth = parseFloat(canvas.dataset.originalWidth || '512')
    const scale = originalWidth / imageWidth

    return pixelDistance * scale * pixelSpacing[0]
  }, [pixelSpacing])

  // Calculate angle in degrees
  const calculateAngle = useCallback((p1: Point, p2: Point, p3: Point): number => {
    const a = Math.sqrt(Math.pow(p2.x - p3.x, 2) + Math.pow(p2.y - p3.y, 2))
    const b = Math.sqrt(Math.pow(p1.x - p3.x, 2) + Math.pow(p1.y - p3.y, 2))
    const c = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2))

    const angle = Math.acos((a * a + c * c - b * b) / (2 * a * c))
    return angle * (180 / Math.PI)
  }, [])

  // Calculate area in square millimeters
  const calculateArea = useCallback((points: Point[]): number => {
    if (points.length < 3) return 0

    const canvas = canvasRef.current
    if (!canvas) return 0

    let area = 0
    const n = points.length

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      area += points[i].x * points[j].y
      area -= points[j].x * points[i].y
    }

    area = Math.abs(area) / 2

    const imageWidth = parseFloat(canvas.dataset.imageWidth || '0')
    const originalWidth = parseFloat(canvas.dataset.originalWidth || '512')
    const scale = originalWidth / imageWidth

    return area * Math.pow(scale * pixelSpacing[0], 2)
  }, [pixelSpacing])

  // Add measurement to history for undo/redo
  const addToHistory = useCallback((newMeasurements: Measurement[]) => {
    const newHistory = measurementHistory.slice(0, historyIndex + 1)
    newHistory.push([...newMeasurements])
    setMeasurementHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }, [measurementHistory, historyIndex])

  // Undo last measurement action
  const undoMeasurement = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1)
      setMeasurements(measurementHistory[historyIndex - 1])
    }
  }, [historyIndex, measurementHistory])

  // Redo measurement action
  const redoMeasurement = useCallback(() => {
    if (historyIndex < measurementHistory.length - 1) {
      setHistoryIndex(historyIndex + 1)
      setMeasurements(measurementHistory[historyIndex + 1])
    }
  }, [historyIndex, measurementHistory])

  // Start editing measurement label
  const startEditingLabel = useCallback((measurementId: string, currentLabel: string) => {
    setEditingLabelId(measurementId)
    setEditingLabelText(currentLabel || '')
  }, [])

  // Save edited label
  const saveEditedLabel = useCallback(() => {
    if (editingLabelId) {
      const updatedMeasurements = measurements.map(m =>
        m.id === editingLabelId ? { ...m, label: editingLabelText } : m
      )
      setMeasurements(updatedMeasurements)
      addToHistory(updatedMeasurements)
      setEditingLabelId(null)
      setEditingLabelText('')
    }
  }, [editingLabelId, editingLabelText, measurements, addToHistory])

  // Delete measurement
  const deleteMeasurement = useCallback((measurementId: string) => {
    const updatedMeasurements = measurements.filter(m => m.id !== measurementId)
    setMeasurements(updatedMeasurements)
    addToHistory(updatedMeasurements)

    // Sync to Redux
    dispatch(removeMeasurementFromRedux(measurementId))

    if (selectedMeasurementId === measurementId) {
      dispatch(selectMeasurement(null))
    }
  }, [measurements, selectedMeasurementId, addToHistory, dispatch])

  // ============ UNDO/REDO SYSTEM ============

  // Push action to history
  const pushAction = useCallback((action: HistoryAction) => {
    console.log('PUSH', action.type, action.annotationId, 'desc:', action.description)

    setActionHistory(prev => {
      // Remove any actions after current index (when undoing then doing new action)
      const newActions = prev.actions.slice(0, prev.currentIndex + 1)

      // Add new action
      newActions.push(action)

      // Limit history size
      if (newActions.length > prev.maxSize) {
        newActions.shift()
      }

      console.log('  History:', newActions.length, 'actions, index:', newActions.length - 1)

      return {
        ...prev,
        actions: newActions,
        currentIndex: newActions.length - 1
      }
    })
  }, [])

  // Undo last action
  const undo = useCallback(() => {
    setActionHistory(prev => {
      if (prev.currentIndex < 0) {
        console.log('UNDO: No actions to undo')
        return prev
      }

      const action = prev.actions[prev.currentIndex]
      console.log('UNDO:', action.type, action.annotationId, 'index:', prev.currentIndex, '/', prev.actions.length)

      // Apply undo based on action type
      switch (action.type) {
        case 'create':
        case 'finalize-draw':
          setAnnotations(prevAnn => {
            const filtered = prevAnn.filter(a => a.id !== action.annotationId)
            console.log('  Removed annotation', action.annotationId, 'count:', prevAnn.length, '->', filtered.length)
            return filtered
          })
          setUndoToast(`Undo: ${action.description}`)
          break

        case 'delete':
          if (action.beforeState) {
            setAnnotations(prevAnn => {
              const restored = [...prevAnn, { ...action.beforeState! }]
              console.log('  Restored annotation', action.annotationId, 'count:', prevAnn.length, '->', restored.length)
              return restored
            })
            setUndoToast(`Undo: ${action.description}`)
          }
          break

        case 'move':
        case 'resize':
        case 'text-edit':
        case 'handle-drag':
        case 'leader-anchor-move':
        case 'leader-textPos-move':
          if (action.beforeState) {
            setAnnotations(prevAnn => {
              const updated = prevAnn.map(a =>
                a.id === action.annotationId ? { ...action.beforeState! } : a
              )
              console.log('  Restored state for', action.annotationId)
              return updated
            })
            setUndoToast(`Undo: ${action.description}`)
          }
          break
      }

      // Return new history state with decremented index
      return {
        ...prev,
        currentIndex: prev.currentIndex - 1
      }
    })

    // Redraw after state updates
    setTimeout(() => drawFrame(currentFrameIndex), 0)
    setTimeout(() => setUndoToast(null), 2000)
  }, [currentFrameIndex, drawFrame])

  // Redo action
  const redo = useCallback(() => {
    setActionHistory(prev => {
      if (prev.currentIndex >= prev.actions.length - 1) {
        console.log('REDO: No actions to redo')
        return prev
      }

      const action = prev.actions[prev.currentIndex + 1]
      console.log('REDO:', action.type, action.annotationId, 'index:', prev.currentIndex + 1, '/', prev.actions.length)

      // Apply redo based on action type
      switch (action.type) {
        case 'create':
        case 'finalize-draw':
          if (action.afterState) {
            setAnnotations(prevAnn => {
              const restored = [...prevAnn, { ...action.afterState! }]
              console.log('  Added annotation', action.annotationId, 'count:', prevAnn.length, '->', restored.length)
              return restored
            })
            setUndoToast(`Redo: ${action.description}`)
          }
          break

        case 'delete':
          setAnnotations(prevAnn => {
            const filtered = prevAnn.filter(a => a.id !== action.annotationId)
            console.log('  Removed annotation', action.annotationId, 'count:', prevAnn.length, '->', filtered.length)
            return filtered
          })
          setUndoToast(`Redo: ${action.description}`)
          break

        case 'move':
        case 'resize':
        case 'text-edit':
        case 'handle-drag':
        case 'leader-anchor-move':
        case 'leader-textPos-move':
          if (action.afterState) {
            setAnnotations(prevAnn => {
              const updated = prevAnn.map(a =>
                a.id === action.annotationId ? { ...action.afterState! } : a
              )
              console.log('  Applied new state for', action.annotationId)
              return updated
            })
            setUndoToast(`Redo: ${action.description}`)
          }
          break
      }

      // Return new history state with incremented index
      return {
        ...prev,
        currentIndex: prev.currentIndex + 1
      }
    })

    // Redraw after state updates
    setTimeout(() => drawFrame(currentFrameIndex), 0)
    setTimeout(() => setUndoToast(null), 2000)
  }, [currentFrameIndex, drawFrame])

  // Check if undo/redo available
  const canUndo = actionHistory.currentIndex >= 0
  const canRedo = actionHistory.currentIndex < actionHistory.actions.length - 1

  // Save edited annotation text
  const saveEditedAnnotationText = useCallback(() => {
    if (editingAnnotationId) {
      const beforeAnnotation = annotations.find(a => a.id === editingAnnotationId)
      const updatedAnnotations = annotations.map(a =>
        a.id === editingAnnotationId ? { ...a, text: editingAnnotationText } : a
      )

      // Push action to history
      const afterAnnotation = updatedAnnotations.find(a => a.id === editingAnnotationId)
      if (beforeAnnotation && afterAnnotation) {
        pushAction({
          type: 'text-edit',
          annotationId: editingAnnotationId,
          beforeState: { ...beforeAnnotation },
          afterState: { ...afterAnnotation },
          timestamp: Date.now(),
          description: 'Edit text'
        })
      }

      setAnnotations(updatedAnnotations)
      setEditingAnnotationId(null)
      setEditingAnnotationText('')
    }
  }, [editingAnnotationId, editingAnnotationText, annotations, pushAction])

  // Delete annotation
  const deleteAnnotation = useCallback((annotationId: string) => {
    const annotation = annotations.find(a => a.id === annotationId)
    const updatedAnnotations = annotations.filter(a => a.id !== annotationId)
    setAnnotations(updatedAnnotations)

    // Sync to Redux
    dispatch(removeAnnotationFromRedux(annotationId))

    // Track action in history
    if (annotation) {
      dispatch(addToolAction({
        actionType: 'delete',
        itemType: 'annotation',
        itemId: annotationId,
        frameIndex: currentFrameIndex,
        metadata: {
          annotationType: annotation.type,
          before: annotation,
        },
      }))
    }

    if (selectedAnnotationId === annotationId) {
      dispatch(selectAnnotation(null))
    }
  }, [annotations, selectedAnnotationId, dispatch, currentFrameIndex])

  // Draw AI overlay with detection boxes and labels
  const drawAIOverlay = useCallback((ctx: CanvasRenderingContext2D, frameIndex: number) => {
    console.log('🎨 drawAIOverlay called for frame:', frameIndex)
    
    // Get AI analysis for current frame
    const analysis = autoAnalysisService.getSliceAnalysis(frameIndex)
    console.log('📊 Analysis for frame', frameIndex, ':', analysis)
    
    if (!analysis || analysis.status !== 'complete' || !analysis.results) {
      console.log('⚠️ No complete analysis found for frame', frameIndex)
      return
    }

    const findings = analysis.results.findings || []
    console.log('🔍 Findings:', findings)
    
    if (findings.length === 0) {
      console.log('⚠️ No findings to display')
      return
    }
    
    console.log('✅ Drawing', findings.length, 'findings on canvas')

    // Save context
    ctx.save()

    // Draw each finding
    findings.forEach((finding: any, index: number) => {
      // Determine color based on confidence/severity
      const confidence = finding.confidence || 0.5
      let color = '#ffff00' // Yellow for low
      if (confidence > 0.8) color = '#ff4444' // Red for high
      else if (confidence > 0.6) color = '#ff9800' // Orange for medium

      // Calculate position (distribute findings across image)
      const canvas = canvasRef.current
      if (!canvas) return

      const boxWidth = 200
      const boxHeight = 80
      const margin = 20
      const x = margin + (index % 2) * (canvas.width / 2 - boxWidth - margin)
      const y = margin + Math.floor(index / 2) * (boxHeight + margin)

      // Draw semi-transparent background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.fillRect(x, y, boxWidth, boxHeight)

      // Draw border
      ctx.strokeStyle = color
      ctx.lineWidth = 3
      ctx.strokeRect(x, y, boxWidth, boxHeight)

      // Draw finding type/label
      ctx.fillStyle = color
      ctx.font = 'bold 14px Arial'
      ctx.fillText(finding.type || finding.label || 'Finding', x + 10, y + 25)

      // Draw confidence
      ctx.fillStyle = '#ffffff'
      ctx.font = '12px Arial'
      ctx.fillText(`Confidence: ${(confidence * 100).toFixed(0)}%`, x + 10, y + 45)

      // Draw location if available
      if (finding.location) {
        ctx.fillStyle = '#aaaaaa'
        ctx.font = '11px Arial'
        const locationText = finding.location.length > 25 ? finding.location.substring(0, 25) + '...' : finding.location
        ctx.fillText(locationText, x + 10, y + 65)
      }

      // Draw indicator line to image (optional - can be enhanced with actual coordinates)
      if (finding.bbox || finding.coordinates) {
        // If we have bounding box coordinates, draw them
        // This would need to be implemented based on your AI service response format
      }
    })

    // Draw summary badge
    const badgeX = canvas.width - 150
    const badgeY = 20
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    ctx.fillRect(badgeX, badgeY, 130, 40)
    ctx.strokeStyle = '#00ff41'
    ctx.lineWidth = 2
    ctx.strokeRect(badgeX, badgeY, 130, 40)
    
    ctx.fillStyle = '#00ff41'
    ctx.font = 'bold 12px Arial'
    ctx.fillText('🤖 AI Analysis', badgeX + 10, badgeY + 20)
    ctx.fillStyle = '#ffffff'
    ctx.font = '11px Arial'
    ctx.fillText(`${findings.length} finding(s)`, badgeX + 10, badgeY + 35)

    // Restore context
    ctx.restore()
  }, [])

  // Draw individual measurement with enhanced interactivity and visuals
  const drawSingleMeasurement = useCallback((ctx: CanvasRenderingContext2D, measurement: Measurement, color: string) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const { points, type, value, unit, id, label, normalized = true } = measurement
    const isSelected = selectedMeasurementId === id
    const isHovered = hoveredMeasurementId === id
    const isEditing = editingLabelId === id

    // Transform points from normalized (0-1) to canvas coordinates
    const canvasPoints = normalized
      ? points.map(p => imageToCanvasCoords(p))
      : points

    // Use different colors for selected/hovered states
    const lineColor = isSelected ? '#ffff00' : isHovered ? '#00ffff' : color
    const handleColor = isSelected ? '#ffff00' : color
    const lineWidth = isSelected ? 4 : isHovered ? 3 : 2

    // Save context state
    ctx.save()

    // Draw lines with enhanced visibility
    if (canvasPoints.length >= 2) {
      if (type === 'length') {
        // Draw shadow/glow for better visibility
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
        ctx.shadowBlur = 6
        ctx.shadowOffsetX = 2
        ctx.shadowOffsetY = 2

        // Draw main line with thicker width
        ctx.strokeStyle = lineColor
        ctx.lineWidth = lineWidth
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y)
        ctx.lineTo(canvasPoints[1].x, canvasPoints[1].y)
        ctx.stroke()

        // Draw white outline for contrast
        ctx.shadowColor = 'transparent'
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
        ctx.lineWidth = lineWidth + 2
        ctx.beginPath()
        ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y)
        ctx.lineTo(canvasPoints[1].x, canvasPoints[1].y)
        ctx.stroke()

        // Draw main line again on top
        ctx.strokeStyle = lineColor
        ctx.lineWidth = lineWidth
        ctx.beginPath()
        ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y)
        ctx.lineTo(canvasPoints[1].x, canvasPoints[1].y)
        ctx.stroke()

        // Draw midpoint handle for easier adjustment (only when selected)
        if (isSelected) {
          const midX = (canvasPoints[0].x + canvasPoints[1].x) / 2
          const midY = (canvasPoints[0].y + canvasPoints[1].y) / 2

          // Midpoint handle (square)
          ctx.fillStyle = 'white'
          ctx.fillRect(midX - 5, midY - 5, 10, 10)
          ctx.fillStyle = lineColor
          ctx.fillRect(midX - 3, midY - 3, 6, 6)

          // Draw connection lines to endpoints (dashed)
          ctx.setLineDash([3, 3])
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y)
          ctx.lineTo(midX, midY)
          ctx.lineTo(canvasPoints[1].x, canvasPoints[1].y)
          ctx.stroke()
          ctx.setLineDash([])
        }

        // Draw measurement label with enhanced background and delete button
        const midX = (canvasPoints[0].x + canvasPoints[1].x) / 2
        const midY = (canvasPoints[0].y + canvasPoints[1].y) / 2
        const displayText = label || `${value.toFixed(1)} ${unit}`
        const text = isEditing ? editingLabelText : displayText
        ctx.font = 'bold 16px Arial'
        const metrics = ctx.measureText(text)

        // Draw label background with border
        const padding = 8
        const deleteButtonSize = 20
        const labelWidth = metrics.width + padding * 2 + (isSelected ? deleteButtonSize + 5 : 0)
        const labelHeight = 24
        const labelX = midX - labelWidth / 2
        const labelY = midY - 30

        // Shadow for label
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
        ctx.shadowBlur = 4
        ctx.fillStyle = isEditing ? 'rgba(50, 50, 50, 0.95)' : 'rgba(0, 0, 0, 0.85)'
        ctx.fillRect(labelX, labelY, labelWidth, labelHeight)

        // Border (highlight if editable)
        ctx.shadowColor = 'transparent'
        ctx.strokeStyle = isEditing ? '#00ff00' : lineColor
        ctx.lineWidth = isEditing ? 3 : 2
        ctx.strokeRect(labelX, labelY, labelWidth, labelHeight)

        // Text
        ctx.fillStyle = lineColor
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, labelX + padding, labelY + labelHeight / 2)

        // Draw delete button (X) when selected
        if (isSelected) {
          const deleteX = labelX + labelWidth - deleteButtonSize - 2
          const deleteY = labelY + 2

          // Delete button background
          ctx.fillStyle = 'rgba(255, 0, 0, 0.8)'
          ctx.fillRect(deleteX, deleteY, deleteButtonSize, deleteButtonSize)

          // X symbol
          ctx.strokeStyle = 'white'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(deleteX + 5, deleteY + 5)
          ctx.lineTo(deleteX + deleteButtonSize - 5, deleteY + deleteButtonSize - 5)
          ctx.moveTo(deleteX + deleteButtonSize - 5, deleteY + 5)
          ctx.lineTo(deleteX + 5, deleteY + deleteButtonSize - 5)
          ctx.stroke()

          // Store delete button bounds for click detection
          canvas.dataset[`deleteBtn_${id}_x`] = deleteX.toString()
          canvas.dataset[`deleteBtn_${id}_y`] = deleteY.toString()
          canvas.dataset[`deleteBtn_${id}_w`] = deleteButtonSize.toString()
          canvas.dataset[`deleteBtn_${id}_h`] = deleteButtonSize.toString()
        }

        // Store label bounds for click detection
        canvas.dataset[`label_${id}_x`] = labelX.toString()
        canvas.dataset[`label_${id}_y`] = labelY.toString()
        canvas.dataset[`label_${id}_w`] = labelWidth.toString()
        canvas.dataset[`label_${id}_h`] = labelHeight.toString()

      } else if (type === 'angle' && canvasPoints.length >= 3) {
        // Draw angle lines with shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
        ctx.shadowBlur = 6
        ctx.shadowOffsetX = 2
        ctx.shadowOffsetY = 2

        ctx.strokeStyle = lineColor
        ctx.lineWidth = lineWidth
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y)
        ctx.lineTo(canvasPoints[1].x, canvasPoints[1].y)
        ctx.lineTo(canvasPoints[2].x, canvasPoints[2].y)
        ctx.stroke()

        // Draw angle arc
        ctx.shadowColor = 'transparent'
        const radius = 30
        const angle1 = Math.atan2(canvasPoints[0].y - canvasPoints[1].y, canvasPoints[0].x - canvasPoints[1].x)
        const angle2 = Math.atan2(canvasPoints[2].y - canvasPoints[1].y, canvasPoints[2].x - canvasPoints[1].x)

        ctx.strokeStyle = lineColor
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(canvasPoints[1].x, canvasPoints[1].y, radius, angle1, angle2)
        ctx.stroke()

        // Draw angle label with background
        const text = `${value.toFixed(1)}°`
        ctx.font = 'bold 16px Arial'
        const metrics = ctx.measureText(text)

        const padding = 8
        const labelX = canvasPoints[1].x + 5
        const labelY = canvasPoints[1].y - 35
        const labelWidth = metrics.width + padding * 2
        const labelHeight = 24

        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
        ctx.fillRect(labelX, labelY, labelWidth, labelHeight)
        ctx.strokeStyle = lineColor
        ctx.lineWidth = 2
        ctx.strokeRect(labelX, labelY, labelWidth, labelHeight)

        ctx.fillStyle = lineColor
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, labelX + padding, labelY + labelHeight / 2)

      } else if (type === 'area' && canvasPoints.length >= 3) {
        // Draw polygon with shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
        ctx.shadowBlur = 6
        ctx.shadowOffsetX = 2
        ctx.shadowOffsetY = 2

        ctx.strokeStyle = lineColor
        ctx.lineWidth = lineWidth
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y)
        for (let i = 1; i < canvasPoints.length; i++) {
          ctx.lineTo(canvasPoints[i].x, canvasPoints[i].y)
        }
        ctx.closePath()
        ctx.stroke()

        // Fill with semi-transparent color when selected
        if (isSelected) {
          ctx.shadowColor = 'transparent'
          ctx.fillStyle = lineColor.replace(')', ', 0.1)').replace('rgb', 'rgba')
          ctx.fill()
        }

        // Draw area label at centroid
        ctx.shadowColor = 'transparent'
        const centerX = canvasPoints.reduce((sum, p) => sum + p.x, 0) / canvasPoints.length
        const centerY = canvasPoints.reduce((sum, p) => sum + p.y, 0) / canvasPoints.length
        const text = `${value.toFixed(1)} ${unit}`
        ctx.font = 'bold 16px Arial'
        const metrics = ctx.measureText(text)

        const padding = 8
        const labelWidth = metrics.width + padding * 2
        const labelHeight = 24

        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
        ctx.fillRect(centerX - labelWidth / 2, centerY - labelHeight / 2, labelWidth, labelHeight)
        ctx.strokeStyle = lineColor
        ctx.lineWidth = 2
        ctx.strokeRect(centerX - labelWidth / 2, centerY - labelHeight / 2, labelWidth, labelHeight)

        ctx.fillStyle = lineColor
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, centerX, centerY)
      }
    }

    // Reset shadow for handles
    ctx.shadowColor = 'transparent'

    // Draw draggable handles (endpoint circles) with enhanced visibility
    canvasPoints.forEach((point, index) => {
      const handleSize = isSelected ? 9 : isHovered ? 7 : 6

      // Draw handle shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
      ctx.shadowBlur = 4
      ctx.shadowOffsetX = 2
      ctx.shadowOffsetY = 2

      // Outer circle (white border) - thicker
      ctx.fillStyle = 'white'
      ctx.beginPath()
      ctx.arc(point.x, point.y, handleSize, 0, 2 * Math.PI)
      ctx.fill()

      // Reset shadow
      ctx.shadowColor = 'transparent'

      // Middle circle (dark border for contrast)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
      ctx.beginPath()
      ctx.arc(point.x, point.y, handleSize - 1, 0, 2 * Math.PI)
      ctx.fill()

      // Inner circle (colored)
      ctx.fillStyle = handleColor
      ctx.beginPath()
      ctx.arc(point.x, point.y, handleSize - 2, 0, 2 * Math.PI)
      ctx.fill()

      // Add a small highlight for 3D effect
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.beginPath()
      ctx.arc(point.x - 1, point.y - 1, handleSize - 4, 0, 2 * Math.PI)
      ctx.fill()

      // Draw handle number for multi-point measurements
      if (isSelected && canvasPoints.length > 2) {
        ctx.fillStyle = 'white'
        ctx.font = 'bold 10px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText((index + 1).toString(), point.x, point.y)
      }
    })

    // Restore context state
    ctx.restore()
  }, [selectedMeasurementId, hoveredMeasurementId, editingLabelId, editingLabelText, imageToCanvasCoords])

  // Draw individual annotation with full interactivity
  const drawSingleAnnotation = useCallback((ctx: CanvasRenderingContext2D, annotation: Annotation, isActive = false) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const { points, style, type, text, id, normalized = true } = annotation
    const isSelected = selectedAnnotationId === id
    const isHovered = hoveredAnnotationId === id
    const isEditingText = editingAnnotationId === id

    // Transform points from normalized to canvas coordinates
    const canvasPoints = normalized
      ? points.map(p => imageToCanvasCoords(p))
      : points

    // Get color from style object and validate it (fix for black annotation issue)
    const rawColor = style?.strokeColor || selectedColor || MEDICAL_ANNOTATION_COLORS.green
    const annotationColor = validateAnnotationColor(rawColor)

    // Use different colors for selected/hovered states
    const drawColor = isSelected ? '#ffff00' : isHovered ? '#00ffff' : isActive ? '#ffff00' : annotationColor
    const lineWidth = isSelected ? (style?.strokeWidth || strokeWidth) + 2 : isHovered ? (style?.strokeWidth || strokeWidth) + 1 : (style?.strokeWidth || strokeWidth)

    ctx.save()
    ctx.strokeStyle = drawColor
    ctx.fillStyle = drawColor
    ctx.lineWidth = lineWidth
    ctx.font = `${annotation.fontSize || fontSize}px Arial`

    switch (type) {
      case 'text':
        if (canvasPoints.length > 0 && text) {
          // Set text properties BEFORE measuring
          ctx.font = `${annotation.fontSize || fontSize}px Arial`
          ctx.textAlign = 'left'
          ctx.textBaseline = 'top'

          const textMetrics = ctx.measureText(text)
          const textHeight = annotation.fontSize || fontSize
          const padding = 8
          const bgX = canvasPoints[0].x
          const bgY = canvasPoints[0].y
          const bgWidth = textMetrics.width + padding * 2
          const bgHeight = textHeight + padding * 2

          // Draw text background with border
          ctx.fillStyle = isEditingText ? 'rgba(50, 50, 50, 0.95)' : 'rgba(0, 0, 0, 0.85)'
          ctx.fillRect(bgX, bgY, bgWidth, bgHeight)

          ctx.strokeStyle = isEditingText ? '#00ff00' : drawColor
          ctx.lineWidth = isEditingText ? 3 : 2
          ctx.strokeRect(bgX, bgY, bgWidth, bgHeight)

          // Draw text with proper positioning
          ctx.fillStyle = drawColor
          ctx.fillText(text, canvasPoints[0].x + padding, canvasPoints[0].y + padding)

          // Store bounds for click detection
          canvas.dataset[`textAnnotation_${id}_x`] = bgX.toString()
          canvas.dataset[`textAnnotation_${id}_y`] = bgY.toString()
          canvas.dataset[`textAnnotation_${id}_w`] = bgWidth.toString()
          canvas.dataset[`textAnnotation_${id}_h`] = bgHeight.toString()

          // Draw anchor handle when selected
          if (isSelected) {
            ctx.fillStyle = 'white'
            ctx.beginPath()
            ctx.arc(canvasPoints[0].x, canvasPoints[0].y, 6, 0, 2 * Math.PI)
            ctx.fill()
            ctx.fillStyle = drawColor
            ctx.beginPath()
            ctx.arc(canvasPoints[0].x, canvasPoints[0].y, 4, 0, 2 * Math.PI)
            ctx.fill()
          }
        }
        break

      case 'arrow':
        if (canvasPoints.length >= 2) {
          const start = canvasPoints[0]
          const end = canvasPoints[1]

          // Draw arrow line with shadow
          ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
          ctx.shadowBlur = 4
          ctx.beginPath()
          ctx.moveTo(start.x, start.y)
          ctx.lineTo(end.x, end.y)
          ctx.stroke()

          // Draw arrowhead
          const angle = Math.atan2(end.y - start.y, end.x - start.x)
          const arrowLength = 15
          const arrowAngle = Math.PI / 6

          ctx.beginPath()
          ctx.moveTo(end.x, end.y)
          ctx.lineTo(
            end.x - arrowLength * Math.cos(angle - arrowAngle),
            end.y - arrowLength * Math.sin(angle - arrowAngle)
          )
          ctx.moveTo(end.x, end.y)
          ctx.lineTo(
            end.x - arrowLength * Math.cos(angle + arrowAngle),
            end.y - arrowLength * Math.sin(angle + arrowAngle)
          )
          ctx.stroke()

          ctx.shadowColor = 'transparent'

          // Draw handles when selected
          if (isSelected) {
            [start, end].forEach(point => {
              ctx.fillStyle = 'white'
              ctx.beginPath()
              ctx.arc(point.x, point.y, 7, 0, 2 * Math.PI)
              ctx.fill()
              ctx.fillStyle = drawColor
              ctx.beginPath()
              ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI)
              ctx.fill()
            })
          }
        }
        break

      case 'freehand':
        if (canvasPoints.length > 1) {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
          ctx.shadowBlur = 4
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          ctx.beginPath()
          ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y)
          for (let i = 1; i < canvasPoints.length; i++) {
            ctx.lineTo(canvasPoints[i].x, canvasPoints[i].y)
          }
          ctx.stroke()
          ctx.shadowColor = 'transparent'

          // Draw start/end handles when selected
          if (isSelected && canvasPoints.length > 0) {
            const handles = [canvasPoints[0], canvasPoints[canvasPoints.length - 1]]
            handles.forEach(point => {
              ctx.fillStyle = 'white'
              ctx.beginPath()
              ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI)
              ctx.fill()
              ctx.fillStyle = drawColor
              ctx.beginPath()
              ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI)
              ctx.fill()
            })
          }
        }
        break

      case 'rectangle':
        if (canvasPoints.length >= 2) {
          const width = canvasPoints[1].x - canvasPoints[0].x
          const height = canvasPoints[1].y - canvasPoints[0].y

          ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
          ctx.shadowBlur = 4
          ctx.strokeRect(canvasPoints[0].x, canvasPoints[0].y, width, height)

          // Fill with semi-transparent color when selected
          if (isSelected) {
            ctx.shadowColor = 'transparent'
            ctx.fillStyle = drawColor.replace(')', ', 0.1)').replace('rgb', 'rgba')
            ctx.fillRect(canvasPoints[0].x, canvasPoints[0].y, width, height)
          }

          ctx.shadowColor = 'transparent'

          // Draw corner handles when selected
          if (isSelected) {
            const corners = [
              canvasPoints[0],
              { x: canvasPoints[1].x, y: canvasPoints[0].y },
              canvasPoints[1],
              { x: canvasPoints[0].x, y: canvasPoints[1].y }
            ]
            corners.forEach(point => {
              ctx.fillStyle = 'white'
              ctx.fillRect(point.x - 5, point.y - 5, 10, 10)
              ctx.fillStyle = drawColor
              ctx.fillRect(point.x - 3, point.y - 3, 6, 6)
            })
          }
        }
        break

      case 'circle':
        if (canvasPoints.length >= 2) {
          const radius = Math.sqrt(
            Math.pow(canvasPoints[1].x - canvasPoints[0].x, 2) +
            Math.pow(canvasPoints[1].y - canvasPoints[0].y, 2)
          )

          ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
          ctx.shadowBlur = 4
          ctx.beginPath()
          ctx.arc(canvasPoints[0].x, canvasPoints[0].y, radius, 0, 2 * Math.PI)
          ctx.stroke()

          // Fill with semi-transparent color when selected
          if (isSelected) {
            ctx.shadowColor = 'transparent'
            ctx.fillStyle = drawColor.replace(')', ', 0.1)').replace('rgb', 'rgba')
            ctx.fill()
          }

          ctx.shadowColor = 'transparent'

          // Draw center and radius handles when selected
          if (isSelected) {
            // Center handle
            ctx.fillStyle = 'white'
            ctx.beginPath()
            ctx.arc(canvasPoints[0].x, canvasPoints[0].y, 7, 0, 2 * Math.PI)
            ctx.fill()
            ctx.fillStyle = drawColor
            ctx.beginPath()
            ctx.arc(canvasPoints[0].x, canvasPoints[0].y, 5, 0, 2 * Math.PI)
            ctx.fill()

            // Radius handle
            ctx.fillStyle = 'white'
            ctx.beginPath()
            ctx.arc(canvasPoints[1].x, canvasPoints[1].y, 7, 0, 2 * Math.PI)
            ctx.fill()
            ctx.fillStyle = drawColor
            ctx.beginPath()
            ctx.arc(canvasPoints[1].x, canvasPoints[1].y, 5, 0, 2 * Math.PI)
            ctx.fill()
          }
        }
        break

      case 'polygon':
        if (canvasPoints.length > 2) {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
          ctx.shadowBlur = 4
          ctx.beginPath()
          ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y)
          for (let i = 1; i < canvasPoints.length; i++) {
            ctx.lineTo(canvasPoints[i].x, canvasPoints[i].y)
          }
          ctx.closePath()
          ctx.stroke()

          // Fill with semi-transparent color when selected
          if (isSelected) {
            ctx.shadowColor = 'transparent'
            ctx.fillStyle = drawColor.replace(')', ', 0.1)').replace('rgb', 'rgba')
            ctx.fill()
          }

          ctx.shadowColor = 'transparent'

          // Draw vertex handles when selected
          if (isSelected) {
            canvasPoints.forEach(point => {
              ctx.fillStyle = 'white'
              ctx.beginPath()
              ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI)
              ctx.fill()
              ctx.fillStyle = drawColor
              ctx.beginPath()
              ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI)
              ctx.fill()
            })
          }
        }
        break

      case 'clinical':
        // Clinical finding annotation with special styling
        if (canvasPoints.length > 0) {
          // Draw clinical marker
          ctx.fillStyle = '#ff6b6b'
          ctx.beginPath()
          ctx.arc(canvasPoints[0].x, canvasPoints[0].y, 8, 0, 2 * Math.PI)
          ctx.fill()

          // Draw cross inside
          ctx.strokeStyle = 'white'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(canvasPoints[0].x - 4, canvasPoints[0].y)
          ctx.lineTo(canvasPoints[0].x + 4, canvasPoints[0].y)
          ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y - 4)
          ctx.lineTo(canvasPoints[0].x, canvasPoints[0].y + 4)
          ctx.stroke()

          // Draw text if available
          if (text) {
            ctx.fillStyle = 'rgba(255, 107, 107, 0.9)'
            const textMetrics = ctx.measureText(text)
            ctx.fillRect(canvasPoints[0].x + 15, canvasPoints[0].y - 15, textMetrics.width + 10, 20)
            ctx.fillStyle = 'white'
            ctx.fillText(text, canvasPoints[0].x + 20, canvasPoints[0].y - 5)
          }

          // Draw handle when selected
          if (isSelected) {
            ctx.fillStyle = 'white'
            ctx.beginPath()
            ctx.arc(canvasPoints[0].x, canvasPoints[0].y, 10, 0, 2 * Math.PI)
            ctx.fill()
            ctx.fillStyle = '#ff6b6b'
            ctx.beginPath()
            ctx.arc(canvasPoints[0].x, canvasPoints[0].y, 8, 0, 2 * Math.PI)
            ctx.fill()
          }
        }
        break

      case 'leader':
        // Leader/callout annotation with connector line and text box
        if (annotation.anchor && annotation.textPos && text) {
          const anchorCanvas = imageToCanvasCoords(annotation.anchor)
          const textPosCanvas = imageToCanvasCoords(annotation.textPos)

          // Draw connector line
          ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
          ctx.shadowBlur = 4
          ctx.strokeStyle = drawColor
          ctx.lineWidth = lineWidth
          ctx.setLineDash([5, 3])
          ctx.beginPath()
          ctx.moveTo(anchorCanvas.x, anchorCanvas.y)
          ctx.lineTo(textPosCanvas.x, textPosCanvas.y)
          ctx.stroke()
          ctx.setLineDash([])
          ctx.shadowColor = 'transparent'

          // Draw arrowhead at anchor if enabled
          if (annotation.showArrow) {
            const angle = Math.atan2(anchorCanvas.y - textPosCanvas.y, anchorCanvas.x - textPosCanvas.x)
            const arrowLength = 12
            const arrowAngle = Math.PI / 6

            ctx.fillStyle = drawColor
            ctx.beginPath()
            ctx.moveTo(anchorCanvas.x, anchorCanvas.y)
            ctx.lineTo(
              anchorCanvas.x - arrowLength * Math.cos(angle - arrowAngle),
              anchorCanvas.y - arrowLength * Math.sin(angle - arrowAngle)
            )
            ctx.lineTo(
              anchorCanvas.x - arrowLength * Math.cos(angle + arrowAngle),
              anchorCanvas.y - arrowLength * Math.sin(angle + arrowAngle)
            )
            ctx.closePath()
            ctx.fill()
          }

          // Draw text box
          const textMetrics = ctx.measureText(text)
          const textHeight = annotation.fontSize || fontSize
          const padding = 10
          const bgWidth = Math.max(textMetrics.width + padding * 2, 80)
          const bgHeight = textHeight + padding * 2
          const bgX = textPosCanvas.x - bgWidth / 2
          const bgY = textPosCanvas.y - bgHeight / 2

          // Text box background
          ctx.fillStyle = isEditingText ? 'rgba(50, 50, 50, 0.95)' : 'rgba(0, 0, 0, 0.9)'
          ctx.fillRect(bgX, bgY, bgWidth, bgHeight)

          // Text box border
          ctx.strokeStyle = isEditingText ? '#00ff00' : drawColor
          ctx.lineWidth = isEditingText ? 3 : 2
          ctx.strokeRect(bgX, bgY, bgWidth, bgHeight)

          // Draw text centered
          ctx.fillStyle = drawColor
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(text, textPosCanvas.x, textPosCanvas.y)

          // Store bounds for click detection
          canvas.dataset[`textAnnotation_${id}_x`] = bgX.toString()
          canvas.dataset[`textAnnotation_${id}_y`] = bgY.toString()
          canvas.dataset[`textAnnotation_${id}_w`] = bgWidth.toString()
          canvas.dataset[`textAnnotation_${id}_h`] = bgHeight.toString()

          // Draw handles when selected
          if (isSelected) {
            // Anchor handle
            ctx.fillStyle = 'white'
            ctx.beginPath()
            ctx.arc(anchorCanvas.x, anchorCanvas.y, 7, 0, 2 * Math.PI)
            ctx.fill()
            ctx.fillStyle = drawColor
            ctx.beginPath()
            ctx.arc(anchorCanvas.x, anchorCanvas.y, 5, 0, 2 * Math.PI)
            ctx.fill()

            // Text position handle
            ctx.fillStyle = 'white'
            ctx.fillRect(textPosCanvas.x - 6, textPosCanvas.y - 6, 12, 12)
            ctx.fillStyle = drawColor
            ctx.fillRect(textPosCanvas.x - 4, textPosCanvas.y - 4, 8, 8)
          }
        }
        break
    }

    ctx.restore()
  }, [fontSize, selectedAnnotationId, hoveredAnnotationId, editingAnnotationId, imageToCanvasCoords])

  // Draw control points for selected annotation
  const drawControlPoints = useCallback((ctx: CanvasRenderingContext2D, controlPoints: ControlPoint[], hoveredControlPointId: string | null) => {
    controlPoints.forEach(cp => {
      const isHovered = cp.id === hoveredControlPointId
      const size = isHovered ? 12 : 8 // Larger when hovered
      const halfSize = size / 2

      ctx.save()

      // Draw control point
      ctx.fillStyle = 'white'
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 2

      // Add shadow for depth
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
      ctx.shadowBlur = 4
      ctx.shadowOffsetX = 1
      ctx.shadowOffsetY = 1

      // Draw circle
      ctx.beginPath()
      ctx.arc(cp.position.x, cp.position.y, halfSize, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      // Highlight hovered control point
      if (isHovered) {
        ctx.strokeStyle = '#00ff41'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(cp.position.x, cp.position.y, halfSize + 2, 0, Math.PI * 2)
        ctx.stroke()
      }

      ctx.restore()
    })
  }, [])

  // Draw measurements and annotations overlay
  const drawMeasurements = useCallback((ctx: CanvasRenderingContext2D, frameIndex: number) => {
    // Draw completed measurements for this frame
    const frameMeasurements = measurements.filter(m => m.frameIndex === frameIndex)

    frameMeasurements.forEach(measurement => {
      drawSingleMeasurement(ctx, measurement, '#00ff41')
    })

    // Draw active measurement with preview
    if (activeMeasurement && activeMeasurement.frameIndex === frameIndex) {
      const { points, type } = activeMeasurement

      // Draw preview line for length tool with enhanced visuals
      if (type === 'length' && points.length === 1 && previewPoint) {
        ctx.save()

        // Draw shadow for preview line
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
        ctx.shadowBlur = 6
        ctx.shadowOffsetX = 2
        ctx.shadowOffsetY = 2

        // Draw white outline for contrast
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
        ctx.lineWidth = 5
        ctx.setLineDash([8, 8])
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(points[0].x, points[0].y)
        ctx.lineTo(previewPoint.x, previewPoint.y)
        ctx.stroke()

        // Draw main preview line (dashed, animated look)
        ctx.strokeStyle = '#ffff00'
        ctx.lineWidth = 3
        ctx.setLineDash([8, 8])
        ctx.beginPath()
        ctx.moveTo(points[0].x, points[0].y)
        ctx.lineTo(previewPoint.x, previewPoint.y)
        ctx.stroke()
        ctx.setLineDash([])

        // Reset shadow
        ctx.shadowColor = 'transparent'

        // Draw first point with enhanced style
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
        ctx.shadowBlur = 4

        ctx.fillStyle = 'white'
        ctx.beginPath()
        ctx.arc(points[0].x, points[0].y, 9, 0, 2 * Math.PI)
        ctx.fill()

        ctx.shadowColor = 'transparent'
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
        ctx.beginPath()
        ctx.arc(points[0].x, points[0].y, 8, 0, 2 * Math.PI)
        ctx.fill()

        ctx.fillStyle = '#ffff00'
        ctx.beginPath()
        ctx.arc(points[0].x, points[0].y, 6, 0, 2 * Math.PI)
        ctx.fill()

        // Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
        ctx.beginPath()
        ctx.arc(points[0].x - 1, points[0].y - 1, 4, 0, 2 * Math.PI)
        ctx.fill()

        // Draw preview point (pulsing effect with larger size)
        ctx.shadowColor = 'rgba(255, 255, 0, 0.8)'
        ctx.shadowBlur = 8

        ctx.fillStyle = 'white'
        ctx.beginPath()
        ctx.arc(previewPoint.x, previewPoint.y, 9, 0, 2 * Math.PI)
        ctx.fill()

        ctx.shadowColor = 'transparent'
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
        ctx.beginPath()
        ctx.arc(previewPoint.x, previewPoint.y, 8, 0, 2 * Math.PI)
        ctx.fill()

        ctx.fillStyle = '#ffff00'
        ctx.beginPath()
        ctx.arc(previewPoint.x, previewPoint.y, 6, 0, 2 * Math.PI)
        ctx.fill()

        // Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
        ctx.beginPath()
        ctx.arc(previewPoint.x - 1, previewPoint.y - 1, 4, 0, 2 * Math.PI)
        ctx.fill()

        // Draw real-time measurement value with enhanced label
        const distance = calculateDistance(points[0], previewPoint)
        const midX = (points[0].x + previewPoint.x) / 2
        const midY = (points[0].y + previewPoint.y) / 2
        const text = `${distance.toFixed(1)} mm`
        ctx.font = 'bold 16px Arial'
        const metrics = ctx.measureText(text)

        const padding = 8
        const labelWidth = metrics.width + padding * 2
        const labelHeight = 24
        const labelX = midX - labelWidth / 2
        const labelY = midY - 30

        // Label shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
        ctx.shadowBlur = 4

        // Background with pulsing border
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
        ctx.fillRect(labelX, labelY, labelWidth, labelHeight)

        ctx.shadowColor = 'transparent'

        // Animated border (thicker for preview)
        ctx.strokeStyle = '#ffff00'
        ctx.lineWidth = 3
        ctx.strokeRect(labelX, labelY, labelWidth, labelHeight)

        // Text
        ctx.fillStyle = '#ffff00'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, midX, labelY + labelHeight / 2)

        // Draw distance indicators at endpoints
        ctx.fillStyle = 'rgba(255, 255, 0, 0.3)'
        ctx.font = 'bold 12px Arial'
        ctx.textAlign = 'center'
        ctx.fillText('START', points[0].x, points[0].y - 15)
        ctx.fillText('END', previewPoint.x, previewPoint.y - 15)

        ctx.restore()
      } else {
        // Draw normal active measurement
        drawSingleMeasurement(ctx, activeMeasurement, '#ffff00')
      }
    }

    // Draw completed annotations for this frame (only visible ones)
    const frameAnnotations = annotations.filter(a => a.frameIndex === frameIndex && a.metadata.visible)

    frameAnnotations.forEach(annotation => {
      drawSingleAnnotation(ctx, annotation)
    })

    // Draw active annotation
    if (activeAnnotation && activeAnnotation.frameIndex === frameIndex) {
      drawSingleAnnotation(ctx, activeAnnotation, true)
    }
  }, [measurements, activeMeasurement, annotations, activeAnnotation, previewPoint, calculateDistance, drawSingleMeasurement, drawSingleAnnotation])

  // Find measurement at point (for selection and dragging)
  const findMeasurementAtPoint = useCallback((point: Point): { measurement: Measurement, pointIndex: number } | null => {
    const hitRadius = 10 // pixels

    // Check measurements on current frame
    const frameMeasurements = measurements.filter(m => m.frameIndex === currentFrameIndex)

    for (const measurement of frameMeasurements) {
      // Convert measurement points to canvas coordinates for hit testing
      const canvasPoints = measurement.normalized
        ? measurement.points.map(p => imageToCanvasCoords(p))
        : measurement.points

      for (let i = 0; i < canvasPoints.length; i++) {
        const p = canvasPoints[i]
        const distance = Math.sqrt(Math.pow(point.x - p.x, 2) + Math.pow(point.y - p.y, 2))

        if (distance <= hitRadius) {
          return { measurement, pointIndex: i }
        }
      }
    }

    return null
  }, [measurements, currentFrameIndex, imageToCanvasCoords])

  // Find annotation at point (for selection and dragging)
  const findAnnotationAtPoint = useCallback((point: Point): { annotation: Annotation, pointIndex: number } | null => {
    const hitRadius = 25 // pixels - increased for easier selection

    // Get annotations on current frame, sorted by z-index (highest first for top-most selection)
    const frameAnnotations = annotations
      .filter(a => a.frameIndex === currentFrameIndex)
      .sort((a, b) => (b.metadata?.zIndex || 0) - (a.metadata?.zIndex || 0))

    for (const annotation of frameAnnotations) {
      const canvasPoints = annotation.normalized
        ? annotation.points.map(p => imageToCanvasCoords(p))
        : annotation.points

      // Check points first (for precise control)
      for (let i = 0; i < canvasPoints.length; i++) {
        const p = canvasPoints[i]
        const distance = Math.sqrt(Math.pow(point.x - p.x, 2) + Math.pow(point.y - p.y, 2))

        if (distance <= hitRadius) {
          return { annotation, pointIndex: i }
        }
      }

      // Check if clicking on annotation body/shape (for easier selection)
      if (canvasPoints.length >= 2) {
        // Check if point is near any line segment
        for (let i = 0; i < canvasPoints.length - 1; i++) {
          const p1 = canvasPoints[i]
          const p2 = canvasPoints[i + 1]
          const distToLine = pointToLineDistance(point, p1, p2)

          if (distToLine <= hitRadius) {
            return { annotation, pointIndex: 0 } // Return first point for body hits
          }
        }

        // For closed shapes (rectangle, circle, freehand), check last-to-first segment
        if (annotation.type === 'rectangle' || annotation.type === 'circle' || annotation.type === 'freehand') {
          const p1 = canvasPoints[canvasPoints.length - 1]
          const p2 = canvasPoints[0]
          const distToLine = pointToLineDistance(point, p1, p2)

          if (distToLine <= hitRadius) {
            return { annotation, pointIndex: 0 }
          }
        }
      }
    }

    return null
  }, [annotations, currentFrameIndex, imageToCanvasCoords])

  // Helper function to calculate distance from point to line segment
  const pointToLineDistance = (point: Point, lineStart: Point, lineEnd: Point): number => {
    const A = point.x - lineStart.x
    const B = point.y - lineStart.y
    const C = lineEnd.x - lineStart.x
    const D = lineEnd.y - lineStart.y

    const dot = A * C + B * D
    const lenSq = C * C + D * D
    let param = -1

    if (lenSq !== 0) {
      param = dot / lenSq
    }

    let xx, yy

    if (param < 0) {
      xx = lineStart.x
      yy = lineStart.y
    } else if (param > 1) {
      xx = lineEnd.x
      yy = lineEnd.y
    } else {
      xx = lineStart.x + param * C
      yy = lineStart.y + param * D
    }

    const dx = point.x - xx
    const dy = point.y - yy
    return Math.sqrt(dx * dx + dy * dy)
  }

  // Check if point is inside rectangle
  const isPointInRectangle = (point: Point, rectPoints: Point[]): boolean => {
    if (rectPoints.length < 2) return false
    const [p1, p2] = rectPoints
    const minX = Math.min(p1.x, p2.x)
    const maxX = Math.max(p1.x, p2.x)
    const minY = Math.min(p1.y, p2.y)
    const maxY = Math.max(p1.y, p2.y)
    return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY
  }

  // Check if point is inside circle
  const isPointInCircle = (point: Point, circlePoints: Point[]): boolean => {
    if (circlePoints.length < 2) return false
    const [center, edge] = circlePoints
    const radius = Math.sqrt(Math.pow(edge.x - center.x, 2) + Math.pow(edge.y - center.y, 2))
    const distance = Math.sqrt(Math.pow(point.x - center.x, 2) + Math.pow(point.y - center.y, 2))
    return distance <= radius
  }

  // Check if point is inside polygon (ray casting algorithm)
  const isPointInPolygon = (point: Point, polygonPoints: Point[]): boolean => {
    if (polygonPoints.length < 3) return false

    let inside = false
    for (let i = 0, j = polygonPoints.length - 1; i < polygonPoints.length; j = i++) {
      const xi = polygonPoints[i].x, yi = polygonPoints[i].y
      const xj = polygonPoints[j].x, yj = polygonPoints[j].y

      const intersect = ((yi > point.y) !== (yj > point.y))
        && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)

      if (intersect) inside = !inside
    }

    return inside
  }

  // Update measurement point position
  const updateMeasurementPoint = useCallback((measurementId: string, pointIndex: number, newPoint: Point) => {
    // Convert canvas point to normalized coordinates
    const normalizedPoint = canvasToImageCoords(newPoint)

    setMeasurements(prev => prev.map(m => {
      if (m.id === measurementId) {
        const newPoints = [...m.points]
        newPoints[pointIndex] = normalizedPoint

        // Recalculate value using canvas coordinates for accurate measurement
        const canvasPoints = newPoints.map(p => imageToCanvasCoords(p))
        let value = 0
        if (m.type === 'length' && canvasPoints.length === 2) {
          value = calculateDistance(canvasPoints[0], canvasPoints[1])
        } else if (m.type === 'angle' && canvasPoints.length === 3) {
          value = calculateAngle(canvasPoints[0], canvasPoints[1], canvasPoints[2])
        } else if (m.type === 'area' && canvasPoints.length >= 3) {
          value = calculateArea(canvasPoints)
        }

        return { ...m, points: newPoints, value }
      }
      return m
    }))
  }, [calculateDistance, calculateAngle, calculateArea, canvasToImageCoords, imageToCanvasCoords])

  // Validate annotation is within canvas bounds
  const validateAnnotationBounds = useCallback((annotation: Annotation): boolean => {
    // Check if all points are within normalized bounds (0-1)
    return annotation.points.every(point =>
      point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1
    )
  }, [])

  // Apply movement with validation
  const applyValidatedMovement = useCallback((annotation: Annotation, delta: { dx: number; dy: number }): Annotation | null => {
    const movedAnnotation = dragManager.applyMovement(annotation, delta)

    // Validate bounds
    if (!validateAnnotationBounds(movedAnnotation)) {
      console.warn('[Movement] Annotation would move out of bounds, rejecting')
      return null
    }

    return movedAnnotation
  }, [validateAnnotationBounds])

  // Validate minimum annotation size
  const validateMinimumSize = useCallback((annotation: Annotation, minSize: number = 0.01): boolean => {
    const bbox = transformService.getBoundingBox(annotation)

    if (bbox.width < minSize || bbox.height < minSize) {
      console.warn('[Validation] Annotation too small:', { width: bbox.width, height: bbox.height, minSize })
      return false
    }

    return true
  }, [])

  // Push action to undo/redo history
  const pushToHistory = useCallback((
    action: HistoryEntry['action'],
    annotationId: string,
    beforeState: Annotation | null,
    afterState: Annotation | null
  ) => {
    const entry: HistoryEntry = {
      id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      action,
      annotationId,
      beforeState,
      afterState,
    }

    undoRedoManager.pushAction(entry)
  }, [])

  // Create new annotation
  const createAnnotation = useCallback((type: Annotation['type'], points: Point[], text?: string): Annotation => {
    const now = new Date().toISOString()
    return {
      id: `annotation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      points,
      text: text || annotationText,
      style: {
        strokeColor: selectedColor,
        fillColor: undefined,
        strokeWidth,
        fontSize,
        opacity: 1.0,
      },
      transform: {
        position: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        rotation: 0,
      },
      metadata: {
        name: undefined,
        visible: true,
        locked: false,
        zIndex: Date.now(), // Use timestamp as z-index for stacking order
      },
      frameIndex: currentFrameIndex,
      normalized: true,
      createdAt: now,
      updatedAt: now,
    }
  }, [annotationText, selectedColor, fontSize, strokeWidth, currentFrameIndex])

  // Handle canvas mouse interactions
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // Check if clicking on delete button
    for (const measurement of measurements) {
      if (measurement.frameIndex === currentFrameIndex) {
        const deleteBtnX = parseFloat(canvas.dataset[`deleteBtn_${measurement.id}_x`] || '0')
        const deleteBtnY = parseFloat(canvas.dataset[`deleteBtn_${measurement.id}_y`] || '0')
        const deleteBtnW = parseFloat(canvas.dataset[`deleteBtn_${measurement.id}_w`] || '0')
        const deleteBtnH = parseFloat(canvas.dataset[`deleteBtn_${measurement.id}_h`] || '0')

        if (x >= deleteBtnX && x <= deleteBtnX + deleteBtnW &&
          y >= deleteBtnY && y <= deleteBtnY + deleteBtnH) {
          deleteMeasurement(measurement.id)
          drawFrame(currentFrameIndex)
          return
        }
      }
    }

    // Check if clicking on measurement label to edit
    for (const measurement of measurements) {
      if (measurement.frameIndex === currentFrameIndex) {
        const labelX = parseFloat(canvas.dataset[`label_${measurement.id}_x`] || '0')
        const labelY = parseFloat(canvas.dataset[`label_${measurement.id}_y`] || '0')
        const labelW = parseFloat(canvas.dataset[`label_${measurement.id}_w`] || '0')
        const labelH = parseFloat(canvas.dataset[`label_${measurement.id}_h`] || '0')

        if (x >= labelX && x <= labelX + labelW &&
          y >= labelY && y <= labelY + labelH) {
          const displayText = measurement.label || `${measurement.value.toFixed(1)} ${measurement.unit}`
          startEditingLabel(measurement.id, displayText)
          dispatch(selectMeasurement(measurement.id))
          return
        }
      }
    }

    // Handle measurement tools
    if (['length', 'angle', 'area'].includes(activeTool)) {
      // Convert canvas coordinates to normalized image coordinates
      const normalizedPoint = canvasToImageCoords({ x, y })

      if (!activeMeasurement) {
        // Start new measurement with normalized coordinates
        const newMeasurement: Measurement = {
          id: `measurement_${Date.now()}`,
          type: activeTool as 'length' | 'angle' | 'area',
          points: [normalizedPoint],
          value: 0,
          unit: activeTool === 'area' ? 'mm²' : activeTool === 'angle' ? '°' : 'mm',
          frameIndex: currentFrameIndex,
          normalized: true
        }
        setActiveMeasurement(newMeasurement)
        setMeasurementPoints([normalizedPoint])
      } else {
        // Add point to current measurement
        const updatedPoints = [...activeMeasurement.points, normalizedPoint]
        const updatedMeasurement = { ...activeMeasurement, points: updatedPoints }

        // Check if measurement is complete
        const isComplete =
          (activeTool === 'length' && updatedPoints.length === 2) ||
          (activeTool === 'angle' && updatedPoints.length === 3) ||
          (activeTool === 'area' && updatedPoints.length >= 3 && event.detail === 2) // Double-click to complete area

        if (isComplete) {
          // Calculate final value using canvas coordinates for accurate measurement
          const canvasPoints = updatedPoints.map(p => imageToCanvasCoords(p))
          let value = 0
          if (activeTool === 'length') {
            value = calculateDistance(canvasPoints[0], canvasPoints[1])
          } else if (activeTool === 'angle') {
            value = calculateAngle(canvasPoints[0], canvasPoints[1], canvasPoints[2])
          } else if (activeTool === 'area') {
            value = calculateArea(canvasPoints)
          }

          const completedMeasurement = { ...updatedMeasurement, value, normalized: true }
          const newMeasurements = [...measurements, completedMeasurement]
          setMeasurements(newMeasurements)
          addToHistory(newMeasurements)

          // Sync to Redux for AnalysisPanel (convert to Redux format)
          dispatch(addMeasurementToRedux({
            id: completedMeasurement.id,
            type: completedMeasurement.type,
            data: completedMeasurement,
            createdAt: new Date().toISOString()
          }))

          setActiveMeasurement(null)
          setMeasurementPoints([])
        } else {
          setActiveMeasurement(updatedMeasurement)
          setMeasurementPoints(updatedPoints)
        }
      }

      drawFrame(currentFrameIndex)
    }

    // Check if clicking on text annotation to edit
    for (const annotation of annotations) {
      if (annotation.type === 'text' && annotation.frameIndex === currentFrameIndex) {
        const textX = parseFloat(canvas.dataset[`textAnnotation_${annotation.id}_x`] || '0')
        const textY = parseFloat(canvas.dataset[`textAnnotation_${annotation.id}_y`] || '0')
        const textW = parseFloat(canvas.dataset[`textAnnotation_${annotation.id}_w`] || '0')
        const textH = parseFloat(canvas.dataset[`textAnnotation_${annotation.id}_h`] || '0')

        if (x >= textX && x <= textX + textW && y >= textY && y <= textY + textH) {
          setEditingAnnotationId(annotation.id)
          setEditingAnnotationText(annotation.text || '')
          dispatch(selectAnnotation(annotation.id))
          return
        }
      }
    }

    // Handle leader tool (two-step: anchor then text position)
    if (activeTool === 'leader') {
      const normalizedPoint = canvasToImageCoords({ x, y })

      if (leaderStep === null) {
        // First click: set anchor point
        setLeaderStep('anchor')
        const newAnnotation = createAnnotation('leader', [normalizedPoint], '')
        newAnnotation.anchor = normalizedPoint
        setActiveAnnotation(newAnnotation)
      } else if (leaderStep === 'anchor' && activeAnnotation) {
        // Second click: set text position and open edit dialog
        const updatedAnnotation = { ...activeAnnotation, textPos: normalizedPoint, text: 'Label' }
        setAnnotations(prev => [...prev, updatedAnnotation])

        // Sync to Redux for AnalysisPanel (convert to Redux format)
        dispatch(addAnnotationToRedux({
          id: updatedAnnotation.id,
          type: updatedAnnotation.type,
          text: updatedAnnotation.text || '',
          points: updatedAnnotation.points,
          createdAt: updatedAnnotation.createdAt
        }))

        setEditingAnnotationId(updatedAnnotation.id)
        setEditingAnnotationText('Label')
        setActiveAnnotation(null)
        setLeaderStep(null)
      }
      drawFrame(currentFrameIndex)
      return
    }

    // Handle annotation tools
    if (['textAnnotation', 'arrowAnnotation', 'rectangle', 'circle', 'polygon', 'clinical'].includes(activeTool)) {
      // Convert canvas coordinates to normalized
      const normalizedPoint = canvasToImageCoords({ x, y })

      if (!activeAnnotation) {
        // Start new annotation
        if (activeTool === 'textAnnotation') {
          // For text annotations, immediately create with current text
          const newAnnotation = createAnnotation('text', [normalizedPoint], annotationText || 'New Text')
          setAnnotations(prev => [...prev, newAnnotation])

          // Sync to Redux for AnalysisPanel (convert to Redux format)
          dispatch(addAnnotationToRedux({
            id: newAnnotation.id,
            type: newAnnotation.type,
            text: newAnnotation.text || '',
            points: newAnnotation.points,
            createdAt: newAnnotation.createdAt
          }))

          // Push to undo/redo history
          pushToHistory('create', newAnnotation.id, null, newAnnotation)

          // Track action in history
          dispatch(addToolAction({
            actionType: 'create',
            itemType: 'annotation',
            itemId: newAnnotation.id,
            frameIndex: currentFrameIndex,
            metadata: {
              annotationType: 'text',
              text: newAnnotation.text,
              coords: normalizedPoint,
            },
          }))

          setEditingAnnotationId(newAnnotation.id)
          setEditingAnnotationText(newAnnotation.text || '')
        } else if (activeTool === 'clinical') {
          // Clinical finding annotation
          const newAnnotation = createAnnotation('clinical', [normalizedPoint], 'Clinical Finding')
          setAnnotations(prev => [...prev, newAnnotation])

          // Sync to Redux for AnalysisPanel (convert to Redux format)
          dispatch(addAnnotationToRedux({
            id: newAnnotation.id,
            type: newAnnotation.type,
            text: newAnnotation.text || '',
            points: newAnnotation.points,
            createdAt: newAnnotation.createdAt
          }))

          // Push to undo/redo history
          pushToHistory('create', newAnnotation.id, null, newAnnotation)
        } else {
          // For other annotations, start interactive creation
          const newAnnotation = createAnnotation(
            activeTool === 'arrowAnnotation' ? 'arrow' : activeTool as Annotation['type'],
            [normalizedPoint]
          )
          setActiveAnnotation(newAnnotation)
          setAnnotationPoints([normalizedPoint])
        }
      } else {
        // Add point to current annotation
        const updatedPoints = [...activeAnnotation.points, normalizedPoint]
        const updatedAnnotation = { ...activeAnnotation, points: updatedPoints }

        // Check if annotation is complete
        const isComplete =
          (activeTool === 'arrowAnnotation' && updatedPoints.length === 2) ||
          (activeTool === 'rectangle' && updatedPoints.length === 2) ||
          (activeTool === 'circle' && updatedPoints.length === 2) ||
          (activeTool === 'polygon' && event.detail === 2) // Double-click to complete polygon

        if (isComplete) {
          setAnnotations(prev => [...prev, updatedAnnotation])

          // Sync to Redux for AnalysisPanel (convert to Redux format)
          dispatch(addAnnotationToRedux({
            id: updatedAnnotation.id,
            type: updatedAnnotation.type,
            text: updatedAnnotation.text || '',
            points: updatedAnnotation.points,
            createdAt: updatedAnnotation.createdAt
          }))

          // Push to undo/redo history
          pushToHistory('create', updatedAnnotation.id, null, updatedAnnotation)

          setActiveAnnotation(null)
          setAnnotationPoints([])
        } else {
          setActiveAnnotation(updatedAnnotation)
          setAnnotationPoints(updatedPoints)
        }
      }

      drawFrame(currentFrameIndex)
    }
  }, [activeTool, activeMeasurement, activeAnnotation, currentFrameIndex, calculateDistance, calculateAngle, calculateArea, createAnnotation, annotationText, drawFrame, leaderStep, canvasToImageCoords])

  // Handle canvas double-click for text editing
  const handleCanvasDoubleClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // Check if double-clicking on a text annotation
    const annotationHit = findAnnotationAtPoint({ x, y })
    if (annotationHit && (annotationHit.annotation.type === 'text' || annotationHit.annotation.type === 'arrow')) {
      // Start editing
      textEditorManager.startEdit(annotationHit.annotation, { x, y })

      // Show editor component
      setTextEditorAnnotation(annotationHit.annotation)
      setTextEditorPosition({ x, y })
      setShowTextEditor(true)

      console.log('[DoubleClick] Started text editing:', annotationHit.annotation.id)
    }
  }, [findAnnotationAtPoint])

  // Handle text editor save
  const handleTextEditorSave = useCallback((text: string) => {
    const initialText = textEditorManager.getInitialText()
    const beforeAnnotation = annotations.find(a => a.id === textEditorManager.getEditingAnnotationId())
    const updatedAnnotation = textEditorManager.saveEdit(annotations)

    if (updatedAnnotation && beforeAnnotation) {
      // Update local state
      setAnnotations(prev => prev.map(a =>
        a.id === updatedAnnotation.id ? updatedAnnotation : a
      ))

      // Push to undo/redo history (only if text actually changed)
      if (initialText !== updatedAnnotation.text) {
        pushToHistory('edit', updatedAnnotation.id, beforeAnnotation, updatedAnnotation)
      }

      // Track action in history
      dispatch(addToolAction({
        actionType: 'text-edit',
        itemType: 'annotation',
        itemId: updatedAnnotation.id,
        frameIndex: currentFrameIndex,
        metadata: {
          annotationType: updatedAnnotation.type,
          text: updatedAnnotation.text,
        },
      }))

      drawFrame(currentFrameIndex)
    }

    // Hide editor
    setShowTextEditor(false)
    setTextEditorAnnotation(null)
  }, [annotations, dispatch, currentFrameIndex, drawFrame, pushToHistory])

  // Handle text editor cancel
  const handleTextEditorCancel = useCallback(() => {
    textEditorManager.cancelEdit()

    // Hide editor
    setShowTextEditor(false)
    setTextEditorAnnotation(null)
  }, [])

  // Handle text editor change
  const handleTextEditorChange = useCallback((text: string) => {
    textEditorManager.updateText(text)
  }, [])

  // Handle canvas mouse down for freehand drawing and measurement dragging
  const handleCanvasMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const normalizedPoint = canvasToImageCoords({ x, y })

    // Priority 1: Check if clicking on control point of selected annotation (for resize)
    if (selectedAnnotationId) {
      const selectedAnnotation = annotations.find(a => a.id === selectedAnnotationId)
      if (selectedAnnotation) {
        const controlPoints = controlPointManager.generateControlPoints(selectedAnnotation, imageToCanvasCoords)
        const hitControlPoint = controlPointManager.getControlPointAtPosition(controlPoints, { x, y })

        if (hitControlPoint) {
          // Start resize drag via control point
          dragManager.startControlPointDrag(selectedAnnotation, { x, y }, hitControlPoint.id)
          console.log('[MouseDown] Started control point drag:', hitControlPoint.id)
          return
        }
      }
    }

    // Priority 2: Check if clicking on existing measurement point
    const measurementHit = findMeasurementAtPoint({ x, y })
    if (measurementHit) {
      // Start dragging measurement
      setDraggingMeasurementId(measurementHit.measurement.id)
      setDraggingPointIndex(measurementHit.pointIndex)
      dispatch(selectMeasurement(measurementHit.measurement.id))
      return
    }

    // Priority 3: Check if clicking on existing annotation
    const annotationHit = findAnnotationAtPoint({ x, y })
    if (annotationHit) {
      // Select annotation
      dispatch(selectAnnotation(annotationHit.annotation.id))

      // Check if clicking on a specific point (for freehand/polygon editing)
      if (annotationHit.pointIndex !== -1) {
        // Start point drag
        dragManager.startDrag(annotationHit.annotation, { x, y }, 'point')
        setDraggingAnnotationPointIndex(annotationHit.pointIndex)
        console.log('[MouseDown] Started point drag:', annotationHit.pointIndex)
      } else {
        // Start whole annotation move
        dragManager.startDrag(annotationHit.annotation, { x, y }, 'move')
        console.log('[MouseDown] Started annotation move')
      }
      return
    }

    // Handle drawing tools with mouse press & drag
    if (activeTool === 'freehand') {
      setIsDrawing(true)
      const newAnnotation = createAnnotation('freehand', [normalizedPoint])
      setActiveAnnotation(newAnnotation)
      setAnnotationPoints([normalizedPoint])
    } else if (activeTool === 'rectangle') {
      setIsDrawing(true)
      const newAnnotation = createAnnotation('rectangle', [normalizedPoint])
      setActiveAnnotation(newAnnotation)
      setAnnotationPoints([normalizedPoint])
    } else if (activeTool === 'circle') {
      setIsDrawing(true)
      const newAnnotation = createAnnotation('circle', [normalizedPoint])
      setActiveAnnotation(newAnnotation)
      setAnnotationPoints([normalizedPoint])
    } else if (activeTool === 'arrowAnnotation') {
      setIsDrawing(true)
      const newAnnotation = createAnnotation('arrow', [normalizedPoint])
      setActiveAnnotation(newAnnotation)
      setAnnotationPoints([normalizedPoint])
    }
  }, [activeTool, createAnnotation, findMeasurementAtPoint, canvasToImageCoords])

  // Handle canvas mouse move for pan, freehand drawing, preview, and dragging
  const handleCanvasMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // Priority 1: Handle drag manager operations (annotation move/resize)
    if (dragManager.isDragging() && event.buttons === 1) {
      const delta = dragManager.updateDrag({ x, y })
      if (!delta) return

      const dragState = dragManager.getDragState()
      if (!dragState) return

      const initialAnnotation = dragManager.getInitialAnnotation()
      if (!initialAnnotation) return

      // Convert canvas delta to normalized delta
      const transform = getImageTransform()
      if (!transform) return

      const normalizedDelta = {
        dx: delta.dx / transform.drawWidth,
        dy: delta.dy / transform.drawHeight,
      }

      if (dragState.dragType === 'move') {
        // Move entire annotation with validation
        const movedAnnotation = applyValidatedMovement(initialAnnotation, normalizedDelta)

        if (movedAnnotation) {
          // Update local state for immediate visual feedback
          setAnnotations(prev => prev.map(a =>
            a.id === movedAnnotation.id ? movedAnnotation : a
          ))
        }
      } else if (dragState.dragType === 'point' && draggingAnnotationPointIndex !== null) {
        // Move single point (for freehand/polygon)
        const normalizedPoint = canvasToImageCoords({ x, y })
        const updatedAnnotation = dragManager.applyPointMovement(
          initialAnnotation,
          draggingAnnotationPointIndex,
          normalizedPoint
        )

        // Validate no self-intersection for polygons/freehand
        if (updatedAnnotation.type === 'polygon' || updatedAnnotation.type === 'freehand') {
          if (!transformService.validateNoSelfIntersection(updatedAnnotation)) {
            console.warn('[PointMove] Self-intersection detected, rejecting move')
            return
          }
        }

        // Update local state for immediate visual feedback
        setAnnotations(prev => prev.map(a =>
          a.id === updatedAnnotation.id ? updatedAnnotation : a
        ))
      } else if (dragState.dragType === 'resize' && dragState.controlPointId) {
        // Handle resize via control point
        const normalizedPoint = canvasToImageCoords({ x, y })

        // Get the control point that's being dragged
        const controlPoints = controlPointManager.generateControlPoints(initialAnnotation, imageToCanvasCoords)
        const controlPoint = controlPoints.find(cp => cp.id === dragState.controlPointId)

        if (controlPoint) {
          // Apply resize transformation
          const resizedAnnotation = transformService.resizeAnnotation(
            initialAnnotation,
            controlPoint,
            normalizedPoint,
            0.01 // Minimum size in normalized coordinates
          )

          // Update local state for immediate visual feedback
          setAnnotations(prev => prev.map(a =>
            a.id === resizedAnnotation.id ? resizedAnnotation : a
          ))
        }
      }

      drawFrame(currentFrameIndex)
      return
    }

    // Priority 2: Handle measurement point dragging
    if (draggingMeasurementId && draggingPointIndex !== null && event.buttons === 1) {
      updateMeasurementPoint(draggingMeasurementId, draggingPointIndex, { x, y })
      drawFrame(currentFrameIndex)
      return
    }

    // Handle preview for length tool with throttling
    if (activeTool === 'length' && activeMeasurement && activeMeasurement.points.length === 1) {
      // Convert to normalized coordinates for preview
      const normalizedPreview = canvasToImageCoords({ x, y })
      setPreviewPoint(normalizedPreview)

      // Use requestAnimationFrame for smooth rendering
      requestAnimationFrame(() => drawFrame(currentFrameIndex))
      return
    }

    // Handle hover detection and cursor updates
    // Update cursor based on position (control points, annotations, measurements, or tool)
    canvas.style.cursor = getCursorForPosition(x, y)

    // Update hover state for measurements
    const hit = findMeasurementAtPoint({ x, y })
    if (hit) {
      dispatch(setHoveredMeasurement(hit.measurement.id))
    } else {
      dispatch(setHoveredMeasurement(null))
    }

    if (activeTool === 'pan' && event.buttons === 1) {
      setPanOffset(prev => ({
        x: prev.x + event.movementX,
        y: prev.y + event.movementY
      }))
      drawFrame(currentFrameIndex)
    }

    // Handle real-time drawing for all drawing tools with throttling
    if (isDrawing && event.buttons === 1 && activeAnnotation) {
      const normalizedPoint = canvasToImageCoords({ x, y })

      if (activeTool === 'freehand') {
        // Add points continuously for smooth freehand path
        // Throttle: only add point if it's far enough from last point
        const lastPoint = activeAnnotation.points[activeAnnotation.points.length - 1]
        const distance = Math.sqrt(
          Math.pow(normalizedPoint.x - lastPoint.x, 2) +
          Math.pow(normalizedPoint.y - lastPoint.y, 2)
        )

        // Only add point if moved at least 0.005 in normalized space (reduces points by ~80%)
        if (distance > 0.005) {
          const updatedPoints = [...activeAnnotation.points, normalizedPoint]
          const updatedAnnotation = { ...activeAnnotation, points: updatedPoints }
          setActiveAnnotation(updatedAnnotation)
          setAnnotationPoints(updatedPoints)

          // Immediate redraw for responsive preview
          drawFrame(currentFrameIndex)
        }
      } else if (activeTool === 'rectangle' || activeTool === 'circle' || activeTool === 'arrowAnnotation') {
        // Update second point for shapes (real-time preview)
        const updatedPoints = [activeAnnotation.points[0], normalizedPoint]
        const updatedAnnotation = { ...activeAnnotation, points: updatedPoints }
        setActiveAnnotation(updatedAnnotation)
        setAnnotationPoints(updatedPoints)

        // Immediate redraw for responsive preview
        drawFrame(currentFrameIndex)
      }
      return
    }

    // Show preview even when not drawing (mouse hover during tool selection)
    if (!isDrawing && activeAnnotation && activeAnnotation.points.length === 1 &&
      (activeTool === 'rectangle' || activeTool === 'circle' || activeTool === 'arrowAnnotation')) {
      // Show ghost preview of what will be drawn
      const normalizedPoint = canvasToImageCoords({ x, y })
      const updatedPoints = [activeAnnotation.points[0], normalizedPoint]
      const updatedAnnotation = { ...activeAnnotation, points: updatedPoints }
      setActiveAnnotation(updatedAnnotation)
      drawFrame(currentFrameIndex)
      return
    }
  }, [activeTool, currentFrameIndex, drawFrame, isDrawing, activeAnnotation, activeMeasurement, draggingMeasurementId, draggingPointIndex, updateMeasurementPoint, findMeasurementAtPoint])

  // Get cursor style for tool
  const getCursorForTool = useCallback((tool: Tool): string => {
    switch (tool) {
      case 'pan': return 'grab'
      case 'zoom': return 'zoom-in'
      case 'length':
      case 'angle':
      case 'area': return 'crosshair'
      case 'textAnnotation':
      case 'arrowAnnotation': return 'crosshair'
      case 'freehand': return 'crosshair'
      case 'rectangle':
      case 'circle':
      case 'polygon': return 'crosshair'
      case 'windowLevel': return 'ew-resize'
      case 'scroll': return 'ns-resize'
      case 'clinical': return 'crosshair'
      case 'leader': return 'crosshair'
      default: return 'default'
    }
  }, [])

  // Get cursor for position (considering annotations and control points)
  const getCursorForPosition = useCallback((x: number, y: number): string => {
    // Priority 1: Check if hovering over control point of selected annotation
    if (selectedAnnotationId) {
      const selectedAnnotation = annotations.find(a => a.id === selectedAnnotationId)
      if (selectedAnnotation) {
        const controlPoints = controlPointManager.generateControlPoints(selectedAnnotation, imageToCanvasCoords)
        const hitControlPoint = controlPointManager.getControlPointAtPosition(controlPoints, { x, y })

        if (hitControlPoint) {
          // Return resize cursor based on control point type
          return hitControlPoint.cursor
        }
      }
    }

    // Priority 2: Check if hovering over annotation
    const annotationHit = findAnnotationAtPoint({ x, y })
    if (annotationHit) {
      // Return move cursor for annotation body
      if (annotationHit.annotation.type === 'text') {
        return 'text'
      }
      return 'move'
    }

    // Priority 3: Check if hovering over measurement
    const measurementHit = findMeasurementAtPoint({ x, y })
    if (measurementHit) {
      return 'pointer'
    }

    // Default: return cursor for active tool
    return getCursorForTool(activeTool)
  }, [selectedAnnotationId, annotations, findAnnotationAtPoint, findMeasurementAtPoint, activeTool, getCursorForTool, imageToCanvasCoords])

  // Handle mouse up for freehand drawing and dragging
  const handleCanvasMouseUp = useCallback(() => {
    // Priority 1: End drag manager operations
    if (dragManager.isDragging()) {
      const dragState = dragManager.getDragState()
      if (dragState) {
        const initialAnnotation = dragManager.getInitialAnnotation()
        const finalAnnotation = annotations.find(a => a.id === dragState.targetId)

        if (finalAnnotation && initialAnnotation) {
          // End drag and save to Redux
          dragManager.endDrag(finalAnnotation)

          // Push to undo/redo history
          const action = dragState.dragType === 'move' ? 'move' :
            dragState.dragType === 'point' ? 'point-move' : 'resize'
          pushToHistory(action, finalAnnotation.id, initialAnnotation, finalAnnotation)

          // Track action in history
          dispatch(addToolAction({
            actionType: dragState.dragType === 'move' ? 'move' :
              dragState.dragType === 'point' ? 'handle-drag' : 'resize',
            itemType: 'annotation',
            itemId: finalAnnotation.id,
            frameIndex: currentFrameIndex,
            metadata: {
              annotationType: finalAnnotation.type,
              coords: finalAnnotation.points[0],
            },
          }))
        } else {
          // No final annotation found, cancel drag
          dragManager.cancelDrag()
        }
      }

      // Clear point index
      setDraggingAnnotationPointIndex(null)
      return
    }

    // Priority 2: Stop dragging measurements
    if (draggingMeasurementId) {
      setDraggingMeasurementId(null)
      setDraggingPointIndex(null)
      return
    }

    // Finalize drawing for all drawing tools
    if (isDrawing && activeAnnotation) {
      // Only save if we have enough points
      const shouldSave =
        (activeTool === 'freehand' && activeAnnotation.points.length > 1) ||
        (activeTool === 'rectangle' && activeAnnotation.points.length === 2) ||
        (activeTool === 'circle' && activeAnnotation.points.length === 2) ||
        (activeTool === 'arrowAnnotation' && activeAnnotation.points.length === 2)

      if (shouldSave) {
        setAnnotations(prev => [...prev, activeAnnotation])

        // Sync to Redux for Analysis Panel
        dispatch(addAnnotationToRedux({
          id: activeAnnotation.id,
          type: activeAnnotation.type,
          text: activeAnnotation.text || '',
          points: activeAnnotation.points,
          createdAt: activeAnnotation.createdAt
        }))

        // Track action in history
        dispatch(addToolAction({
          actionType: 'finalize',
          itemType: 'annotation',
          itemId: activeAnnotation.id,
          frameIndex: currentFrameIndex,
          metadata: {
            annotationType: activeAnnotation.type,
            coords: activeAnnotation.points[0],
          },
        }))
      }

      setActiveAnnotation(null)
      setAnnotationPoints([])
      setIsDrawing(false)
    }
  }, [activeTool, isDrawing, activeAnnotation, draggingMeasurementId, dispatch, currentFrameIndex])

  // Handle canvas wheel for zoom/scroll
  const handleCanvasWheel = useCallback((event: React.WheelEvent<HTMLCanvasElement>) => {
    // Only prevent default if we're actually using the wheel for viewer functions
    if (activeTool === 'zoom' || activeTool === 'scroll') {
      event.preventDefault()
      event.stopPropagation()

      if (activeTool === 'zoom') {
        const delta = event.deltaY > 0 ? 0.9 : 1.1
        setZoom(prev => Math.max(0.1, Math.min(5, prev * delta)))
        drawFrame(currentFrameIndex)
      } else if (activeTool === 'scroll') {
        const direction = event.deltaY > 0 ? 1 : -1
        const newFrame = Math.max(0, Math.min(totalFrames - 1, currentFrameIndex + direction))
        if (newFrame !== currentFrameIndex) {
          setCurrentFrameIndex(newFrame)
        }
      }
    }
    // For other tools, allow normal page scrolling
  }, [activeTool, currentFrameIndex, totalFrames, drawFrame])

  // Frame navigation functions
  const goToFrame = useCallback((frameIndex: number) => {
    const newFrame = Math.max(0, Math.min(totalFrames - 1, frameIndex))
    setCurrentFrameIndex(newFrame)
  }, [totalFrames])

  const nextFrame = useCallback(() => {
    goToFrame(currentFrameIndex + 1)
  }, [currentFrameIndex, goToFrame])

  const previousFrame = useCallback(() => {
    goToFrame(currentFrameIndex - 1)
  }, [currentFrameIndex, goToFrame])

  // New feature handlers
  const handlePresetSelect = useCallback((preset: WindowLevelPreset) => {
    setWindowWidth(preset.windowWidth)
    setWindowLevel(preset.windowCenter)
    setCurrentPreset(preset.name)
    drawFrame(currentFrameIndex)
  }, [currentFrameIndex, drawFrame])

  const handleCinePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev)
  }, [])

  const handleCineStop = useCallback(() => {
    setIsPlaying(false)
    setCurrentFrameIndex(0)
  }, [])

  const handleFirstFrame = useCallback(() => {
    setCurrentFrameIndex(0)
  }, [])

  const handleLastFrame = useCallback(() => {
    setCurrentFrameIndex(totalFrames - 1)
  }, [totalFrames])

  const handleLoopToggle = useCallback(() => {
    setCineLoop(prev => !prev)
  }, [])

  const handleFpsChange = useCallback((fps: number) => {
    setCineFps(fps)
    setPlaySpeed(1000 / fps)
  }, [])

  // Auto-play functionality
  const startPlayback = useCallback(() => {
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current)
    }

    playIntervalRef.current = setInterval(() => {
      setCurrentFrameIndex((prev) => {
        const nextFrame = prev + 1
        if (nextFrame >= totalFrames) {
          // If loop is enabled, go back to start, otherwise stop
          if (cineLoop) {
            return 0
          } else {
            setIsPlaying(false)
            return prev
          }
        }
        return nextFrame
      })
    }, playSpeed) // Use playSpeed from state
  }, [totalFrames, cineLoop, playSpeed])

  const stopPlayback = useCallback(() => {
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current)
      playIntervalRef.current = null
    }
  }, [])

  useEffect(() => {
    if (isPlaying && totalFrames > 1) {
      startPlayback()
    } else {
      stopPlayback()
    }

    return () => stopPlayback()
  }, [isPlaying, totalFrames, startPlayback, stopPlayback])

  // Cine loop playback
  const togglePlayback = useCallback(() => {
    setIsPlaying(prev => !prev)
  }, [])

  // Window/Level presets
  const applyWindowLevelPreset = useCallback((preset: string) => {
    switch (preset) {
      case 'angio':
        setWindowWidth(600)
        setWindowLevel(300)
        break
      case 'bone':
        setWindowWidth(2000)
        setWindowLevel(300)
        break
      case 'soft':
        setWindowWidth(400)
        setWindowLevel(50)
        break
      default:
        setWindowWidth(256)
        setWindowLevel(128)
    }
    drawFrame(currentFrameIndex)
  }, [currentFrameIndex, drawFrame])

  // Reset view
  const resetView = useCallback(() => {
    setZoom(1.0)
    setPanOffset({ x: 0, y: 0 })
    setWindowWidth(metadata?.technical_info?.window_width?.[0] || 256)
    setWindowLevel(metadata?.technical_info?.window_center?.[0] || 128)
    drawFrame(currentFrameIndex)
  }, [currentFrameIndex, drawFrame, metadata])

  // Clear measurements
  const clearMeasurements = useCallback(() => {
    setMeasurements([])
    setActiveMeasurement(null)
    setMeasurementPoints([])
    dispatch(selectMeasurement(null))
    setPreviewPoint(null)
    drawFrame(currentFrameIndex)
  }, [currentFrameIndex, drawFrame, dispatch])

  // Delete selected measurement
  const deleteSelectedMeasurement = useCallback(() => {
    if (selectedMeasurementId) {
      const updatedMeasurements = measurements.filter(m => m.id !== selectedMeasurementId)
      setMeasurements(updatedMeasurements)
      addToHistory(updatedMeasurements)
      dispatch(selectMeasurement(null))
      drawFrame(currentFrameIndex)
    }
  }, [selectedMeasurementId, currentFrameIndex, drawFrame, addToHistory, measurements, dispatch])

  // Clear all annotations and measurements
  const clearAllAnnotations = useCallback(() => {
    const emptyMeasurements: Measurement[] = []
    setMeasurements(emptyMeasurements)
    setAnnotations([])
    setActiveMeasurement(null)
    setActiveAnnotation(null)
    addToHistory(emptyMeasurements)
    drawFrame(currentFrameIndex)
  }, [currentFrameIndex, drawFrame])

  // Keyboard event handler for annotations with undo/redo
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      console.log('KEY', event.key, 'ctrl:', event.ctrlKey, 'meta:', event.metaKey, 'target:', document.activeElement?.tagName)

      // Suppress global shortcuts when text input is focused
      if (isTextInputFocused) {
        console.log('  Suppressed (text input focused)')
        return // Let the text input handle its own keyboard events
      }

      // Undo: Ctrl+Z (or Cmd+Z on Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        if (canUndo) {
          undo()
          event.preventDefault()
        }
        return
      }

      // Redo: Ctrl+Y or Ctrl+Shift+Z (or Cmd+Y / Cmd+Shift+Z on Mac)
      if (((event.ctrlKey || event.metaKey) && event.key === 'y') ||
        ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'z')) {
        if (canRedo) {
          redo()
          event.preventDefault()
        }
        return
      }

      // Delete key - remove selected annotation or measurement
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedAnnotationId) {
          // Find the annotation to delete
          const annotationToDelete = annotations.find(a => a.id === selectedAnnotationId)
          if (annotationToDelete) {
            // Push delete action to history
            pushAction({
              type: 'delete',
              annotationId: selectedAnnotationId,
              beforeState: { ...annotationToDelete },
              afterState: null,
              timestamp: Date.now(),
              description: `Delete ${annotationToDelete.type} annotation`
            })

            // Remove annotation
            setAnnotations(prev => prev.filter(a => a.id !== selectedAnnotationId))
            dispatch(selectAnnotation(null))
            drawFrame(currentFrameIndex)
          }
          event.preventDefault()
        } else if (selectedMeasurementId) {
          deleteSelectedMeasurement()
          event.preventDefault()
        }
      }

      // Escape key - cancel drawing or deselect
      else if (event.key === 'Escape') {
        if (activeAnnotation || activeMeasurement) {
          // Cancel active drawing
          setActiveAnnotation(null)
          setActiveMeasurement(null)
          setAnnotationPoints([])
          setMeasurementPoints([])
          setIsDrawing(false)
          setLeaderStep(null)
          drawFrame(currentFrameIndex)
        } else if (selectedAnnotationId || selectedMeasurementId) {
          // Deselect
          dispatch(clearAllSelections())
          drawFrame(currentFrameIndex)
        }
        event.preventDefault()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    isTextInputFocused,
    canUndo,
    canRedo,
    undo,
    redo,
    selectedAnnotationId,
    selectedMeasurementId,
    activeAnnotation,
    activeMeasurement,
    annotations,
    currentFrameIndex,
    drawFrame,
    deleteSelectedMeasurement,
    pushAction,
  ])

  // MPR Rendering Functions
  const drawMPRView = useCallback((ctx: CanvasRenderingContext2D, viewType: 'axial' | 'sagittal' | 'coronal', width: number, height: number) => {
    // Clear canvas
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, width, height)

    console.log(`Drawing MPR view: ${viewType}, size: ${width}x${height}, currentFrame: ${currentFrameIndex}`)

    if (viewType === 'axial') {
      // For axial view, show the current frame (this is the original view)
      const img = imageCache.current.get(currentFrameIndex)
      console.log(`Axial view - image cache has frame ${currentFrameIndex}:`, !!img)

      if (img) {
        const scale = Math.min(width / img.width, height / img.height) * 0.9
        const drawWidth = img.width * scale
        const drawHeight = img.height * scale
        const x = (width - drawWidth) / 2
        const y = (height - drawHeight) / 2

        ctx.drawImage(img, x, y, drawWidth, drawHeight)

        // Add crosshairs
        ctx.strokeStyle = '#00ff00'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(width / 2, 0)
        ctx.lineTo(width / 2, height)
        ctx.moveTo(0, height / 2)
        ctx.lineTo(width, height / 2)
        ctx.stroke()
      } else {
        // Load the image directly if not in cache
        const frameUrl = frameUrls[currentFrameIndex]
        if (frameUrl) {
          const img = new Image()
          img.onload = () => {
            const scale = Math.min(width / img.width, height / img.height) * 0.9
            const drawWidth = img.width * scale
            const drawHeight = img.height * scale
            const x = (width - drawWidth) / 2
            const y = (height - drawHeight) / 2

            ctx.drawImage(img, x, y, drawWidth, drawHeight)

            // Add crosshairs
            ctx.strokeStyle = '#00ff00'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(width / 2, 0)
            ctx.lineTo(width / 2, height)
            ctx.moveTo(0, height / 2)
            ctx.lineTo(width, height / 2)
            ctx.stroke()
          }
          img.src = frameUrl
        }
      }
    } else if (viewType === 'sagittal') {
      // Sagittal view - show reconstructed sagittal slice from multiple frames
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(0, 0, width, height)

      // Load and composite multiple frames to create sagittal view
      const sagittalSliceWidth = Math.floor(width / 2) // Central sagittal slice

      // Use current frame as representative sagittal view
      const img = imageCache.current.get(currentFrameIndex)
      if (img) {
        // Rotate and display image to simulate sagittal orientation
        const scale = Math.min(width / img.height, height / img.width) * 0.8
        const drawWidth = img.height * scale
        const drawHeight = img.width * scale
        const x = (width - drawWidth) / 2
        const y = (height - drawHeight) / 2

        ctx.save()
        ctx.translate(width / 2, height / 2)
        ctx.rotate(Math.PI / 2) // 90-degree rotation for sagittal orientation
        ctx.drawImage(img, -drawHeight / 2, -drawWidth / 2, drawHeight, drawWidth)
        ctx.restore()

        // Add orientation crosshairs
        ctx.strokeStyle = '#10b981'
        ctx.lineWidth = 1
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        ctx.moveTo(width / 2, 0)
        ctx.lineTo(width / 2, height)
        ctx.moveTo(0, height / 2)
        ctx.lineTo(width, height / 2)
        ctx.stroke()
        ctx.setLineDash([])
      } else {
        // Fallback to procedural sagittal representation
        ctx.strokeStyle = '#10b981'
        ctx.lineWidth = 2

        for (let i = 0; i < totalFrames; i += 4) {
          const x = (i / totalFrames) * width
          ctx.beginPath()
          ctx.moveTo(x, 0)
          ctx.lineTo(x, height)
          ctx.stroke()

          const waveY = height / 2 + Math.sin((i / totalFrames) * Math.PI * 4) * (height / 4)
          ctx.fillStyle = '#10b981'
          ctx.fillRect(x - 1, waveY - 2, 2, 4)
        }

        // Current position indicator
        const currentX = (currentFrameIndex / totalFrames) * width
        ctx.strokeStyle = '#ffff00'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(currentX, 0)
        ctx.lineTo(currentX, height)
        ctx.stroke()
      }

    } else if (viewType === 'coronal') {
      // Coronal view - show reconstructed coronal slice
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(0, 0, width, height)

      // Use current frame as representative coronal view
      const img = imageCache.current.get(currentFrameIndex)
      if (img) {
        // Display image flipped to simulate coronal orientation
        const scale = Math.min(width / img.width, height / img.height) * 0.8
        const drawWidth = img.width * scale
        const drawHeight = img.height * scale
        const x = (width - drawWidth) / 2
        const y = (height - drawHeight) / 2

        ctx.save()
        ctx.translate(width / 2, height / 2)
        ctx.scale(1, -1) // Vertical flip for coronal orientation
        ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
        ctx.restore()

        // Add orientation crosshairs
        ctx.strokeStyle = '#f59e0b'
        ctx.lineWidth = 1
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        ctx.moveTo(width / 2, 0)
        ctx.lineTo(width / 2, height)
        ctx.moveTo(0, height / 2)
        ctx.lineTo(width, height / 2)
        ctx.stroke()
        ctx.setLineDash([])
      } else {
        // Fallback to procedural coronal representation
        ctx.strokeStyle = '#f59e0b'
        ctx.lineWidth = 2

        for (let y = 0; y < height; y += 20) {
          const phase = (y / height) * Math.PI * 2
          const waveX = width / 2 + Math.cos(phase + (currentFrameIndex * 0.1)) * (width / 3)

          ctx.beginPath()
          ctx.moveTo(0, y)
          ctx.lineTo(waveX, y)
          ctx.stroke()

          ctx.fillStyle = '#f59e0b'
          ctx.fillRect(waveX - 2, y - 1, 4, 2)
        }

        // Add current slice indicator
        const currentY = height / 2
        ctx.strokeStyle = '#ffff00'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(0, currentY)
        ctx.lineTo(width, currentY)
        ctx.stroke()
      }
    }

    // Add crosshairs for all views
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(width / 2, 0)
    ctx.lineTo(width / 2, height)
    ctx.moveTo(0, height / 2)
    ctx.lineTo(width, height / 2)
    ctx.stroke()
  }, [currentFrameIndex, totalFrames, imageCache])

  // 3D Volume Overview
  const draw3DOverview = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, width, height)

    // Draw 3D cube representation
    const centerX = width / 2
    const centerY = height / 2
    const size = Math.min(width, height) * 0.3

    // Draw wireframe cube
    ctx.strokeStyle = '#8b5cf6'
    ctx.lineWidth = 2

    // Front face
    ctx.strokeRect(centerX - size / 2, centerY - size / 2, size, size)

    // Back face (offset for 3D effect)
    const offset = size * 0.3
    ctx.strokeRect(centerX - size / 2 + offset, centerY - size / 2 - offset, size, size)

    // Connecting lines
    ctx.beginPath()
    ctx.moveTo(centerX - size / 2, centerY - size / 2)
    ctx.lineTo(centerX - size / 2 + offset, centerY - size / 2 - offset)
    ctx.moveTo(centerX + size / 2, centerY - size / 2)
    ctx.lineTo(centerX + size / 2 + offset, centerY - size / 2 - offset)
    ctx.moveTo(centerX - size / 2, centerY + size / 2)
    ctx.lineTo(centerX - size / 2 + offset, centerY + size / 2 - offset)
    ctx.moveTo(centerX + size / 2, centerY + size / 2)
    ctx.lineTo(centerX + size / 2 + offset, centerY + size / 2 - offset)
    ctx.stroke()

    // Add frame indicator
    const framePosition = (currentFrameIndex / totalFrames)
    const indicatorY = centerY - size / 2 + (framePosition * size)

    ctx.fillStyle = '#ffff00'
    ctx.fillRect(centerX - size / 2 - 10, indicatorY - 2, size + 20, 4)

    // Add labels
    ctx.fillStyle = '#8b5cf6'
    ctx.font = '12px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`Frame ${currentFrameIndex + 1}`, centerX, centerY + size / 2 + 20)
  }, [currentFrameIndex, totalFrames])

  // 3D Rendering Control
  const handleStart3DRendering = useCallback(async () => {
    // Validate that we have enough frames for 3D rendering
    if (totalFrames < 2) {
      alert(`⚠️ 3D Rendering Not Available\n\nThis study has only ${totalFrames} frame(s).\n\n3D volume rendering requires multiple frames (slices) to create a 3D volume.\n\nPlease upload a multi-frame study such as:\n• CT scans (typically 100-500 slices)\n• MRI scans (typically 20-200 slices)\n• ZIP files containing multiple DICOM files from the same series`)
      console.warn(`Cannot start 3D rendering: only ${totalFrames} frame(s) available`)
      return
    }

    console.log(`🚀 Starting 3D volume rendering with ${totalFrames} frames...`)
    setIs3DRenderingStarted(true)
    // Load volume data
    await volumeRenderer.loadVolume()
  }, [volumeRenderer, totalFrames])

  // 3D Volume Rendering - Now handled by useVolumeRenderer hook
  // No need for fake render3DVolume function anymore

  // 3D Preset Functions
  const apply3DPreset = useCallback((preset: string) => {
    console.log(`Applying 3D preset: ${preset}`)
    if (preset === 'mip') {
      volumeRenderer.setRenderMode('mip')
    } else if (preset === 'vr') {
      volumeRenderer.setRenderMode('volume')
    } else if (preset === 'iso') {
      volumeRenderer.setRenderMode('isosurface')
    }
  }, [volumeRenderer])

  const rotate3D = useCallback(() => {
    // Toggle auto-rotation
    if (volumeRenderer.isRotating) {
      volumeRenderer.stopAutoRotation()
    } else {
      volumeRenderer.startAutoRotation()
    }
  }, [volumeRenderer])

  // Removed old start3DRendering - now using handleStart3DRendering with real volume renderer

  // Load available studies
  const loadAvailableStudies = useCallback(async () => {
    try {
      const result = await ApiService.getStudies()

      if (result.success) {
        const list = result.data || result.studies || []
        setAvailableStudies(list)
      }
    } catch (error) {
      console.error('Failed to load available studies:', error)
    }
  }, [])

  // Load available studies on component mount
  useEffect(() => {
    loadAvailableStudies()
  }, [loadAvailableStudies])

  // Subscribe to AI analysis queue updates
  useEffect(() => {
    const unsubscribe = aiAnalysisQueue.subscribe((stats) => {
      setQueueStats(stats)
    })
    return unsubscribe
  }, [])

  // Listen for Analysis Panel open requests
  useEffect(() => {
    const handleOpenAnalysisPanel = () => {
      console.log('📊 Opening Analysis Panel to show results...')
      setIsAnalysisPanelOpen(true)
    }

    window.addEventListener('openAnalysisPanel', handleOpenAnalysisPanel)
    return () => window.removeEventListener('openAnalysisPanel', handleOpenAnalysisPanel)
  }, [])

  // Subscribe to AI analysis updates to redraw canvas when analysis completes
  useEffect(() => {
    const handleAnalysisUpdate = () => {
      console.log('🔄 AI Analysis updated, redrawing canvas...')
      drawFrame(currentFrameIndex)
    }

    const unsubscribe = autoAnalysisService.subscribe(handleAnalysisUpdate)
    return unsubscribe
  }, [currentFrameIndex, drawFrame])

  // Report Management Functions
  const handleSaveReport = useCallback(async (report: any) => {
    setCurrentReport(report)
    console.log('📋 Report data received from StructuredReporting:', report)
    console.log('📊 Measurements:', report.measurements?.length || 0)
    console.log('📝 Annotations:', report.annotations?.length || 0)
    console.log('✍️ Signature:', report.radiologistSignature ? 'Present' : 'Missing')

    // If status is final, save immediately
    if (report.status === 'final') {
      try {
        const patientID = metadata?.patient_info?.id || 'UNKNOWN'

        const saveData = {
          studyInstanceUID: currentStudyId,
          patientID,
          reportStatus: 'final' as 'final' | 'draft' | 'preliminary' | 'amended' | 'cancelled',
          radiologistSignature: report.radiologistSignature || radiologistSignature,
          measurements: report.measurements || [],
          annotations: report.annotations || [],
          findings: report.findings || [],
          clinicalHistory: report.sections?.['clinical-info'] || '',
          technique: report.sections?.technique || '',
          findingsText: report.sections?.findings || '',
          impression: report.sections?.impression || '',
          recommendations: report.sections?.recommendations || ''
        }

        console.log('💾 Saving final report to backend:', saveData)

        const result = await reportsApi.upsert(saveData)

        if (result.success && result.report) {
          setCurrentReportId(result.report.reportId)
          alert(`✅ Report finalized and saved!\n\nReport ID: ${result.report.reportId}`)
          setShowStructuredReporting(false)
          console.log('✅ Report saved successfully:', result.report)
        } else {
          alert(`❌ Failed to save report`)
          console.error('❌ Save failed')
        }
      } catch (error) {
        console.error('Error saving report:', error)
        alert('❌ An error occurred while saving the report')
      }
    } else {
      // Draft mode - just close dialog and open finalize
      setShowStructuredReporting(false)
      setShowFinalizeDialog(true)
    }
  }, [measurements, annotations, currentStudyId, metadata, radiologistSignature])

  // AI Analysis Handler - DIRECT MODE (Opens AutoAnalysisPopup)
  const handleAIAnalysis = useCallback(async () => {
    if (!canvasRef.current) {
      alert('Canvas not available. Please make sure an image is loaded.')
      return
    }

    console.log('🚀 [DIRECT] Opening AutoAnalysisPopup for current frame...')

    // Close AI Assistant dialog
    setIsAIAssistantOpen(false)

    // Open AutoAnalysisPopup with current frame
    setAutoAnalysisOpen(true)
    setAutoAnalysisMode('single')
    setAutoAnalysisSlices([currentFrameIndex])
  }, [canvasRef, currentFrameIndex])

  // Multi-Slice AI Analysis Handler - DIRECT MODE (Opens AutoAnalysisPopup)
  const handleMultiSliceAnalysis = useCallback(async () => {
    if (!canvasRef.current || totalFrames === 0) {
      alert('No frames available for multi-slice analysis.')
      return
    }

    console.log(`🚀 [DIRECT] Opening AutoAnalysisPopup for all ${totalFrames} slices...`)

    // Close AI Assistant dialog
    setIsAIAssistantOpen(false)

    // Generate array of all slice indices
    const allSlices = Array.from({ length: totalFrames }, (_, i) => i)

    // Open AutoAnalysisPopup with all slices
    setAutoAnalysisOpen(true)
    setAutoAnalysisMode('all')
    setAutoAnalysisSlices(allSlices)
  }, [canvasRef, totalFrames])

  // Download AI Report Handler
  const handleDownloadAIReport = useCallback(async () => {
    if (!downloadReportId) {
      alert('No report available for download. Please run analysis first.')
      return
    }

    try {
      console.log(`📥 Downloading report: ${downloadReportId}`)

      const downloadResponse = await fetch(`http://localhost:8001/api/ai/report/${downloadReportId}/download`)

      if (!downloadResponse.ok) {
        throw new Error(`Download failed: ${downloadResponse.status}`)
      }

      const blob = await downloadResponse.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url

      // Determine filename based on analysis type
      const isMultiSlice = multiSliceAnalysisIds.length > 0
      const filename = isMultiSlice
        ? `AI_MultiSlice_Report_${totalFrames}slices_${downloadReportId}.pdf`
        : `AI_Report_Slice${currentFrameIndex}_${downloadReportId}.pdf`

      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      console.log(`✅ Report downloaded: ${filename}`)
      alert('✅ Report downloaded successfully!\n\nFile: ' + filename)

    } catch (error: any) {
      console.error('❌ Download error:', error)
      alert('Failed to download report: ' + error.message)
    }
  }, [downloadReportId, multiSliceAnalysisIds, totalFrames, currentFrameIndex])

  // Retry Failed Slice Handler
  const handleRetryFailedSlice = useCallback(async (frameIndex: number) => {
    if (aiAnalyzing) {
      alert('Analysis already in progress. Please wait.')
      return
    }

    console.log(`🔄 Retrying analysis for slice ${frameIndex}...`)
    setSliceAnalysisStatus(prev => new Map(prev).set(frameIndex, 'analyzing'))

    try {
      const response = await fetch('http://localhost:8001/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'single',
          studyInstanceUID,
          seriesInstanceUID: metadata?.series_info?.seriesInstanceUID,
          instanceUID: metadata?.instance_info?.sopInstanceUID,
          frameIndex,
          options: {
            saveResults: true,
            includeSnapshot: true,
            forceReanalyze: true // Force reanalysis
          }
        })
      })

      if (!response.ok) {
        throw new Error(`Backend API error: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        // Store slice data
        const sliceData = {
          frameIndex,
          analysisId: result.analysisId,
          timestamp: new Date().toISOString(),
          classification: result.results?.classification,
          report: result.results?.report,
          combined: result.results?.combined,
          metadata: {
            studyInstanceUID,
            seriesInstanceUID: metadata?.series_info?.seriesInstanceUID,
            modality: metadata?.study_info?.modality
          }
        }

        setSliceAnalysisData(prev => new Map(prev).set(frameIndex, sliceData))
        setSliceAnalysisStatus(prev => new Map(prev).set(frameIndex, 'complete'))

        // Add to analysis IDs if not already there
        if (!multiSliceAnalysisIds.includes(result.analysisId)) {
          setMultiSliceAnalysisIds(prev => [...prev, result.analysisId])
        }

        console.log(`✅ Retry successful for slice ${frameIndex}`)
        alert('✅ Slice ' + frameIndex + ' analyzed successfully!\n\nYou can now regenerate the consolidated report.')
      } else {
        throw new Error(result.error || 'Analysis failed')
      }

    } catch (error: any) {
      console.error(`❌ Retry failed for slice ${frameIndex}:`, error)
      setSliceAnalysisStatus(prev => new Map(prev).set(frameIndex, 'error'))
      alert('Failed to analyze slice ' + frameIndex + ': ' + error.message + '\n\nYou can try again.')
    }
  }, [aiAnalyzing, studyInstanceUID, metadata, multiSliceAnalysisIds])

  // Regenerate Consolidated Report Handler
  const handleRegenerateConsolidatedReport = useCallback(async () => {
    const completeSlices = Array.from(sliceAnalysisData.values())

    if (completeSlices.length === 0) {
      alert('No analysis data available. Please run analysis first.')
      return
    }

    try {
      console.log('📄 Regenerating consolidated report...')

      const failedSlices: number[] = []
      for (let i = 0; i < totalFrames; i++) {
        if (sliceAnalysisStatus.get(i) === 'error' || !sliceAnalysisData.has(i)) {
          failedSlices.push(i)
        }
      }

      const reportResponse = await fetch('http://localhost:8001/api/ai/report/consolidated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisIds: multiSliceAnalysisIds,
          studyInstanceUID,
          totalFrames,
          successCount: completeSlices.length,
          failedSlices,
          sliceData: completeSlices
        })
      })

      if (!reportResponse.ok) {
        throw new Error(`Report generation failed: ${reportResponse.status}`)
      }

      const reportResult = await reportResponse.json()
      setDownloadReportId(reportResult.reportId)
      setIsDownloadReady(true)

      console.log('✅ Consolidated report regenerated:', reportResult.reportId)
      alert('✅ Consolidated report regenerated!\n\nSlices included: ' + completeSlices.length + '/' + totalFrames + '\n\nClick Download Report to get the updated PDF.')

    } catch (error: any) {
      console.error('❌ Report regeneration error:', error)
      alert('Failed to regenerate report: ' + error.message)
    }
  }, [sliceAnalysisData, sliceAnalysisStatus, multiSliceAnalysisIds, studyInstanceUID, totalFrames])

  const handleExportReport = useCallback(async (format: string) => {
    if (!currentReport) {
      console.warn('No report to export')
      return
    }

    const reportData = {
      studyInfo: {
        patientName: studyInstanceUID?.includes('DEMO') ? 'Rubo^DEMO' : studyInstanceUID?.includes('Free') ? 'Free.Max_Head' : 'Doe^John',
        patientID: studyInstanceUID?.includes('DEMO') ? 'DEMO001' : studyInstanceUID?.includes('Free') ? 'FREE001' : 'DOE001',
        studyDate: metadata?.study_info?.study_date || new Date().toISOString().split('T')[0].replace(/-/g, ''),
        studyTime: metadata?.study_info?.study_time || '120000',
        modality: metadata?.study_info?.modality || 'XA',
        studyDescription: metadata?.study_info?.study_description || 'Medical Imaging Study',
        studyInstanceUID: studyInstanceUID
      },
      sections: currentReport.sections || {},
      findings: currentReport.findings || [],
      measurements: measurements.map(m => ({
        id: m.id,
        type: m.type,
        value: m.value,
        unit: m.unit,
        location: `Frame ${m.frameIndex}`,
        frameIndex: m.frameIndex
      })),
      reportStatus: currentReport.status || 'draft',
      timestamp: new Date().toISOString(),
      capturedImages: screenshotService.exportForReport(),
      radiologistSignature: currentReport.radiologistSignature || radiologistSignature,
      addendums: currentReport.addendums || [],
      auditTrail: currentReport.auditTrail || [],
      locked: currentReport.locked || false
    }

    const exportOptions = {
      format: format as any,
      includeImages: true,
      includeMetadata: true,
      includeMeasurements: true,
      includeSignature: true,
      includeAddendums: true,
      includeAuditTrail: false,
      watermark: (reportData.reportStatus === 'final' ? 'FINAL' : 'DRAFT') as any,
      headerInfo: {
        institutionName: 'Medical Imaging Center',
        departmentName: 'Radiology Department',
        radiologist: 'Dr. Medical Professional'
      }
    }

    try {
      switch (format) {
        case 'pdf':
          await reportExportService.exportToPDF(reportData, exportOptions)
          alert('✅ PDF exported successfully with images and signature!')
          break
        case 'docx':
          await reportExportService.exportToDOCX(reportData, exportOptions)
          alert('✅ DOCX exported successfully with images and formatting!')
          break
        case 'dicom-sr':
          await reportExportService.exportToDICOMSR(reportData)
          alert('✅ DICOM SR exported successfully!')
          break
        case 'hl7':
          await reportExportService.exportToHL7(reportData)
          alert('✅ HL7 message exported successfully!')
          break
        default:
          console.warn('Unsupported export format:', format)
      }
    } catch (error) {
      console.error('Error exporting report:', error)
      alert('❌ Export failed: ' + (error as Error).message)
    }
  }, [currentReport, measurements, metadata, studyInstanceUID, reportExportService, radiologistSignature])

  // Handle file upload (supports both DICOM and ZIP files)
  const handleFileUpload = useCallback(async (files: FileList) => {
    if (!files || files.length === 0) return

    setIsUploading(true)
    setUploadProgress(0)
    setUploadStatus('Preparing upload...')

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const fileName = file.name.toLowerCase()

        // Check if it's a ZIP file
        if (fileName.endsWith('.zip')) {
          setUploadStatus(`📦 Processing ZIP file: ${file.name}...`)

          // Upload ZIP with progress tracking
          const result = await ApiService.uploadZipStudy(file, {
            forceUnifiedStudy: true,
            onProgress: (progress) => {
              setUploadProgress(progress)
              setUploadStatus(`📦 Uploading ZIP: ${progress}%`)
            }
          })

          if (result.success) {
            setUploadProgress(100)
            setUploadStatus(
              `✅ ZIP processed: ${result.data.totalInstances} DICOM files, ` +
              `${result.data.totalSeries} series, ${result.data.totalFrames} frames`
            )

            // Switch to the new study
            if (result.data.studyInstanceUID) {
              setTimeout(() => {
                switchToStudy(result.data.studyInstanceUID)
              }, 1000)
            }
          } else {
            setUploadStatus(`❌ Failed to process ZIP ${file.name}: ${result.message}`)
          }

          continue
        }

        // Validate DICOM file type
        if (!fileName.endsWith('.dcm') && !fileName.includes('dicom')) {
          setUploadStatus(`⚠️ Skipping ${file.name} - Only DICOM (.dcm) or ZIP files are supported`)
          continue
        }

        setUploadStatus(`📤 Uploading ${file.name}...`)

        // Upload DICOM with progress tracking
        const result = await ApiService.uploadDicomFile(file)

        if (result.success) {
          setUploadProgress(((i + 1) / files.length) * 100)
          setUploadStatus(`✅ Successfully uploaded ${file.name}`)

          // If this is the first successful upload, switch to it
          if (i === 0 && result.data?.studyInstanceUID) {
            setTimeout(() => {
              switchToStudy(result.data.studyInstanceUID)
            }, 1000)
          }
        } else {
          setUploadStatus(`❌ Failed to upload ${file.name}: ${result.message}`)
        }

        // Small delay between uploads
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      // Reload available studies
      await loadAvailableStudies()
      setUploadStatus(`🎉 Upload completed! ${files.length} file(s) processed.`)

      // Auto-close dialog after success
      setTimeout(() => {
        setShowUploadDialog(false)
        setIsUploading(false)
        setUploadProgress(0)
        setUploadStatus('')
      }, 2000)

    } catch (error) {
      console.error('Upload error:', error)
      setUploadStatus(`❌ Upload failed: ${error.message || 'Unknown error'}`)
      setIsUploading(false)
    }
  }, [loadAvailableStudies])

  // Switch to a different study
  const switchToStudy = useCallback(async (studyUID: string) => {
    try {
      setUploadStatus('🔄 Loading new study...')

      // Load study metadata
      const result = await ApiService.getStudyMetadata(studyUID)

      if (result.success) {
        // Update current study
        setCurrentStudyId(studyUID)

        // Reset viewer state
        setCurrentFrameIndex(0)
        setMeasurements([])
        setAnnotations([])
        setActiveMeasurement(null)
        setActiveAnnotation(null)

        // Load new metadata
        const metadataResult = await ApiService.getStudyDetailedMetadata(studyUID)

        if (metadataResult.success) {
          const mdRaw = metadataResult.data ?? metadataResult.metadata
          const md = normalizeMetadataResponse(mdRaw)
          if (md) {
            setMetadata(md)

            // Update total frames from new study metadata
            const framesFromMeta = md.image_info?.number_of_frames
            if (typeof framesFromMeta === 'number' && framesFromMeta > 0) {
              setTotalFrames(framesFromMeta)
              console.log(`📊 Switched to study with ${framesFromMeta} frames`)
            } else if (result?.data?.numberOfInstances != null) {
              // Fallback: use basic study metadata's numberOfInstances when detailed image_info is not available
              setTotalFrames(result.data.numberOfInstances)
              console.log(`📊 Frames fallback to numberOfInstances: ${result.data.numberOfInstances}`)
            }

            // Update window/level from new metadata
            const ww = md.technical_info?.window_width?.[0]
            const wc = md.technical_info?.window_center?.[0]
            if (typeof ww === 'number') setWindowWidth(ww)
            if (typeof wc === 'number') setWindowLevel(wc)
          }
        }

        // Clear image cache for new study
        imageCache.current.clear()

        setUploadStatus('✅ Study loaded successfully!')

        // Auto-close dialogs
        setTimeout(() => {
          setShowStudySelector(false)
          setUploadStatus('')
        }, 1500)

      } else {
        setUploadStatus(`❌ Failed to load study: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to switch study:', error)
      setUploadStatus(`❌ Failed to switch study: ${error.message}`)
    }
  }, [])

  // Manual save report
  const handleManualSave = useCallback(async () => {
    if (measurements.length === 0 && annotations.length === 0) {
      alert('⚠️ No measurements or annotations to save')
      return
    }

    setAutoSaveStatus('saving')
    try {
      const patientID = metadata?.patient_info?.id || 'UNKNOWN'

      const formattedMeasurements = measurements.map(m => ({
        id: m.id,
        type: m.type,
        value: m.value,
        unit: m.unit,
        label: m.label,
        points: m.points,
        frameIndex: m.frameIndex,
        timestamp: new Date()
      }))

      const formattedAnnotations = annotations.map(a => ({
        id: a.id,
        type: a.type,
        text: a.text,
        color: a.color,
        points: a.points,
        anchor: a.anchor,
        textPos: a.textPos,
        category: a.category,
        clinicalCode: a.clinicalCode,
        isKeyImage: a.isKeyImage,
        frameIndex: a.frameIndex,
        timestamp: new Date()
      }))

      console.log('📤 Manual Save - Sending data:', {
        studyUID: currentStudyId,
        patientID,
        measurements: formattedMeasurements.length,
        annotations: formattedAnnotations.length,
        reportId: currentReportId
      })

      const reportData = {
        studyInstanceUID: currentStudyId,
        patientID,
        patientName: metadata?.patient_info?.name || 'Unknown',
        modality: metadata?.study_info?.Modality || 'XA',
        measurements: formattedMeasurements,
        findings: formattedAnnotations,
        reportStatus: 'draft' as const
      };

      const result = await reportsApi.upsert(reportData)

      if (result.success && result.report) {
        setAutoSaveStatus('saved')
        if (result.report.reportId && !currentReportId) {
          setCurrentReportId(result.report.reportId)
        }
        console.log('✅ Manual save successful:', result.report.reportId)
        alert(`✅ Report saved successfully!\nReport ID: ${result.report.reportId}`)
      } else {
        setAutoSaveStatus('error')
        console.error('❌ Manual save failed')
        alert(`❌ Failed to save report`)
      }

      setTimeout(() => setAutoSaveStatus('idle'), 2000)
    } catch (error) {
      console.error('Manual save error:', error)
      setAutoSaveStatus('error')
      alert('❌ An error occurred while saving')
      setTimeout(() => setAutoSaveStatus('idle'), 2000)
    }
  }, [measurements, annotations, currentStudyId, metadata, currentReportId])

  // Capture snapshot of current frame with annotations for report
  const handleCaptureSnapshot = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      alert('⚠️ Canvas not available')
      return
    }

    try {
      // Capture canvas with current state using screenshotService
      const dataUrl = screenshotService.captureCanvas(canvas, {
        includeAIOverlay: showAIOverlay,
        includeAnnotations: true,
        includeMeasurements: true,
        quality: 0.95,
        format: 'png'
      })

      // Save with metadata for report embedding
      const capturedImage = screenshotService.saveCapturedImage(
        dataUrl,
        `Frame ${currentFrameIndex + 1}${metadata?.study_info?.description ? ` - ${metadata.study_info.description}` : ''}`,
        {
          studyUID: currentStudyId || 'unknown',
          seriesUID: metadata?.series_info?.uid,
          instanceUID: metadata?.instance_info?.uid,
          frameIndex: currentFrameIndex,
          windowLevel: { width: windowWidth, center: windowLevel },
          zoom: zoom,
          hasAIOverlay: showAIOverlay,
          hasAnnotations: annotations.filter(a => a.frameIndex === currentFrameIndex).length > 0
        }
      )

      // Visual feedback - Flash animation
      const flashDiv = document.createElement('div')
      flashDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: white;
        opacity: 0.8;
        pointer-events: none;
        z-index: 9999;
        animation: flash 0.3s ease-out;
      `
      document.body.appendChild(flashDiv)
      setTimeout(() => {
        if (document.body.contains(flashDiv)) {
          document.body.removeChild(flashDiv)
        }
      }, 300)

      // Success notification
      const imageCount = screenshotService.getImageCount()
      alert(`📸 Image captured! (${imageCount} total)\n\nThis image will be included in your medical report.`)
      console.log('📸 Key image captured for report:', capturedImage.id, `Total: ${imageCount}`)

      // Force re-render to update badge
      setAutoSaveStatus('saved')
      setTimeout(() => setAutoSaveStatus('idle'), 1000)

    } catch (error) {
      console.error('Screenshot capture error:', error)
      alert('❌ Failed to capture image. Please try again.')
    }
  }, [currentStudyId, currentFrameIndex, showAIOverlay, annotations, zoom, windowWidth, windowLevel, metadata])

  // Finalize report (change status to final)
  const handleFinalizeReport = useCallback(async () => {
    if (!radiologistSignature.trim()) {
      alert('⚠️ Please enter your signature to finalize the report')
      return
    }

    try {
      const patientID = metadata?.patient_info?.id || 'UNKNOWN'

      // Prepare complete report data
      const formattedMeasurements = measurements.map(m => ({
        id: m.id,
        type: m.type,
        value: m.value,
        unit: m.unit,
        label: m.label,
        points: m.points,
        frameIndex: m.frameIndex,
        timestamp: new Date()
      }))

      const formattedAnnotations = annotations.map(a => ({
        id: a.id,
        type: a.type,
        text: a.text,
        color: a.color,
        points: a.points,
        anchor: a.anchor,
        textPos: a.textPos,
        category: a.category,
        clinicalCode: a.clinicalCode,
        isKeyImage: a.isKeyImage,
        frameIndex: a.frameIndex,
        timestamp: new Date()
      }))

      console.log('🔒 Finalizing report with signature:', radiologistSignature)
      console.log('📊 Total measurements:', formattedMeasurements.length)
      console.log('📝 Total annotations:', formattedAnnotations.length)

      // Note: Use ProductionReportEditor dialog for full reporting functionality
      alert('Please use the Report Editor dialog for creating and finalizing reports')
      setShowFinalizeDialog(false)
    } catch (error) {
      console.error('Error finalizing report:', error)
      alert('❌ An error occurred while finalizing the report')
    }
  }, [currentReportId, radiologistSignature, measurements, annotations, currentStudyId, metadata, currentReport])

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const files = e.dataTransfer.files
    if (files.length > 0) {
      setShowUploadDialog(true)
      handleFileUpload(files)
    }
  }, [handleFileUpload])

  // Track previous Redux IDs to detect removals only
  const prevReduxMeasurementIds = useRef<Set<string>>(new Set())
  const prevReduxAnnotationIds = useRef<Set<string>>(new Set())

  // Sync Redux state to local state (for Analysis Panel removals ONLY)
  useEffect(() => {
    const reduxIds = new Set(reduxMeasurements.map(m => m.id))
    const prevIds = prevReduxMeasurementIds.current

    // Only sync if items were REMOVED (not added)
    if (prevIds.size > 0 && reduxIds.size < prevIds.size) {
      setLocalMeasurements(prev => {
        const filtered = prev.filter(m => reduxIds.has(m.id))
        if (filtered.length !== prev.length) {
          console.log('[SYNC] Removing measurements from canvas:', prev.filter(m => !reduxIds.has(m.id)).map(m => m.id))
          return filtered
        }
        return prev
      })
    }

    prevReduxMeasurementIds.current = reduxIds
  }, [reduxMeasurements])

  useEffect(() => {
    const reduxIds = new Set(reduxAnnotations.map(a => a.id))
    const prevIds = prevReduxAnnotationIds.current

    // Only sync if items were REMOVED (not added)
    if (prevIds.size > 0 && reduxIds.size < prevIds.size) {
      setLocalAnnotations(prev => {
        const filtered = prev.filter(a => reduxIds.has(a.id))
        if (filtered.length !== prev.length) {
          console.log('[SYNC] Removing annotations from canvas:', prev.filter(a => !reduxIds.has(a.id)).map(a => a.id))
          return filtered
        }
        return prev
      })
    }

    prevReduxAnnotationIds.current = reduxIds
  }, [reduxAnnotations])

  // Auto-save structured report when measurements or annotations change
  useEffect(() => {
    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    // Only auto-save if we have measurements or annotations
    if (measurements.length === 0 && annotations.length === 0) {
      console.log('⏭️ Auto-save skipped: No measurements or annotations')
      return
    }

    console.log('⏰ Auto-save scheduled in 3 seconds...', {
      measurements: measurements.length,
      annotations: annotations.length
    })

    // Debounce auto-save by 3 seconds
    setAutoSaveStatus('saving')
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        const patientID = metadata?.patient_info?.id || 'UNKNOWN'

        // Convert measurements and annotations to the format expected by the API
        const formattedMeasurements = measurements.map(m => ({
          id: m.id,
          type: m.type,
          value: m.value,
          unit: m.unit,
          label: m.label,
          points: m.points,
          frameIndex: m.frameIndex,
          timestamp: new Date()
        }))

        const formattedAnnotations = annotations.map(a => ({
          id: a.id,
          type: a.type,
          text: a.text,
          color: a.color,
          points: a.points,
          anchor: a.anchor,
          textPos: a.textPos,
          category: a.category,
          clinicalCode: a.clinicalCode,
          isKeyImage: a.isKeyImage,
          frameIndex: a.frameIndex,
          timestamp: new Date()
        }))

        console.log('📤 Auto-save triggered:', {
          studyUID: currentStudyId,
          patientID,
          measurements: formattedMeasurements.length,
          annotations: formattedAnnotations.length,
          existingReportId: currentReportId
        })

        // Auto-save disabled - use ProductionReportEditor for full reporting
        console.log('Auto-save skipped - use Report Editor dialog for saving reports')
        setAutoSaveStatus('idle')

        // Reset status after 2 seconds
        setTimeout(() => setAutoSaveStatus('idle'), 2000)
      } catch (error) {
        console.error('Auto-save error:', error)
        setAutoSaveStatus('error')
        setTimeout(() => setAutoSaveStatus('idle'), 2000)
      }
    }, 3000) // 3 second debounce

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [measurements, annotations, currentStudyId, metadata, currentReportId])

  // Redraw when measurements or preview changes
  useEffect(() => {
    drawFrame(currentFrameIndex)
  }, [measurements, activeMeasurement, previewPoint, annotations, activeAnnotation, selectedMeasurementId, selectedAnnotationId, hoveredMeasurementId, hoveredAnnotationId, currentFrameIndex, drawFrame])

  // Draw frame when frame changes
  useEffect(() => {
    drawFrame(currentFrameIndex)

    // Update MPR views when frame changes
    if (viewerMode === 'mpr') {
      // Force re-render of MPR canvases
      setTimeout(() => {
        const canvases = document.querySelectorAll('canvas')
        canvases.forEach(canvas => {
          const ctx = canvas.getContext('2d')
          if (ctx && canvas.width > 0) {
            // Re-draw based on canvas context or position
            if (canvas.parentElement?.textContent?.includes('AXIAL')) {
              drawMPRView(ctx, 'axial', canvas.width, canvas.height)
            } else if (canvas.parentElement?.textContent?.includes('SAGITTAL')) {
              drawMPRView(ctx, 'sagittal', canvas.width, canvas.height)
            } else if (canvas.parentElement?.textContent?.includes('CORONAL')) {
              drawMPRView(ctx, 'coronal', canvas.width, canvas.height)
            } else if (canvas.parentElement?.textContent?.includes('VOLUME')) {
              draw3DOverview(ctx, canvas.width, canvas.height)
            }
          }
        })
      }, 50)
    }

    // 3D view is now handled by useVolumeRenderer hook - no manual rendering needed
  }, [currentFrameIndex, drawFrame, viewerMode, drawMPRView, draw3DOverview])

  // Resize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const resizeCanvas = () => {
      const { clientWidth, clientHeight } = container

      // Support high-DPI displays (Retina, 4K, etc.)
      const dpr = window.devicePixelRatio || 1

      // Set actual canvas size (accounting for device pixel ratio)
      canvas.width = clientWidth * dpr
      canvas.height = clientHeight * dpr

      // Scale canvas context to match device pixel ratio
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(dpr, dpr)
      }

      // Set display size (CSS pixels)
      canvas.style.width = `${clientWidth}px`
      canvas.style.height = `${clientHeight}px`

      drawFrame(currentFrameIndex)
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [currentFrameIndex, drawFrame])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current)
      }
      // Clear measurements and annotations on unmount
      dispatch(clearMeasurementsAndAnnotations())
      console.log('[UNMOUNT] Cleared measurements and annotations')
    }
  }, [dispatch])

  // Enhanced keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Prevent default for our shortcuts
      const shortcuts = ['w', 'z', 'p', 'l', 'a', 't', 'r', 'c', ' ', '?', '1', '2', '3', '4', 'f', 'i', 'm']
      if (shortcuts.includes(e.key.toLowerCase()) && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
      }

      switch (e.key.toLowerCase()) {
        // Tools - with cleanup
        case 'w':
          setActiveTool('windowLevel')
          setActiveMeasurement(null)
          setPreviewPoint(null)
          break
        case 'z':
          setActiveTool('zoom')
          setActiveMeasurement(null)
          setPreviewPoint(null)
          break
        case 'p':
          setActiveTool('pan')
          setActiveMeasurement(null)
          setPreviewPoint(null)
          break
        case 'l':
          setActiveTool('length')
          setActiveMeasurement(null)
          setPreviewPoint(null)
          break
        case 'a':
          setActiveTool('angle')
          setActiveMeasurement(null)
          setPreviewPoint(null)
          break
        case 't':
          setActiveTool('textAnnotation')
          setActiveMeasurement(null)
          setPreviewPoint(null)
          break
        case 'c':
          // Capture key image for report
          handleCaptureSnapshot()
          break
        case 'r':
          setZoom(1.0)
          setPanOffset({ x: 0, y: 0 })
          drawFrame(currentFrameIndex)
          break

        // Delete selected measurement
        case 'delete':
        case 'backspace':
          if (editingLabelId) {
            // If editing label, allow normal backspace
            return
          }
          if (selectedMeasurementId) {
            deleteMeasurement(selectedMeasurementId)
            drawFrame(currentFrameIndex)
          }
          break

        // Undo/Redo
        case 'z':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            if (event.shiftKey) {
              // Redo
              redoMeasurement()
              const redoEntry = undoRedoManager.redo()
              if (redoEntry) {
                // Update local annotations from Redux
                const reduxAnnotations = store.getState().viewer.annotations
                setAnnotations(reduxAnnotations)
                // Show toast
                const description = undoRedoManager.getNextRedoDescription() || 'Redo'
                console.log(`[Redo] ${description}`)
              }
            } else {
              // Undo
              undoMeasurement()
              const undoEntry = undoRedoManager.undo()
              if (undoEntry) {
                // Update local annotations from Redux
                const reduxAnnotations = store.getState().viewer.annotations
                setAnnotations(reduxAnnotations)
                // Show toast
                const description = undoRedoManager.getLastActionDescription() || 'Undo'
                console.log(`[Undo] ${description}`)
              }
            }
            drawFrame(currentFrameIndex)
          }
          break

        // Redo (Ctrl+Y)
        case 'y':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            redoMeasurement()
            const redoEntry = undoRedoManager.redo()
            if (redoEntry) {
              // Update local annotations from Redux
              const reduxAnnotations = store.getState().viewer.annotations
              setAnnotations(reduxAnnotations)
              // Show toast
              const description = undoRedoManager.getNextRedoDescription() || 'Redo'
              console.log(`[Redo] ${description}`)
            }
            drawFrame(currentFrameIndex)
          }
          break

        // Save label/annotation text edit
        case 'enter':
          if (editingLabelId) {
            saveEditedLabel()
            drawFrame(currentFrameIndex)
          } else if (editingAnnotationId) {
            saveEditedAnnotationText()
            drawFrame(currentFrameIndex)
          }
          break

        // Navigation
        case ' ': handleCinePlayPause(); break
        case 'arrowleft': previousFrame(); break
        case 'arrowright': nextFrame(); break
        case 'home': handleFirstFrame(); break
        case 'end': handleLastFrame(); break

        // Window Presets
        case '1': handlePresetSelect(WINDOW_LEVEL_PRESETS.lung); break
        case '2': handlePresetSelect(WINDOW_LEVEL_PRESETS.bone); break
        case '3': handlePresetSelect(WINDOW_LEVEL_PRESETS.softTissue); break
        case '4': handlePresetSelect(WINDOW_LEVEL_PRESETS.brain); break

        // Help
        case '?': setShowShortcutsHelp(true); break

        // Cancel
        case 'escape':
          if (editingLabelId) {
            setEditingLabelId(null)
            setEditingLabelText('')
          }
          if (editingAnnotationId) {
            setEditingAnnotationId(null)
            setEditingAnnotationText('')
          }
          setActiveMeasurement(null)
          setActiveAnnotation(null)
          dispatch(clearAllSelections())
          setPreviewPoint(null)
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [currentFrameIndex, drawFrame, handleCinePlayPause, previousFrame, nextFrame, handleFirstFrame, handleLastFrame, handlePresetSelect, selectedMeasurementId, deleteMeasurement, undoMeasurement, redoMeasurement, editingLabelId, saveEditedLabel, editingAnnotationId, saveEditedAnnotationText])

  // Error state
  if (error) {
    return (
      <Box sx={{ p: 3, height: '100%' }}>
        <Alert severity="error">
          <Typography variant="h6" gutterBottom>
            Medical Image Viewer Error
          </Typography>
          <Typography variant="body2">{error}</Typography>
        </Alert>
      </Box>
    )
  }

  // Removed Cornerstone initialization checks - using canvas-based rendering

  return (
    <Box sx={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: '#000',
      overflow: 'auto',
      maxHeight: '100vh'
    }}>
      {/* Modern Medical Toolbar with Glassmorphism */}
      <Paper
        elevation={0}
        sx={{
          backdropFilter: 'blur(20px)',
          bgcolor: 'rgba(0, 0, 0, 0.8)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          color: 'white',
          borderRadius: 0,
          p: 1.5,
        }}
      >
        {/* Modern View Mode Selector */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{
            display: 'flex',
            gap: 0.5,
            bgcolor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: 2,
            p: 0.5,
          }}>
            {[
              { mode: 'stack', icon: <StackIcon />, label: '2D' },
              { mode: 'mpr', icon: <MPRIcon />, label: 'MPR' },
              { mode: '3d', icon: <View3DIcon />, label: '3D' }
            ].map(({ mode, icon, label }) => (
              <Button
                key={mode}
                onClick={() => setViewerMode(mode as ViewerMode)}
                startIcon={icon}
                sx={{
                  px: 2,
                  py: 0.75,
                  borderRadius: 1.5,
                  color: viewerMode === mode ? 'white' : 'rgba(255, 255, 255, 0.6)',
                  bgcolor: viewerMode === mode ? 'rgba(25, 118, 210, 0.3)' : 'transparent',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: viewerMode === mode ? 'rgba(25, 118, 210, 0.4)' : 'rgba(255, 255, 255, 0.1)',
                    color: 'white',
                  },
                }}
              >
                {label}
              </Button>
            ))}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Chip
              label={`${metadata?.patient_info?.name || 'Loading...'}`}
              size="small"
              sx={{
                bgcolor: 'rgba(25, 118, 210, 0.2)',
                color: '#90caf9',
                border: '1px solid rgba(25, 118, 210, 0.3)',
                fontWeight: 600,
              }}
            />
            <Chip
              label={`${metadata?.study_info?.modality || 'XA'} Study`}
              size="small"
              sx={{
                bgcolor: 'rgba(156, 39, 176, 0.2)',
                color: '#ce93d8',
                border: '1px solid rgba(156, 39, 176, 0.3)',
                fontWeight: 600,
              }}
            />
            <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)', mx: 0.5 }} />
            <Tooltip title="Upload New Study">
              <IconButton
                onClick={() => setShowUploadDialog(true)}
                size="small"
                sx={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                  '&:hover': { bgcolor: 'rgba(76, 175, 80, 0.2)', color: '#81c784' },
                }}
              >
                <UploadIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip title="Save Report">
              <IconButton
                onClick={handleManualSave}
                size="small"
                disabled={measurements.length === 0 && annotations.length === 0}
                sx={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                  '&:hover': { bgcolor: 'rgba(25, 118, 210, 0.2)', color: '#90caf9' },
                  '&.Mui-disabled': { color: 'rgba(255, 255, 255, 0.3)' },
                }}
              >
                <SaveIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={`Capture Key Image (C) - ${screenshotService.getImageCount()} captured`}>
              <IconButton
                onClick={(e) => {
                  // If shift key is pressed and there are captured images, show them
                  // Otherwise, capture a new snapshot
                  if (e.shiftKey && screenshotService.getImageCount() > 0) {
                    setShowCapturedImages(true)
                  } else {
                    handleCaptureSnapshot()
                  }
                }}
                size="small"
                sx={{
                  color: screenshotService.getImageCount() > 0 ? '#ce93d8' : 'rgba(255, 255, 255, 0.6)',
                  bgcolor: screenshotService.getImageCount() > 0 ? 'rgba(156, 39, 176, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  border: screenshotService.getImageCount() > 0 ? '1px solid rgba(156, 39, 176, 0.3)' : 'none',
                  '&:hover': { bgcolor: 'rgba(156, 39, 176, 0.3)', color: '#ce93d8' },
                }}
              >
                <Badge 
                  badgeContent={screenshotService.getImageCount()} 
                  color="success"
                  sx={{
                    '& .MuiBadge-badge': {
                      bgcolor: '#4caf50',
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: '0.65rem',
                      minWidth: '18px',
                      height: '18px',
                      padding: '0 4px',
                    }
                  }}
                >
                  <PhotoCameraIcon fontSize="small" />
                </Badge>
              </IconButton>
            </Tooltip>
            {autoSaveStatus !== 'idle' && (
              <Chip
                size="small"
                label={
                  autoSaveStatus === 'saving' ? 'Saving...' :
                    autoSaveStatus === 'saved' ? 'Saved' :
                      'Error'
                }
                icon={
                  autoSaveStatus === 'saving' ? <SaveIcon fontSize="small" /> :
                    autoSaveStatus === 'saved' ? <CheckIcon fontSize="small" /> :
                      <ErrorIcon fontSize="small" />
                }
                sx={{
                  bgcolor: autoSaveStatus === 'saving' ? 'rgba(255, 255, 255, 0.1)' :
                    autoSaveStatus === 'saved' ? 'rgba(76, 175, 80, 0.2)' :
                      'rgba(244, 67, 54, 0.2)',
                  color: autoSaveStatus === 'saving' ? 'rgba(255, 255, 255, 0.8)' :
                    autoSaveStatus === 'saved' ? '#81c784' :
                      '#ef5350',
                  border: `1px solid ${autoSaveStatus === 'saving' ? 'rgba(255, 255, 255, 0.2)' :
                    autoSaveStatus === 'saved' ? 'rgba(76, 175, 80, 0.3)' :
                      'rgba(244, 67, 54, 0.3)'}`,
                  fontWeight: 600,
                }}
              />
            )}
            {currentReportId && (
              <Tooltip title="Finalize Report">
                <IconButton
                  onClick={() => setShowFinalizeDialog(true)}
                  size="small"
                  sx={{
                    color: '#81c784',
                    bgcolor: 'rgba(76, 175, 80, 0.2)',
                    border: '1px solid rgba(76, 175, 80, 0.3)',
                    '&:hover': { bgcolor: 'rgba(76, 175, 80, 0.3)' },
                  }}
                >
                  <CheckIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}

            <Tooltip title="Export Report">
              <IconButton
                onClick={() => setShowExportDialog(true)}
                size="small"
                sx={{
                  color: '#81c784',
                  bgcolor: 'rgba(76, 175, 80, 0.2)',
                  border: '1px solid rgba(76, 175, 80, 0.3)',
                  '&:hover': { bgcolor: 'rgba(76, 175, 80, 0.3)' },
                }}
              >
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={`Browse Studies (${availableStudies.length})`}>
              <IconButton
                onClick={() => setShowStudySelector(true)}
                size="small"
                sx={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)', color: 'white' },
                }}
              >
                <StudyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button
              startIcon={<InfoIcon />}
              onClick={() => setShowMetadata(true)}
              variant="outlined"
              size="small"
              sx={{ color: 'white', borderColor: 'white' }}
            >
              Metadata
            </Button>
          </Box>
        </Box>

        {/* Tool Controls */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
          overflowX: 'auto', // Allow horizontal scrolling if needed
          pb: 1, // Padding bottom for scrollbar
          '&::-webkit-scrollbar': {
            height: '4px'
          },
          '&::-webkit-scrollbar-track': {
            background: 'rgba(255,255,255,0.1)'
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(255,255,255,0.3)',
            borderRadius: '2px'
          }
        }}>
          {/* Navigation Tools */}
          <ButtonGroup variant="outlined" size="small">
            <Button
              startIcon={<PanIcon />}
              onClick={() => {
                setActiveTool('pan')
                setActiveMeasurement(null)
                setPreviewPoint(null)
                dispatch(selectMeasurement(null))
              }}
              variant={activeTool === 'pan' ? 'contained' : 'outlined'}
            >
              Pan
            </Button>
            <Button
              startIcon={<ZoomIcon />}
              onClick={() => {
                setActiveTool('zoom')
                setActiveMeasurement(null)
                setPreviewPoint(null)
                dispatch(selectMeasurement(null))
              }}
              variant={activeTool === 'zoom' ? 'contained' : 'outlined'}
            >
              Zoom
            </Button>
            <Button
              startIcon={<WindowLevelIcon />}
              onClick={() => {
                setActiveTool('windowLevel')
                setActiveMeasurement(null)
                setPreviewPoint(null)
                dispatch(selectMeasurement(null))
              }}
              variant={activeTool === 'windowLevel' ? 'contained' : 'outlined'}
            >
              W/L
            </Button>
          </ButtonGroup>

          <Divider orientation="vertical" flexItem sx={{ bgcolor: 'grey.600' }} />

          {/* Measurement Tools */}
          <ButtonGroup variant="outlined" size="small">
            <Button
              startIcon={<RulerIcon />}
              onClick={() => {
                setActiveTool('length')
                setActiveMeasurement(null)
                setPreviewPoint(null)
                dispatch(selectMeasurement(null))
              }}
              variant={activeTool === 'length' ? 'contained' : 'outlined'}
              color={activeTool === 'length' ? 'primary' : 'inherit'}
            >
              Length
            </Button>
            <Button
              startIcon={<AngleIcon />}
              onClick={() => {
                setActiveTool('angle')
                setActiveMeasurement(null)
                setPreviewPoint(null)
                dispatch(selectMeasurement(null))
              }}
              variant={activeTool === 'angle' ? 'contained' : 'outlined'}
              color={activeTool === 'angle' ? 'primary' : 'inherit'}
            >
              Angle
            </Button>
            <Button
              startIcon={<AreaIcon />}
              onClick={() => {
                setActiveTool('area')
                setActiveMeasurement(null)
                setPreviewPoint(null)
                dispatch(selectMeasurement(null))
              }}
              variant={activeTool === 'area' ? 'contained' : 'outlined'}
              color={activeTool === 'area' ? 'primary' : 'inherit'}
            >
              Area
            </Button>
          </ButtonGroup>

          {/* Undo/Redo Controls */}
          <ButtonGroup variant="outlined" size="small">
            <Tooltip title="Undo (Ctrl+Z)">
              <span>
                <Button
                  onClick={() => {
                    undoMeasurement()
                    drawFrame(currentFrameIndex)
                  }}
                  disabled={historyIndex <= 0}
                  sx={{ minWidth: 40 }}
                >
                  ↶
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Redo (Ctrl+Shift+Z)">
              <span>
                <Button
                  onClick={() => {
                    redoMeasurement()
                    drawFrame(currentFrameIndex)
                  }}
                  disabled={historyIndex >= measurementHistory.length - 1}
                  sx={{ minWidth: 40 }}
                >
                  ↷
                </Button>
              </span>
            </Tooltip>
          </ButtonGroup>

          <Divider orientation="vertical" flexItem sx={{ bgcolor: 'grey.600' }} />

          {/* Advanced Annotation Tools */}
          <ButtonGroup variant="outlined" size="small">
            <Button
              startIcon={<TextIcon />}
              onClick={() => setActiveTool('textAnnotation')}
              variant={activeTool === 'textAnnotation' ? 'contained' : 'outlined'}
            >
              Text
            </Button>
            <Button
              startIcon={<ArrowIcon />}
              onClick={() => setActiveTool('arrowAnnotation')}
              variant={activeTool === 'arrowAnnotation' ? 'contained' : 'outlined'}
            >
              Arrow
            </Button>
            <Button
              startIcon={<FreehandIcon />}
              onClick={() => setActiveTool('freehand')}
              variant={activeTool === 'freehand' ? 'contained' : 'outlined'}
            >
              Draw
            </Button>
            <Button
              startIcon={<RectangleIcon />}
              onClick={() => setActiveTool('rectangle')}
              variant={activeTool === 'rectangle' ? 'contained' : 'outlined'}
            >
              Rect
            </Button>
            <Button
              startIcon={<CircleIcon />}
              onClick={() => setActiveTool('circle')}
              variant={activeTool === 'circle' ? 'contained' : 'outlined'}
            >
              Circle
            </Button>
            <Button
              startIcon={<ClinicalIcon />}
              onClick={() => setActiveTool('clinical')}
              variant={activeTool === 'clinical' ? 'contained' : 'outlined'}
              color="error"
            >
              Clinical
            </Button>
            <Button
              startIcon={<BookmarkIcon />}
              onClick={() => {
                setActiveTool('leader')
                setLeaderStep(null)
              }}
              variant={activeTool === 'leader' ? 'contained' : 'outlined'}
              color="info"
            >
              Leader
            </Button>
          </ButtonGroup>

          <Divider orientation="vertical" flexItem sx={{ bgcolor: 'grey.600' }} />

          {/* Annotation Controls */}
          <ButtonGroup variant="outlined" size="small">
            <Button
              startIcon={<ColorIcon />}
              onClick={(e) => setAnnotationMenuEl(e.currentTarget)}
            >
              Style
            </Button>
            <Button
              startIcon={<CommentIcon />}
              onClick={() => setShowAnnotations(true)}
            >
              Measurements ({measurements.length})
            </Button>
            {selectedMeasurementId && (
              <Button
                startIcon={<ClearIcon />}
                onClick={deleteSelectedMeasurement}
                variant="outlined"
                color="warning"
                size="small"
              >
                Delete Selected
              </Button>
            )}
            <Button
              startIcon={<ClearIcon />}
              onClick={() => {
                clearMeasurements()
                setAnnotations([])
                setActiveAnnotation(null)
                drawFrame(currentFrameIndex)
              }}
              variant="outlined"
              color="error"
            >
              Clear All
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
            <Button
              startIcon={<ResetIcon />}
              onClick={resetView}
            >
              Reset
            </Button>
            <Button
              startIcon={<SettingsIcon />}
              onClick={(e) => setAnchorEl(e.currentTarget)}
            >
              Presets
            </Button>
            <Tooltip title="Keyboard Shortcuts (?)">
              <Button
                startIcon={<HelpIcon />}
                onClick={() => setShowShortcutsHelp(true)}
              >
                Help
              </Button>
            </Tooltip>
          </ButtonGroup>

          <Divider orientation="vertical" flexItem sx={{ bgcolor: 'grey.600' }} />

          {/* AI & Screenshot Tools */}
          <ButtonGroup variant="outlined" size="small">
            <Tooltip title={showAIOverlay ? "Hide AI Overlay" : "Show AI Overlay"}>
              <Button
                startIcon={showAIOverlay ? <ShowAIIcon /> : <HideAIIcon />}
                onClick={() => {
                  const newState = !showAIOverlay;
                  setShowAIOverlay(newState);
                  console.log('🎨 AI Overlay toggled:', newState);
                  setTimeout(() => drawFrame(currentFrameIndex), 100);
                }}
                sx={{
                  bgcolor: showAIOverlay ? 'primary.main' : 'transparent',
                  color: showAIOverlay ? 'white' : 'inherit',
                  '&:hover': {
                    bgcolor: showAIOverlay ? 'primary.dark' : 'rgba(255,255,255,0.1)'
                  }
                }}
              >
                AI Overlay
              </Button>
            </Tooltip>
            
            <Tooltip title="Capture Screenshot for Report">
              <Button
                startIcon={<CameraIcon />}
                onClick={() => {
                  const canvas = canvasRef.current;
                  if (!canvas) return;
                  
                  try {
                    const dataUrl = screenshotService.captureCanvas(canvas, {
                      includeAIOverlay: showAIOverlay,
                      includeAnnotations: true,
                      quality: 0.95,
                      format: 'png'
                    });
                    
                    screenshotService.saveCapturedImage(
                      dataUrl,
                      `Frame ${currentFrameIndex + 1}`,
                      {
                        studyUID: studyInstanceUID,
                        frameIndex: currentFrameIndex,
                        hasAIOverlay: showAIOverlay,
                        hasAnnotations: annotations.length > 0
                      }
                    );
                    
                    alert(`📸 Screenshot captured!\n\nTotal images: ${screenshotService.getImageCount()}\n\nImages will be available in the report editor.`);
                  } catch (error) {
                    console.error('Screenshot failed:', error);
                    alert('❌ Screenshot capture failed. Please try again.');
                  }
                }}
                color="primary"
              >
                Capture
              </Button>
            </Tooltip>
          </ButtonGroup>

          <Divider orientation="vertical" flexItem sx={{ bgcolor: 'grey.600' }} />

          {/* AI Analysis Control (Phase 1 & 2) */}
          <ButtonGroup variant="outlined" size="small">
            <Tooltip title="AI Analysis Control">
              <Button
                startIcon={<AIIcon />}
                onClick={() => setShowAIControl(!showAIControl)}
                variant={showAIControl ? 'contained' : 'outlined'}
                color={showAIControl ? 'secondary' : 'inherit'}
                sx={{
                  bgcolor: showAIControl ? 'secondary.main' : 'transparent',
                  color: showAIControl ? 'white' : 'inherit',
                  '&:hover': {
                    bgcolor: showAIControl ? 'secondary.dark' : 'rgba(255,255,255,0.1)'
                  }
                }}
              >
                AI Control
              </Button>
            </Tooltip>
            
            <Tooltip title="Background Analysis Jobs">
              <Badge 
                badgeContent={queueStats.processing + queueStats.queued} 
                color="primary"
                invisible={queueStats.processing + queueStats.queued === 0}
              >
                <Button
                  startIcon={<ListIcon />}
                  onClick={() => setShowBackgroundJobs(!showBackgroundJobs)}
                  variant={showBackgroundJobs ? 'contained' : 'outlined'}
                  color={showBackgroundJobs ? 'info' : 'inherit'}
                  sx={{
                    bgcolor: showBackgroundJobs ? 'info.main' : 'transparent',
                    color: showBackgroundJobs ? 'white' : 'inherit',
                    '&:hover': {
                      bgcolor: showBackgroundJobs ? 'info.dark' : 'rgba(255,255,255,0.1)'
                    }
                  }}
                >
                  Jobs
                </Button>
              </Badge>
            </Tooltip>
          </ButtonGroup>
        </Box>
      </Paper>

      {/* Tool Instructions */}
      {['length', 'angle', 'area'].includes(activeTool) && (
        <Alert severity="info" sx={{ mb: 2 }} icon={<InfoIcon />}>
          <Typography variant="body2" fontWeight="bold">
            {activeTool === 'length' && '📏 Length Tool: Click to set first point, move to see preview, click to complete. Drag handles to adjust.'}
            {activeTool === 'angle' && '📐 Angle Tool: Click three points to measure angle. Drag handles to adjust.'}
            {activeTool === 'area' && '📊 Area Tool: Click multiple points, double-click to finish. Drag handles to adjust.'}
          </Typography>
          {activeMeasurement && (
            <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
              Points: {activeMeasurement.points.length} | Press ESC to cancel | Press Delete to remove selected
            </Typography>
          )}
          {selectedMeasurementId && (
            <Typography variant="caption" display="block" sx={{ mt: 0.5, color: 'warning.main' }}>
              ⚠️ Measurement selected - Press Delete to remove or drag handles to adjust
            </Typography>
          )}
        </Alert>
      )}

      {/* Window/Level Presets Panel */}
      {/* <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.paper' }}>
        <WindowLevelPresets
          onPresetSelect={handlePresetSelect}
          currentPreset={currentPreset}
        />
      </Paper> */}



      {/* Main Viewer Area */}
      <Box sx={{
        flex: 1,
        position: 'relative',
        overflow: 'auto', // Allow scrolling in main viewer area
        minHeight: 0 // Allow flex child to shrink
      }}>
        {/* 2D Stack Viewer */}
        {viewerMode === 'stack' && (
          <Box sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 'calc(100vh - 200px)', // Prevent excessive height
            overflow: 'hidden' // Prevent scrolling within this container
          }}>
            {/* Canvas Container */}
            <Box
              ref={containerRef}
              sx={{
                flex: 1,
                position: 'relative',
                bgcolor: '#000',
                overflow: 'hidden', // Prevent scrollbars in canvas area
                cursor: activeTool === 'pan' ? 'grab' :
                  ['length', 'angle', 'area'].includes(activeTool) ? 'crosshair' :
                    activeTool === 'zoom' ? 'zoom-in' : 'default',
                minHeight: 400, // Ensure minimum height for canvas
                maxHeight: 'calc(100vh - 300px)', // Prevent excessive height
                border: '2px dashed transparent',
                transition: 'border-color 0.3s',
                '&.drag-over': {
                  borderColor: '#2563eb',
                  bgcolor: 'rgba(37, 99, 235, 0.05)'
                }
              }}
              onDragOver={(e) => {
                e.preventDefault()
                e.currentTarget.classList.add('drag-over')
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('drag-over')
              }}
              onDrop={(e) => {
                e.preventDefault()
                e.currentTarget.classList.remove('drag-over')
                const files = e.dataTransfer.files
                if (files.length > 0) {
                  setShowUploadDialog(true)
                  handleFileUpload(files)
                }
              }}
            >
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                onDoubleClick={handleCanvasDoubleClick}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onWheel={handleCanvasWheel}
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'block',
                  touchAction: 'none', // Prevent touch scrolling on canvas
                  userSelect: 'none', // Prevent text selection
                  cursor: getCursorForTool(activeTool), // Dynamic cursor based on active tool
                  imageRendering: zoom > 1.5 ? 'auto' : 'crisp-edges' // Better quality at high zoom
                }}
              />

              {/* Inline Text Editor */}
              {showTextEditor && textEditorAnnotation && (
                <InlineTextEditor
                  annotation={textEditorAnnotation}
                  position={textEditorPosition}
                  initialText={textEditorAnnotation.text || ''}
                  onSave={handleTextEditorSave}
                  onCancel={handleTextEditorCancel}
                  onChange={handleTextEditorChange}
                />
              )}

              {/* Label Editing Input Overlay */}
              {editingLabelId && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    bgcolor: 'rgba(0, 0, 0, 0.95)',
                    border: '2px solid #00ff00',
                    borderRadius: 2,
                    p: 2,
                    zIndex: 2000,
                    minWidth: 300
                  }}
                >
                  <Typography variant="subtitle2" sx={{ color: 'white', mb: 1 }}>
                    Edit Measurement Label
                  </Typography>
                  <input
                    type="text"
                    value={editingLabelText}
                    onChange={(e) => setEditingLabelText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        saveEditedLabel()
                        drawFrame(currentFrameIndex)
                      } else if (e.key === 'Escape') {
                        setEditingLabelId(null)
                        setEditingLabelText('')
                      }
                    }}
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '14px',
                      backgroundColor: '#333',
                      color: 'white',
                      border: '1px solid #666',
                      borderRadius: '4px',
                      outline: 'none'
                    }}
                  />
                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      onClick={() => {
                        saveEditedLabel()
                        drawFrame(currentFrameIndex)
                      }}
                    >
                      Save
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setEditingLabelId(null)
                        setEditingLabelText('')
                      }}
                    >
                      Cancel
                    </Button>
                  </Box>
                </Box>
              )}

              {/* Annotation Text Editing Input Overlay */}
              {editingAnnotationId && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    bgcolor: 'rgba(0, 0, 0, 0.95)',
                    border: '2px solid #00ffff',
                    borderRadius: 2,
                    p: 2,
                    zIndex: 2000,
                    minWidth: 300
                  }}
                >
                  <Typography variant="subtitle2" sx={{ color: 'white', mb: 1 }}>
                    Edit Annotation Text
                  </Typography>
                  <input
                    type="text"
                    value={editingAnnotationText}
                    onChange={(e) => setEditingAnnotationText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        saveEditedAnnotationText()
                        drawFrame(currentFrameIndex)
                      } else if (e.key === 'Escape') {
                        setEditingAnnotationId(null)
                        setEditingAnnotationText('')
                      }
                    }}
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '14px',
                      backgroundColor: '#333',
                      color: 'white',
                      border: '1px solid #666',
                      borderRadius: '4px',
                      outline: 'none'
                    }}
                  />
                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      onClick={() => {
                        saveEditedAnnotationText()
                        drawFrame(currentFrameIndex)
                      }}
                    >
                      Save
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setEditingAnnotationId(null)
                        setEditingAnnotationText('')
                      }}
                    >
                      Cancel
                    </Button>
                  </Box>
                </Box>
              )}

              {/* Viewport Overlays */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 10,
                  left: 10,
                  color: 'white',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                }}
              >
                <div>Patient: {metadata?.patient_info?.name || 'Loading...'}</div>
                <div>Study: {metadata?.study_info?.study_description || 'XA Study'}</div>
              </Box>

              <Box
                sx={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  color: 'white',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                  textAlign: 'right'
                }}
              >
                <div>Frame: {currentFrameIndex + 1} / {totalFrames}</div>
                <div>{metadata?.image_info?.columns || 512} × {metadata?.image_info?.rows || 512}</div>
              </Box>

              <Box
                sx={{
                  position: 'absolute',
                  bottom: 10,
                  left: 10,
                  color: 'white',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                }}
              >
                <div>WW: {windowWidth.toFixed(0)}</div>
                <div>WL: {windowLevel.toFixed(0)}</div>
              </Box>

              <Box
                sx={{
                  position: 'absolute',
                  bottom: 10,
                  right: 10,
                  color: 'white',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                  textAlign: 'right'
                }}
              >
                <div>Zoom: {(zoom * 100).toFixed(0)}%</div>
                <div>Tool: {activeTool.toUpperCase()}</div>
                {availableStudies.length > 1 && (
                  <div>Studies: {availableStudies.length}</div>
                )}
              </Box>

              {/* Quick Upload Overlay */}
              {isUploading && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    bgcolor: 'rgba(0, 0, 0, 0.8)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                  }}
                >
                  <UploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
                  <Typography variant="h6" color="white" gutterBottom>
                    Processing DICOM Upload...
                  </Typography>
                  <Box sx={{ width: '50%', mb: 2 }}>
                    <Slider
                      value={uploadProgress}
                      variant="determinate"
                      sx={{ color: 'primary.main' }}
                    />
                  </Box>
                  <Typography variant="body2" color="primary.main">
                    {uploadStatus}
                  </Typography>
                </Box>
              )}
            </Box>

          </Box>
        )}

        {/* Enhanced MPR Viewer */}
        {viewerMode === 'mpr' && (
          <Box
            sx={{
              height: '100%',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gridTemplateRows: '1fr 1fr',
              gap: 2,
              bgcolor: '#111',
              p: 1
            }}
          >
            {/* Axial View (Original Image) */}
            <Box sx={{
              bgcolor: '#000',
              position: 'relative',
              border: '2px solid #2563eb',
              borderRadius: 1,
              overflow: 'hidden'
            }}>
              <Box sx={{
                position: 'absolute',
                top: 8,
                left: 8,
                color: '#2563eb',
                fontSize: '12px',
                fontWeight: 'bold',
                bgcolor: 'rgba(0,0,0,0.7)',
                px: 1,
                py: 0.5,
                borderRadius: 1
              }}>
                AXIAL VIEW
              </Box>
              <canvas
                ref={(el) => {
                  if (el && viewerMode === 'mpr') {
                    // Draw current frame in axial view
                    const ctx = el.getContext('2d')
                    if (ctx) {
                      el.width = el.clientWidth
                      el.height = el.clientHeight
                      drawMPRView(ctx, 'axial', el.width, el.height)
                    }
                  }
                }}
                style={{ width: '100%', height: '100%', display: 'block' }}
              />
              <Box sx={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                color: 'white',
                fontSize: '10px',
                bgcolor: 'rgba(0,0,0,0.7)',
                px: 1,
                py: 0.5,
                borderRadius: 1
              }}>
                Frame {currentFrameIndex + 1}/{totalFrames}
              </Box>
            </Box>

            {/* Sagittal View (Reconstructed) */}
            <Box sx={{
              bgcolor: '#000',
              position: 'relative',
              border: '2px solid #10b981',
              borderRadius: 1,
              overflow: 'hidden'
            }}>
              <Box sx={{
                position: 'absolute',
                top: 8,
                left: 8,
                color: '#10b981',
                fontSize: '12px',
                fontWeight: 'bold',
                bgcolor: 'rgba(0,0,0,0.7)',
                px: 1,
                py: 0.5,
                borderRadius: 1
              }}>
                SAGITTAL VIEW
              </Box>
              <canvas
                ref={(el) => {
                  if (el && viewerMode === 'mpr') {
                    const ctx = el.getContext('2d')
                    if (ctx) {
                      el.width = el.clientWidth
                      el.height = el.clientHeight
                      drawMPRView(ctx, 'sagittal', el.width, el.height)
                    }
                  }
                }}
                style={{ width: '100%', height: '100%', display: 'block' }}
              />
              <Box sx={{
                position: 'absolute',
                bottom: 8,
                left: 8,
                color: 'white',
                fontSize: '10px',
                bgcolor: 'rgba(0,0,0,0.7)',
                px: 1,
                py: 0.5,
                borderRadius: 1
              }}>
                Left ↔ Right Cross-Section
              </Box>
            </Box>

            {/* Coronal View (Reconstructed) */}
            <Box sx={{
              bgcolor: '#000',
              position: 'relative',
              border: '2px solid #f59e0b',
              borderRadius: 1,
              overflow: 'hidden'
            }}>
              <Box sx={{
                position: 'absolute',
                top: 8,
                left: 8,
                color: '#f59e0b',
                fontSize: '12px',
                fontWeight: 'bold',
                bgcolor: 'rgba(0,0,0,0.7)',
                px: 1,
                py: 0.5,
                borderRadius: 1
              }}>
                CORONAL VIEW
              </Box>
              <canvas
                ref={(el) => {
                  if (el && viewerMode === 'mpr') {
                    const ctx = el.getContext('2d')
                    if (ctx) {
                      el.width = el.clientWidth
                      el.height = el.clientHeight
                      drawMPRView(ctx, 'coronal', el.width, el.height)
                    }
                  }
                }}
                style={{ width: '100%', height: '100%', display: 'block' }}
              />
              <Box sx={{
                position: 'absolute',
                bottom: 8,
                left: 8,
                color: 'white',
                fontSize: '10px',
                bgcolor: 'rgba(0,0,0,0.7)',
                px: 1,
                py: 0.5,
                borderRadius: 1
              }}>
                Front ↔ Back Cross-Section
              </Box>
            </Box>

            {/* 3D Volume Overview */}
            <Box sx={{
              bgcolor: '#000',
              position: 'relative',
              border: '2px solid #8b5cf6',
              borderRadius: 1,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Box sx={{
                position: 'absolute',
                top: 8,
                left: 8,
                color: '#8b5cf6',
                fontSize: '12px',
                fontWeight: 'bold',
                bgcolor: 'rgba(0,0,0,0.7)',
                px: 1,
                py: 0.5,
                borderRadius: 1
              }}>
                VOLUME OVERVIEW
              </Box>

              <canvas
                ref={(el) => {
                  if (el && viewerMode === 'mpr') {
                    const ctx = el.getContext('2d')
                    if (ctx) {
                      el.width = el.clientWidth
                      el.height = el.clientHeight
                      draw3DOverview(ctx, el.width, el.height)
                    }
                  }
                }}
                style={{ width: '100%', height: '100%', display: 'block' }}
              />

              <Box sx={{
                position: 'absolute',
                bottom: 8,
                left: 8,
                right: 8,
                color: 'white',
                fontSize: '10px',
                bgcolor: 'rgba(0,0,0,0.7)',
                px: 1,
                py: 0.5,
                borderRadius: 1,
                textAlign: 'center'
              }}>
                96 Frames • 512×512×96 Volume
              </Box>
            </Box>
          </Box>
        )}

        {/* Enhanced 3D Viewer */}
        {viewerMode === '3d' && (
          <Box data-testid="viewport-3d" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* 3D Controls */}
            <Box sx={{
              bgcolor: 'rgba(0,0,0,0.8)',
              p: 2,
              display: 'flex',
              gap: 2,
              alignItems: 'center',
              borderBottom: '1px solid #333'
            }}>
              <Typography variant="h6" color="primary.main">
                3D Volume Rendering
              </Typography>

              {/* 3D Start Button */}
              {!is3DRenderingStarted && (
                <>
                  <Button
                    variant="contained"
                    onClick={handleStart3DRendering}
                    disabled={totalFrames < 2}
                    sx={{
                      background: totalFrames < 2
                        ? 'linear-gradient(45deg, #666, #888)'
                        : 'linear-gradient(45deg, #2196f3, #21cbf3)',
                      color: 'white',
                      fontWeight: 'bold',
                      px: 3,
                      '&:hover': {
                        background: totalFrames < 2
                          ? 'linear-gradient(45deg, #666, #888)'
                          : 'linear-gradient(45deg, #1976d2, #0288d1)',
                      },
                      '&.Mui-disabled': {
                        background: 'linear-gradient(45deg, #666, #888)',
                        color: 'rgba(255, 255, 255, 0.5)',
                      }
                    }}
                  >
                    {totalFrames < 2 ? '⚠️ 3D NOT AVAILABLE (SINGLE FRAME)' : '🚀 START 3D RENDERING'}
                  </Button>
                  {totalFrames < 2 && (
                    <Typography variant="caption" sx={{ color: '#ff9800', ml: 2 }}>
                      Need multiple frames for 3D rendering. Current: {totalFrames} frame(s)
                    </Typography>
                  )}
                </>
              )}

              {is3DRenderingStarted && (
                <>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Box sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: '#4caf50',
                      animation: 'pulse 1.5s infinite'
                    }} />
                    <Typography variant="body2" sx={{ color: '#4caf50', fontWeight: 'bold' }}>
                      3D Rendering Active
                    </Typography>
                  </Box>

                  {/* Fallback Warning */}
                  {volumeRenderer.rendererType === 'canvas' && (
                    <Alert
                      severity="warning"
                      sx={{
                        mt: 1,
                        mb: 1,
                        fontSize: '0.875rem',
                        '& .MuiAlert-message': {
                          width: '100%'
                        }
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                        ⚠️ Using Canvas Fallback (CPU Rendering)
                      </Typography>
                      <Typography variant="caption" component="div" sx={{ mb: 0.5 }}>
                        WebGL is not available or not supported. Performance will be limited.
                      </Typography>
                      <Typography variant="caption" component="div" sx={{ fontWeight: 'bold' }}>
                        For best performance, please:
                      </Typography>
                      <ul style={{ margin: '4px 0', paddingLeft: '20px', fontSize: '0.75rem' }}>
                        <li>Update to the latest version of Chrome (90+), Firefox (88+), Safari (14+), or Edge (90+)</li>
                        <li>Enable hardware acceleration in your browser settings</li>
                        <li>Update your graphics drivers</li>
                        <li>Ensure WebGL is not disabled in browser flags</li>
                      </ul>
                    </Alert>
                  )}

                  <Button
                    size="small"
                    onClick={() => setIs3DRenderingStarted(false)}
                    sx={{ color: '#ff9800', ml: 1 }}
                  >
                    Reset
                  </Button>
                </>
              )}

              <ButtonGroup size="small" variant="outlined">
                <Button
                  onClick={() => apply3DPreset('mip')}
                  disabled={!is3DRenderingStarted}
                  variant={volumeRenderer.renderSettings.mode === 'mip' ? 'contained' : 'outlined'}
                >
                  MIP
                </Button>
                <Button
                  onClick={() => apply3DPreset('vr')}
                  disabled={!is3DRenderingStarted}
                  variant={volumeRenderer.renderSettings.mode === 'volume' ? 'contained' : 'outlined'}
                >
                  Volume
                </Button>
                <Button
                  onClick={() => apply3DPreset('iso')}
                  disabled={!is3DRenderingStarted}
                  variant={volumeRenderer.renderSettings.mode === 'isosurface' ? 'contained' : 'outlined'}
                >
                  Isosurface
                </Button>
              </ButtonGroup>

              <ButtonGroup size="small" variant="outlined">
                <Button
                  onClick={() => volumeRenderer.setPreset('CT-Bone')}
                  disabled={!is3DRenderingStarted}
                >
                  Bone
                </Button>
                <Button
                  onClick={() => volumeRenderer.setPreset('CT-Soft-Tissue')}
                  disabled={!is3DRenderingStarted}
                >
                  Soft Tissue
                </Button>
                <Button
                  onClick={() => volumeRenderer.setPreset('MR-Default')}
                  disabled={!is3DRenderingStarted}
                >
                  MR
                </Button>
              </ButtonGroup>

              <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
                {/* Quality Slider */}
                <Typography variant="body2" color="grey.400">
                  Quality:
                </Typography>
                <ButtonGroup size="small" variant="outlined">
                  <Button
                    onClick={() => volumeRenderer.setRenderQuality?.('low')}
                    disabled={!is3DRenderingStarted}
                    variant={volumeRenderer.renderQuality === 'low' ? 'contained' : 'outlined'}
                    title="Low Quality (Fastest)"
                  >
                    Low
                  </Button>
                  <Button
                    onClick={() => volumeRenderer.setRenderQuality?.('medium')}
                    disabled={!is3DRenderingStarted}
                    variant={volumeRenderer.renderQuality === 'medium' ? 'contained' : 'outlined'}
                    title="Medium Quality (Balanced)"
                  >
                    Med
                  </Button>
                  <Button
                    onClick={() => volumeRenderer.setRenderQuality?.('high')}
                    disabled={!is3DRenderingStarted}
                    variant={volumeRenderer.renderQuality === 'high' ? 'contained' : 'outlined'}
                    title="High Quality (Best)"
                  >
                    High
                  </Button>
                </ButtonGroup>

                <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

                {/* Opacity Slider */}
                <Typography variant="body2" color="grey.400">
                  Opacity:
                </Typography>
                <Slider
                  size="small"
                  value={50}
                  min={0}
                  max={100}
                  onChange={(_, value) => volumeRenderer.setOpacity((value as number) / 100)}
                  disabled={!is3DRenderingStarted}
                  sx={{ width: 100 }}
                />

                <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

                {/* Rotation Controls */}
                <Typography variant="body2" color="grey.400">
                  Rotation:
                </Typography>
                <Button
                  size="small"
                  onClick={() => rotate3D()}
                  disabled={!is3DRenderingStarted}
                  variant={volumeRenderer.isRotating ? 'contained' : 'outlined'}
                  title="Toggle Auto-Rotation"
                >
                  <View3DIcon />
                </Button>
                <Button
                  size="small"
                  onClick={() => volumeRenderer.resetCamera()}
                  disabled={!is3DRenderingStarted}
                  title="Reset Camera"
                >
                  <ResetIcon />
                </Button>

                {/* Performance Info */}
                {is3DRenderingStarted && volumeRenderer.renderTime > 0 && (
                  <>
                    <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                    <Chip
                      size="small"
                      label={`${Math.round(1000 / volumeRenderer.renderTime)} FPS`}
                      color={volumeRenderer.renderTime < 50 ? 'success' : volumeRenderer.renderTime < 100 ? 'warning' : 'error'}
                      sx={{ fontFamily: 'monospace' }}
                    />
                    <Chip
                      size="small"
                      label={`${Math.round(volumeRenderer.renderTime)}ms`}
                      variant="outlined"
                      sx={{ fontFamily: 'monospace' }}
                    />
                  </>
                )}
              </Box>
            </Box>

            {/* Real 3D Volume Rendering Canvas */}
            <Box sx={{
              flex: 1,
              bgcolor: '#000',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {/* Real 3D Volume Renderer */}
              {is3DRenderingStarted ? (
                <>
                  {/* Container for VTK.js renderer (creates its own canvas) */}
                  <div
                    ref={container3DRef}
                    style={{
                      width: '100%',
                      height: '100%',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      cursor: volumeRenderer.isRotating ? 'grabbing' : 'grab',
                      display: volumeRenderer.rendererType === 'vtk' ? 'block' : 'none'
                    }}
                  />

                  {/* Canvas fallback for non-WebGL browsers */}
                  <canvas
                    ref={canvas3DRef}
                    width={800}
                    height={600}
                    onMouseDown={volumeRenderer.handleMouseDown}
                    onMouseMove={volumeRenderer.handleMouseMove}
                    onMouseUp={volumeRenderer.handleMouseUp}
                    onMouseLeave={volumeRenderer.handleMouseUp}
                    style={{
                      width: '100%',
                      height: '100%',
                      display: volumeRenderer.rendererType === 'canvas' ? 'block' : 'none',
                      cursor: volumeRenderer.isRotating ? 'grabbing' : 'grab',
                      objectFit: 'contain'
                    }}
                  />

                  {/* Performance Overlay */}
                  {volumeRenderer.volume && (
                    <Box sx={{
                      position: 'absolute',
                      top: 10,
                      left: 10,
                      bgcolor: 'rgba(0,0,0,0.7)',
                      p: 1.5,
                      borderRadius: 1,
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      color: '#00ff41'
                    }}>
                      {/* Renderer Type Indicator */}
                      <div style={{
                        color: volumeRenderer.rendererType === 'vtk' ? '#00ff41' : '#ffaa00',
                        fontWeight: 'bold',
                        marginBottom: '4px'
                      }}>
                        🎨 Renderer: {volumeRenderer.rendererType === 'vtk' ? 'VTK.js (GPU)' : 'Canvas (CPU)'}
                      </div>

                      {/* WebGL Version (only for VTK.js) */}
                      {volumeRenderer.rendererType === 'vtk' && volumeRenderer.webglVersion && (
                        <div style={{ color: '#00aaff' }}>
                          WebGL: {volumeRenderer.webglVersion}
                        </div>
                      )}

                      <div>Volume: {volumeRenderer.volume.dimensions.width}×{volumeRenderer.volume.dimensions.height}×{volumeRenderer.volume.dimensions.depth}</div>
                      <div>Mode: {volumeRenderer.renderSettings.mode.toUpperCase()}</div>
                      <div>Quality: {volumeRenderer.renderQuality?.toUpperCase()}</div>

                      {/* GPU Memory Usage (only for VTK.js) */}
                      {volumeRenderer.rendererType === 'vtk' && volumeRenderer.gpuMemoryMB > 0 && (
                        <div style={{ color: volumeRenderer.gpuMemoryMB > 400 ? '#ff5555' : '#00ff41' }}>
                          GPU Memory: {volumeRenderer.gpuMemoryMB.toFixed(1)} MB
                        </div>
                      )}

                      {/* FPS Display */}
                      {volumeRenderer.fps > 0 && (
                        <div style={{ color: volumeRenderer.fps >= 30 ? '#00ff41' : volumeRenderer.fps >= 15 ? '#ffaa00' : '#ff5555' }}>
                          FPS: {volumeRenderer.fps.toFixed(1)}
                        </div>
                      )}

                      {volumeRenderer.isInteracting && <div style={{ color: '#ffaa00' }}>⚡ INTERACTING (Low Res)</div>}
                      {volumeRenderer.rendererType === 'canvas' && volumeRenderer.useWebWorker && <div style={{ color: '#00aaff' }}>🔧 Web Worker Active</div>}
                    </Box>
                  )}

                  {/* Interaction Hint */}
                  {!volumeRenderer.isInteracting && !volumeRenderer.isRotating && (
                    <Box sx={{
                      position: 'absolute',
                      bottom: 10,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      bgcolor: 'rgba(0,0,0,0.7)',
                      px: 2,
                      py: 1,
                      borderRadius: 1,
                      fontSize: '12px',
                      color: 'grey.400'
                    }}>
                      💡 Drag to rotate • Scroll to zoom
                    </Box>
                  )}
                </>
              ) : (
                <canvas
                  ref={(el) => {
                    if (el && viewerMode === '3d') {
                      const ctx = el.getContext('2d')
                      if (ctx) {
                        el.width = el.clientWidth
                        el.height = el.clientHeight
                        ctx.fillStyle = '#000'
                        ctx.fillRect(0, 0, el.width, el.height)
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
                        ctx.font = 'bold 24px Arial'
                        ctx.textAlign = 'center'
                        ctx.fillText('Ready for Real 3D Volume Rendering', el.width / 2, el.height / 2 - 40)
                        ctx.font = '16px Arial'
                        ctx.fillStyle = 'rgba(200, 200, 200, 0.8)'
                        ctx.fillText('Click "START 3D RENDERING" to begin', el.width / 2, el.height / 2 + 20)
                      }
                    }
                  }}
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'block'
                  }}
                />
              )}

              {/* Loading Progress */}
              {volumeRenderer.isLoading && (
                <Box sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  bgcolor: 'rgba(0,0,0,0.9)',
                  p: 3,
                  borderRadius: 2,
                  minWidth: 300
                }}>
                  <Typography variant="h6" color="primary.main" gutterBottom>
                    Loading Volume Data...
                  </Typography>
                  <Box sx={{ width: '100%', mt: 2 }}>
                    <Box sx={{
                      width: '100%',
                      height: 8,
                      bgcolor: 'grey.800',
                      borderRadius: 1,
                      overflow: 'hidden'
                    }}>
                      <Box sx={{
                        width: `${volumeRenderer.loadProgress}%`,
                        height: '100%',
                        bgcolor: 'primary.main',
                        transition: 'width 0.3s'
                      }} />
                    </Box>
                    <Typography variant="body2" color="grey.400" sx={{ mt: 1 }}>
                      {Math.round(volumeRenderer.loadProgress)}% ({totalFrames} frames)
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* 3D Info Overlay */}
              {is3DRenderingStarted && volumeRenderer.volume && (
                <Box sx={{
                  position: 'absolute',
                  top: 10,
                  left: 10,
                  color: 'white',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  bgcolor: 'rgba(0,0,0,0.7)',
                  p: 1,
                  borderRadius: 1,
                  pointerEvents: 'none'
                }}>
                  <div>3D Volume: {volumeRenderer.volume.dimensions.width}×{volumeRenderer.volume.dimensions.height}×{volumeRenderer.volume.dimensions.depth}</div>
                  <div>Mode: {volumeRenderer.renderSettings.mode.toUpperCase()}</div>
                  <div>Render: Real Ray Casting</div>
                  <div>Status: {volumeRenderer.isRotating ? 'Auto-Rotating' : 'Interactive'}</div>
                </Box>
              )}

              <Box sx={{
                position: 'absolute',
                bottom: 10,
                right: 10,
                color: 'white',
                fontSize: '12px',
                fontFamily: 'monospace',
                bgcolor: 'rgba(0,0,0,0.7)',
                p: 1,
                borderRadius: 1,
                textAlign: 'right',
                pointerEvents: 'none'
              }}>
                <div>Quality: {volumeRenderer.renderSettings.stepSize < 0.7 ? 'High' : volumeRenderer.renderSettings.stepSize < 1.5 ? 'Medium' : 'Low'}</div>
                <div>Step Size: {volumeRenderer.renderSettings.stepSize.toFixed(2)}</div>
                <div>Canvas Rendering</div>
              </Box>

              {/* Start Button */}
              {!is3DRenderingStarted && (
                <Box sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  color: 'primary.main',
                  pointerEvents: 'none',
                  zIndex: 3
                }}>
                  <Box sx={{ pointerEvents: 'auto' }}>
                    <View3DIcon sx={{ fontSize: 64, mb: 2, animation: 'pulse 2s infinite' }} />
                    <Typography variant="h6" gutterBottom>
                      Real 3D Volume Rendering
                    </Typography>
                    <Typography variant="body2" color="grey.400">
                      Ray casting with {totalFrames} frames
                    </Typography>
                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                      <Button
                        variant="contained"
                        onClick={handleStart3DRendering}
                        startIcon={<View3DIcon />}
                      >
                        Start 3D Rendering
                      </Button>
                    </Box>
                  </Box>
                </Box>
              )}

              {/* Error Display */}
              {volumeRenderer.error && (
                <Box sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  bgcolor: 'rgba(0,0,0,0.9)',
                  p: 3,
                  borderRadius: 2,
                  maxWidth: 400
                }}>
                  <Typography variant="h6" color="error" gutterBottom>
                    Error Loading Volume
                  </Typography>
                  <Typography variant="body2" color="grey.400">
                    {volumeRenderer.error}
                  </Typography>
                  <Button
                    variant="outlined"
                    color="primary"
                    onClick={() => setIs3DRenderingStarted(false)}
                    sx={{ mt: 2 }}
                  >
                    Try Again
                  </Button>
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* AI Assistant Button */}
     

      {/* Analysis Panel Toggle Button */}
      {!isAnalysisPanelOpen && (
        <Tooltip title="Show Analysis Panel">
          <IconButton
            onClick={() => setIsAnalysisPanelOpen(true)}
            sx={{
              position: 'fixed',
              top: 180,
              right: 20,
              bgcolor: 'primary.main',
              color: 'white',
              zIndex: 1000,
              '&:hover': {
                bgcolor: 'primary.dark'
              }
            }}
          >
            <ListIcon />
          </IconButton>
        </Tooltip>
      )}

      {/* Analysis Panel Component */}
      <AnalysisPanel
        isOpen={isAnalysisPanelOpen}
        onClose={() => setIsAnalysisPanelOpen(false)}
        measurements={measurements}
        annotations={annotations}
        currentFrameIndex={currentFrameIndex}
      />

      

      {/* Tools History Toggle Button */}
      <Tooltip title={isToolsHistoryOpen ? "Hide Tools History" : "Show Tools History"}>
        <IconButton
          onClick={() => setIsToolsHistoryOpen(!isToolsHistoryOpen)}
          sx={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            bgcolor: 'primary.main',
            color: 'white',
            zIndex: 1000,
            '&:hover': {
              bgcolor: 'primary.dark'
            }
          }}
        >
          <ListIcon />
        </IconButton>
      </Tooltip>

      {/* Tools History Component */}
      {isToolsHistoryOpen && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 80,
            right: 20,
            width: 350,
            zIndex: 1000,
          }}
        >
          <ToolsHistory />
        </Box>
      )}

      {/* Window/Level Preset Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => { applyWindowLevelPreset('angio'); setAnchorEl(null) }}>
          Angiography (W:600 L:300)
        </MenuItem>
        <MenuItem onClick={() => { applyWindowLevelPreset('bone'); setAnchorEl(null) }}>
          Bone (W:2000 L:300)
        </MenuItem>
        <MenuItem onClick={() => { applyWindowLevelPreset('soft'); setAnchorEl(null) }}>
          Soft Tissue (W:400 L:50)
        </MenuItem>
        <MenuItem onClick={() => { applyWindowLevelPreset('default'); setAnchorEl(null) }}>
          Reset to Default
        </MenuItem>
      </Menu>

      {/* Annotation Style Menu */}
      <Menu
        anchorEl={annotationMenuEl}
        open={Boolean(annotationMenuEl)}
        onClose={() => setAnnotationMenuEl(null)}
      >
        <Box sx={{ p: 2, minWidth: 300 }}>
          <Typography variant="subtitle2" gutterBottom>Annotation Style</Typography>

          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" gutterBottom>Color:</Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              {['#00ff41', '#ff6b6b', '#4dabf7', '#ffd43b', '#ff8cc8', '#69db7c'].map(color => (
                <Box
                  key={color}
                  sx={{
                    width: 24,
                    height: 24,
                    bgcolor: color,
                    border: selectedColor === color ? '2px solid white' : '1px solid #666',
                    borderRadius: 1,
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedColor(color)}
                />
              ))}
            </Box>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" gutterBottom>Stroke Width: {strokeWidth}px</Typography>
            <Slider
              value={strokeWidth}
              min={1}
              max={10}
              step={1}
              onChange={(_, value) => setStrokeWidth(value as number)}
              sx={{ width: '100%' }}
            />
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" gutterBottom>Font Size: {fontSize}px</Typography>
            <Slider
              value={fontSize}
              min={10}
              max={24}
              step={2}
              onChange={(_, value) => setFontSize(value as number)}
              sx={{ width: '100%' }}
            />
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" gutterBottom>Annotation Text:</Typography>
            <input
              type="text"
              value={annotationText}
              onChange={(e) => setAnnotationText(e.target.value)}
              placeholder="Enter annotation text..."
              style={{
                width: '100%',
                padding: '8px',
                background: '#333',
                color: 'white',
                border: '1px solid #555',
                borderRadius: '4px'
              }}
            />
          </Box>

          <Button
            onClick={() => setAnnotationMenuEl(null)}
            variant="contained"
            size="small"
            fullWidth
          >
            Apply Style
          </Button>
        </Box>
      </Menu>

      {/* Metadata Dialog */}
      <Dialog
        open={showMetadata}
        onClose={() => setShowMetadata(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Comprehensive DICOM Metadata
        </DialogTitle>
        <DialogContent>
          {metadata ? (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom color="primary.main">
                  Patient Information
                </Typography>
                <Typography variant="body2">Name: {metadata.patient_info?.name ?? 'N/A'}</Typography>
                <Typography variant="body2">ID: {metadata.patient_info?.id ?? 'N/A'}</Typography>
                <Typography variant="body2">DOB: {metadata.patient_info?.birth_date ?? 'N/A'}</Typography>
                <Typography variant="body2">Sex: {metadata.patient_info?.sex ?? 'N/A'}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom color="primary.main">
                  Study Information
                </Typography>
                <Typography variant="body2">Date: {metadata.study_info?.study_date ?? 'N/A'}</Typography>
                <Typography variant="body2">Time: {metadata.study_info?.study_time ?? 'N/A'}</Typography>
                <Typography variant="body2">Modality: {metadata.study_info?.modality ?? 'N/A'}</Typography>
                <Typography variant="body2">Description: {metadata.study_info?.study_description ?? 'N/A'}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom color="primary.main">
                  Image Properties
                </Typography>
                <Typography variant="body2">Matrix: {metadata.image_info?.columns ?? 'N/A'} × {metadata.image_info?.rows ?? 'N/A'}</Typography>
                <Typography variant="body2">Frames: {metadata.image_info?.number_of_frames ?? totalFrames}</Typography>
                <Typography variant="body2">Pixel Spacing: {metadata.image_info?.pixel_spacing?.join(' × ') ?? 'N/A'} mm</Typography>
                <Typography variant="body2">Bits: {metadata.technical_info?.bits_allocated ?? 'N/A'}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom color="primary.main">
                  Statistics
                </Typography>
                <Typography variant="body2">Min Pixel: {metadata.image_info?.pixel_min ?? 'N/A'}</Typography>
                <Typography variant="body2">Max Pixel: {metadata.image_info?.pixel_max ?? 'N/A'}</Typography>
                <Typography variant="body2">Mean: {metadata.image_info?.pixel_mean != null ? metadata.image_info.pixel_mean.toFixed(1) : 'N/A'}</Typography>
                <Typography variant="body2">Std Dev: {metadata.image_info?.pixel_std != null ? metadata.image_info.pixel_std.toFixed(1) : 'N/A'}</Typography>
              </Grid>
            </Grid>
          ) : (
            <Typography>Loading metadata...</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowMetadata(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Advanced Annotations Management Dialog */}
      <Dialog
        open={showAnnotations}
        onClose={() => setShowAnnotations(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Advanced Annotations & Clinical Findings ({annotations.length + measurements.length})
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            {/* Measurements Section */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom color="primary.main">
                Measurements ({measurements.length})
              </Typography>
              {measurements.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No measurements</Typography>
              ) : (
                measurements.map((measurement) => (
                  <Card key={measurement.id} sx={{ mb: 1, bgcolor: 'grey.100' }}>
                    <CardContent sx={{ py: 1 }}>
                      <Typography variant="body2" color="primary.main" fontWeight="bold">
                        {measurement.type.toUpperCase()}
                      </Typography>
                      <Typography variant="h6">
                        {measurement.value.toFixed(2)} {measurement.unit}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Frame {measurement.frameIndex + 1} • {measurement.points.length} points
                      </Typography>
                    </CardContent>
                  </Card>
                ))
              )}
            </Grid>

            {/* Annotations Section */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom color="secondary.main">
                Annotations ({annotations.length})
              </Typography>
              {annotations.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No annotations</Typography>
              ) : (
                annotations.map((annotation) => (
                  <Card
                    key={annotation.id}
                    sx={{
                      mb: 1,
                      bgcolor: annotation.type === 'clinical' ? 'error.light' : 'grey.100',
                      borderLeft: `4px solid ${validateAnnotationColor(annotation.style?.strokeColor)}`
                    }}
                  >
                    <CardContent sx={{ py: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography
                            variant="body2"
                            color={annotation.type === 'clinical' ? 'error.main' : 'secondary.main'}
                            fontWeight="bold"
                          >
                            {annotation.type.toUpperCase()}
                            {annotation.type === 'clinical' && ' 🏥'}
                          </Typography>
                          {annotation.text && (
                            <Typography variant="body1" sx={{ mt: 0.5 }}>
                              "{annotation.text}"
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.secondary">
                            Frame {annotation.frameIndex + 1} • {new Date(annotation.timestamp).toLocaleString()}
                          </Typography>
                          <br />
                          <Typography variant="caption" color="text.secondary">
                            By: {annotation.author} • Category: {annotation.category}
                          </Typography>
                        </Box>
                        <Box sx={{ ml: 1 }}>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => {
                              setAnnotations(prev => prev.filter(a => a.id !== annotation.id))
                              drawFrame(currentFrameIndex)
                            }}
                          >
                            <ClearIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                ))
              )}
            </Grid>

            {/* Clinical Findings Summary */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom color="error.main">
                Clinical Findings Summary
              </Typography>
              {annotations.filter(a => a.type === 'clinical').length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No clinical findings marked
                </Typography>
              ) : (
                <Box sx={{ bgcolor: 'error.light', p: 2, borderRadius: 1 }}>
                  {annotations.filter(a => a.type === 'clinical').map((finding, index) => (
                    <Typography key={finding.id} variant="body2" sx={{ mb: 1 }}>
                      <strong>Finding {index + 1}:</strong> {finding.text || 'Unlabeled finding'}
                      <em> (Frame {finding.frameIndex + 1})</em>
                    </Typography>
                  ))}
                </Box>
              )}
            </Grid>

            {/* Export Options */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>Export & Reporting</Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button
                  startIcon={<SaveIcon />}
                  variant="outlined"
                  onClick={() => {
                    const reportData = {
                      measurements,
                      annotations,
                      studyUID: studyInstanceUID,
                      timestamp: new Date().toISOString(),
                      totalFrames
                    }
                    console.log('Export Report:', reportData)
                    // Here you would implement actual export functionality
                  }}
                >
                  Export Report
                </Button>
                <Button
                  startIcon={<BookmarkIcon />}
                  variant="outlined"
                  color="secondary"
                  onClick={() => {
                    // Mark current frame as key image
                    const keyImageAnnotation = createAnnotation('text', [{ x: 50, y: 50 }], `Key Image - Frame ${currentFrameIndex + 1}`)
                    keyImageAnnotation.isKeyImage = true
                    keyImageAnnotation.category = 'critical'
                    setAnnotations(prev => [...prev, keyImageAnnotation])
                  }}
                >
                  Mark Key Image
                </Button>
                <Button
                  startIcon={<ViewIcon />}
                  variant="outlined"
                  onClick={() => goToFrame(currentFrameIndex)}
                >
                  Go to Current Frame
                </Button>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAnnotations(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Structured Reporting Dialog */}
      <Dialog
        open={showStructuredReporting}
        onClose={() => setShowStructuredReporting(false)}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1a1a1a',
            color: '#fff',
            height: '90vh',
            maxHeight: '90vh'
          }
        }}
      >
        <DialogContent sx={{ p: 0, height: '100%' }}>
          <ProductionReportEditor
            studyInstanceUID={studyInstanceUID}
            patientInfo={{
              patientID: studyInstanceUID?.includes('DEMO') ? 'DEMO001' : studyInstanceUID?.includes('Free') ? 'FREE001' : 'DOE001',
              patientName: studyInstanceUID?.includes('DEMO') ? 'Rubo^DEMO' : studyInstanceUID?.includes('Free') ? 'Free.Max_Head' : 'Doe^John',
              modality: metadata?.study_info?.Modality || 'XA',
              studyDate: metadata?.study_info?.StudyDate || '20240101'
            }}
            onClose={() => setShowReportDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Finalize Report Dialog */}
      <Dialog
        open={showFinalizeDialog}
        onClose={() => setShowFinalizeDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#1976d2', color: 'white' }}>
          ✅ Finalize Structured Report
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Review the report details below and enter your signature to finalize.
            </Typography>

            {/* Study Information */}
            <Paper elevation={2} sx={{ p: 2, mb: 2, bgcolor: '#f5f5f5' }}>
              <Typography variant="h6" sx={{ mb: 1, color: '#1976d2' }}>
                📋 Study Information
              </Typography>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="body2">
                    <strong>Patient:</strong> {metadata?.patient_info?.name || 'Unknown'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2">
                    <strong>Patient ID:</strong> {metadata?.patient_info?.id || 'N/A'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2">
                    <strong>Study:</strong> {currentStudyId?.substring(0, 20)}...
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2">
                    <strong>Modality:</strong> {metadata?.study_info?.modality || 'N/A'}
                  </Typography>
                </Grid>
                {currentReportId && (
                  <Grid item xs={12}>
                    <Typography variant="body2">
                      <strong>Report ID:</strong> {currentReportId}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Paper>

            {/* Measurements Section */}
            {measurements.length > 0 && (
              <Paper elevation={2} sx={{ p: 2, mb: 2, bgcolor: '#e3f2fd' }}>
                <Typography variant="h6" sx={{ mb: 1, color: '#1976d2' }}>
                  📏 Measurements ({measurements.length})
                </Typography>
                <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                  {measurements.map((m, idx) => (
                    <Box key={m.id} sx={{ mb: 1, p: 1, bgcolor: 'white', borderRadius: 1 }}>
                      <Typography variant="body2">
                        <strong>{idx + 1}. {m.type.toUpperCase()}:</strong> {m.value.toFixed(2)} {m.unit}
                        {m.label && ` - ${m.label}`}
                        <Typography component="span" variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                          (Frame {m.frameIndex})
                        </Typography>
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>
            )}

            {/* Annotations Section */}
            {annotations.length > 0 && (
              <Paper elevation={2} sx={{ p: 2, mb: 2, bgcolor: '#fff3e0' }}>
                <Typography variant="h6" sx={{ mb: 1, color: '#f57c00' }}>
                  📝 Annotations ({annotations.length})
                </Typography>
                <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                  {annotations.map((a, idx) => (
                    <Box key={a.id} sx={{ mb: 1, p: 1, bgcolor: 'white', borderRadius: 1 }}>
                      <Typography variant="body2">
                        <strong>{idx + 1}. {a.type.toUpperCase()}:</strong> {a.text || 'No text'}
                        <Typography component="span" variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                          (Frame {a.frameIndex})
                        </Typography>
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>
            )}

            {/* Signature Section */}
            <Paper elevation={2} sx={{ p: 2, bgcolor: '#e8f5e9' }}>
              <Typography variant="h6" sx={{ mb: 1, color: '#2e7d32' }}>
                ✍️ Radiologist Signature
              </Typography>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>
                Enter your signature:
              </Typography>
              <Box
                component="input"
                type="text"
                placeholder="Enter your signature (e.g., Dr. John Smith)"
                value={radiologistSignature}
                onChange={(e: any) => setRadiologistSignature(e.target.value)}
                onFocus={(e: any) => {
                  // Auto-fill with default signature if empty
                  if (!radiologistSignature) {
                    setRadiologistSignature('Dr. Test Radiologist')
                  }
                }}
                sx={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '16px',
                  border: '2px solid #ccc',
                  borderRadius: '4px',
                  '&:focus': {
                    outline: 'none',
                    borderColor: '#2563eb'
                  }
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                💡 Tip: Your signature will be permanently recorded with this report
              </Typography>
            </Paper>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowFinalizeDialog(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleFinalizeReport}
            variant="contained"
            color="success"
            disabled={!radiologistSignature.trim()}
            startIcon={<CheckIcon />}
          >
            Finalize Report
          </Button>
        </DialogActions>
      </Dialog>

      {/* Simple Export Dialog - Removed (use ProductionReportEditor export feature) */}

      {/* DICOM Study Upload Dialog */}
      <Dialog
        open={showUploadDialog}
        onClose={() => !isUploading && setShowUploadDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          📤 Upload New DICOM Study
        </DialogTitle>
        <DialogContent>
          <Box
            sx={{
              border: '2px dashed #2563eb',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              bgcolor: 'rgba(37, 99, 235, 0.05)',
              mb: 3,
              position: 'relative',
              minHeight: 200,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <UploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Drag & Drop DICOM or ZIP Files Here
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Upload individual DICOM files or ZIP archives containing entire studies
            </Typography>

            <input
              type="file"
              multiple
              accept=".dcm,.dicom,.zip"
              style={{ display: 'none' }}
              id="dicom-file-input"
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
            />
            <label htmlFor="dicom-file-input">
              <Button
                component="span"
                variant="contained"
                startIcon={<UploadIcon />}
                disabled={isUploading}
                size="large"
              >
                Select DICOM or ZIP Files
              </Button>
            </label>

            {/* ZIP Upload Option */}
            <input
              type="file"
              accept=".zip"
              style={{ display: 'none' }}
              id="zip-file-input"
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
            />
            <label htmlFor="zip-file-input">
              <Button
                component="span"
                variant="outlined"
                startIcon={<FolderIcon />}
                disabled={isUploading}
                size="large"
                sx={{ ml: 2 }}
              >
                Upload ZIP Study
              </Button>
            </label>

            {/* Upload Progress */}
            {isUploading && (
              <Box sx={{ width: '100%', mt: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Box sx={{ width: '100%', mr: 1 }}>
                    <Slider
                      value={uploadProgress}
                      variant="determinate"
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>
                  <Box sx={{ minWidth: 35 }}>
                    <Typography variant="body2" color="text.secondary">
                      {Math.round(uploadProgress)}%
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body2" color="primary.main" sx={{ textAlign: 'center' }}>
                  {uploadStatus}
                </Typography>
              </Box>
            )}

            {/* Upload Status */}
            {uploadStatus && !isUploading && (
              <Box sx={{ mt: 2, p: 2, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.05)' }}>
                <Typography variant="body2" color="text.primary">
                  {uploadStatus}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Upload Instructions */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              📋 Upload Instructions
            </Typography>
            <ul style={{ paddingLeft: '20px', lineHeight: 1.8 }}>
              <li><strong>Supported Formats:</strong> .dcm, .dicom, .zip files</li>
              <li><strong>ZIP Upload:</strong> Upload entire study as ZIP for unified 3D reconstruction</li>
              <li><strong>Multi-file Upload:</strong> Select multiple files or drag entire folders</li>
              <li><strong>Auto-Processing:</strong> Files are automatically processed and added to studies</li>
              <li><strong>Frame Extraction:</strong> Multi-frame DICOM files are automatically extracted</li>
              <li><strong>3D Support:</strong> ZIP files are grouped as single study for proper 3D viewing</li>
              <li><strong>Metadata:</strong> Patient and study information is automatically extracted</li>
            </ul>
          </Box>

          {/* Recent Uploads */}
          {availableStudies.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                📚 Available Studies ({availableStudies.length})
              </Typography>
              <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                {availableStudies.slice(0, 5).map((study, index) => (
                  <Card key={study.studyInstanceUID || index} sx={{ mb: 1, bgcolor: 'grey.50' }}>
                    <CardContent sx={{ py: 1 }}>
                      <Typography variant="body2" fontWeight="bold">
                        {study.patientName || 'Unknown Patient'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {study.studyDescription || 'DICOM Study'} • {study.studyDate || 'Unknown Date'}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowStudySelector(true)} startIcon={<ListIcon />}>
            View All Studies
          </Button>
          <Button
            onClick={() => setShowUploadDialog(false)}
            disabled={isUploading}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Study Selector Dialog */}
      <Dialog
        open={showStudySelector}
        onClose={() => setShowStudySelector(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          📚 Select DICOM Study
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Available Studies ({availableStudies.length})
            </Typography>
            <Button
              startIcon={<RefreshIcon />}
              onClick={loadAvailableStudies}
              size="small"
            >
              Refresh
            </Button>
          </Box>

          {availableStudies.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <StudyIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No Studies Available
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Upload DICOM files to get started
              </Typography>
              <Button
                variant="contained"
                startIcon={<UploadIcon />}
                onClick={() => {
                  setShowStudySelector(false)
                  setShowUploadDialog(true)
                }}
              >
                Upload First Study
              </Button>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {availableStudies.map((study, index) => (
                <Grid item xs={12} md={6} key={study.studyInstanceUID || index}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      border: currentStudyId === study.studyInstanceUID ? '2px solid #2563eb' : '1px solid #e0e0e0',
                      '&:hover': {
                        boxShadow: 3,
                        transform: 'translateY(-2px)'
                      }
                    }}
                    onClick={() => switchToStudy(study.studyInstanceUID)}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h6" color="primary.main">
                            {study.patientName || 'Unknown Patient'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Patient ID: {study.patientID || 'Unknown'}
                          </Typography>

                          <Typography variant="body1" sx={{ mt: 1 }}>
                            {study.studyDescription || 'DICOM Study'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {study.modality || 'Unknown'} • {study.studyDate || 'Unknown Date'}
                          </Typography>

                          <Typography variant="caption" color="text.secondary">
                            Images: {study.numberOfInstances || 'Unknown'} •
                            Study UID: {study.studyInstanceUID?.substring(0, 20)}...
                          </Typography>
                        </Box>

                        {currentStudyId === study.studyInstanceUID && (
                          <CheckIcon color="primary" />
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}

          {/* Upload Status in Study Selector */}
          {uploadStatus && (
            <Box sx={{ mt: 2, p: 2, borderRadius: 1, bgcolor: 'primary.light' }}>
              <Typography variant="body2" color="white">
                {uploadStatus}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setShowStudySelector(false)
              setShowUploadDialog(true)
            }}
            startIcon={<UploadIcon />}
          >
            Upload New Study
          </Button>
          <Button onClick={() => setShowStudySelector(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Keyboard Shortcuts Help Dialog */}
      <KeyboardShortcutsHelp
        open={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />

      {/* AI Analysis removed */}

      {/* AI Analysis Control Panel (Phase 1 & 2) */}
      {showAIControl && (
        <Box
          sx={{
            position: 'fixed',
            top: 100,
            right: 20,
            zIndex: 2000,
            maxWidth: 500,
          }}
        >
          <AIAnalysisControl
            studyInstanceUID={currentStudyId}
            seriesInstanceUID={seriesInstanceUID}
            currentFrameIndex={currentFrameIndex}
            totalFrames={totalFrames}
            onClose={() => setShowAIControl(false)}
          />
        </Box>
      )}

      {/* Background Jobs Panel */}
      {showBackgroundJobs && (
        <Box
          sx={{
            position: 'fixed',
            top: 100,
            right: 20,
            zIndex: 2000,
            maxWidth: 600,
          }}
        >
          <BackgroundJobsPanel
            onViewResult={(job) => {
              // Navigate to the slice
              setCurrentFrameIndex(job.sliceIndex)
              
              // Show the result in analysis panel
              setIsAnalysisPanelOpen(true)
              
              // Close background jobs panel
              setShowBackgroundJobs(false)
              
              console.log('Viewing result for job:', job)
            }}
          />
        </Box>
      )}

      {/* Captured Images Gallery */}
      <CapturedImagesGallery
        open={showCapturedImages}
        onClose={() => setShowCapturedImages(false)}
      />

      {/* Toast Notification System */}
      <ToastNotification />
    </Box>
  )
}

export default MedicalImageViewer