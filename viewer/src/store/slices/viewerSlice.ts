import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { viewerService } from '../../services/viewerService'
import type { 
  ViewerState as IViewerState, 
  Viewport, 
  ViewerTool, 
  WindowLevel,
  Measurement,
  Annotation,
  SelectionState,
  SelectionHistoryEntry,
  DragState,
  TextEditorState,
  HistoryEntry,
  AnnotationManagerState,
  Point
} from '../../types/viewer'

export interface ViewerState extends IViewerState {
  isLoading: boolean
  error: string | null
}

const initialState: ViewerState = {
  currentStudy: null,
  currentSeries: null,
  currentInstance: null,
  viewports: [],
  activeViewportIndex: 0,
  layout: {
    rows: 1,
    columns: 1,
  },
  activeTool: 'pan',
  tools: {
    pan: { enabled: true, active: false },
    zoom: { enabled: true, active: false },
    windowLevel: { enabled: true, active: false },
    length: { enabled: true, active: false },
    angle: { enabled: true, active: false },
    rectangle: { enabled: true, active: false },
    ellipse: { enabled: true, active: false },
    freehand: { enabled: true, active: false },
    annotation: { enabled: true, active: false },
  },
  windowLevel: {
    width: 400,
    center: 40,
  },
  zoom: 1.0,
  pan: { x: 0, y: 0 },
  rotation: 0,
  invert: false,
  flipHorizontal: false,
  flipVertical: false,
  measurements: [],
  annotations: [],
  aiOverlays: [],
  showAiOverlays: true,
  showMeasurements: true,
  showAnnotations: true,
  cineMode: {
    enabled: false,
    playing: false,
    fps: 10,
    loop: true,
  },
  selection: {
    selectedMeasurementId: null,
    selectedAnnotationId: null,
    hoveredMeasurementId: null,
    hoveredAnnotationId: null,
    selectionHistory: [],
    actionHistory: [],
    lastSelectionTimestamp: 0,
  },
  annotationDrag: {
    isDragging: false,
    dragType: 'move',
    startPosition: { x: 0, y: 0 },
    currentPosition: { x: 0, y: 0 },
    targetId: '',
    controlPointId: undefined,
    initialAnnotation: undefined,
  },
  annotationTextEditor: {
    isEditing: false,
    annotationId: null,
    position: { x: 0, y: 0 },
    initialText: '',
    currentText: '',
  },
  annotationHistory: {
    undoStack: [],
    redoStack: [],
  },
  annotationManager: {
    filter: 'all',
    sortBy: 'created',
    searchQuery: '',
  },
  isLoading: false,
  error: null,
}

// Async thunks
export const loadStudy = createAsyncThunk(
  'viewer/loadStudy',
  async (studyInstanceUID: string, { rejectWithValue }) => {
    try {
      const study = await viewerService.loadStudy(studyInstanceUID)
      return study
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to load study')
    }
  }
)

export const loadSeries = createAsyncThunk(
  'viewer/loadSeries',
  async ({ studyInstanceUID, seriesInstanceUID }: { 
    studyInstanceUID: string
    seriesInstanceUID: string 
  }, { rejectWithValue }) => {
    try {
      const series = await viewerService.loadSeries(studyInstanceUID, seriesInstanceUID)
      return series
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to load series')
    }
  }
)

export const loadInstance = createAsyncThunk(
  'viewer/loadInstance',
  async ({ studyInstanceUID, seriesInstanceUID, sopInstanceUID }: {
    studyInstanceUID: string
    seriesInstanceUID: string
    sopInstanceUID: string
  }, { rejectWithValue }) => {
    try {
      const instance = await viewerService.loadInstance(studyInstanceUID, seriesInstanceUID, sopInstanceUID)
      return instance
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to load instance')
    }
  }
)

export const saveMeasurement = createAsyncThunk(
  'viewer/saveMeasurement',
  async (measurement: Omit<Measurement, 'id' | 'createdAt'>, { rejectWithValue }) => {
    try {
      const savedMeasurement = await viewerService.saveMeasurement(measurement)
      return savedMeasurement
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to save measurement')
    }
  }
)

export const saveAnnotation = createAsyncThunk(
  'viewer/saveAnnotation',
  async (annotation: Omit<Annotation, 'id' | 'createdAt'>, { rejectWithValue }) => {
    try {
      const savedAnnotation = await viewerService.saveAnnotation(annotation)
      return savedAnnotation
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to save annotation')
    }
  }
)

// Viewer slice
const viewerSlice = createSlice({
  name: 'viewer',
  initialState,
  reducers: {
    setActiveTool: (state, action: PayloadAction<ViewerTool>) => {
      // Deactivate all tools
      Object.keys(state.tools).forEach(tool => {
        state.tools[tool as ViewerTool].active = false
      })
      
      // Activate selected tool
      state.activeTool = action.payload
      state.tools[action.payload].active = true
    },
    setActiveViewport: (state, action: PayloadAction<number>) => {
      if (action.payload >= 0 && action.payload < state.viewports.length) {
        state.activeViewportIndex = action.payload
      }
    },
    setLayout: (state, action: PayloadAction<{ rows: number; columns: number }>) => {
      state.layout = action.payload
      
      // Adjust viewports array to match new layout
      const totalViewports = action.payload.rows * action.payload.columns
      
      if (state.viewports.length > totalViewports) {
        // Remove excess viewports
        state.viewports = state.viewports.slice(0, totalViewports)
      } else if (state.viewports.length < totalViewports) {
        // Add new viewports
        for (let i = state.viewports.length; i < totalViewports; i++) {
          state.viewports.push({
            index: i,
            studyInstanceUID: null,
            seriesInstanceUID: null,
            sopInstanceUID: null,
            imageIndex: 0,
            windowLevel: { ...state.windowLevel },
            zoom: 1.0,
            pan: { x: 0, y: 0 },
            rotation: 0,
            invert: false,
            flipHorizontal: false,
            flipVertical: false,
          })
        }
      }
      
      // Reset active viewport if it's out of bounds
      if (state.activeViewportIndex >= totalViewports) {
        state.activeViewportIndex = 0
      }
    },
    setWindowLevel: (state, action: PayloadAction<WindowLevel>) => {
      state.windowLevel = action.payload
      
      // Update active viewport
      if (state.viewports[state.activeViewportIndex]) {
        state.viewports[state.activeViewportIndex].windowLevel = action.payload
      }
    },
    setZoom: (state, action: PayloadAction<number>) => {
      state.zoom = Math.max(0.1, Math.min(10, action.payload))
      
      // Update active viewport
      if (state.viewports[state.activeViewportIndex]) {
        state.viewports[state.activeViewportIndex].zoom = state.zoom
      }
    },
    setPan: (state, action: PayloadAction<{ x: number; y: number }>) => {
      state.pan = action.payload
      
      // Update active viewport
      if (state.viewports[state.activeViewportIndex]) {
        state.viewports[state.activeViewportIndex].pan = action.payload
      }
    },
    setRotation: (state, action: PayloadAction<number>) => {
      state.rotation = action.payload % 360
      
      // Update active viewport
      if (state.viewports[state.activeViewportIndex]) {
        state.viewports[state.activeViewportIndex].rotation = state.rotation
      }
    },
    setInvert: (state, action: PayloadAction<boolean>) => {
      state.invert = action.payload
      
      // Update active viewport
      if (state.viewports[state.activeViewportIndex]) {
        state.viewports[state.activeViewportIndex].invert = action.payload
      }
    },
    setFlipHorizontal: (state, action: PayloadAction<boolean>) => {
      state.flipHorizontal = action.payload
      
      // Update active viewport
      if (state.viewports[state.activeViewportIndex]) {
        state.viewports[state.activeViewportIndex].flipHorizontal = action.payload
      }
    },
    setFlipVertical: (state, action: PayloadAction<boolean>) => {
      state.flipVertical = action.payload
      
      // Update active viewport
      if (state.viewports[state.activeViewportIndex]) {
        state.viewports[state.activeViewportIndex].flipVertical = action.payload
      }
    },
    addMeasurement: (state, action: PayloadAction<Measurement>) => {
      state.measurements.push(action.payload)
    },
    updateMeasurement: (state, action: PayloadAction<Measurement>) => {
      const index = state.measurements.findIndex(m => m.id === action.payload.id)
      if (index !== -1) {
        state.measurements[index] = action.payload
      }
    },
    removeMeasurement: (state, action: PayloadAction<string>) => {
      state.measurements = state.measurements.filter(m => m.id !== action.payload)
    },
    addAnnotation: (state, action: PayloadAction<Annotation>) => {
      state.annotations.push(action.payload)
    },
    updateAnnotation: (state, action: PayloadAction<Annotation>) => {
      const index = state.annotations.findIndex(a => a.id === action.payload.id)
      if (index !== -1) {
        state.annotations[index] = action.payload
      }
    },
    removeAnnotation: (state, action: PayloadAction<string>) => {
      state.annotations = state.annotations.filter(a => a.id !== action.payload)
    },
    toggleAiOverlays: (state) => {
      state.showAiOverlays = !state.showAiOverlays
    },
    toggleMeasurements: (state) => {
      state.showMeasurements = !state.showMeasurements
    },
    toggleAnnotations: (state) => {
      state.showAnnotations = !state.showAnnotations
    },
    setCineMode: (state, action: PayloadAction<Partial<ViewerState['cineMode']>>) => {
      state.cineMode = { ...state.cineMode, ...action.payload }
    },
    
    // Selection actions
    selectMeasurement: (state, action: PayloadAction<string | null>) => {
      state.selection.selectedMeasurementId = action.payload
      state.selection.selectedAnnotationId = null
      state.selection.lastSelectionTimestamp = Date.now()
      
      if (action.payload) {
        // Add to selection history
        state.selection.selectionHistory.push({
          id: action.payload,
          type: 'measurement',
          timestamp: Date.now(),
          action: 'select',
        })
        
        // Limit history to 100 entries
        if (state.selection.selectionHistory.length > 100) {
          state.selection.selectionHistory.shift()
        }
      }
    },
    selectAnnotation: (state, action: PayloadAction<string | null>) => {
      state.selection.selectedAnnotationId = action.payload
      state.selection.selectedMeasurementId = null
      state.selection.lastSelectionTimestamp = Date.now()
      
      if (action.payload) {
        // Add to selection history
        state.selection.selectionHistory.push({
          id: action.payload,
          type: 'annotation',
          timestamp: Date.now(),
          action: 'select',
        })
        
        // Limit history to 100 entries
        if (state.selection.selectionHistory.length > 100) {
          state.selection.selectionHistory.shift()
        }
      }
    },
    setHoveredMeasurement: (state, action: PayloadAction<string | null>) => {
      state.selection.hoveredMeasurementId = action.payload
    },
    setHoveredAnnotation: (state, action: PayloadAction<string | null>) => {
      state.selection.hoveredAnnotationId = action.payload
    },
    clearAllSelections: (state) => {
      state.selection.selectedMeasurementId = null
      state.selection.selectedAnnotationId = null
      state.selection.hoveredMeasurementId = null
      state.selection.hoveredAnnotationId = null
      state.selection.lastSelectionTimestamp = Date.now()
    },
    addToSelectionHistory: (state, action: PayloadAction<SelectionHistoryEntry>) => {
      state.selection.selectionHistory.push(action.payload)
      
      // Limit history to 100 entries
      if (state.selection.selectionHistory.length > 100) {
        state.selection.selectionHistory.shift()
      }
    },
    
    // Tool action history
    addToolAction: (state, action: PayloadAction<Omit<import('../../types/viewer').ToolActionEntry, 'id' | 'timestamp'>>) => {
      const toolAction: import('../../types/viewer').ToolActionEntry = {
        ...action.payload,
        id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
      }
      
      state.selection.actionHistory.push(toolAction)
      
      // Limit history to 200 entries
      if (state.selection.actionHistory.length > 200) {
        state.selection.actionHistory.shift()
      }
      
      console.log('[ACTION PUSH]', toolAction.actionType, toolAction.itemId, toolAction.metadata, state.selection.actionHistory.length)
    },
    clearActionHistory: (state) => {
      state.selection.actionHistory = []
    },
    
    // Removal actions with selection cleanup
    removeMeasurementWithSync: (state, action: PayloadAction<string>) => {
      const measurementId = action.payload
      
      // Remove measurement from array
      state.measurements = state.measurements.filter(m => m.id !== measurementId)
      
      // Clear selection if this measurement was selected
      if (state.selection.selectedMeasurementId === measurementId) {
        state.selection.selectedMeasurementId = null
      }
      
      // Clear hover if this measurement was hovered
      if (state.selection.hoveredMeasurementId === measurementId) {
        state.selection.hoveredMeasurementId = null
      }
      
      // Add to selection history
      state.selection.selectionHistory.push({
        id: measurementId,
        type: 'measurement',
        timestamp: Date.now(),
        action: 'remove',
      })
      
      // Limit history to 100 entries
      if (state.selection.selectionHistory.length > 100) {
        state.selection.selectionHistory.shift()
      }
    },
    removeAnnotationWithSync: (state, action: PayloadAction<string>) => {
      const annotationId = action.payload
      
      // Remove annotation from array
      state.annotations = state.annotations.filter(a => a.id !== annotationId)
      
      // Clear selection if this annotation was selected
      if (state.selection.selectedAnnotationId === annotationId) {
        state.selection.selectedAnnotationId = null
      }
      
      // Clear hover if this annotation was hovered
      if (state.selection.hoveredAnnotationId === annotationId) {
        state.selection.hoveredAnnotationId = null
      }
      
      // Add to selection history
      state.selection.selectionHistory.push({
        id: annotationId,
        type: 'annotation',
        timestamp: Date.now(),
        action: 'remove',
      })
      
      // Limit history to 100 entries
      if (state.selection.selectionHistory.length > 100) {
        state.selection.selectionHistory.shift()
      }
    },
    
    // Rollback actions for error recovery
    rollbackMeasurementRemoval: (state, action: PayloadAction<Measurement>) => {
      const measurement = action.payload
      
      // Restore measurement to array
      state.measurements.push(measurement)
      
      // Restore selection if it was selected before
      if (state.selection.selectedMeasurementId === measurement.id) {
        state.selection.selectedMeasurementId = measurement.id
      }
      
      // Remove the 'remove' action from history
      state.selection.selectionHistory = state.selection.selectionHistory.filter(
        entry => !(entry.id === measurement.id && entry.action === 'remove')
      )
    },
    rollbackAnnotationRemoval: (state, action: PayloadAction<Annotation>) => {
      const annotation = action.payload
      
      // Restore annotation to array
      state.annotations.push(annotation)
      
      // Restore selection if it was selected before
      if (state.selection.selectedAnnotationId === annotation.id) {
        state.selection.selectedAnnotationId = annotation.id
      }
      
      // Remove the 'remove' action from history
      state.selection.selectionHistory = state.selection.selectionHistory.filter(
        entry => !(entry.id === annotation.id && entry.action === 'remove')
      )
    },
    
    clearMeasurementsAndAnnotations: (state) => {
      state.measurements = []
      state.annotations = []
      state.selection.selectedMeasurementId = null
      state.selection.selectedAnnotationId = null
      state.selection.hoveredMeasurementId = null
      state.selection.hoveredAnnotationId = null
      state.selection.selectionHistory = []
      state.selection.actionHistory = []
      console.log('[REDUX] Cleared measurements and annotations')
    },
    resetViewer: (state) => {
      return { ...initialState }
    },
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    // Load study
    builder
      .addCase(loadStudy.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loadStudy.fulfilled, (state, action) => {
        state.isLoading = false
        state.currentStudy = action.payload
        state.error = null
      })
      .addCase(loadStudy.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Load series
    builder
      .addCase(loadSeries.fulfilled, (state, action) => {
        state.currentSeries = action.payload
      })

    // Load instance
    builder
      .addCase(loadInstance.fulfilled, (state, action) => {
        state.currentInstance = action.payload
      })

    // Save measurement
    builder
      .addCase(saveMeasurement.fulfilled, (state, action) => {
        const index = state.measurements.findIndex(m => m.id === action.payload.id)
        if (index !== -1) {
          state.measurements[index] = action.payload
        } else {
          state.measurements.push(action.payload)
        }
      })

    // Save annotation
    builder
      .addCase(saveAnnotation.fulfilled, (state, action) => {
        const index = state.annotations.findIndex(a => a.id === action.payload.id)
        if (index !== -1) {
          state.annotations[index] = action.payload
        } else {
          state.annotations.push(action.payload)
        }
      })
  },
})

export const {
  setActiveTool,
  setActiveViewport,
  setLayout,
  setWindowLevel,
  setZoom,
  setPan,
  setRotation,
  setInvert,
  setFlipHorizontal,
  setFlipVertical,
  addMeasurement,
  updateMeasurement,
  removeMeasurement,
  addAnnotation,
  updateAnnotation,
  removeAnnotation,
  toggleAiOverlays,
  toggleMeasurements,
  toggleAnnotations,
  setCineMode,
  // Selection actions
  selectMeasurement,
  selectAnnotation,
  setHoveredMeasurement,
  setHoveredAnnotation,
  clearAllSelections,
  addToSelectionHistory,
  addToolAction,
  clearActionHistory,
  removeMeasurementWithSync,
  removeAnnotationWithSync,
  rollbackMeasurementRemoval,
  rollbackAnnotationRemoval,
  clearMeasurementsAndAnnotations,
  resetViewer,
  clearError,
} = viewerSlice.actions

export default viewerSlice.reducer

// Selectors
export const selectViewer = (state: { viewer: ViewerState }) => state.viewer
export const selectCurrentStudy = (state: { viewer: ViewerState }) => state.viewer.currentStudy
export const selectCurrentSeries = (state: { viewer: ViewerState }) => state.viewer.currentSeries
export const selectCurrentInstance = (state: { viewer: ViewerState }) => state.viewer.currentInstance
export const selectViewports = (state: { viewer: ViewerState }) => state.viewer.viewports
export const selectActiveViewport = (state: { viewer: ViewerState }) => 
  state.viewer.viewports[state.viewer.activeViewportIndex]
export const selectActiveTool = (state: { viewer: ViewerState }) => state.viewer.activeTool
export const selectViewerTools = (state: { viewer: ViewerState }) => state.viewer.tools
export const selectWindowLevel = (state: { viewer: ViewerState }) => state.viewer.windowLevel
export const selectMeasurements = (state: { viewer: ViewerState }) => state.viewer.measurements
export const selectAnnotations = (state: { viewer: ViewerState }) => state.viewer.annotations
export const selectViewerLoading = (state: { viewer: ViewerState }) => state.viewer.isLoading
export const selectViewerError = (state: { viewer: ViewerState }) => state.viewer.error

// Selection selectors
export const selectSelection = (state: { viewer: ViewerState }) => state.viewer.selection
export const selectSelectedMeasurementId = (state: { viewer: ViewerState }) => state.viewer.selection.selectedMeasurementId
export const selectSelectedAnnotationId = (state: { viewer: ViewerState }) => state.viewer.selection.selectedAnnotationId
export const selectHoveredMeasurementId = (state: { viewer: ViewerState }) => state.viewer.selection.hoveredMeasurementId
export const selectHoveredAnnotationId = (state: { viewer: ViewerState }) => state.viewer.selection.hoveredAnnotationId
export const selectSelectionHistory = (state: { viewer: ViewerState }) => state.viewer.selection.selectionHistory
export const selectActionHistory = (state: { viewer: ViewerState }) => state.viewer.selection.actionHistory || []