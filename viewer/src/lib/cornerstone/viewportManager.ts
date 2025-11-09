/**
 * Viewport management for Cornerstone3D
 */

import {
  RenderingEngine,
  Types,
} from '@cornerstonejs/core'
import { logger } from '@/utils/logger'

export interface ViewportConfig {
  viewportId: string
  type: Enums.ViewportType
  element: HTMLDivElement
  defaultOptions?: Types.PublicViewportInput['defaultOptions']
}

export interface VolumeViewportConfig extends ViewportConfig {
  type: Enums.ViewportType.ORTHOGRAPHIC | Enums.ViewportType.PERSPECTIVE
  orientation?: Enums.OrientationAxis
}

export interface StackViewportConfig extends ViewportConfig {
  type: Enums.ViewportType.STACK
}

export class ViewportManager {
  private renderingEngine: RenderingEngine
  private viewports: Map<string, Types.IViewport> = new Map()
  private renderingEngineId: string

  constructor(renderingEngineId: string = 'medicalImagingRenderingEngine') {
    this.renderingEngineId = renderingEngineId
    this.renderingEngine = new RenderingEngine(renderingEngineId)
  }

  /**
   * Create a stack viewport for 2D image viewing
   */
  async createStackViewport(config: StackViewportConfig): Promise<Types.IStackViewport> {
    try {
      const viewportInput: Types.PublicViewportInput = {
        viewportId: config.viewportId,
        type: config.type,
        element: config.element,
        defaultOptions: {
          background: [0, 0, 0] as Types.Point3,
          orientation: Enums.OrientationAxis.AXIAL,
          ...config.defaultOptions,
        },
      }

      this.renderingEngine.enableElement(viewportInput)
      
      const viewport = this.renderingEngine.getViewport(config.viewportId) as Types.IStackViewport
      this.viewports.set(config.viewportId, viewport)

      logger.debug(`Stack viewport created: ${config.viewportId}`)
      return viewport
    } catch (error) {
      logger.error(`Failed to create stack viewport ${config.viewportId}:`, error)
      throw error
    }
  }

  /**
   * Create a volume viewport for 3D/MPR viewing
   */
  async createVolumeViewport(config: VolumeViewportConfig): Promise<Types.IVolumeViewport> {
    try {
      const viewportInput: Types.PublicViewportInput = {
        viewportId: config.viewportId,
        type: config.type,
        element: config.element,
        defaultOptions: {
          background: [0, 0, 0] as Types.Point3,
          orientation: config.orientation || Enums.OrientationAxis.AXIAL,
          ...config.defaultOptions,
        },
      }

      this.renderingEngine.enableElement(viewportInput)
      
      const viewport = this.renderingEngine.getViewport(config.viewportId) as Types.IVolumeViewport
      this.viewports.set(config.viewportId, viewport)

      logger.debug(`Volume viewport created: ${config.viewportId}`)
      return viewport
    } catch (error) {
      logger.error(`Failed to create volume viewport ${config.viewportId}:`, error)
      throw error
    }
  }

  /**
   * Get an existing viewport by ID
   */
  getViewport(viewportId: string): Types.IViewport | undefined {
    return this.viewports.get(viewportId)
  }

  /**
   * Get all viewports
   */
  getAllViewports(): Map<string, Types.IViewport> {
    return new Map(this.viewports)
  }

  /**
   * Remove a viewport
   */
  removeViewport(viewportId: string): void {
    try {
      this.renderingEngine.disableElement(viewportId)
      this.viewports.delete(viewportId)
      logger.debug(`Viewport removed: ${viewportId}`)
    } catch (error) {
      logger.error(`Failed to remove viewport ${viewportId}:`, error)
    }
  }

  /**
   * Resize a viewport
   */
  resizeViewport(viewportId: string): void {
    try {
      const viewport = this.getViewport(viewportId)
      if (viewport) {
        // @ts-ignore - resize method may not be in type definitions
        if (viewport.resize) {
          viewport.resize()
        }
        logger.debug(`Viewport resized: ${viewportId}`)
      }
    } catch (error) {
      logger.error(`Failed to resize viewport ${viewportId}:`, error)
    }
  }

  /**
   * Resize all viewports
   */
  resizeAllViewports(): void {
    this.viewports.forEach((viewport, viewportId) => {
      try {
        // @ts-ignore - resize method may not be in type definitions
        if (viewport.resize) {
          viewport.resize()
        }
      } catch (error) {
        logger.error(`Failed to resize viewport ${viewportId}:`, error)
      }
    })
  }

  /**
   * Render a specific viewport
   */
  renderViewport(viewportId: string): void {
    try {
      const viewport = this.getViewport(viewportId)
      if (viewport) {
        viewport.render()
      }
    } catch (error) {
      logger.error(`Failed to render viewport ${viewportId}:`, error)
    }
  }

  /**
   * Render all viewports
   */
  renderAllViewports(): void {
    try {
      this.renderingEngine.renderViewports(Array.from(this.viewports.keys()))
    } catch (error) {
      logger.error('Failed to render all viewports:', error)
    }
  }

  /**
   * Reset a viewport to its default state
   */
  resetViewport(viewportId: string): void {
    try {
      const viewport = this.getViewport(viewportId)
      if (viewport) {
        viewport.resetCamera()
        // @ts-ignore - resetProperties may not be in type definitions
        if (viewport.resetProperties) {
          viewport.resetProperties()
        }
        viewport.render()
        logger.debug(`Viewport reset: ${viewportId}`)
      }
    } catch (error) {
      logger.error(`Failed to reset viewport ${viewportId}:`, error)
    }
  }

  /**
   * Set viewport properties (window/level, zoom, pan, etc.)
   */
  setViewportProperties(
    viewportId: string, 
    properties: Partial<Types.ViewportProperties>
  ): void {
    try {
      const viewport = this.getViewport(viewportId)
      if (viewport) {
        // @ts-ignore - setProperties may not be in type definitions
        if (viewport.setProperties) {
          viewport.setProperties(properties)
        }
        viewport.render()
        logger.debug(`Viewport properties updated: ${viewportId}`)
      }
    } catch (error) {
      logger.error(`Failed to set viewport properties ${viewportId}:`, error)
    }
  }

  /**
   * Get viewport properties
   */
  getViewportProperties(viewportId: string): Types.ViewportProperties | undefined {
    try {
      const viewport = this.getViewport(viewportId)
      // @ts-ignore - getProperties may not be in type definitions
      return viewport?.getProperties ? viewport.getProperties() : undefined
    } catch (error) {
      logger.error(`Failed to get viewport properties ${viewportId}:`, error)
      return undefined
    }
  }

  /**
   * Destroy the viewport manager and clean up resources
   */
  destroy(): void {
    try {
      // Remove all viewports
      Array.from(this.viewports.keys()).forEach(viewportId => {
        this.removeViewport(viewportId)
      })

      // Destroy the rendering engine
      destroyRenderingEngine(this.renderingEngineId)
      
      this.viewports.clear()
      logger.debug('ViewportManager destroyed')
    } catch (error) {
      logger.error('Failed to destroy ViewportManager:', error)
    }
  }

  /**
   * Get the rendering engine instance
   */
  getRenderingEngine(): RenderingEngine {
    return this.renderingEngine
  }

  /**
   * Check if a viewport exists
   */
  hasViewport(viewportId: string): boolean {
    return this.viewports.has(viewportId)
  }

  /**
   * Get viewport count
   */
  getViewportCount(): number {
    return this.viewports.size
  }
}

// Global viewport manager instance
let globalViewportManager: ViewportManager | null = null

export function getGlobalViewportManager(): ViewportManager {
  if (!globalViewportManager) {
    globalViewportManager = new ViewportManager()
  }
  return globalViewportManager
}

export function destroyGlobalViewportManager(): void {
  if (globalViewportManager) {
    globalViewportManager.destroy()
    globalViewportManager = null
  }
}