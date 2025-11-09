// Cornerstone core is accessed via runtime-loaded module on window.__csCore
// to avoid static imports that can trigger TDZ errors in production builds.
// Tools are loaded dynamically to avoid build-time initialization issues
import { getToolsModule } from './toolsLoader'
import {
  RENDERING_ENGINE_ID,
  TOOL_GROUP_IDS,
  DEFAULT_TOOL_CONFIG,
  VIEWPORT_TYPES,
} from './config'

// Import tools
// Do not statically import individual tools; access via dynamic module

/**
 * Add all required tools to Cornerstone3D
 */
export async function addTools(): Promise<void> {
  const tools = await getToolsModule()
  const { addTool } = tools
  // Manipulation tools
  addTool(tools.PanTool)
  addTool(tools.ZoomTool)
  addTool(tools.StackScrollMouseWheelTool)
  addTool(tools.WindowLevelTool)

  // Annotation tools
  addTool(tools.LengthTool)
  addTool(tools.RectangleROITool)
  addTool(tools.EllipticalROITool)
  addTool(tools.CircleROITool)
  addTool(tools.BidirectionalTool)
  addTool(tools.AngleTool)
  addTool(tools.CobbAngleTool)
  addTool(tools.ArrowAnnotateTool)

  // 3D tools
  addTool(tools.TrackballRotateTool)

  // MPR tools
  addTool(tools.CrosshairsTool)
}

/**
 * Create or get the rendering engine
 */
export function getRenderingEngineInstance(): any {
  const core = (window as any).__csCore
  if (!core) {
    throw new Error('Cornerstone core not initialized')
  }
  let renderingEngine = core.getRenderingEngine(RENDERING_ENGINE_ID)
  if (!renderingEngine) {
    const RenderingEngine = core.RenderingEngine
    renderingEngine = new RenderingEngine(RENDERING_ENGINE_ID)
  }
  return renderingEngine as any
}

/**
 * Create a tool group with default tools
 */
export function createToolGroup(
  toolGroupId: string,
  viewportType: 'STACK_VIEWPORT' | 'VOLUME_VIEWPORT' | 'VOLUME_3D_VIEWPORT'
): any {
  // Remove existing tool group if it exists
  const existingToolGroup = (window as any).__csTools?.ToolGroupManager?.getToolGroup?.(toolGroupId) || null
  if (existingToolGroup) {
    // @ts-ignore - destroy method may not be in type definitions
    if (existingToolGroup.destroy) {
      existingToolGroup.destroy()
    }
  }
  
  // Access via dynamic module
  const toolGroupManager = (window as any).__csTools?.ToolGroupManager
  let toolGroup: any = null
  if (toolGroupManager?.createToolGroup) {
    toolGroup = toolGroupManager.createToolGroup(toolGroupId)
  } else {
    // Fallback: load module directly
    // Note: synchronous access is not possible; caller should ensure tools init
  }
  
  if (!toolGroup) {
    throw new Error(`Failed to create tool group: ${toolGroupId}`)
  }
  
  // Add tools based on viewport type
  const toolConfig = DEFAULT_TOOL_CONFIG[viewportType]
  
  toolConfig.forEach((config: any) => {
    const { tool, mode, bindings } = config
    toolGroup.addTool(tool)
    
    if (bindings) {
      toolGroup.setToolActive(tool, {
        bindings: bindings.map((binding: any) => ({ mouseButton: binding })),
      })
    } else {
      toolGroup.setToolMode(tool, mode)
    }
  })
  
  return toolGroup
}

/**
 * Create a viewport specification
 */
export function createViewportSpec(
  viewportId: string,
  type: any,
  element: HTMLDivElement,
  orientation?: any
): any {
  const spec: any = {
    viewportId,
    type,
    element,
  }
  
  if (orientation && type === VIEWPORT_TYPES.ORTHOGRAPHIC) {
    spec.defaultOptions = {
      orientation,
    }
  }
  
  return spec
}

/**
 * Load and cache a volume
 */
export async function loadVolume(
  volumeId: string,
  imageIds: string[]
): Promise<any> {
  const core = (window as any).__csCore
  if (!core) {
    throw new Error('Cornerstone core not initialized')
  }
  // Check if volume is already cached
  let volume: any | undefined = core.cache.getVolume(volumeId) as any | undefined
  if (!volume) {
    // Create volume
    volume = await core.volumeLoader.createAndCacheVolume(volumeId, {
      imageIds,
    }) as any
    // Ensure the volume actually loads its image data before returning
    await (volume as any).load?.()
  } else {
    // If cached, make sure it has been loaded
    if ((volume as any).load && !(volume as any).isLoaded) {
      await (volume as any).load()
    }
  }
  if (!volume) {
    throw new Error(`Failed to load volume: ${volumeId}`)
  }
  return volume
}

/**
 * Set viewport data for stack viewport
 */
export async function setStackViewportData(
  renderingEngine: any,
  viewportId: string,
  imageIds: string[],
  currentImageIdIndex = 0
): Promise<void> {
  const viewport = renderingEngine.getViewport(viewportId) as any
  
  await viewport.setStack(imageIds, currentImageIdIndex)
  viewport.render()
}

/**
 * Set viewport data for volume viewport
 */
export async function setVolumeViewportData(
  renderingEngine: any,
  viewportId: string,
  volume: any,
  orientation?: any
): Promise<void> {
  const viewport = renderingEngine.getViewport(viewportId) as any
  
  await viewport.setVolumes([
    {
      volumeId: volume.volumeId,
      callback: ({ volumeActor }) => {
        // Set initial window/level if available
        const metadata = volume.metadata as any
        if (metadata?.WindowCenter && metadata?.WindowWidth) {
          const windowCenter = Array.isArray(metadata.WindowCenter)
            ? metadata.WindowCenter[0]
            : metadata.WindowCenter
          const windowWidth = Array.isArray(metadata.WindowWidth)
            ? metadata.WindowWidth[0]
            : metadata.WindowWidth
            
          volumeActor.getProperty().setRGBTransferFunction(0, windowCenter - windowWidth / 2, windowCenter + windowWidth / 2)
        }
      },
    },
  ])
  
  if (orientation) {
    viewport.setOrientation(orientation)
  }
  
  viewport.render()
}

/**
 * Clean up resources
 */
export function cleanup(): void {
  // Destroy all tool groups
  Object.values(TOOL_GROUP_IDS).forEach(toolGroupId => {
    const toolGroup = (window as any).__csTools?.ToolGroupManager?.getToolGroup?.(toolGroupId) || null
    if (toolGroup) {
      // @ts-ignore - destroy method may not be in type definitions
      if (toolGroup.destroy) {
        toolGroup.destroy()
      }
    }
  })
  
  // Destroy rendering engine
  const renderingEngine = getRenderingEngine(RENDERING_ENGINE_ID)
  if (renderingEngine) {
    renderingEngine.destroy()
  }
  
  // Clear cache
  cache.purgeCache()
}

/**
 * Generate DICOM image IDs from a study
 */
export function generateImageIds(
  studyInstanceUID: string,
  seriesInstanceUID: string,
  sopInstanceUIDs: string[],
  baseUrl = '/api/dicom'
): string[] {
  // Resolve base URL to absolute if needed to avoid preview server proxy issues
  const resolveDicomBaseUrl = (url: string) => {
    try {
      const trimmedUrl = (url || '').trim()
      if (/^https?:\/\//i.test(trimmedUrl)) {
        return trimmedUrl
      }
      const envApi = (import.meta as any)?.env?.VITE_API_URL || (import.meta as any)?.env?.VITE_BACKEND_URL || ''
      if (envApi) {
        const api = String(envApi).replace(/\/$/, '')
        const path = trimmedUrl.startsWith('/') ? trimmedUrl.slice(1) : trimmedUrl
        return `${api}/${path}`
      }
      return trimmedUrl || '/api/dicom'
    } catch {
      return url
    }
  }

  const absoluteBase = resolveDicomBaseUrl(baseUrl)

  return sopInstanceUIDs.map(sopInstanceUID =>
    `wadouri:${absoluteBase}/studies/${studyInstanceUID}/series/${seriesInstanceUID}/instances/${sopInstanceUID}`
  )
}

/**
 * Get viewport element by ID
 */
export function getViewportElement(viewportId: string): HTMLDivElement | null {
  return document.getElementById(viewportId) as HTMLDivElement | null
}