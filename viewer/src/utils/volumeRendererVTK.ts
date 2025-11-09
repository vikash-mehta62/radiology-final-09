/**
 * @fileoverview VTK.js-based 3D Volume Renderer
 * 
 * This module provides GPU-accelerated volume rendering using VTK.js (Visualization Toolkit for JavaScript).
 * It offers 10-100x performance improvement over canvas-based CPU rendering by leveraging WebGL for
 * hardware-accelerated ray casting.
 * 
 * **Key Features:**
 * - GPU-accelerated volume rendering (30-60 FPS)
 * - Multiple render modes (MIP, Volume, Isosurface)
 * - Transfer function mapping for tissue visualization
 * - Interactive camera controls (rotate, zoom, pan)
 * - Adaptive quality during interaction
 * - Auto-rotation capability
 * - WebGL context loss recovery
 * - Comprehensive error handling
 * 
 * **VTK.js Concepts:**
 * 
 * VTK.js is a JavaScript port of the Visualization Toolkit (VTK), a powerful 3D graphics library.
 * It uses WebGL to render 3D data directly on the GPU, providing significant performance improvements
 * over CPU-based rendering.
 * 
 * Core VTK.js components used in this renderer:
 * 
 * 1. **vtkImageData**: Represents 3D volume data as a regular grid of voxels (3D pixels).
 *    Each voxel has a scalar value (e.g., Hounsfield units in CT scans).
 * 
 * 2. **vtkVolumeMapper**: Performs ray casting through the volume. For each pixel on screen,
 *    it casts a ray through the volume and samples voxel values along the ray.
 * 
 * 3. **vtkVolume**: The actor that represents the volume in the scene. It combines the mapper
 *    with visual properties (transfer functions, shading).
 * 
 * 4. **vtkPiecewiseFunction**: Maps scalar values to opacity. Used to make certain tissue types
 *    more or less transparent.
 * 
 * 5. **vtkColorTransferFunction**: Maps scalar values to RGB colors. Used to colorize different
 *    tissue types (e.g., bone = white, soft tissue = red).
 * 
 * 6. **vtkRenderWindow**: Manages the WebGL context and rendering pipeline.
 * 
 * 7. **vtkRenderer**: Contains the scene (volumes, lights, camera) and performs rendering.
 * 
 * 8. **vtkCamera**: Controls the viewpoint (position, orientation, zoom).
 * 
 * **Rendering Pipeline:**
 * ```
 * Volume Data (Float32Array)
 *     ↓
 * vtkImageData (3D texture on GPU)
 *     ↓
 * vtkVolumeMapper (ray casting)
 *     ↓
 * Transfer Functions (opacity + color mapping)
 *     ↓
 * vtkVolume (actor with properties)
 *     ↓
 * vtkRenderer (scene with camera)
 *     ↓
 * vtkRenderWindow (WebGL context)
 *     ↓
 * Screen (final image)
 * ```
 * 
 * **Usage Example:**
 * ```typescript
 * // Create renderer
 * const container = document.getElementById('viewer-3d');
 * const renderer = new VTKVolumeRenderer(container);
 * 
 * // Load volume data
 * const volumeData = {
 *   data: new Float32Array(512 * 512 * 100), // 100 slices of 512x512
 *   dimensions: { width: 512, height: 512, depth: 100 },
 *   spacing: { x: 1.0, y: 1.0, z: 1.0 } // 1mm voxel spacing
 * };
 * 
 * await renderer.loadVolume(volumeData, (progress) => {
 *   console.log(`Loading: ${(progress * 100).toFixed(0)}%`);
 * });
 * 
 * // Set render mode
 * renderer.setRenderMode('volume'); // or 'mip' or 'isosurface'
 * 
 * // Apply transfer function (e.g., CT-Bone preset)
 * const transferFunction = {
 *   opacityPoints: [
 *     { value: 0.0, opacity: 0.0 },
 *     { value: 0.5, opacity: 0.0 },
 *     { value: 0.7, opacity: 0.5 },
 *     { value: 1.0, opacity: 1.0 }
 *   ],
 *   colorPoints: [
 *     { value: 0.0, r: 0, g: 0, b: 0 },
 *     { value: 1.0, r: 1, g: 1, b: 1 }
 *   ]
 * };
 * renderer.setTransferFunction(transferFunction, 0, 4095);
 * 
 * // Set quality
 * renderer.setQuality('high'); // or 'medium' or 'low'
 * 
 * // Enable performance monitoring
 * renderer.setPerformanceCallback((metrics) => {
 *   console.log(`FPS: ${metrics.fps}, GPU Memory: ${metrics.gpuMemoryMB.toFixed(2)} MB`);
 * });
 * 
 * // Start auto-rotation
 * renderer.startAutoRotation(1.0); // 1 degree per frame
 * 
 * // Clean up when done
 * renderer.dispose();
 * ```
 * 
 * @module volumeRendererVTK
 * @requires @kitware/vtk.js
 * @see {@link https://kitware.github.io/vtk-js/|VTK.js Documentation}
 * @see {@link https://kitware.github.io/vtk-js/examples/|VTK.js Examples}
 */

import '@kitware/vtk.js/Rendering/Profiles/Volume'
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow'
import vtkVolume from '@kitware/vtk.js/Rendering/Core/Volume'
import vtkVolumeMapper from '@kitware/vtk.js/Rendering/Core/VolumeMapper'
import vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData'
import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray'
import vtkPiecewiseFunction from '@kitware/vtk.js/Common/DataModel/PiecewiseFunction'
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction'
import vtkInteractorStyleTrackballCamera from '@kitware/vtk.js/Interaction/Style/InteractorStyleTrackballCamera'

// Import types from existing renderer for compatibility
import type { VolumeData, TransferFunction } from './volumeRenderer'

/**
 * Quality levels for rendering
 * 
 * Controls the tradeoff between visual quality and rendering performance:
 * - **low**: Fast rendering (60 FPS target), larger sample distance, fewer samples per ray
 * - **medium**: Balanced (30-45 FPS target), moderate sample distance and samples
 * - **high**: Best quality (15-30 FPS target), small sample distance, many samples per ray
 * 
 * @typedef {('low'|'medium'|'high')} QualityLevel
 */
export type QualityLevel = 'low' | 'medium' | 'high'

/**
 * Render modes supported by VTK.js
 * 
 * Different visualization techniques for volume data:
 * 
 * - **mip** (Maximum Intensity Projection): Shows the maximum voxel value along each ray.
 *   Useful for visualizing high-density structures like bones or contrast-enhanced vessels.
 *   Fast rendering, no depth perception.
 * 
 * - **volume**: Composite blending using transfer functions. Accumulates color and opacity
 *   along each ray based on transfer function mapping. Provides depth perception and
 *   allows visualization of multiple tissue types simultaneously. Most versatile mode.
 * 
 * - **isosurface**: Extracts and renders surfaces at specific scalar values. Useful for
 *   visualizing boundaries between tissue types (e.g., skin surface, bone surface).
 *   Implemented using a sharp transfer function in VTK.js.
 * 
 * @typedef {('mip'|'volume'|'isosurface')} RenderMode
 */
export type RenderMode = 'mip' | 'volume' | 'isosurface'

/**
 * Performance metrics for monitoring rendering performance
 * 
 * @interface PerformanceMetrics
 * @property {number} fps - Frames per second (rolling average over last second)
 * @property {number} renderTime - Time to render last frame in milliseconds
 * @property {number} gpuMemoryMB - Estimated GPU memory usage in megabytes
 */
export interface PerformanceMetrics {
    /** Frames per second (rolling average over last second) */
    fps: number
    /** Time to render last frame in milliseconds */
    renderTime: number
    /** Estimated GPU memory usage in megabytes */
    gpuMemoryMB: number
}

/**
 * Callback function for receiving performance metrics updates
 * 
 * Called periodically (every 500ms) with current performance metrics.
 * Use this to display FPS, render time, and memory usage in the UI.
 * 
 * @callback PerformanceCallback
 * @param {PerformanceMetrics} metrics - Current performance metrics
 * 
 * @example
 * renderer.setPerformanceCallback((metrics) => {
 *   console.log(`FPS: ${metrics.fps}`);
 *   console.log(`Render Time: ${metrics.renderTime.toFixed(2)}ms`);
 *   console.log(`GPU Memory: ${metrics.gpuMemoryMB.toFixed(2)}MB`);
 * });
 */
export type PerformanceCallback = (metrics: PerformanceMetrics) => void

/**
 * Performance warning types
 * 
 * @typedef {('low-fps'|'large-volume'|'high-memory'|'slow-gpu')} PerformanceWarningType
 */
export type PerformanceWarningType = 'low-fps' | 'large-volume' | 'high-memory' | 'slow-gpu'

/**
 * Performance warning information
 * 
 * @interface PerformanceWarning
 * @property {PerformanceWarningType} type - Type of warning
 * @property {string} message - Human-readable warning message
 * @property {string} suggestion - Suggested action to improve performance
 * @property {any} data - Additional data about the warning
 */
export interface PerformanceWarning {
    /** Type of warning */
    type: PerformanceWarningType
    /** Human-readable warning message */
    message: string
    /** Suggested action to improve performance */
    suggestion: string
    /** Additional data about the warning */
    data?: any
}

/**
 * Callback function for receiving performance warnings
 * 
 * @callback PerformanceWarningCallback
 * @param {PerformanceWarning} warning - Performance warning information
 * 
 * @example
 * renderer.setPerformanceWarningCallback((warning) => {
 *   console.warn(`⚠️ ${warning.message}`);
 *   console.log(`💡 ${warning.suggestion}`);
 * });
 */
export type PerformanceWarningCallback = (warning: PerformanceWarning) => void

/**
 * VTK.js Volume Renderer Class
 * 
 * Main class for GPU-accelerated 3D volume rendering using VTK.js and WebGL.
 * 
 * **Features:**
 * - GPU-accelerated rendering (30-60 FPS for typical medical volumes)
 * - Multiple render modes (MIP, Volume, Isosurface)
 * - Transfer function mapping for tissue visualization
 * - Interactive camera controls (rotate, zoom, pan)
 * - Adaptive quality during interaction (reduces quality for smooth interaction)
 * - Auto-rotation capability
 * - Performance monitoring (FPS, render time, GPU memory)
 * - WebGL context loss recovery
 * - Comprehensive error handling with fallback support
 * 
 * **Architecture:**
 * 
 * The renderer manages a VTK.js rendering pipeline:
 * 1. Volume data is uploaded to GPU as a 3D texture (vtkImageData)
 * 2. A volume mapper (vtkVolumeMapper) performs ray casting through the volume
 * 3. Transfer functions map scalar values to colors and opacity
 * 4. The volume actor (vtkVolume) is added to the scene
 * 5. A camera controls the viewpoint
 * 6. The render window manages the WebGL context and rendering
 * 
 * **Resource Management:**
 * 
 * The renderer tracks all VTK.js objects and WebGL resources for proper cleanup.
 * Always call `dispose()` when done to prevent memory leaks.
 * 
 * **Performance Considerations:**
 * 
 * - Use lower quality settings for larger volumes
 * - Adaptive quality automatically reduces quality during interaction
 * - Monitor GPU memory usage to avoid exhausting GPU resources
 * - Consider progressive loading for very large volumes
 * 
 * @class VTKVolumeRenderer
 * 
 * @example
 * // Basic usage
 * const container = document.getElementById('viewer-3d');
 * const renderer = new VTKVolumeRenderer(container);
 * 
 * // Load volume
 * await renderer.loadVolume({
 *   data: volumeData,
 *   dimensions: { width: 512, height: 512, depth: 100 },
 *   spacing: { x: 1.0, y: 1.0, z: 1.0 }
 * });
 * 
 * // Configure rendering
 * renderer.setRenderMode('volume');
 * renderer.setQuality('high');
 * 
 * // Clean up
 * renderer.dispose();
 * 
 * @example
 * // With performance monitoring
 * const renderer = new VTKVolumeRenderer(container);
 * 
 * renderer.setPerformanceCallback((metrics) => {
 *   if (metrics.fps < 15) {
 *     console.warn('Low FPS detected, consider reducing quality');
 *     renderer.setQuality('low');
 *   }
 * });
 * 
 * @example
 * // With auto-rotation
 * const renderer = new VTKVolumeRenderer(container);
 * await renderer.loadVolume(volumeData);
 * 
 * // Start rotating at 1 degree per frame
 * renderer.startAutoRotation(1.0);
 * 
 * // Stop rotation later
 * setTimeout(() => renderer.stopAutoRotation(), 5000);
 * 
 * @example
 * // With context loss handling
 * const renderer = new VTKVolumeRenderer(container);
 * 
 * renderer.setContextLostCallback((lost) => {
 *   if (lost) {
 *     console.error('WebGL context lost! Attempting recovery...');
 *   } else {
 *     console.log('WebGL context restored!');
 *   }
 * });
 */
export class VTKVolumeRenderer {
    private container: HTMLElement
    private fullScreenRenderer: any
    private renderer: any
    private renderWindow: any
    private volume: any
    private volumeMapper: any
    private imageData: any
    private camera: any
    private interactor: any
    
    // State tracking
    private currentRenderMode: RenderMode = 'volume'
    private currentQuality: QualityLevel = 'medium'
    private isInitialized = false
    private resources: any[] = []
    
    // Performance monitoring
    private frameTimestamps: number[] = []
    private lastFrameTime: number = 0
    private currentFPS: number = 0
    private lastRenderTime: number = 0
    private performanceCallback?: PerformanceCallback
    private fpsUpdateInterval: number = 500 // Update FPS every 500ms
    private lastFPSUpdate: number = 0
    private volumeMemoryMB: number = 0
    
    // Mouse interaction
    private interactorStyle: any
    private isInteractionEnabled: boolean = true
    
    // Adaptive quality during interaction
    private isInteracting: boolean = false
    private savedQuality?: QualityLevel
    private interactionQuality: QualityLevel = 'low'
    private restoreQualityTimeout?: number
    private restoreQualityDelay: number = 300 // ms delay before restoring quality (reduced from 500ms for faster response)
    
    // Auto-rotation
    private autoRotationEnabled: boolean = false
    private autoRotationSpeed: number = 1.0 // degrees per frame
    private autoRotationAnimationId?: number
    
    // WebGL context loss handling
    private contextLostHandler?: (event: Event) => void
    private contextRestoredHandler?: (event: Event) => void
    private isContextLost: boolean = false
    private lastVolumeData?: VolumeData
    private contextLostCallback?: (lost: boolean) => void
    
    // Performance warnings
    private performanceWarningCallback?: (warning: PerformanceWarning) => void
    private lowFPSWarningShown: boolean = false
    private largeVolumeWarningShown: boolean = false
    private lastWarningTime: number = 0
    private warningCooldown: number = 10000 // 10 seconds between warnings
    
    /**
     * Create a new VTK.js volume renderer
     * 
     * Initializes the VTK.js rendering pipeline:
     * 1. Creates a full-screen render window with WebGL context
     * 2. Sets up the renderer and camera
     * 3. Configures mouse interaction (trackball camera style)
     * 4. Sets up WebGL context loss handling
     * 5. Initializes performance monitoring
     * 
     * **WebGL Requirements:**
     * - WebGL 1.0 or 2.0 support required
     * - 3D texture support required for volume rendering
     * - Sufficient GPU memory for volume data
     * 
     * @param {HTMLElement} container - HTML element to render into. Must be a valid HTMLElement
     *                                   with non-zero dimensions. The renderer will create a
     *                                   canvas element inside this container.
     * 
     * @throws {Error} If container is null or not an HTMLElement
     * @throws {Error} If WebGL context creation fails
     * @throws {Error} If VTK.js initialization fails
     * 
     * @example
     * // Create renderer in a div
     * const container = document.getElementById('viewer-3d');
     * const renderer = new VTKVolumeRenderer(container);
     * 
     * @example
     * // With error handling
     * try {
     *   const renderer = new VTKVolumeRenderer(container);
     *   console.log('Renderer initialized successfully');
     * } catch (error) {
     *   console.error('Failed to initialize renderer:', error);
     *   // Fall back to canvas renderer
     * }
     */
    constructor(container: HTMLElement) {
        this.container = container
        this.initializeRenderer()
    }
    
    /**
     * Initialize VTK.js render window and renderer
     * Sets up WebGL context and rendering pipeline
     * 
     * @throws {Error} If WebGL context creation fails
     * @throws {Error} If VTK.js initialization fails
     */
    private initializeRenderer(): void {
        try {
            console.log('🎨 Initializing VTK.js renderer...')
            
            // Validate container element
            if (!this.container) {
                throw new Error('Container element is null or undefined')
            }
            
            if (!(this.container instanceof HTMLElement)) {
                throw new Error('Container must be an HTMLElement')
            }
            
            // Create full screen render window
            this.fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
                container: this.container,
                background: [0, 0, 0, 1] // Black background
            })
            
            if (!this.fullScreenRenderer) {
                throw new Error('Failed to create VTK.js full screen renderer')
            }
            
            // Get renderer and render window
            this.renderer = this.fullScreenRenderer.getRenderer()
            this.renderWindow = this.fullScreenRenderer.getRenderWindow()
            
            if (!this.renderer) {
                throw new Error('Failed to get VTK.js renderer')
            }
            
            if (!this.renderWindow) {
                throw new Error('Failed to get VTK.js render window')
            }
            
            // Verify WebGL context was created
            const context = this.getContext()
            if (!context) {
                throw new Error('WebGL context creation failed. Your browser may not support WebGL or it may be disabled.')
            }
            
            // Check WebGL version
            const isWebGL2 = context instanceof WebGL2RenderingContext
            console.log(`  ℹ️ WebGL version: ${isWebGL2 ? '2.0' : '1.0'}`)
            
            // Get camera
            this.camera = this.renderer.getActiveCamera()
            if (!this.camera) {
                throw new Error('Failed to get VTK.js camera')
            }
            
            // Get interactor for mouse controls
            this.interactor = this.renderWindow.getInteractor()
            if (!this.interactor) {
                throw new Error('Failed to get VTK.js interactor')
            }
            
            // Set up mouse interaction style
            this.setupMouseInteraction()
            
            // Set up WebGL context loss handling
            this.setupContextLossHandling()
            
            // Track resources for cleanup
            this.resources.push(this.fullScreenRenderer)
            
            this.isInitialized = true
            console.log('✅ VTK.js renderer initialized successfully')
            
        } catch (error) {
            console.error('❌ Failed to initialize VTK.js renderer:', error)
            
            // Clean up any partially created resources
            this.cleanupPartialInitialization()
            
            // Provide clear error message for upstream handling
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            throw new Error(`WebGL initialization failed: ${errorMessage}. Please ensure your browser supports WebGL and it is enabled.`)
        }
    }
    
    /**
     * Clean up resources if initialization fails partway through
     * Prevents memory leaks from partial initialization
     */
    private cleanupPartialInitialization(): void {
        try {
            if (this.fullScreenRenderer) {
                this.fullScreenRenderer.delete()
                this.fullScreenRenderer = null
            }
            
            this.renderer = null
            this.renderWindow = null
            this.camera = null
            this.interactor = null
            this.interactorStyle = null
            this.resources = []
            this.isInitialized = false
            
            console.log('  🧹 Cleaned up partial initialization')
        } catch (cleanupError) {
            console.warn('  ⚠️ Error during partial cleanup:', cleanupError)
        }
    }
    
    /**
     * Check if renderer is initialized
     */
    public isReady(): boolean {
        return this.isInitialized
    }
    
    /**
     * Get the WebGL rendering context
     */
    public getContext(): WebGLRenderingContext | null {
        if (!this.renderWindow) return null
        
        try {
            const openGLRenderWindow = this.renderWindow.getViews()[0]
            return openGLRenderWindow?.getContext() || null
        } catch (error) {
            console.error('Failed to get WebGL context:', error)
            return null
        }
    }
    
    /**
     * Set up mouse interaction with trackball camera style
     * Enables:
     * - Left mouse drag: Rotate camera
     * - Right mouse drag: Pan camera
     * - Middle mouse drag: Roll camera
     * - Mouse wheel: Zoom camera
     */
    private setupMouseInteraction(): void {
        if (!this.interactor) {
            console.warn('Interactor not available')
            return
        }
        
        try {
            console.log('🖱️ Setting up mouse interaction...')
            
            // Create trackball camera interaction style
            // @ts-ignore - VTK.js types may not be complete
            this.interactorStyle = vtkInteractorStyleTrackballCamera.newInstance()
            this.resources.push(this.interactorStyle)
            
            // Set the interaction style on the interactor
            this.interactor.setInteractorStyle(this.interactorStyle)
            
            // Initialize the interactor (binds event listeners)
            this.interactor.initialize()
            
            // Bind events to trigger renders
            this.interactor.bindEvents(this.container)
            
            // Set up adaptive quality listeners
            this.setupAdaptiveQuality()
            
            console.log('✅ Mouse interaction enabled')
            console.log('   - Left drag: Rotate')
            console.log('   - Right drag: Pan')
            console.log('   - Mouse wheel: Zoom')
            
        } catch (error) {
            console.error('❌ Failed to setup mouse interaction:', error)
        }
    }
    
    /**
     * Set up adaptive quality during interaction
     * Reduces quality during interaction for smoother performance
     * Restores quality after interaction ends
     */
    private setupAdaptiveQuality(): void {
        if (!this.interactor) {
            console.warn('Interactor not available for adaptive quality')
            return
        }
        
        try {
            console.log('⚡ Setting up adaptive quality...')
            
            // Listen for interaction start events
            this.interactor.onStartInteractionEvent(() => {
                this.onInteractionStart()
            })
            
            // Listen for interaction end events
            this.interactor.onEndInteractionEvent(() => {
                this.onInteractionEnd()
            })
            
            console.log('✅ Adaptive quality enabled')
            console.log(`   - Interaction quality: ${this.interactionQuality}`)
            console.log(`   - Restore delay: ${this.restoreQualityDelay}ms`)
            
        } catch (error) {
            console.error('❌ Failed to setup adaptive quality:', error)
        }
    }
    
    /**
     * Set up WebGL context loss and restoration handling
     * Listens for webglcontextlost and webglcontextrestored events
     */
    private setupContextLossHandling(): void {
        const context = this.getContext()
        if (!context) {
            console.warn('Cannot setup context loss handling - no WebGL context')
            return
        }
        
        const canvas = context.canvas
        if (!canvas) {
            console.warn('Cannot setup context loss handling - no canvas element')
            return
        }
        
        try {
            console.log('🛡️ Setting up WebGL context loss handling...')
            
            // Handle context lost
            this.contextLostHandler = (event: Event) => {
                event.preventDefault() // Prevent default behavior
                this.onContextLost()
            }
            
            // Handle context restored
            this.contextRestoredHandler = (event: Event) => {
                this.onContextRestored()
            }
            
            // Add event listeners
            canvas.addEventListener('webglcontextlost', this.contextLostHandler, false)
            canvas.addEventListener('webglcontextrestored', this.contextRestoredHandler, false)
            
            console.log('✅ WebGL context loss handling enabled')
            
        } catch (error) {
            console.error('❌ Failed to setup context loss handling:', error)
        }
    }
    
    /**
     * Handle WebGL context lost event
     * Called when the browser loses the WebGL context
     */
    private onContextLost(): void {
        console.error('⚠️ WebGL context lost!')
        this.isContextLost = true
        
        // Stop auto-rotation if active
        if (this.autoRotationEnabled) {
            this.stopAutoRotation()
        }
        
        // Clear any pending timeouts
        if (this.restoreQualityTimeout) {
            clearTimeout(this.restoreQualityTimeout)
            this.restoreQualityTimeout = undefined
        }
        
        // Notify callback if set
        if (this.contextLostCallback) {
            this.contextLostCallback(true)
        }
        
        console.log('  ℹ️ Attempting to restore WebGL context...')
    }
    
    /**
     * Handle WebGL context restored event
     * Called when the browser restores the WebGL context
     * Attempts to reload the volume if one was loaded
     */
    private async onContextRestored(): Promise<void> {
        console.log('✅ WebGL context restored!')
        this.isContextLost = false
        
        // Notify callback if set
        if (this.contextLostCallback) {
            this.contextLostCallback(false)
        }
        
        // Try to reload the last volume if available
        if (this.lastVolumeData) {
            console.log('  🔄 Reloading volume after context restoration...')
            try {
                await this.loadVolume(this.lastVolumeData)
                console.log('  ✅ Volume reloaded successfully')
            } catch (error) {
                console.error('  ❌ Failed to reload volume after context restoration:', error)
            }
        } else {
            console.log('  ℹ️ No volume to reload')
        }
    }
    
    /**
     * Set callback for context loss/restoration events
     * 
     * @param callback - Function called with true when context is lost, false when restored
     */
    public setContextLostCallback(callback: ((lost: boolean) => void) | undefined): void {
        this.contextLostCallback = callback
    }
    
    /**
     * Check if WebGL context is currently lost
     * 
     * @returns true if context is lost, false otherwise
     */
    public isContextCurrentlyLost(): boolean {
        return this.isContextLost
    }
    
    /**
     * Manually trigger context loss (for testing)
     * Only works if WEBGL_lose_context extension is available
     */
    public loseContext(): void {
        const context = this.getContext()
        if (!context) {
            console.warn('Cannot lose context - no WebGL context')
            return
        }
        
        const loseContextExt = context.getExtension('WEBGL_lose_context')
        if (loseContextExt) {
            console.log('🧪 Manually losing WebGL context for testing...')
            loseContextExt.loseContext()
        } else {
            console.warn('WEBGL_lose_context extension not available')
        }
    }
    
    /**
     * Manually trigger context restoration (for testing)
     * Only works if WEBGL_lose_context extension is available
     */
    public restoreContext(): void {
        const context = this.getContext()
        if (!context) {
            console.warn('Cannot restore context - no WebGL context')
            return
        }
        
        const loseContextExt = context.getExtension('WEBGL_lose_context')
        if (loseContextExt) {
            console.log('🧪 Manually restoring WebGL context for testing...')
            loseContextExt.restoreContext()
        } else {
            console.warn('WEBGL_lose_context extension not available')
        }
    }
    
    /**
     * Handle interaction start
     * Reduces quality for smoother interaction
     */
    private onInteractionStart(): void {
        if (this.isInteracting) return
        
        this.isInteracting = true
        
        // Clear any pending quality restore
        if (this.restoreQualityTimeout) {
            clearTimeout(this.restoreQualityTimeout)
            this.restoreQualityTimeout = undefined
        }
        
        // Save current quality
        this.savedQuality = this.currentQuality
        
        // Reduce quality for smoother interaction
        if (this.currentQuality !== this.interactionQuality) {
            console.log(`⚡ Interaction started - reducing quality to ${this.interactionQuality}`)
            this.setQuality(this.interactionQuality)
        }
    }
    
    /**
     * Handle interaction end
     * Schedules quality restoration after a delay
     */
    private onInteractionEnd(): void {
        if (!this.isInteracting) return
        
        this.isInteracting = false
        
        // Clear any existing timeout
        if (this.restoreQualityTimeout) {
            clearTimeout(this.restoreQualityTimeout)
        }
        
        // Schedule quality restoration after delay
        this.restoreQualityTimeout = window.setTimeout(() => {
            if (this.savedQuality && this.savedQuality !== this.currentQuality) {
                console.log(`✨ Interaction ended - restoring quality to ${this.savedQuality}`)
                this.setQuality(this.savedQuality)
            }
            this.savedQuality = undefined
            this.restoreQualityTimeout = undefined
        }, this.restoreQualityDelay)
    }
    
    /**
     * Enable mouse interaction
     * Allows user to interact with the volume using mouse
     */
    public enableInteraction(): void {
        if (!this.interactor) {
            console.warn('Interactor not available')
            return
        }
        
        try {
            this.interactor.bindEvents(this.container)
            this.isInteractionEnabled = true
            console.log('✅ Mouse interaction enabled')
        } catch (error) {
            console.error('❌ Failed to enable interaction:', error)
        }
    }
    
    /**
     * Disable mouse interaction
     * Prevents user from interacting with the volume using mouse
     */
    public disableInteraction(): void {
        if (!this.interactor) {
            console.warn('Interactor not available')
            return
        }
        
        try {
            this.interactor.unbindEvents()
            this.isInteractionEnabled = false
            console.log('🚫 Mouse interaction disabled')
        } catch (error) {
            console.error('❌ Failed to disable interaction:', error)
        }
    }
    
    /**
     * Check if mouse interaction is enabled
     */
    public isInteractionActive(): boolean {
        return this.isInteractionEnabled
    }
    
    /**
     * Get the interactor style
     * Allows direct manipulation of interaction behavior
     */
    public getInteractorStyle(): any {
        return this.interactorStyle
    }
    
    /**
     * Get the interactor
     * Allows direct manipulation of interaction events
     */
    public getInteractor(): any {
        return this.interactor
    }
    
    /**
     * Set the quality level to use during interaction
     * Lower quality provides smoother interaction
     * 
     * @param quality - Quality level for interaction ('low', 'medium', or 'high')
     */
    public setInteractionQuality(quality: QualityLevel): void {
        this.interactionQuality = quality
        console.log(`⚙️ Interaction quality set to: ${quality}`)
    }
    
    /**
     * Get the current interaction quality level
     */
    public getInteractionQuality(): QualityLevel {
        return this.interactionQuality
    }
    
    /**
     * Set the delay before restoring quality after interaction ends
     * 
     * @param delayMs - Delay in milliseconds (default: 500ms)
     */
    public setQualityRestoreDelay(delayMs: number): void {
        this.restoreQualityDelay = Math.max(0, delayMs)
        console.log(`⚙️ Quality restore delay set to: ${this.restoreQualityDelay}ms`)
    }
    
    /**
     * Get the quality restore delay
     */
    public getQualityRestoreDelay(): number {
        return this.restoreQualityDelay
    }
    
    /**
     * Check if currently interacting
     */
    public isCurrentlyInteracting(): boolean {
        return this.isInteracting
    }
    
    /**
     * Load volume data into VTK.js
     * 
     * Converts Float32Array volume data to vtkImageData and uploads to GPU as a 3D texture.
     * This is the main method for loading medical imaging data into the renderer.
     * 
     * **Process:**
     * 1. Validates volume data (dimensions, data array, spacing)
     * 2. Checks GPU memory availability
     * 3. Creates vtkImageData object
     * 4. Sets dimensions, spacing, and origin
     * 5. Uploads data to GPU as 3D texture
     * 6. Sets up volume mapper and actor
     * 7. Adds volume to scene
     * 8. Resets camera to fit volume
     * 
     * **Data Format:**
     * 
     * Volume data must be a Float32Array with values in the range appropriate for the
     * imaging modality (e.g., -1024 to 3071 for CT Hounsfield units, 0-4095 for 12-bit data).
     * 
     * The data array is organized in row-major order:
     * ```
     * index = x + y * width + z * width * height
     * ```
     * 
     * **Spacing:**
     * 
     * Spacing defines the physical size of each voxel in millimeters. For example:
     * - spacing = { x: 1.0, y: 1.0, z: 2.0 } means voxels are 1mm × 1mm × 2mm
     * - This affects the aspect ratio of the rendered volume
     * 
     * **GPU Memory:**
     * 
     * The method estimates required GPU memory and checks against limits:
     * - Recommended maximum: 500 MB
     * - Absolute maximum: 1000 MB
     * - Formula: width × height × depth × 4 bytes (Float32)
     * 
     * @param {VolumeData} volumeData - Volume data with dimensions and spacing
     * @param {VolumeData.data} volumeData.data - Float32Array of voxel values
     * @param {Object} volumeData.dimensions - Volume dimensions
     * @param {number} volumeData.dimensions.width - Width in voxels
     * @param {number} volumeData.dimensions.height - Height in voxels
     * @param {number} volumeData.dimensions.depth - Depth (number of slices) in voxels
     * @param {Object} volumeData.spacing - Voxel spacing in millimeters
     * @param {number} volumeData.spacing.x - X spacing (mm)
     * @param {number} volumeData.spacing.y - Y spacing (mm)
     * @param {number} volumeData.spacing.z - Z spacing (mm)
     * @param {Function} [onProgress] - Optional callback for loading progress (0.0 to 1.0)
     * 
     * @returns {Promise<void>} Resolves when volume is loaded and ready to render
     * 
     * @throws {Error} If renderer is not initialized
     * @throws {Error} If volume dimensions are invalid (non-positive or too large)
     * @throws {Error} If data array is missing or wrong size
     * @throws {Error} If spacing values are invalid (non-positive)
     * @throws {Error} If GPU memory is insufficient
     * @throws {Error} If texture upload to GPU fails
     * 
     * @example
     * // Load a 512×512×100 CT volume
     * const volumeData = {
     *   data: new Float32Array(512 * 512 * 100),
     *   dimensions: { width: 512, height: 512, depth: 100 },
     *   spacing: { x: 0.5, y: 0.5, z: 1.0 } // 0.5mm in-plane, 1mm slice thickness
     * };
     * 
     * await renderer.loadVolume(volumeData, (progress) => {
     *   console.log(`Loading: ${(progress * 100).toFixed(0)}%`);
     * });
     * 
     * @example
     * // With error handling
     * try {
     *   await renderer.loadVolume(volumeData);
     *   console.log('Volume loaded successfully');
     * } catch (error) {
     *   if (error.message.includes('GPU memory')) {
     *     console.error('Volume too large for GPU');
     *     // Try reducing volume size or quality
     *   } else {
     *     console.error('Failed to load volume:', error);
     *   }
     * }
     * 
     * @example
     * // Load multiple volumes sequentially
     * for (const study of studies) {
     *   await renderer.loadVolume(study.volumeData);
     *   // Render and capture screenshot
     *   await new Promise(resolve => setTimeout(resolve, 1000));
     * }
     */
    public async loadVolume(
        volumeData: VolumeData,
        onProgress?: (progress: number) => void
    ): Promise<void> {
        console.log('📦 Loading volume into VTK.js...')
        console.log(`   Dimensions: ${volumeData.dimensions.width}x${volumeData.dimensions.height}x${volumeData.dimensions.depth}`)
        
        try {
            // Validate renderer is initialized
            if (!this.isInitialized) {
                throw new Error('Renderer not initialized. Cannot load volume.')
            }
            
            onProgress?.(0.1)
            
            // Validate volume data
            this.validateVolumeData(volumeData)
            
            onProgress?.(0.15)
            
            // Check for large volume warning
            this.checkLargeVolumeWarning(volumeData)
            
            // Check GPU memory availability
            this.checkGPUMemoryAvailability(volumeData)
            
            onProgress?.(0.2)
            
            // Create vtkImageData
            // @ts-ignore - VTK.js types may not be complete
            this.imageData = vtkImageData.newInstance()
            if (!this.imageData) {
                throw new Error('Failed to create VTK.js ImageData object')
            }
            this.resources.push(this.imageData)
            
            onProgress?.(0.3)
            
            // Set dimensions (width, height, depth)
            const { width, height, depth } = volumeData.dimensions
            this.imageData.setDimensions(width, height, depth)
            
            onProgress?.(0.4)
            
            // Set spacing (voxel size in mm)
            const { x: sx, y: sy, z: sz } = volumeData.spacing
            this.imageData.setSpacing(sx, sy, sz)
            
            onProgress?.(0.5)
            
            // Set origin (center the volume)
            this.imageData.setOrigin(
                -width * sx / 2,
                -height * sy / 2,
                -depth * sz / 2
            )
            
            onProgress?.(0.6)
            
            // Create data array from Float32Array
            // @ts-ignore - VTK.js types may not be complete
            const dataArray = vtkDataArray.newInstance({
                name: 'VolumeData',
                numberOfComponents: 1,
                values: volumeData.data
            })
            
            if (!dataArray) {
                throw new Error('Failed to create VTK.js DataArray object')
            }
            this.resources.push(dataArray)
            
            onProgress?.(0.7)
            
            // Set scalars (the actual voxel data)
            try {
                this.imageData.getPointData().setScalars(dataArray)
            } catch (error) {
                throw new Error(`Failed to upload texture to GPU: ${error instanceof Error ? error.message : 'Unknown error'}. GPU memory may be exhausted.`)
            }
            
            onProgress?.(0.9)
            
            console.log('✅ Volume data uploaded to GPU')
            onProgress?.(1.0)
            
            // Estimate GPU memory usage
            this.estimateGPUMemory()
            
            // Set up volume mapper and actor
            this.setupVolumeMapper()
            
            // Save volume data for potential reload after context loss
            this.lastVolumeData = volumeData
            
        } catch (error) {
            console.error('❌ Failed to load volume:', error)
            
            // Clean up any partially created resources
            this.cleanupFailedVolumeLoad()
            
            // Re-throw with clear error message
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            throw new Error(`Volume loading failed: ${errorMessage}`)
        }
    }
    
    /**
     * Load volume with progressive quality enhancement
     * 
     * Loads a low-resolution preview first for immediate feedback, then progressively
     * increases quality. This provides better user experience for large volumes.
     * 
     * **Progressive Loading Strategy:**
     * 1. Load at 1/4 resolution (low quality, fast)
     * 2. Load at 1/2 resolution (medium quality)
     * 3. Load at full resolution (high quality)
     * 
     * Each stage renders immediately, providing visual feedback while loading continues.
     * 
     * @param volumeData - Full resolution volume data
     * @param onProgress - Callback for loading progress (0.0 to 1.0)
     * @param onStageComplete - Callback when each quality stage completes
     * @returns Promise that resolves when full quality is loaded
     * 
     * @example
     * await renderer.loadVolumeProgressive(volumeData, 
     *   (progress) => console.log(`Loading: ${(progress * 100).toFixed(0)}%`),
     *   (stage) => console.log(`Stage ${stage} complete`)
     * );
     */
    public async loadVolumeProgressive(
        volumeData: VolumeData,
        onProgress?: (progress: number) => void,
        onStageComplete?: (stage: 'low' | 'medium' | 'high') => void
    ): Promise<void> {
        console.log('🔄 Loading volume with progressive quality...')
        
        try {
            // Stage 1: Load low-resolution preview (1/4 resolution)
            console.log('  📥 Stage 1: Loading low-resolution preview (1/4)...')
            onProgress?.(0.0)
            
            const lowResData = this.downsampleVolume(volumeData, 4)
            await this.loadVolume(lowResData, (p) => onProgress?.(p * 0.3))
            
            // Set to low quality for fast preview
            this.setQuality('low')
            
            console.log('  ✅ Stage 1 complete: Low-resolution preview ready')
            onStageComplete?.('low')
            onProgress?.(0.3)
            
            // Small delay to allow preview to render
            await new Promise(resolve => setTimeout(resolve, 100))
            
            // Stage 2: Load medium-resolution (1/2 resolution)
            console.log('  📥 Stage 2: Loading medium-resolution (1/2)...')
            
            const mediumResData = this.downsampleVolume(volumeData, 2)
            await this.loadVolume(mediumResData, (p) => onProgress?.(0.3 + p * 0.3))
            
            // Set to medium quality
            this.setQuality('medium')
            
            console.log('  ✅ Stage 2 complete: Medium-resolution ready')
            onStageComplete?.('medium')
            onProgress?.(0.6)
            
            // Small delay to allow medium quality to render
            await new Promise(resolve => setTimeout(resolve, 100))
            
            // Stage 3: Load full resolution
            console.log('  📥 Stage 3: Loading full resolution...')
            
            await this.loadVolume(volumeData, (p) => onProgress?.(0.6 + p * 0.4))
            
            // Set to high quality for final render
            this.setQuality('high')
            
            console.log('  ✅ Stage 3 complete: Full resolution ready')
            onStageComplete?.('high')
            onProgress?.(1.0)
            
            console.log('✅ Progressive loading complete')
            
        } catch (error) {
            console.error('❌ Progressive loading failed:', error)
            throw error
        }
    }
    
    /**
     * Downsample volume data by a factor
     * Creates a lower-resolution version of the volume for progressive loading
     * 
     * Uses simple nearest-neighbor sampling for speed.
     * 
     * @param volumeData - Original volume data
     * @param factor - Downsampling factor (2 = half resolution, 4 = quarter resolution)
     * @returns Downsampled volume data
     */
    private downsampleVolume(volumeData: VolumeData, factor: number): VolumeData {
        const { width, height, depth } = volumeData.dimensions
        const { x: sx, y: sy, z: sz } = volumeData.spacing
        
        // Calculate new dimensions
        const newWidth = Math.max(1, Math.floor(width / factor))
        const newHeight = Math.max(1, Math.floor(height / factor))
        const newDepth = Math.max(1, Math.floor(depth / factor))
        
        console.log(`    Downsampling from ${width}x${height}x${depth} to ${newWidth}x${newHeight}x${newDepth}`)
        
        // Create downsampled data array
        const newSize = newWidth * newHeight * newDepth
        const newData = new Float32Array(newSize)
        
        // Downsample using nearest-neighbor sampling
        for (let z = 0; z < newDepth; z++) {
            for (let y = 0; y < newHeight; y++) {
                for (let x = 0; x < newWidth; x++) {
                    // Map to original coordinates
                    const origX = Math.min(Math.floor(x * factor), width - 1)
                    const origY = Math.min(Math.floor(y * factor), height - 1)
                    const origZ = Math.min(Math.floor(z * factor), depth - 1)
                    
                    // Get value from original data
                    const origIndex = origX + origY * width + origZ * width * height
                    const newIndex = x + y * newWidth + z * newWidth * newHeight
                    
                    newData[newIndex] = volumeData.data[origIndex]
                }
            }
        }
        
        // Return downsampled volume with adjusted spacing
        return {
            data: newData,
            dimensions: {
                width: newWidth,
                height: newHeight,
                depth: newDepth
            },
            spacing: {
                x: sx * factor,
                y: sy * factor,
                z: sz * factor
            },
            min: volumeData.min || 0,
            max: volumeData.max || 1
        }
    }
    
    /**
     * Validate volume data before loading
     * Checks dimensions, data array, and spacing
     * 
     * @param volumeData - Volume data to validate
     * @throws {Error} If validation fails
     */
    private validateVolumeData(volumeData: VolumeData): void {
        // Check if volumeData exists
        if (!volumeData) {
            throw new Error('Volume data is null or undefined')
        }
        
        // Validate dimensions
        if (!volumeData.dimensions) {
            throw new Error('Volume dimensions are missing')
        }
        
        const { width, height, depth } = volumeData.dimensions
        
        if (!Number.isInteger(width) || width <= 0) {
            throw new Error(`Invalid volume width: ${width}. Must be a positive integer.`)
        }
        
        if (!Number.isInteger(height) || height <= 0) {
            throw new Error(`Invalid volume height: ${height}. Must be a positive integer.`)
        }
        
        if (!Number.isInteger(depth) || depth <= 0) {
            throw new Error(`Invalid volume depth: ${depth}. Must be a positive integer.`)
        }
        
        // Check for reasonable maximum dimensions
        const MAX_DIMENSION = 2048
        if (width > MAX_DIMENSION || height > MAX_DIMENSION || depth > MAX_DIMENSION) {
            throw new Error(`Volume dimensions too large (${width}x${height}x${depth}). Maximum dimension is ${MAX_DIMENSION}.`)
        }
        
        // Validate data array
        if (!volumeData.data) {
            throw new Error('Volume data array is missing')
        }
        
        if (!(volumeData.data instanceof Float32Array)) {
            throw new Error('Volume data must be a Float32Array')
        }
        
        // Check data array size matches dimensions
        const expectedSize = width * height * depth
        if (volumeData.data.length !== expectedSize) {
            throw new Error(`Volume data size mismatch. Expected ${expectedSize} voxels, got ${volumeData.data.length}`)
        }
        
        // Validate spacing
        if (!volumeData.spacing) {
            throw new Error('Volume spacing is missing')
        }
        
        const { x: sx, y: sy, z: sz } = volumeData.spacing
        
        if (!Number.isFinite(sx) || sx <= 0) {
            throw new Error(`Invalid volume spacing X: ${sx}. Must be a positive number.`)
        }
        
        if (!Number.isFinite(sy) || sy <= 0) {
            throw new Error(`Invalid volume spacing Y: ${sy}. Must be a positive number.`)
        }
        
        if (!Number.isFinite(sz) || sz <= 0) {
            throw new Error(`Invalid volume spacing Z: ${sz}. Must be a positive number.`)
        }
        
        console.log('  ✓ Volume data validation passed')
    }
    
    /**
     * Check if GPU has enough memory for the volume
     * Estimates required memory and compares with available GPU memory
     * 
     * @param volumeData - Volume data to check
     * @throws {Error} If GPU memory is likely insufficient
     */
    private checkGPUMemoryAvailability(volumeData: VolumeData): void {
        const { width, height, depth } = volumeData.dimensions
        const numVoxels = width * height * depth
        
        // Float32Array = 4 bytes per voxel
        const bytesPerVoxel = 4
        const requiredBytes = numVoxels * bytesPerVoxel
        const requiredMB = requiredBytes / (1024 * 1024)
        
        console.log(`  ℹ️ Required GPU memory: ${requiredMB.toFixed(2)} MB`)
        
        // Check against reasonable limits
        const RECOMMENDED_MAX_MB = 500
        const ABSOLUTE_MAX_MB = 1000
        
        if (requiredMB > ABSOLUTE_MAX_MB) {
            throw new Error(
                `Volume too large for GPU memory (${requiredMB.toFixed(0)} MB required). ` +
                `Maximum supported size is ${ABSOLUTE_MAX_MB} MB. ` +
                `Try reducing the number of frames or image resolution.`
            )
        }
        
        if (requiredMB > RECOMMENDED_MAX_MB) {
            console.warn(
                `  ⚠️ Volume size (${requiredMB.toFixed(0)} MB) exceeds recommended limit (${RECOMMENDED_MAX_MB} MB). ` +
                `Performance may be degraded. Consider reducing volume size.`
            )
        }
        
        // Try to get WebGL context and check max texture size
        const context = this.getContext()
        if (context) {
            const maxTextureSize = context.getParameter(context.MAX_TEXTURE_SIZE)
            // @ts-ignore - MAX_3D_TEXTURE_SIZE is WebGL2 constant
            const max3DTextureSize = context.getParameter(context.MAX_3D_TEXTURE_SIZE || 0x8073)
            
            console.log(`  ℹ️ GPU max 2D texture size: ${maxTextureSize}`)
            console.log(`  ℹ️ GPU max 3D texture size: ${max3DTextureSize}`)
            
            // Check if dimensions exceed GPU limits
            if (width > maxTextureSize || height > maxTextureSize) {
                throw new Error(
                    `Volume dimensions (${width}x${height}) exceed GPU max 2D texture size (${maxTextureSize}). ` +
                    `Your GPU cannot handle this volume size.`
                )
            }
            
            if (max3DTextureSize && (width > max3DTextureSize || height > max3DTextureSize || depth > max3DTextureSize)) {
                throw new Error(
                    `Volume dimensions (${width}x${height}x${depth}) exceed GPU max 3D texture size (${max3DTextureSize}). ` +
                    `Your GPU cannot handle this volume size.`
                )
            }
        }
        
        console.log('  ✓ GPU memory check passed')
    }
    
    /**
     * Clean up resources if volume loading fails
     * Prevents memory leaks from partial volume loading
     */
    private cleanupFailedVolumeLoad(): void {
        try {
            if (this.imageData) {
                this.imageData.delete()
                this.imageData = null
            }
            
            // Remove any resources added during this load attempt
            // Keep existing resources from previous successful loads
            const resourcesToClean = this.resources.filter(r => r === this.imageData)
            resourcesToClean.forEach(r => {
                if (r && typeof r.delete === 'function') {
                    try {
                        r.delete()
                    } catch (e) {
                        // Ignore cleanup errors
                    }
                }
            })
            
            console.log('  🧹 Cleaned up failed volume load')
        } catch (cleanupError) {
            console.warn('  ⚠️ Error during volume load cleanup:', cleanupError)
        }
    }
    
    /**
     * Set up volume mapper and connect to volume actor
     * Configures ray casting parameters for rendering
     */
    private setupVolumeMapper(): void {
        console.log('🔧 Setting up volume mapper...')
        
        try {
            // Create volume mapper
            // @ts-ignore - VTK.js types may not be complete
            this.volumeMapper = vtkVolumeMapper.newInstance()
            this.resources.push(this.volumeMapper)
            
            // Set input data
            this.volumeMapper.setInputData(this.imageData)
            
            // Configure sample distance (affects quality vs performance)
            // Lower values = higher quality but slower
            this.volumeMapper.setSampleDistance(1.0)
            
            // Set maximum number of samples per ray
            // Higher values = better quality but slower
            this.volumeMapper.setMaximumSamplesPerRay(1000)
            
            // Enable auto-adjust sample distances for better performance
            this.volumeMapper.setAutoAdjustSampleDistances(true)
            
            // Create volume actor
            // @ts-ignore - VTK.js types may not be complete
            this.volume = vtkVolume.newInstance()
            this.resources.push(this.volume)
            
            // Connect mapper to volume
            this.volume.setMapper(this.volumeMapper)
            
            // Add volume to renderer
            this.renderer.addVolume(this.volume)
            
            // Reset camera to fit volume
            this.renderer.resetCamera()
            
            console.log('✅ Volume mapper configured')
            
        } catch (error) {
            console.error('❌ Failed to setup volume mapper:', error)
            throw new Error(`Volume mapper setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }
    
    /**
     * Set the render mode
     * 
     * Changes how the volume is visualized. Each mode is suited for different diagnostic tasks.
     * 
     * **Render Modes:**
     * 
     * 1. **MIP (Maximum Intensity Projection)**
     *    - Shows the maximum voxel value along each ray from camera to volume
     *    - Fast rendering, no depth perception
     *    - Best for: Visualizing high-density structures (bones, contrast-enhanced vessels)
     *    - Use case: Angiography, bone imaging
     *    - VTK.js implementation: `setBlendModeToMaximumIntensity()`
     * 
     * 2. **Volume (Composite Blending)**
     *    - Accumulates color and opacity along each ray using transfer functions
     *    - Provides depth perception and soft tissue visualization
     *    - Best for: General purpose, viewing multiple tissue types simultaneously
     *    - Use case: CT chest/abdomen, MRI brain
     *    - VTK.js implementation: `setBlendModeToComposite()`
     * 
     * 3. **Isosurface**
     *    - Extracts and renders surfaces at specific scalar values
     *    - Shows boundaries between tissue types
     *    - Best for: Surface visualization (skin, bone surface)
     *    - Use case: 3D reconstruction, surgical planning
     *    - VTK.js implementation: Composite mode with sharp transfer function
     * 
     * **Performance:**
     * - MIP: Fastest (simple max operation)
     * - Volume: Moderate (requires transfer function evaluation)
     * - Isosurface: Moderate (similar to volume mode)
     * 
     * @param {RenderMode} mode - Render mode: 'mip', 'volume', or 'isosurface'
     * 
     * @example
     * // Use MIP for angiography
     * renderer.setRenderMode('mip');
     * 
     * @example
     * // Use volume mode for general CT viewing
     * renderer.setRenderMode('volume');
     * 
     * @example
     * // Use isosurface for 3D reconstruction
     * renderer.setRenderMode('isosurface');
     * // Configure transfer function for surface extraction
     * renderer.setTransferFunction(isosurfaceTransferFunction, 0, 4095);
     * 
     * @example
     * // Switch modes dynamically
     * const modes = ['mip', 'volume', 'isosurface'];
     * let currentMode = 0;
     * 
     * setInterval(() => {
     *   renderer.setRenderMode(modes[currentMode]);
     *   currentMode = (currentMode + 1) % modes.length;
     * }, 3000); // Switch every 3 seconds
     */
    public setRenderMode(mode: RenderMode): void {
        if (!this.volumeMapper) {
            console.warn('Volume mapper not initialized')
            return
        }
        
        console.log(`🎨 Setting render mode to: ${mode}`)
        
        try {
            this.currentRenderMode = mode
            
            switch (mode) {
                case 'mip':
                    // Maximum Intensity Projection
                    this.volumeMapper.setBlendModeToMaximumIntensity()
                    break
                    
                case 'volume':
                    // Composite blending (standard volume rendering)
                    this.volumeMapper.setBlendModeToComposite()
                    break
                    
                case 'isosurface':
                    // Isosurface rendering
                    // Note: VTK.js doesn't have a direct "isosurface" blend mode
                    // We use composite with a sharp transfer function to simulate it
                    this.volumeMapper.setBlendModeToComposite()
                    // The transfer function will be configured to create isosurface effect
                    break
                    
                default:
                    console.warn(`Unknown render mode: ${mode}, defaulting to volume`)
                    this.volumeMapper.setBlendModeToComposite()
            }
            
            // Trigger re-render
            this.render()
            
            console.log(`✅ Render mode set to: ${mode}`)
            
        } catch (error) {
            console.error('❌ Failed to set render mode:', error)
        }
    }
    
    /**
     * Get current render mode
     */
    public getRenderMode(): RenderMode {
        return this.currentRenderMode
    }
    
    /**
     * Set transfer function for volume rendering
     * 
     * Transfer functions are the key to visualizing different tissue types in medical imaging.
     * They map scalar values (e.g., Hounsfield units in CT) to colors and opacity.
     * 
     * **How Transfer Functions Work:**
     * 
     * 1. **Opacity Transfer Function (vtkPiecewiseFunction)**
     *    - Maps scalar values to opacity (0.0 = transparent, 1.0 = opaque)
     *    - Controls which tissues are visible
     *    - Example: Make air (HU < -500) transparent, make bone (HU > 400) opaque
     * 
     * 2. **Color Transfer Function (vtkColorTransferFunction)**
     *    - Maps scalar values to RGB colors
     *    - Colorizes different tissue types
     *    - Example: Bone = white, soft tissue = red/brown, air = black
     * 
     * **Common Presets:**
     * 
     * - **CT-Bone**: Emphasizes bone structures, makes soft tissue transparent
     * - **CT-Soft-Tissue**: Shows soft tissue detail, makes bone semi-transparent
     * - **MR-Default**: General purpose for MRI data
     * - **CT-Angio**: Highlights contrast-enhanced vessels
     * 
     * **Value Mapping:**
     * 
     * Transfer function points use normalized values [0, 1], which are mapped to the
     * actual data range [volumeMin, volumeMax]:
     * ```
     * actualValue = volumeMin + normalizedValue * (volumeMax - volumeMin)
     * ```
     * 
     * For example, with CT data (HU range -1024 to 3071):
     * - normalizedValue = 0.0 → actualValue = -1024 (air)
     * - normalizedValue = 0.5 → actualValue = 1023 (soft tissue)
     * - normalizedValue = 1.0 → actualValue = 3071 (dense bone)
     * 
     * **Shading:**
     * 
     * The method also configures shading properties for realistic lighting:
     * - Ambient: Base lighting (30%)
     * - Diffuse: Directional lighting (70%)
     * - Specular: Highlights (30%, power 8.0)
     * 
     * @param {TransferFunction} transferFunction - Transfer function with opacity and color points
     * @param {Array<{value: number, opacity: number}>} transferFunction.opacityPoints - Opacity mapping points
     * @param {Array<{value: number, r: number, g: number, b: number}>} transferFunction.colorPoints - Color mapping points
     * @param {number} volumeMin - Minimum value in volume data (e.g., -1024 for CT)
     * @param {number} volumeMax - Maximum value in volume data (e.g., 3071 for CT)
     * 
     * @example
     * // CT-Bone preset
     * const ctBone = {
     *   opacityPoints: [
     *     { value: 0.0, opacity: 0.0 },   // Air: transparent
     *     { value: 0.3, opacity: 0.0 },   // Soft tissue: transparent
     *     { value: 0.5, opacity: 0.5 },   // Bone start: semi-transparent
     *     { value: 1.0, opacity: 1.0 }    // Dense bone: opaque
     *   ],
     *   colorPoints: [
     *     { value: 0.0, r: 0.0, g: 0.0, b: 0.0 },  // Air: black
     *     { value: 0.5, r: 0.8, g: 0.7, b: 0.6 },  // Bone: beige
     *     { value: 1.0, r: 1.0, g: 1.0, b: 1.0 }   // Dense bone: white
     *   ]
     * };
     * renderer.setTransferFunction(ctBone, -1024, 3071);
     * 
     * @example
     * // CT-Soft-Tissue preset
     * const ctSoftTissue = {
     *   opacityPoints: [
     *     { value: 0.0, opacity: 0.0 },
     *     { value: 0.2, opacity: 0.1 },
     *     { value: 0.4, opacity: 0.3 },
     *     { value: 1.0, opacity: 0.8 }
     *   ],
     *   colorPoints: [
     *     { value: 0.0, r: 0.0, g: 0.0, b: 0.0 },
     *     { value: 0.5, r: 0.9, g: 0.5, b: 0.3 },
     *     { value: 1.0, r: 1.0, g: 1.0, b: 1.0 }
     *   ]
     * };
     * renderer.setTransferFunction(ctSoftTissue, -1024, 3071);
     * 
     * @example
     * // Isosurface at specific value (e.g., skin surface at HU = 0)
     * const skinIsosurface = {
     *   opacityPoints: [
     *     { value: 0.48, opacity: 0.0 },  // Below threshold: transparent
     *     { value: 0.50, opacity: 1.0 },  // At threshold: opaque
     *     { value: 0.52, opacity: 0.0 }   // Above threshold: transparent
     *   ],
     *   colorPoints: [
     *     { value: 0.0, r: 0.9, g: 0.7, b: 0.6 },
     *     { value: 1.0, r: 0.9, g: 0.7, b: 0.6 }
     *   ]
     * };
     * renderer.setTransferFunction(skinIsosurface, -1024, 3071);
     */
    public setTransferFunction(
        transferFunction: TransferFunction,
        volumeMin: number,
        volumeMax: number
    ): void {
        if (!this.volume) {
            console.warn('Volume not initialized')
            return
        }
        
        console.log('🎨 Applying transfer function...')
        
        try {
            // Get volume property
            const volumeProperty = this.volume.getProperty()
            
            // Create opacity (scalar opacity) function
            // @ts-ignore - VTK.js types may not be complete
            const opacityFunction = vtkPiecewiseFunction.newInstance()
            this.resources.push(opacityFunction)
            
            // Map opacity points from normalized [0,1] to actual data range
            transferFunction.opacityPoints.forEach(point => {
                const value = volumeMin + point.value * (volumeMax - volumeMin)
                opacityFunction.addPoint(value, point.opacity)
            })
            
            // Create color transfer function
            // @ts-ignore - VTK.js types may not be complete
            const colorFunction = vtkColorTransferFunction.newInstance()
            this.resources.push(colorFunction)
            
            // Map color points from normalized [0,1] to actual data range
            transferFunction.colorPoints.forEach(point => {
                const value = volumeMin + point.value * (volumeMax - volumeMin)
                colorFunction.addRGBPoint(value, point.r, point.g, point.b)
            })
            
            // Apply transfer functions to volume property
            volumeProperty.setRGBTransferFunction(0, colorFunction)
            volumeProperty.setScalarOpacity(0, opacityFunction)
            
            // Set shading properties for better visualization
            volumeProperty.setShade(true)
            volumeProperty.setAmbient(0.3)
            volumeProperty.setDiffuse(0.7)
            volumeProperty.setSpecular(0.3)
            volumeProperty.setSpecularPower(8.0)
            
            // Trigger re-render
            this.render()
            
            console.log('✅ Transfer function applied')
            
        } catch (error) {
            console.error('❌ Failed to set transfer function:', error)
        }
    }
    
    /**
     * Set global opacity multiplier
     * Scales all opacity values in the transfer function
     * 
     * @param opacity - Opacity value from 0.0 (transparent) to 1.0 (opaque)
     */
    public setOpacity(opacity: number): void {
        if (!this.volume) {
            console.warn('Volume not initialized')
            return
        }
        
        // Clamp opacity to valid range
        const clampedOpacity = Math.max(0, Math.min(1, opacity))
        
        try {
            // Get volume property
            const volumeProperty = this.volume.getProperty()
            
            // Get current scalar opacity function
            const opacityFunction = volumeProperty.getScalarOpacity(0)
            
            if (opacityFunction) {
                // Scale the opacity function
                // VTK.js doesn't have a direct "scale" method, so we use the range
                const range = opacityFunction.getRange()
                
                // Set scalar opacity unit distance (affects opacity scaling)
                // Smaller values = more opaque, larger values = more transparent
                const unitDistance = 1.0 / clampedOpacity
                volumeProperty.setScalarOpacityUnitDistance(0, unitDistance)
            }
            
            // Trigger re-render
            this.render()
            
        } catch (error) {
            console.error('❌ Failed to set opacity:', error)
        }
    }
    
    /**
     * Reset camera to default position
     * Fits the volume in view
     */
    public resetCamera(): void {
        if (!this.renderer) {
            console.warn('Renderer not initialized')
            return
        }
        
        try {
            // Reset camera to fit volume
            this.renderer.resetCamera()
            
            // Trigger re-render
            this.render()
            
            console.log('📷 Camera reset')
            
        } catch (error) {
            console.error('❌ Failed to reset camera:', error)
        }
    }
    
    /**
     * Get the VTK.js camera object
     * Allows direct manipulation of camera properties
     */
    public getCamera(): any {
        return this.camera
    }
    
    /**
     * Rotate camera around the volume
     * 
     * @param deltaX - Horizontal rotation in degrees
     * @param deltaY - Vertical rotation in degrees
     */
    public rotateCamera(deltaX: number, deltaY: number): void {
        if (!this.camera) {
            console.warn('Camera not initialized')
            return
        }
        
        try {
            // Azimuth (horizontal rotation)
            this.camera.azimuth(deltaX)
            
            // Elevation (vertical rotation)
            this.camera.elevation(deltaY)
            
            // Orthogonalize view up vector
            this.camera.orthogonalizeViewUp()
            
            // Trigger re-render
            this.render()
            
        } catch (error) {
            console.error('❌ Failed to rotate camera:', error)
        }
    }
    
    /**
     * Zoom camera
     * 
     * @param factor - Zoom factor (>1 = zoom in, <1 = zoom out)
     */
    public zoomCamera(factor: number): void {
        if (!this.camera) {
            console.warn('Camera not initialized')
            return
        }
        
        try {
            // Dolly (zoom) the camera
            this.camera.dolly(factor)
            
            // Trigger re-render
            this.render()
            
        } catch (error) {
            console.error('❌ Failed to zoom camera:', error)
        }
    }
    
    /**
     * Pan camera
     * 
     * @param deltaX - Horizontal pan
     * @param deltaY - Vertical pan
     */
    public panCamera(deltaX: number, deltaY: number): void {
        if (!this.camera || !this.renderer) {
            console.warn('Camera or renderer not initialized')
            return
        }
        
        try {
            const position = this.camera.getPosition()
            const focalPoint = this.camera.getFocalPoint()
            
            // Calculate pan vectors
            const viewUp = this.camera.getViewUp()
            const viewPlaneNormal = this.camera.getViewPlaneNormal()
            
            // Pan the camera
            const newPosition = [
                position[0] + deltaX,
                position[1] + deltaY,
                position[2]
            ]
            
            const newFocalPoint = [
                focalPoint[0] + deltaX,
                focalPoint[1] + deltaY,
                focalPoint[2]
            ]
            
            this.camera.setPosition(...newPosition)
            this.camera.setFocalPoint(...newFocalPoint)
            
            // Trigger re-render
            this.render()
            
        } catch (error) {
            console.error('❌ Failed to pan camera:', error)
        }
    }
    
    /**
     * Set rendering quality
     * 
     * Adjusts ray casting parameters to balance visual quality and rendering performance.
     * 
     * **Ray Casting Parameters:**
     * 
     * 1. **Sample Distance**
     *    - Distance between samples along each ray (in voxel units)
     *    - Smaller values = more samples = higher quality but slower
     *    - Larger values = fewer samples = lower quality but faster
     * 
     * 2. **Maximum Samples Per Ray**
     *    - Maximum number of samples taken along each ray
     *    - More samples = better quality but slower
     *    - Prevents infinite loops in ray casting
     * 
     * 3. **Auto-Adjust Sample Distances**
     *    - Automatically adjusts sample distance based on volume size
     *    - Enabled for low/medium quality for adaptive performance
     *    - Disabled for high quality for consistent results
     * 
     * **Quality Levels:**
     * 
     * | Quality | Sample Distance | Max Samples | Auto-Adjust | Target FPS | Use Case |
     * |---------|----------------|-------------|-------------|------------|----------|
     * | Low     | 2.0            | 500         | Yes         | 60         | Interaction, large volumes |
     * | Medium  | 1.0            | 1000        | Yes         | 30-45      | General viewing |
     * | High    | 0.5            | 2000        | No          | 15-30      | Final rendering, screenshots |
     * 
     * **Adaptive Quality:**
     * 
     * The renderer automatically reduces quality to 'low' during mouse interaction
     * (rotation, zoom, pan) and restores the selected quality after interaction ends.
     * This provides smooth interaction even with large volumes.
     * 
     * **Performance Impact:**
     * 
     * Quality setting has the most significant impact on rendering performance:
     * - Low → Medium: ~2x slower
     * - Medium → High: ~2x slower
     * - Low → High: ~4x slower
     * 
     * @param {QualityLevel} quality - Quality level: 'low', 'medium', or 'high'
     * 
     * @example
     * // Use low quality for large volumes or slow GPUs
     * renderer.setQuality('low');
     * 
     * @example
     * // Use medium quality for general viewing
     * renderer.setQuality('medium');
     * 
     * @example
     * // Use high quality for screenshots or final rendering
     * renderer.setQuality('high');
     * 
     * @example
     * // Adaptive quality based on FPS
     * renderer.setPerformanceCallback((metrics) => {
     *   if (metrics.fps < 15) {
     *     console.warn('Low FPS, reducing quality');
     *     renderer.setQuality('low');
     *   } else if (metrics.fps > 45) {
     *     console.log('High FPS, increasing quality');
     *     renderer.setQuality('high');
     *   }
     * });
     * 
     * @example
     * // High quality for screenshots
     * async function captureScreenshot() {
     *   const originalQuality = renderer.getQuality();
     *   
     *   // Switch to high quality
     *   renderer.setQuality('high');
     *   
     *   // Wait for render
     *   await new Promise(resolve => setTimeout(resolve, 100));
     *   
     *   // Capture screenshot
     *   const canvas = renderer.getContext()?.canvas;
     *   const dataUrl = canvas?.toDataURL('image/png');
     *   
     *   // Restore original quality
     *   renderer.setQuality(originalQuality);
     *   
     *   return dataUrl;
     * }
     */
    public setQuality(quality: QualityLevel): void {
        if (!this.volumeMapper) {
            console.warn('Volume mapper not initialized')
            return
        }
        
        console.log(`⚙️ Setting quality to: ${quality}`)
        
        try {
            this.currentQuality = quality
            
            let sampleDistance: number
            let maxSamples: number
            let autoAdjust: boolean
            
            // Fine-tuned quality settings based on benchmarking
            // Optimized for balance between visual quality and performance
            switch (quality) {
                case 'low':
                    // Fast rendering - optimized for 60 FPS on typical hardware
                    // Larger steps reduce ray casting overhead
                    // Fewer samples reduce computation time
                    sampleDistance = 1.5  // Reduced from 2.0 for better quality
                    maxSamples = 600      // Increased from 500 for smoother gradients
                    autoAdjust = true     // Let VTK.js optimize based on viewport
                    break
                    
                case 'medium':
                    // Balanced - optimized for 30-45 FPS
                    // Good quality/performance tradeoff for general viewing
                    sampleDistance = 0.8  // Reduced from 1.0 for sharper details
                    maxSamples = 1200     // Increased from 1000 for better depth perception
                    autoAdjust = true     // Adaptive sampling for consistent performance
                    break
                    
                case 'high':
                    // High quality - optimized for 15-30 FPS
                    // Maximum visual fidelity for screenshots and detailed examination
                    sampleDistance = 0.4  // Reduced from 0.5 for finest details
                    maxSamples = 2500     // Increased from 2000 for maximum accuracy
                    autoAdjust = false    // Disable auto-adjust for consistent high quality
                    break
                    
                default:
                    console.warn(`Unknown quality level: ${quality}, defaulting to medium`)
                    sampleDistance = 0.8
                    maxSamples = 1200
                    autoAdjust = true
            }
            
            // Apply settings to volume mapper
            this.volumeMapper.setSampleDistance(sampleDistance)
            this.volumeMapper.setMaximumSamplesPerRay(maxSamples)
            this.volumeMapper.setAutoAdjustSampleDistances(autoAdjust)
            
            // Trigger re-render
            this.render()
            
            console.log(`✅ Quality set to ${quality} (distance: ${sampleDistance}, samples: ${maxSamples}, auto-adjust: ${autoAdjust})`)
            
        } catch (error) {
            console.error('❌ Failed to set quality:', error)
        }
    }
    
    /**
     * Set custom quality parameters for advanced users
     * Allows fine-grained control over rendering quality
     * 
     * @param sampleDistance - Distance between samples along ray (lower = higher quality)
     * @param maxSamples - Maximum samples per ray (higher = higher quality)
     * @param autoAdjust - Enable automatic sample distance adjustment
     * 
     * @example
     * // Ultra-low quality for very large volumes
     * renderer.setCustomQuality(2.5, 400, true);
     * 
     * @example
     * // Ultra-high quality for publication screenshots
     * renderer.setCustomQuality(0.25, 3000, false);
     */
    public setCustomQuality(sampleDistance: number, maxSamples: number, autoAdjust: boolean = true): void {
        if (!this.volumeMapper) {
            console.warn('Volume mapper not initialized')
            return
        }
        
        console.log(`⚙️ Setting custom quality (distance: ${sampleDistance}, samples: ${maxSamples}, auto-adjust: ${autoAdjust})`)
        
        try {
            // Validate parameters
            if (sampleDistance <= 0) {
                throw new Error('Sample distance must be positive')
            }
            
            if (maxSamples <= 0 || !Number.isInteger(maxSamples)) {
                throw new Error('Max samples must be a positive integer')
            }
            
            // Apply settings
            this.volumeMapper.setSampleDistance(sampleDistance)
            this.volumeMapper.setMaximumSamplesPerRay(maxSamples)
            this.volumeMapper.setAutoAdjustSampleDistances(autoAdjust)
            
            // Mark as custom quality
            this.currentQuality = 'medium' // Default to medium for tracking
            
            // Trigger re-render
            this.render()
            
            console.log(`✅ Custom quality applied`)
            
        } catch (error) {
            console.error('❌ Failed to set custom quality:', error)
        }
    }
    
    /**
     * Benchmark current quality settings
     * Measures FPS over a period and returns average
     * 
     * @param durationMs - Duration to benchmark in milliseconds (default: 3000ms)
     * @returns Promise that resolves to average FPS
     * 
     * @example
     * const fps = await renderer.benchmarkQuality(5000);
     * console.log(`Average FPS: ${fps.toFixed(1)}`);
     * 
     * if (fps < 20) {
     *   renderer.setQuality('low');
     * }
     */
    public async benchmarkQuality(durationMs: number = 3000): Promise<number> {
        console.log(`📊 Benchmarking quality for ${durationMs}ms...`)
        
        const startTime = performance.now()
        const fpsReadings: number[] = []
        
        return new Promise((resolve) => {
            const interval = setInterval(() => {
                fpsReadings.push(this.currentFPS)
                
                const elapsed = performance.now() - startTime
                if (elapsed >= durationMs) {
                    clearInterval(interval)
                    
                    // Calculate average FPS
                    const avgFPS = fpsReadings.reduce((a, b) => a + b, 0) / fpsReadings.length
                    
                    console.log(`✅ Benchmark complete: ${avgFPS.toFixed(1)} FPS average`)
                    resolve(avgFPS)
                }
            }, 100) // Sample every 100ms
        })
    }
    
    /**
     * Auto-adjust quality based on current FPS
     * Automatically reduces quality if FPS drops below threshold
     * Increases quality if FPS is consistently high
     * 
     * @param targetFPS - Target FPS to maintain (default: 30)
     * @param tolerance - FPS tolerance before adjusting (default: 5)
     * 
     * @example
     * // Maintain 30 FPS
     * renderer.autoAdjustQuality(30, 5);
     */
    public autoAdjustQuality(targetFPS: number = 30, tolerance: number = 5): void {
        const currentFPS = this.currentFPS
        
        // Don't adjust during interaction (already handled by adaptive quality)
        if (this.isInteracting) {
            return
        }
        
        // FPS too low - reduce quality
        if (currentFPS < targetFPS - tolerance) {
            if (this.currentQuality === 'high') {
                console.log(`📉 FPS too low (${currentFPS.toFixed(1)}), reducing to medium quality`)
                this.setQuality('medium')
            } else if (this.currentQuality === 'medium') {
                console.log(`📉 FPS too low (${currentFPS.toFixed(1)}), reducing to low quality`)
                this.setQuality('low')
            }
        }
        // FPS too high - increase quality
        else if (currentFPS > targetFPS + tolerance + 15) {
            if (this.currentQuality === 'low') {
                console.log(`📈 FPS high (${currentFPS.toFixed(1)}), increasing to medium quality`)
                this.setQuality('medium')
            } else if (this.currentQuality === 'medium' && currentFPS > targetFPS + tolerance + 30) {
                console.log(`📈 FPS very high (${currentFPS.toFixed(1)}), increasing to high quality`)
                this.setQuality('high')
            }
        }
    }
    
    /**
     * Get current quality level
     */
    public getQuality(): QualityLevel {
        return this.currentQuality
    }
    
    /**
     * Set performance metrics callback
     * Called periodically with FPS, render time, and GPU memory usage
     * 
     * @param callback - Function to receive performance metrics
     */
    public setPerformanceCallback(callback: PerformanceCallback | undefined): void {
        this.performanceCallback = callback
    }
    
    /**
     * Set performance warning callback
     * Called when performance issues are detected
     * 
     * @param callback - Function to receive performance warnings
     * 
     * @example
     * renderer.setPerformanceWarningCallback((warning) => {
     *   // Show warning to user
     *   showNotification({
     *     type: 'warning',
     *     title: warning.message,
     *     message: warning.suggestion
     *   });
     * });
     */
    public setPerformanceWarningCallback(callback: PerformanceWarningCallback | undefined): void {
        this.performanceWarningCallback = callback
    }
    
    /**
     * Emit a performance warning
     * Checks cooldown to avoid spamming warnings
     * 
     * @param warning - Performance warning to emit
     */
    private emitPerformanceWarning(warning: PerformanceWarning): void {
        // Check cooldown
        const now = performance.now()
        if (now - this.lastWarningTime < this.warningCooldown) {
            return // Too soon since last warning
        }
        
        this.lastWarningTime = now
        
        // Log warning
        console.warn(`⚠️ Performance Warning: ${warning.message}`)
        console.log(`💡 Suggestion: ${warning.suggestion}`)
        
        // Call callback if set
        if (this.performanceWarningCallback) {
            this.performanceWarningCallback(warning)
        }
    }
    
    /**
     * Check for performance issues and emit warnings
     * Called periodically during rendering
     */
    private checkPerformanceWarnings(): void {
        // Check for low FPS
        if (this.currentFPS > 0 && this.currentFPS < 15 && !this.lowFPSWarningShown && !this.isInteracting) {
            this.emitPerformanceWarning({
                type: 'low-fps',
                message: `Low frame rate detected (${this.currentFPS.toFixed(1)} FPS)`,
                suggestion: 'Try reducing quality settings or using a smaller volume',
                data: { fps: this.currentFPS, quality: this.currentQuality }
            })
            this.lowFPSWarningShown = true
        }
        
        // Reset low FPS warning if performance improves
        if (this.currentFPS >= 20) {
            this.lowFPSWarningShown = false
        }
        
        // Check for high GPU memory usage
        if (this.volumeMemoryMB > 400 && !this.largeVolumeWarningShown) {
            this.emitPerformanceWarning({
                type: 'high-memory',
                message: `High GPU memory usage (${this.volumeMemoryMB.toFixed(0)} MB)`,
                suggestion: 'Consider reducing volume size or closing other GPU-intensive applications',
                data: { memoryMB: this.volumeMemoryMB }
            })
            this.largeVolumeWarningShown = true
        }
    }
    
    /**
     * Warn about large volume before loading
     * 
     * @param volumeData - Volume data to check
     */
    private checkLargeVolumeWarning(volumeData: VolumeData): void {
        const { width, height, depth } = volumeData.dimensions
        const numVoxels = width * height * depth
        const requiredMB = (numVoxels * 4) / (1024 * 1024)
        
        // Warn if volume is very large
        if (depth > 300 || requiredMB > 300) {
            this.emitPerformanceWarning({
                type: 'large-volume',
                message: `Large volume detected (${width}×${height}×${depth}, ${requiredMB.toFixed(0)} MB)`,
                suggestion: 'Loading may take longer. Consider using progressive loading or reducing volume size.',
                data: { dimensions: { width, height, depth }, memoryMB: requiredMB }
            })
        }
    }
    
    /**
     * Get current performance metrics
     * 
     * @returns Current FPS, render time, and GPU memory usage
     */
    public getPerformanceMetrics(): PerformanceMetrics {
        return {
            fps: this.currentFPS,
            renderTime: this.lastRenderTime,
            gpuMemoryMB: this.volumeMemoryMB
        }
    }
    
    /**
     * Calculate FPS from frame timestamps
     * Uses rolling average over the last second
     */
    private calculateFPS(): void {
        const now = performance.now()
        
        // Add current timestamp
        this.frameTimestamps.push(now)
        
        // Remove timestamps older than 1 second
        const oneSecondAgo = now - 1000
        this.frameTimestamps = this.frameTimestamps.filter(t => t > oneSecondAgo)
        
        // Calculate FPS (frames in last second)
        this.currentFPS = this.frameTimestamps.length
        
        // Check for performance warnings
        this.checkPerformanceWarnings()
        
        // Update callback if enough time has passed
        if (now - this.lastFPSUpdate > this.fpsUpdateInterval) {
            this.lastFPSUpdate = now
            this.notifyPerformanceUpdate()
        }
    }
    
    /**
     * Notify performance callback with current metrics
     */
    private notifyPerformanceUpdate(): void {
        if (this.performanceCallback) {
            this.performanceCallback({
                fps: this.currentFPS,
                renderTime: this.lastRenderTime,
                gpuMemoryMB: this.volumeMemoryMB
            })
        }
    }
    
    /**
     * Estimate GPU memory usage
     * Calculates texture memory based on volume dimensions and data type
     */
    private estimateGPUMemory(): void {
        if (!this.imageData) {
            this.volumeMemoryMB = 0
            return
        }
        
        try {
            const dimensions = this.imageData.getDimensions()
            const [width, height, depth] = dimensions
            
            // Calculate number of voxels
            const numVoxels = width * height * depth
            
            // Float32Array = 4 bytes per voxel
            const bytesPerVoxel = 4
            
            // Total memory in bytes
            const totalBytes = numVoxels * bytesPerVoxel
            
            // Convert to MB
            this.volumeMemoryMB = totalBytes / (1024 * 1024)
            
            console.log(`📊 Estimated GPU memory: ${this.volumeMemoryMB.toFixed(2)} MB`)
            
        } catch (error) {
            console.warn('Failed to estimate GPU memory:', error)
            this.volumeMemoryMB = 0
        }
    }
    
    /**
     * Start auto-rotation
     * Continuously rotates the volume around the vertical axis
     * 
     * @param speed - Rotation speed in degrees per frame (default: 1.0)
     */
    public startAutoRotation(speed: number = 1.0): void {
        if (this.autoRotationEnabled) {
            console.warn('Auto-rotation already enabled')
            return
        }
        
        if (!this.camera) {
            console.warn('Camera not initialized')
            return
        }
        
        this.autoRotationSpeed = speed
        this.autoRotationEnabled = true
        
        console.log(`🔄 Starting auto-rotation (speed: ${speed}°/frame)`)
        
        // Start animation loop
        this.autoRotationLoop()
    }
    
    /**
     * Stop auto-rotation
     */
    public stopAutoRotation(): void {
        if (!this.autoRotationEnabled) {
            return
        }
        
        this.autoRotationEnabled = false
        
        // Cancel animation frame
        if (this.autoRotationAnimationId !== undefined) {
            cancelAnimationFrame(this.autoRotationAnimationId)
            this.autoRotationAnimationId = undefined
        }
        
        console.log('⏸️ Auto-rotation stopped')
    }
    
    /**
     * Check if auto-rotation is enabled
     */
    public isAutoRotationEnabled(): boolean {
        return this.autoRotationEnabled
    }
    
    /**
     * Get current auto-rotation speed
     */
    public getAutoRotationSpeed(): number {
        return this.autoRotationSpeed
    }
    
    /**
     * Set auto-rotation speed
     * 
     * @param speed - Rotation speed in degrees per frame
     */
    public setAutoRotationSpeed(speed: number): void {
        this.autoRotationSpeed = speed
        console.log(`⚙️ Auto-rotation speed set to: ${speed}°/frame`)
    }
    
    /**
     * Auto-rotation animation loop
     * Uses requestAnimationFrame for smooth rotation
     */
    private autoRotationLoop = (): void => {
        if (!this.autoRotationEnabled) {
            return
        }
        
        try {
            // Rotate camera by the configured speed
            if (this.camera) {
                this.camera.azimuth(this.autoRotationSpeed)
                this.camera.orthogonalizeViewUp()
            }
            
            // Render the frame
            this.render()
            
            // Schedule next frame
            this.autoRotationAnimationId = requestAnimationFrame(this.autoRotationLoop)
            
        } catch (error) {
            console.error('❌ Error in auto-rotation loop:', error)
            this.stopAutoRotation()
        }
    }
    
    /**
     * Trigger a render with performance tracking
     */
    public render(): void {
        if (!this.renderWindow) return
        
        // Start timing
        const startTime = performance.now()
        
        try {
            // Perform render
            this.renderWindow.render()
            
            // End timing
            const endTime = performance.now()
            this.lastRenderTime = endTime - startTime
            
            // Update FPS
            this.calculateFPS()
            
        } catch (error) {
            console.error('Render error:', error)
        }
    }
    
    /**
     * Resize the renderer
     */
    public resize(): void {
        if (this.fullScreenRenderer) {
            this.fullScreenRenderer.resize()
        }
    }
    
    /**
     * Clean up all VTK.js resources
     * 
     * **CRITICAL: Must be called when component unmounts to prevent memory leaks!**
     * 
     * This method performs comprehensive cleanup of all VTK.js objects and WebGL resources:
     * 
     * 1. **Stop Active Processes**
     *    - Stops auto-rotation animation
     *    - Clears quality restore timeout
     *    - Cancels any pending operations
     * 
     * 2. **Remove Volume from Scene**
     *    - Removes volume actor from renderer
     *    - Prevents rendering of disposed volume
     * 
     * 3. **Delete VTK.js Objects**
     *    - Deletes all tracked VTK.js objects (volume, mapper, imageData, etc.)
     *    - Calls `.delete()` on each object to free internal resources
     *    - Clears resource tracking array
     * 
     * 4. **Remove Event Listeners**
     *    - Unbinds mouse interaction events
     *    - Removes WebGL context loss handlers
     *    - Prevents memory leaks from event listeners
     * 
     * 5. **Release WebGL Context**
     *    - Deletes full screen renderer
     *    - Releases WebGL context and GPU memory
     *    - Frees all GPU textures and buffers
     * 
     * 6. **Reset State**
     *    - Clears all references to VTK.js objects
     *    - Resets performance metrics
     *    - Resets configuration to defaults
     * 
     * **Memory Leak Prevention:**
     * 
     * Failing to call `dispose()` will result in:
     * - GPU memory leaks (3D textures remain in GPU memory)
     * - CPU memory leaks (VTK.js objects remain in memory)
     * - Event listener leaks (mouse events continue firing)
     * - WebGL context leaks (contexts not released)
     * 
     * **React Integration:**
     * 
     * Always call `dispose()` in the cleanup function of `useEffect`:
     * ```typescript
     * useEffect(() => {
     *   const renderer = new VTKVolumeRenderer(containerRef.current);
     *   
     *   return () => {
     *     renderer.dispose(); // Cleanup on unmount
     *   };
     * }, []);
     * ```
     * 
     * **Multiple Volumes:**
     * 
     * When loading multiple volumes sequentially, you don't need to call `dispose()`
     * between volumes. The renderer will clean up the previous volume automatically.
     * Only call `dispose()` when you're done with the renderer entirely.
     * 
     * @example
     * // Basic cleanup
     * const renderer = new VTKVolumeRenderer(container);
     * await renderer.loadVolume(volumeData);
     * // ... use renderer ...
     * renderer.dispose(); // Clean up when done
     * 
     * @example
     * // React hook cleanup
     * function VolumeViewer() {
     *   const containerRef = useRef<HTMLDivElement>(null);
     *   const rendererRef = useRef<VTKVolumeRenderer | null>(null);
     *   
     *   useEffect(() => {
     *     if (containerRef.current) {
     *       rendererRef.current = new VTKVolumeRenderer(containerRef.current);
     *     }
     *     
     *     return () => {
     *       // Cleanup on unmount
     *       if (rendererRef.current) {
     *         rendererRef.current.dispose();
     *         rendererRef.current = null;
     *       }
     *     };
     *   }, []);
     *   
     *   return <div ref={containerRef} />;
     * }
     * 
     * @example
     * // Cleanup with error handling
     * try {
     *   renderer.dispose();
     *   console.log('Renderer disposed successfully');
     * } catch (error) {
     *   console.error('Error during cleanup:', error);
     *   // Cleanup still completes even if errors occur
     * }
     */
    public dispose(): void {
        console.log('🧹 Disposing VTK.js renderer and releasing GPU resources...')
        
        try {
            // Remove volume from renderer first
            if (this.volume && this.renderer) {
                try {
                    this.renderer.removeVolume(this.volume)
                    console.log('  ✓ Volume removed from renderer')
                } catch (error) {
                    console.warn('  ⚠ Failed to remove volume from renderer:', error)
                }
            }
            
            // Delete volume actor
            if (this.volume) {
                try {
                    this.volume.delete()
                    this.volume = null
                    console.log('  ✓ Volume actor deleted')
                } catch (error) {
                    console.warn('  ⚠ Failed to delete volume:', error)
                }
            }
            
            // Delete volume mapper
            if (this.volumeMapper) {
                try {
                    this.volumeMapper.delete()
                    this.volumeMapper = null
                    console.log('  ✓ Volume mapper deleted')
                } catch (error) {
                    console.warn('  ⚠ Failed to delete volume mapper:', error)
                }
            }
            
            // Delete image data (releases GPU texture)
            if (this.imageData) {
                try {
                    this.imageData.delete()
                    this.imageData = null
                    console.log('  ✓ Image data deleted (GPU texture released)')
                } catch (error) {
                    console.warn('  ⚠ Failed to delete image data:', error)
                }
            }
            
            // Delete all tracked resources (transfer functions, data arrays, etc.)
            let deletedCount = 0
            this.resources.forEach(resource => {
                if (resource && typeof resource.delete === 'function') {
                    try {
                        resource.delete()
                        deletedCount++
                    } catch (error) {
                        console.warn('  ⚠ Failed to delete resource:', error)
                    }
                }
            })
            this.resources = []
            console.log(`  ✓ ${deletedCount} additional resources deleted`)
            
            // Clean up interactor
            if (this.interactor) {
                try {
                    this.interactor.unbindEvents()
                    this.interactor = null
                    console.log('  ✓ Interactor unbound')
                } catch (error) {
                    console.warn('  ⚠ Failed to unbind interactor:', error)
                }
            }
            
            // Remove context loss event listeners
            const context = this.getContext()
            if (context && context.canvas) {
                try {
                    if (this.contextLostHandler) {
                        context.canvas.removeEventListener('webglcontextlost', this.contextLostHandler)
                    }
                    if (this.contextRestoredHandler) {
                        context.canvas.removeEventListener('webglcontextrestored', this.contextRestoredHandler)
                    }
                    console.log('  ✓ Context loss handlers removed')
                } catch (error) {
                    console.warn('  ⚠ Failed to remove context loss handlers:', error)
                }
            }
            this.contextLostHandler = undefined
            this.contextRestoredHandler = undefined
            
            // Clean up full screen renderer (releases WebGL context)
            if (this.fullScreenRenderer) {
                try {
                    this.fullScreenRenderer.delete()
                    this.fullScreenRenderer = null
                    console.log('  ✓ Full screen renderer deleted (WebGL context released)')
                } catch (error) {
                    console.warn('  ⚠ Failed to delete full screen renderer:', error)
                }
            }
            
            // Clear references
            this.renderer = null
            this.renderWindow = null
            this.camera = null
            
            // Clear interactor style reference
            this.interactorStyle = null
            
            // Clear adaptive quality timeout
            if (this.restoreQualityTimeout) {
                clearTimeout(this.restoreQualityTimeout)
                this.restoreQualityTimeout = undefined
            }
            
            // Stop auto-rotation
            this.stopAutoRotation()
            
            // Reset state
            this.isInitialized = false
            this.currentRenderMode = 'volume'
            this.currentQuality = 'medium'
            this.isInteractionEnabled = false
            this.isInteracting = false
            this.savedQuality = undefined
            this.autoRotationEnabled = false
            this.autoRotationSpeed = 1.0
            
            // Reset performance metrics
            this.frameTimestamps = []
            this.lastFrameTime = 0
            this.currentFPS = 0
            this.lastRenderTime = 0
            this.lastFPSUpdate = 0
            this.volumeMemoryMB = 0
            this.performanceCallback = undefined
            
            // Reset context loss state
            this.isContextLost = false
            this.lastVolumeData = undefined
            this.contextLostCallback = undefined
            
            console.log('✅ VTK.js renderer fully disposed - all GPU resources released')
            
        } catch (error) {
            console.error('❌ Error during VTK.js cleanup:', error)
            // Even if cleanup fails, mark as not initialized
            this.isInitialized = false
        }
    }
}

/**
 * @example Complete Usage Example
 * 
 * ```typescript
 * // ============================================================================
 * // Complete VTK.js Volume Renderer Usage Example
 * // ============================================================================
 * 
 * import { VTKVolumeRenderer } from './volumeRendererVTK';
 * import type { VolumeData, TransferFunction } from './volumeRenderer';
 * 
 * // ----------------------------------------------------------------------------
 * // 1. Initialize Renderer
 * // ----------------------------------------------------------------------------
 * 
 * const container = document.getElementById('viewer-3d') as HTMLElement;
 * let renderer: VTKVolumeRenderer;
 * 
 * try {
 *   renderer = new VTKVolumeRenderer(container);
 *   console.log('✅ Renderer initialized');
 * } catch (error) {
 *   console.error('❌ Failed to initialize renderer:', error);
 *   // Fall back to canvas renderer
 *   throw error;
 * }
 * 
 * // ----------------------------------------------------------------------------
 * // 2. Load Volume Data
 * // ----------------------------------------------------------------------------
 * 
 * // Prepare volume data (e.g., from DICOM images)
 * const volumeData: VolumeData = {
 *   data: new Float32Array(512 * 512 * 100), // 100 slices of 512×512
 *   dimensions: {
 *     width: 512,
 *     height: 512,
 *     depth: 100
 *   },
 *   spacing: {
 *     x: 0.5,  // 0.5mm pixel spacing
 *     y: 0.5,  // 0.5mm pixel spacing
 *     z: 1.0   // 1.0mm slice thickness
 *   }
 * };
 * 
 * // Load with progress tracking
 * try {
 *   await renderer.loadVolume(volumeData, (progress) => {
 *     console.log(`Loading: ${(progress * 100).toFixed(0)}%`);
 *     // Update progress bar in UI
 *     updateProgressBar(progress);
 *   });
 *   console.log('✅ Volume loaded');
 * } catch (error) {
 *   console.error('❌ Failed to load volume:', error);
 *   throw error;
 * }
 * 
 * // ----------------------------------------------------------------------------
 * // 3. Configure Rendering
 * // ----------------------------------------------------------------------------
 * 
 * // Set render mode
 * renderer.setRenderMode('volume'); // or 'mip' or 'isosurface'
 * 
 * // Set quality
 * renderer.setQuality('medium'); // or 'low' or 'high'
 * 
 * // Apply CT-Bone transfer function
 * const ctBonePreset: TransferFunction = {
 *   opacityPoints: [
 *     { value: 0.0, opacity: 0.0 },
 *     { value: 0.3, opacity: 0.0 },
 *     { value: 0.5, opacity: 0.5 },
 *     { value: 1.0, opacity: 1.0 }
 *   ],
 *   colorPoints: [
 *     { value: 0.0, r: 0.0, g: 0.0, b: 0.0 },
 *     { value: 0.5, r: 0.8, g: 0.7, b: 0.6 },
 *     { value: 1.0, r: 1.0, g: 1.0, b: 1.0 }
 *   ]
 * };
 * 
 * // Apply transfer function (CT Hounsfield units: -1024 to 3071)
 * renderer.setTransferFunction(ctBonePreset, -1024, 3071);
 * 
 * // Adjust global opacity
 * renderer.setOpacity(0.8);
 * 
 * // ----------------------------------------------------------------------------
 * // 4. Set Up Performance Monitoring
 * // ----------------------------------------------------------------------------
 * 
 * renderer.setPerformanceCallback((metrics) => {
 *   console.log(`FPS: ${metrics.fps}`);
 *   console.log(`Render Time: ${metrics.renderTime.toFixed(2)}ms`);
 *   console.log(`GPU Memory: ${metrics.gpuMemoryMB.toFixed(2)}MB`);
 *   
 *   // Update UI with metrics
 *   updatePerformanceDisplay(metrics);
 *   
 *   // Adaptive quality based on FPS
 *   if (metrics.fps < 15) {
 *     console.warn('⚠️ Low FPS detected, reducing quality');
 *     renderer.setQuality('low');
 *   }
 * });
 * 
 * // ----------------------------------------------------------------------------
 * // 5. Camera Controls
 * // ----------------------------------------------------------------------------
 * 
 * // Reset camera to fit volume
 * renderer.resetCamera();
 * 
 * // Manual camera control
 * renderer.rotateCamera(45, 30); // Rotate 45° horizontally, 30° vertically
 * renderer.zoomCamera(1.5);      // Zoom in 1.5x
 * renderer.panCamera(10, -5);    // Pan right 10, down 5
 * 
 * // Auto-rotation
 * renderer.startAutoRotation(1.0); // Rotate 1° per frame
 * 
 * // Stop auto-rotation after 5 seconds
 * setTimeout(() => {
 *   renderer.stopAutoRotation();
 * }, 5000);
 * 
 * // ----------------------------------------------------------------------------
 * // 6. WebGL Context Loss Handling
 * // ----------------------------------------------------------------------------
 * 
 * renderer.setContextLostCallback((lost) => {
 *   if (lost) {
 *     console.error('⚠️ WebGL context lost!');
 *     showNotification('WebGL context lost. Attempting recovery...');
 *   } else {
 *     console.log('✅ WebGL context restored!');
 *     showNotification('WebGL context restored successfully.');
 *   }
 * });
 * 
 * // ----------------------------------------------------------------------------
 * // 7. Interactive Controls
 * // ----------------------------------------------------------------------------
 * 
 * // Quality buttons
 * document.getElementById('btn-low')?.addEventListener('click', () => {
 *   renderer.setQuality('low');
 * });
 * 
 * document.getElementById('btn-medium')?.addEventListener('click', () => {
 *   renderer.setQuality('medium');
 * });
 * 
 * document.getElementById('btn-high')?.addEventListener('click', () => {
 *   renderer.setQuality('high');
 * });
 * 
 * // Render mode buttons
 * document.getElementById('btn-mip')?.addEventListener('click', () => {
 *   renderer.setRenderMode('mip');
 * });
 * 
 * document.getElementById('btn-volume')?.addEventListener('click', () => {
 *   renderer.setRenderMode('volume');
 * });
 * 
 * document.getElementById('btn-isosurface')?.addEventListener('click', () => {
 *   renderer.setRenderMode('isosurface');
 * });
 * 
 * // Opacity slider
 * document.getElementById('opacity-slider')?.addEventListener('input', (e) => {
 *   const opacity = parseFloat((e.target as HTMLInputElement).value);
 *   renderer.setOpacity(opacity);
 * });
 * 
 * // Reset camera button
 * document.getElementById('btn-reset-camera')?.addEventListener('click', () => {
 *   renderer.resetCamera();
 * });
 * 
 * // Auto-rotation toggle
 * let autoRotating = false;
 * document.getElementById('btn-auto-rotate')?.addEventListener('click', () => {
 *   if (autoRotating) {
 *     renderer.stopAutoRotation();
 *     autoRotating = false;
 *   } else {
 *     renderer.startAutoRotation(1.0);
 *     autoRotating = true;
 *   }
 * });
 * 
 * // ----------------------------------------------------------------------------
 * // 8. Window Resize Handling
 * // ----------------------------------------------------------------------------
 * 
 * window.addEventListener('resize', () => {
 *   renderer.resize();
 * });
 * 
 * // ----------------------------------------------------------------------------
 * // 9. Cleanup on Page Unload
 * // ----------------------------------------------------------------------------
 * 
 * window.addEventListener('beforeunload', () => {
 *   renderer.dispose();
 * });
 * 
 * // Or in React:
 * // useEffect(() => {
 * //   return () => {
 * //     renderer.dispose();
 * //   };
 * // }, []);
 * 
 * // ----------------------------------------------------------------------------
 * // 10. Advanced: Screenshot Capture
 * // ----------------------------------------------------------------------------
 * 
 * async function captureScreenshot(): Promise<string | undefined> {
 *   // Save current quality
 *   const originalQuality = renderer.getQuality();
 *   
 *   // Switch to high quality for screenshot
 *   renderer.setQuality('high');
 *   
 *   // Wait for high-quality render
 *   await new Promise(resolve => setTimeout(resolve, 200));
 *   
 *   // Get canvas and capture
 *   const context = renderer.getContext();
 *   const canvas = context?.canvas as HTMLCanvasElement;
 *   const dataUrl = canvas?.toDataURL('image/png');
 *   
 *   // Restore original quality
 *   renderer.setQuality(originalQuality);
 *   
 *   return dataUrl;
 * }
 * 
 * // ----------------------------------------------------------------------------
 * // 11. Advanced: Multiple Transfer Function Presets
 * // ----------------------------------------------------------------------------
 * 
 * const transferFunctionPresets = {
 *   'CT-Bone': {
 *     opacityPoints: [
 *       { value: 0.0, opacity: 0.0 },
 *       { value: 0.3, opacity: 0.0 },
 *       { value: 0.5, opacity: 0.5 },
 *       { value: 1.0, opacity: 1.0 }
 *     ],
 *     colorPoints: [
 *       { value: 0.0, r: 0.0, g: 0.0, b: 0.0 },
 *       { value: 0.5, r: 0.8, g: 0.7, b: 0.6 },
 *       { value: 1.0, r: 1.0, g: 1.0, b: 1.0 }
 *     ]
 *   },
 *   'CT-Soft-Tissue': {
 *     opacityPoints: [
 *       { value: 0.0, opacity: 0.0 },
 *       { value: 0.2, opacity: 0.1 },
 *       { value: 0.4, opacity: 0.3 },
 *       { value: 1.0, opacity: 0.8 }
 *     ],
 *     colorPoints: [
 *       { value: 0.0, r: 0.0, g: 0.0, b: 0.0 },
 *       { value: 0.5, r: 0.9, g: 0.5, b: 0.3 },
 *       { value: 1.0, r: 1.0, g: 1.0, b: 1.0 }
 *     ]
 *   },
 *   'MR-Default': {
 *     opacityPoints: [
 *       { value: 0.0, opacity: 0.0 },
 *       { value: 0.2, opacity: 0.2 },
 *       { value: 0.5, opacity: 0.5 },
 *       { value: 1.0, opacity: 1.0 }
 *     ],
 *     colorPoints: [
 *       { value: 0.0, r: 0.0, g: 0.0, b: 0.0 },
 *       { value: 0.5, r: 0.5, g: 0.5, b: 0.8 },
 *       { value: 1.0, r: 1.0, g: 1.0, b: 1.0 }
 *     ]
 *   }
 * };
 * 
 * function applyPreset(presetName: keyof typeof transferFunctionPresets) {
 *   const preset = transferFunctionPresets[presetName];
 *   renderer.setTransferFunction(preset, -1024, 3071);
 * }
 * 
 * // Apply preset
 * applyPreset('CT-Bone');
 * 
 * // ============================================================================
 * // End of Complete Usage Example
 * // ============================================================================
 * ```
 */
