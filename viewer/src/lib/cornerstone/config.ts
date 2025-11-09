// Core enums are initialized at runtime to avoid static import of core
let CoreEnums: any = null

// Tool enums are initialized at runtime to avoid static import of tools
let ToolEnums: any = null

export function initializeToolEnums(enums: any) {
  ToolEnums = enums
  // Rebuild dynamic structures when enums become available
  MOUSE_BINDINGS.PRIMARY = enums.MouseBindings.Primary
  MOUSE_BINDINGS.SECONDARY = enums.MouseBindings.Secondary
  MOUSE_BINDINGS.AUXILIARY = enums.MouseBindings.Auxiliary

  TOOL_MODES.ACTIVE = enums.ToolModes.Active
  TOOL_MODES.PASSIVE = enums.ToolModes.Passive
  TOOL_MODES.ENABLED = enums.ToolModes.Enabled
  TOOL_MODES.DISABLED = enums.ToolModes.Disabled

  const ToolsEnum = enums.Tools
  TOOL_NAMES.PAN = ToolsEnum.Pan
  TOOL_NAMES.ZOOM = ToolsEnum.Zoom
  TOOL_NAMES.STACK_SCROLL = ToolsEnum.StackScroll
  TOOL_NAMES.WINDOW_LEVEL = ToolsEnum.WindowLevel
  TOOL_NAMES.LENGTH = ToolsEnum.Length
  TOOL_NAMES.RECTANGLE_ROI = ToolsEnum.RectangleROI
  TOOL_NAMES.ELLIPTICAL_ROI = ToolsEnum.EllipticalROI
  TOOL_NAMES.CIRCLE_ROI = ToolsEnum.CircleROI
  TOOL_NAMES.BIDIRECTIONAL = ToolsEnum.Bidirectional
  TOOL_NAMES.ANGLE = ToolsEnum.Angle
  TOOL_NAMES.COBB_ANGLE = ToolsEnum.CobbAngle
  TOOL_NAMES.ARROW_ANNOTATE = ToolsEnum.ArrowAnnotate
  TOOL_NAMES.BRUSH = ToolsEnum.Brush
  TOOL_NAMES.RECTANGLE_SCISSOR = ToolsEnum.RectangleScissor
  TOOL_NAMES.CIRCLE_SCISSOR = ToolsEnum.CircleScissor
  TOOL_NAMES.SPHERE_SCISSOR = ToolsEnum.SphereScissor
  TOOL_NAMES.TRACKBALL_ROTATE = ToolsEnum.TrackballRotate
  TOOL_NAMES.CROSSHAIRS = ToolsEnum.Crosshairs
}

// Viewport types (set at runtime)
export const VIEWPORT_TYPES: { STACK: any; ORTHOGRAPHIC: any; VOLUME_3D: any } = {
  // Placeholder values; will be replaced when initializeCoreEnums runs
  STACK: 'STACK',
  ORTHOGRAPHIC: 'ORTHOGRAPHIC',
  VOLUME_3D: 'VOLUME_3D',
}

// Initialize core enums at runtime to avoid static import cycles
export function initializeCoreEnums(enums: any) {
  CoreEnums = enums
  VIEWPORT_TYPES.STACK = enums.ViewportType.STACK
  VIEWPORT_TYPES.ORTHOGRAPHIC = enums.ViewportType.ORTHOGRAPHIC
  VIEWPORT_TYPES.VOLUME_3D = enums.ViewportType.VOLUME_3D
}

// Safe defaults; replaced when initializeToolEnums runs
const ToolsEnumDefaults = {
  Pan: 'Pan',
  Zoom: 'Zoom',
  StackScroll: 'StackScroll',
  WindowLevel: 'WindowLevel',
  Length: 'Length',
  RectangleROI: 'RectangleROI',
  EllipticalROI: 'EllipticalROI',
  CircleROI: 'CircleROI',
  Bidirectional: 'Bidirectional',
  Angle: 'Angle',
  CobbAngle: 'CobbAngle',
  ArrowAnnotate: 'ArrowAnnotate',
  Brush: 'Brush',
  RectangleScissor: 'RectangleScissor',
  CircleScissor: 'CircleScissor',
  SphereScissor: 'SphereScissor',
  TrackballRotate: 'TrackballRotate',
  Crosshairs: 'Crosshairs',
}

// Tool names
export const TOOL_NAMES: Record<string, string> = {
  // Manipulation tools
  PAN: ToolsEnumDefaults.Pan,
  ZOOM: ToolsEnumDefaults.Zoom,
  STACK_SCROLL: ToolsEnumDefaults.StackScroll,
  WINDOW_LEVEL: ToolsEnumDefaults.WindowLevel,
  
  // Annotation tools
  LENGTH: ToolsEnumDefaults.Length,
  RECTANGLE_ROI: ToolsEnumDefaults.RectangleROI,
  ELLIPTICAL_ROI: ToolsEnumDefaults.EllipticalROI,
  CIRCLE_ROI: ToolsEnumDefaults.CircleROI,
  BIDIRECTIONAL: ToolsEnumDefaults.Bidirectional,
  ANGLE: ToolsEnumDefaults.Angle,
  COBB_ANGLE: ToolsEnumDefaults.CobbAngle,
  ARROW_ANNOTATE: ToolsEnumDefaults.ArrowAnnotate,
  
  // Segmentation tools
  BRUSH: ToolsEnumDefaults.Brush,
  RECTANGLE_SCISSOR: ToolsEnumDefaults.RectangleScissor,
  CIRCLE_SCISSOR: ToolsEnumDefaults.CircleScissor,
  SPHERE_SCISSOR: ToolsEnumDefaults.SphereScissor,
  
  // 3D tools
  TRACKBALL_ROTATE: ToolsEnumDefaults.TrackballRotate,
  
  // Crosshairs for MPR
  CROSSHAIRS: ToolsEnumDefaults.Crosshairs,
} as const

// Mouse bindings
export const MOUSE_BINDINGS: { PRIMARY: any; SECONDARY: any; AUXILIARY: any } = {
  PRIMARY: 1,
  SECONDARY: 2,
  AUXILIARY: 3,
}

// Tool modes
export const TOOL_MODES: { ACTIVE: any; PASSIVE: any; ENABLED: any; DISABLED: any } = {
  ACTIVE: 'Active',
  PASSIVE: 'Passive',
  ENABLED: 'Enabled',
  DISABLED: 'Disabled',
}

// Default tool configuration for different viewport types
export const DEFAULT_TOOL_CONFIG = {
  STACK_VIEWPORT: [
    { tool: TOOL_NAMES.PAN, mode: TOOL_MODES.ACTIVE, bindings: [MOUSE_BINDINGS.AUXILIARY] },
    { tool: TOOL_NAMES.ZOOM, mode: TOOL_MODES.ACTIVE, bindings: [MOUSE_BINDINGS.SECONDARY] },
    { tool: TOOL_NAMES.STACK_SCROLL, mode: TOOL_MODES.ACTIVE },
    { tool: TOOL_NAMES.WINDOW_LEVEL, mode: TOOL_MODES.ACTIVE, bindings: [MOUSE_BINDINGS.PRIMARY] },
    { tool: TOOL_NAMES.LENGTH, mode: TOOL_MODES.ENABLED },
    { tool: TOOL_NAMES.RECTANGLE_ROI, mode: TOOL_MODES.ENABLED },
    { tool: TOOL_NAMES.ELLIPTICAL_ROI, mode: TOOL_MODES.ENABLED },
  ],
  
  VOLUME_VIEWPORT: [
    { tool: TOOL_NAMES.PAN, mode: TOOL_MODES.ACTIVE, bindings: [MOUSE_BINDINGS.AUXILIARY] },
    { tool: TOOL_NAMES.ZOOM, mode: TOOL_MODES.ACTIVE, bindings: [MOUSE_BINDINGS.SECONDARY] },
    { tool: TOOL_NAMES.WINDOW_LEVEL, mode: TOOL_MODES.ACTIVE, bindings: [MOUSE_BINDINGS.PRIMARY] },
    { tool: TOOL_NAMES.CROSSHAIRS, mode: TOOL_MODES.ENABLED },
    { tool: TOOL_NAMES.LENGTH, mode: TOOL_MODES.ENABLED },
    { tool: TOOL_NAMES.RECTANGLE_ROI, mode: TOOL_MODES.ENABLED },
  ],
  
  VOLUME_3D_VIEWPORT: [
    { tool: TOOL_NAMES.TRACKBALL_ROTATE, mode: TOOL_MODES.ACTIVE, bindings: [MOUSE_BINDINGS.PRIMARY] },
    { tool: TOOL_NAMES.PAN, mode: TOOL_MODES.ACTIVE, bindings: [MOUSE_BINDINGS.AUXILIARY] },
    { tool: TOOL_NAMES.ZOOM, mode: TOOL_MODES.ACTIVE, bindings: [MOUSE_BINDINGS.SECONDARY] },
  ],
} as const

// Rendering engine configuration
export const RENDERING_ENGINE_ID = 'medical-imaging-rendering-engine'

// Tool group IDs
export const TOOL_GROUP_IDS = {
  STACK: 'stack-tool-group',
  VOLUME: 'volume-tool-group',
  VOLUME_3D: 'volume-3d-tool-group',
} as const

// Viewport IDs
export const VIEWPORT_IDS = {
  AXIAL: 'axial-viewport',
  SAGITTAL: 'sagittal-viewport',
  CORONAL: 'coronal-viewport',
  VOLUME_3D: 'volume-3d-viewport',
  STACK: 'stack-viewport',
} as const

// Volume IDs
export const VOLUME_IDS = {
  CT: 'ct-volume',
  MR: 'mr-volume',
  PT: 'pt-volume',
} as const