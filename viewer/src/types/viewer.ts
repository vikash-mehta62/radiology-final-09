export interface ViewerState {
  currentStudy: any | null
  currentSeries: any | null
  currentInstance: any | null
  viewports: Viewport[]
  activeViewportIndex: number
  layout: {
    rows: number
    columns: number
  }
  activeTool: ViewerTool
  tools: Record<ViewerTool, { enabled: boolean; active: boolean }>
  windowLevel: WindowLevel
  zoom: number
  pan: { x: number; y: number }
  rotation: number
  invert: boolean
  flipHorizontal: boolean
  flipVertical: boolean
  measurements: Measurement[]
  annotations: Annotation[]
  aiOverlays: any[]
  showAiOverlays: boolean
  showMeasurements: boolean
  showAnnotations: boolean
  cineMode: {
    enabled: boolean
    playing: boolean
    fps: number
    loop: boolean
  }
  selection: SelectionState
  annotationDrag: DragState
  annotationTextEditor: TextEditorState
  annotationHistory: {
    undoStack: HistoryEntry[]
    redoStack: HistoryEntry[]
  }
  annotationManager: AnnotationManagerState
}

export interface Viewport {
  index: number
  studyInstanceUID: string | null
  seriesInstanceUID: string | null
  sopInstanceUID: string | null
  imageIndex: number
  windowLevel: WindowLevel
  zoom: number
  pan: { x: number; y: number }
  rotation: number
  invert: boolean
  flipHorizontal: boolean
  flipVertical: boolean
}

export type ViewerTool = 
  | 'pan' 
  | 'zoom' 
  | 'windowLevel' 
  | 'length' 
  | 'angle' 
  | 'rectangle' 
  | 'ellipse' 
  | 'freehand' 
  | 'annotation'

export interface WindowLevel {
  width: number
  center: number
}

export interface Measurement {
  id: string
  type: string
  data: any
  createdAt: string
}

// Point interface for coordinates
export interface Point {
  x: number
  y: number
}

// Enhanced Annotation interface with full editing support
export interface Annotation {
  id: string
  type: 'arrow' | 'text' | 'freehand' | 'rectangle' | 'circle' | 'polygon' | 'measurement' | 'leader' | 'clinical'
  points: Point[]
  text?: string
  label?: string
  style: AnnotationStyle
  transform: Transform
  metadata: AnnotationMetadata
  frameIndex: number
  normalized?: boolean
  createdAt: string
  updatedAt: string
}

// Annotation style properties
export interface AnnotationStyle {
  strokeColor: string
  fillColor?: string
  strokeWidth: number
  fontSize?: number
  opacity: number
}

// Transform properties for position, scale, rotation
export interface Transform {
  position: Point  // Offset for whole annotation movement
  scale: { x: number; y: number }  // Scale factors for resizing
  rotation: number  // Rotation angle in degrees (for future use)
}

// Annotation metadata for management
export interface AnnotationMetadata {
  name?: string  // User-defined name
  visible: boolean  // Show/hide toggle
  locked: boolean  // Prevent editing
  zIndex: number  // Stacking order
}

// Control point for resizing and editing
export interface ControlPoint {
  id: string
  annotationId: string
  type: 'corner' | 'edge' | 'point' | 'center'
  position: Point
  cursor: CursorType
  index?: number  // For freehand/polygon points
}

// Cursor types for different interactions
export type CursorType = 
  | 'nw-resize' | 'n-resize' | 'ne-resize'
  | 'w-resize' | 'e-resize'
  | 'sw-resize' | 's-resize' | 'se-resize'
  | 'move' | 'pointer' | 'text' | 'crosshair'

// Bounding box for hit detection and rendering
export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

// Drag state for tracking drag operations
export interface DragState {
  isDragging: boolean
  dragType: 'move' | 'resize' | 'point'
  startPosition: Point
  currentPosition: Point
  targetId: string
  controlPointId?: string
  initialAnnotation?: Annotation  // For undo/redo
}

// Text editor state for inline editing
export interface TextEditorState {
  isEditing: boolean
  annotationId: string | null
  position: Point
  initialText: string
  currentText: string
}

// History entry for undo/redo
export interface HistoryEntry {
  id: string
  timestamp: number
  action: 'create' | 'move' | 'resize' | 'edit' | 'delete' | 'style' | 'point-move'
  annotationId: string
  beforeState: Annotation | null
  afterState: Annotation | null
}

// Annotation manager state
export interface AnnotationManagerState {
  filter: 'all' | 'measurements' | 'annotations'
  sortBy: 'created' | 'updated' | 'name'
  searchQuery: string
}

// Selection state interfaces
export interface SelectionHistoryEntry {
  id: string
  type: 'measurement' | 'annotation'
  timestamp: number
  action: 'select' | 'deselect' | 'remove'
  metadata?: {
    measurementType?: string
    annotationType?: string
    value?: number
    label?: string
  }
}

// Tool action history interfaces
export interface ToolActionEntry {
  id: string
  actionType: 'create' | 'move' | 'resize' | 'text-edit' | 'delete' | 'finalize' | 'leader' | 'handle-drag' | 'point-move'
  itemType: 'measurement' | 'annotation'
  itemId: string
  timestamp: number
  frameIndex?: number
  metadata?: {
    annotationType?: string
    measurementType?: string
    before?: any
    after?: any
    coords?: { x: number; y: number }
    delta?: { dx: number; dy: number }
    text?: string
  }
}

export interface SelectionState {
  selectedMeasurementId: string | null
  selectedAnnotationId: string | null
  hoveredMeasurementId: string | null
  hoveredAnnotationId: string | null
  selectionHistory: SelectionHistoryEntry[]
  actionHistory: ToolActionEntry[]
  lastSelectionTimestamp: number
}