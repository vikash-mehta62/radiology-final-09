import { useState, useEffect, useCallback, useRef } from 'react'
import {
  VolumeData,
  Camera,
  TransferFunction,
  RenderSettings,
  createVolumeFromFrames,
  renderMIP,
  renderVolume,
  rotateCamera,
  TRANSFER_FUNCTIONS
} from '../utils/volumeRenderer'
import { detectWebGL, checkVolumeRenderingCapabilities } from '../utils/webglDetection'
import { createVTKRenderer, preloadVTK as preloadVTKModule, isVTKLoaded } from '../utils/volumeRendererVTKLazy'
import type { QualityLevel, RenderMode, PerformanceWarning } from '../utils/volumeRendererVTKLazy'
import type { VTKVolumeRenderer } from '../utils/volumeRendererVTK'

export interface UseVolumeRendererOptions {
  frameUrls: string[]
  canvasRef: React.RefObject<HTMLCanvasElement>
  containerRef: React.RefObject<HTMLDivElement>
  enabled: boolean
  useProgressiveLoading?: boolean // Enable progressive loading for large volumes
  preloadOnMount?: boolean // Preload VTK.js on mount when WebGL is supported
}

export type RendererType = 'vtk' | 'canvas'

export function useVolumeRenderer({
  frameUrls,
  canvasRef,
  containerRef,
  enabled,
  useProgressiveLoading = false,
  preloadOnMount = false
}: UseVolumeRendererOptions) {
  // Renderer type detection and state
  const [rendererType, setRendererType] = useState<RendererType>('canvas')
  const [webglCapabilities, setWebglCapabilities] = useState<ReturnType<typeof detectWebGL> | null>(null)
  
  const [volume, setVolume] = useState<VolumeData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadProgress, setLoadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  
  const [camera, setCamera] = useState<Camera>({
    position: { x: 0, y: 0, z: 300 },
    target: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },
    fov: 45
  })
  
  const [renderSettings, setRenderSettings] = useState<RenderSettings>({
    mode: 'volume',
    stepSize: 0.5,
    brightness: 1.0,
    contrast: 1.0
  })
  
  const [transferFunction, setTransferFunction] = useState<TransferFunction>(
    TRANSFER_FUNCTIONS['CT-Bone']
  )
  
  const [isRotating, setIsRotating] = useState(false)
  const [isInteracting, setIsInteracting] = useState(false)
  const [renderQuality, setRenderQuality] = useState<'low' | 'medium' | 'high'>('high')
  const [renderTime, setRenderTime] = useState(0)
  const [useWebWorker, setUseWebWorker] = useState(true)
  const [fps, setFps] = useState(0)
  const [gpuMemoryMB, setGpuMemoryMB] = useState(0)
  const [loadingStage, setLoadingStage] = useState<'low' | 'medium' | 'high' | null>(null)
  const [performanceWarning, setPerformanceWarning] = useState<PerformanceWarning | null>(null)
  
  const rotationRef = useRef<number | null>(null)
  const lastMousePos = useRef<{ x: number; y: number } | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const renderCacheRef = useRef<Map<string, ImageData>>(new Map())
  const isRenderingRef = useRef(false)
  const vtkRendererRef = useRef<VTKVolumeRenderer | null>(null)
  
  // Detect WebGL capabilities on mount
  useEffect(() => {
    // Detect WebGL capabilities on mount
    if (import.meta.env.DEV) {
      console.log('🔍 Detecting WebGL capabilities...')
    }
    const capabilities = detectWebGL()
    setWebglCapabilities(capabilities)
    
    const check = checkVolumeRenderingCapabilities(capabilities)
    
    if (check.canRender) {
      if (import.meta.env.DEV) {
        console.log('✅ WebGL 2.0 supported - using VTK.js renderer')
      }
      if (check.warnings.length > 0) {
        if (import.meta.env.DEV) {
          console.warn('⚠️ WebGL warnings:', check.warnings)
        }
      }
      setRendererType('vtk')
      
      // Optional: Preload VTK.js in the background when explicitly enabled
      // Defaults to disabled to reduce initial load
      if (preloadOnMount && enabled) {
        if (import.meta.env.DEV) {
          console.log('🔄 Preloading VTK.js in background...')
        }
        preloadVTKModule().catch(err => {
          if (import.meta.env.DEV) {
            console.warn('⚠️ Failed to preload VTK.js:', err)
          }
          // Not a critical error - VTK will be loaded when needed
        })
      }
    } else {
      if (import.meta.env.DEV) {
        console.warn('⚠️ WebGL not suitable for VTK.js - using canvas fallback')
        console.warn('   Reasons:', check.reasons)
      }
      setRendererType('canvas')
    }
  }, [])
  
  // Initialize VTK.js renderer when renderer type is 'vtk'
  useEffect(() => {
    if (rendererType !== 'vtk' || !enabled) {
      return
    }
    
    // Use the provided container ref for VTK.js
    if (!containerRef.current) {
      console.warn('⚠️ Container ref not available for VTK.js renderer')
      return
    }
    
    // Initialize VTK.js renderer with lazy loading
    if (!vtkRendererRef.current) {
      const initializeVTK = async () => {
        try {
          console.log('🎨 Initializing VTK.js renderer (lazy loading)...')
          
          // Check if VTK is already loaded
          if (!isVTKLoaded()) {
            console.log('📥 VTK.js not loaded yet - loading now...')
            setIsLoading(true)
            setLoadProgress(0)
          }
          
          // Create VTK renderer (lazy loads VTK.js on first call)
          const renderer = await createVTKRenderer(containerRef.current!)
          vtkRendererRef.current = renderer
          
          // Set up performance monitoring callback
          vtkRendererRef.current.setPerformanceCallback((metrics) => {
            setFps(metrics.fps)
            setRenderTime(metrics.renderTime)
            setGpuMemoryMB(metrics.gpuMemoryMB)
          })
          
          // Set up performance warning callback
          vtkRendererRef.current.setPerformanceWarningCallback((warning) => {
            setPerformanceWarning(warning)
            console.warn('⚠️ Performance warning:', warning)
          })
          
          console.log('✅ VTK.js renderer initialized')
          
          // Clear loading state if we set it
          if (!isVTKLoaded()) {
            setIsLoading(false)
            setLoadProgress(100)
          }
          
        } catch (err) {
          console.error('❌ Failed to initialize VTK.js renderer:', err)
          setError(err instanceof Error ? err.message : 'Failed to initialize VTK.js renderer')
          setIsLoading(false)
          
          // Fall back to canvas
          console.log('   Falling back to canvas renderer')
          setRendererType('canvas')
        }
      }
      
      initializeVTK()
    }
    
    return () => {
      // Cleanup will be handled in a separate effect
    }
  }, [rendererType, enabled, containerRef])
  
  // Load volume from frames (unified for both renderers)
  const loadVolume = useCallback(async () => {
    if (!enabled || frameUrls.length === 0) return
    
    setIsLoading(true)
    setError(null)
    setLoadProgress(0)
    
    try {
      const volumeData = await createVolumeFromFrames(
        frameUrls,
        (loaded, total) => {
          setLoadProgress((loaded / total) * 100)
        }
      )
      
      setVolume(volumeData)
      
      // Load into VTK.js renderer if using VTK
      if (rendererType === 'vtk' && vtkRendererRef.current) {
        try {
          // Use progressive loading for large volumes or if explicitly enabled
          const shouldUseProgressive = useProgressiveLoading || volumeData.dimensions.depth > 150
          
          if (shouldUseProgressive) {
            console.log('📊 Using progressive loading for better user experience')
            
            await vtkRendererRef.current.loadVolumeProgressive(
              volumeData,
              (progress) => {
                setLoadProgress(progress * 100)
              },
              (stage) => {
                setLoadingStage(stage)
                console.log(`  ✅ ${stage} quality stage complete`)
              }
            )
            
            setLoadingStage(null)
          } else {
            await vtkRendererRef.current.loadVolume(volumeData, (progress) => {
              setLoadProgress(progress * 100)
            })
          }
          
          // Reset camera to view volume
          vtkRendererRef.current.resetCamera()
          
          console.log('✅ Volume loaded into VTK.js renderer')
        } catch (vtkErr) {
          console.error('❌ Failed to load volume into VTK.js:', vtkErr)
          setError(vtkErr instanceof Error ? vtkErr.message : 'Failed to load volume into VTK.js')
          // Fall back to canvas
          console.log('   Falling back to canvas renderer')
          setRendererType('canvas')
          if (canvasRef.current) {
            canvasRef.current.style.display = 'block'
          }
        }
      }
      
      // Set camera to view volume (for canvas renderer)
      if (rendererType === 'canvas') {
        const { width, height, depth } = volumeData.dimensions
        const maxDim = Math.max(width, height, depth)
        setCamera(prev => ({
          ...prev,
          position: { x: width / 2, y: height / 2, z: maxDim * 1.5 },
          target: { x: width / 2, y: height / 2, z: depth / 2 }
        }))
      }
      
      console.log('✅ Volume loaded successfully')
    } catch (err) {
      console.error('Failed to load volume:', err)
      setError(err instanceof Error ? err.message : 'Failed to load volume')
    } finally {
      setIsLoading(false)
    }
  }, [enabled, frameUrls, rendererType, canvasRef])
  
  // Initialize Web Worker
  useEffect(() => {
    if (useWebWorker && !workerRef.current) {
      try {
        workerRef.current = new Worker(
          new URL('../workers/volumeRenderer.worker.ts', import.meta.url),
          { type: 'module' }
        )
        
        workerRef.current.onmessage = (e) => {
          if (e.data.type === 'rendered') {
            const canvas = canvasRef.current
            if (canvas) {
              const ctx = canvas.getContext('2d')
              if (ctx) {
                ctx.putImageData(e.data.imageData, 0, 0)
                setRenderTime(e.data.renderTime)
              }
            }
            isRenderingRef.current = false
          } else if (e.data.type === 'error') {
            console.error('Worker render error:', e.data.error)
            isRenderingRef.current = false
          }
        }
        
        console.log('✅ Web Worker initialized')
      } catch (err) {
        console.warn('Web Worker not available, falling back to main thread:', err)
        setUseWebWorker(false)
      }
    }
    
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
    }
  }, [useWebWorker, canvasRef])
  
  // Get cache key for current view
  const getCacheKey = useCallback(() => {
    return `${camera.position.x.toFixed(1)},${camera.position.y.toFixed(1)},${camera.position.z.toFixed(1)}-${renderSettings.mode}-${renderQuality}`
  }, [camera, renderSettings.mode, renderQuality])
  
  // Render volume to canvas with optimizations (canvas renderer only)
  const render = useCallback(() => {
    // Only use canvas rendering when renderer type is 'canvas'
    if (rendererType !== 'canvas') return
    
    if (!volume || !canvasRef.current || isRenderingRef.current) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Check cache first
    const cacheKey = getCacheKey()
    const cached = renderCacheRef.current.get(cacheKey)
    if (cached && !isInteracting) {
      ctx.putImageData(cached, 0, 0)
      console.log('📦 Using cached render')
      return
    }
    
    // Adaptive resolution based on interaction and quality
    let renderWidth = canvas.width
    let renderHeight = canvas.height
    
    if (isInteracting || renderQuality === 'low') {
      renderWidth = Math.floor(canvas.width / 2)
      renderHeight = Math.floor(canvas.height / 2)
    } else if (renderQuality === 'medium') {
      renderWidth = Math.floor(canvas.width * 0.75)
      renderHeight = Math.floor(canvas.height * 0.75)
    }
    
    // Adaptive step size
    const adaptiveSettings = {
      ...renderSettings,
      stepSize: isInteracting ? renderSettings.stepSize * 2 : renderSettings.stepSize
    }
    
    console.log(`🎨 Rendering ${renderSettings.mode} at ${renderWidth}x${renderHeight} (quality: ${renderQuality})`)
    
    isRenderingRef.current = true
    const startTime = performance.now()
    
    try {
      // Use Web Worker if available
      if (useWebWorker && workerRef.current) {
        workerRef.current.postMessage({
          type: 'render',
          volume,
          camera,
          transferFunction,
          settings: adaptiveSettings,
          width: renderWidth,
          height: renderHeight
        })
      } else {
        // Fallback to main thread
        let imageData: ImageData
        
        if (renderSettings.mode === 'mip') {
          imageData = renderMIP(volume, camera, renderWidth, renderHeight)
        } else if (renderSettings.mode === 'volume') {
          imageData = renderVolume(
            volume,
            camera,
            transferFunction,
            renderWidth,
            renderHeight,
            adaptiveSettings.stepSize
          )
        } else {
          const isoTransferFunction: TransferFunction = {
            opacityPoints: [
              { value: 0, opacity: 0 },
              { value: (renderSettings.isoValue || 0.5) - 0.05, opacity: 0 },
              { value: renderSettings.isoValue || 0.5, opacity: 1 },
              { value: 1, opacity: 1 }
            ],
            colorPoints: transferFunction.colorPoints
          }
          imageData = renderVolume(
            volume,
            camera,
            isoTransferFunction,
            renderWidth,
            renderHeight,
            adaptiveSettings.stepSize
          )
        }
        
        // Apply brightness
        if (renderSettings.brightness !== 1.0) {
          const pixels = imageData.data
          for (let i = 0; i < pixels.length; i += 4) {
            pixels[i] = Math.min(255, pixels[i] * renderSettings.brightness)
            pixels[i + 1] = Math.min(255, pixels[i + 1] * renderSettings.brightness)
            pixels[i + 2] = Math.min(255, pixels[i + 2] * renderSettings.brightness)
          }
        }
        
        // Scale to canvas size if needed
        if (renderWidth !== canvas.width || renderHeight !== canvas.height) {
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = renderWidth
          tempCanvas.height = renderHeight
          const tempCtx = tempCanvas.getContext('2d')!
          tempCtx.putImageData(imageData, 0, 0)
          
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height)
        } else {
          ctx.putImageData(imageData, 0, 0)
        }
        
        const renderTime = performance.now() - startTime
        setRenderTime(renderTime)
        
        // Cache high-quality renders
        if (!isInteracting && renderQuality === 'high') {
          renderCacheRef.current.set(cacheKey, imageData)
          
          // Limit cache size
          if (renderCacheRef.current.size > 20) {
            const firstKey = renderCacheRef.current.keys().next().value
            if (firstKey !== undefined) {
              renderCacheRef.current.delete(firstKey)
            }
          }
        }
        
        isRenderingRef.current = false
      }
    } catch (err) {
      console.error('Render error:', err)
      isRenderingRef.current = false
    }
  }, [volume, camera, transferFunction, renderSettings, canvasRef, isInteracting, renderQuality, useWebWorker, getCacheKey])
  
  // Auto-rotation (unified for both renderers)
  const startAutoRotation = useCallback(() => {
    if (rendererType === 'vtk' && vtkRendererRef.current) {
      vtkRendererRef.current.startAutoRotation()
      setIsRotating(true)
    } else {
      if (rotationRef.current) return
      
      setIsRotating(true)
      
      const rotate = () => {
        setCamera(prev => rotateCamera(prev, 1, 0))
        rotationRef.current = requestAnimationFrame(rotate)
      }
      
      rotationRef.current = requestAnimationFrame(rotate)
    }
  }, [rendererType])
  
  const stopAutoRotation = useCallback(() => {
    if (rendererType === 'vtk' && vtkRendererRef.current) {
      vtkRendererRef.current.stopAutoRotation()
      setIsRotating(false)
    } else {
      if (rotationRef.current) {
        cancelAnimationFrame(rotationRef.current)
        rotationRef.current = null
      }
      setIsRotating(false)
    }
  }, [rendererType])
  
  // Mouse interaction with adaptive quality
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    lastMousePos.current = { x: e.clientX, y: e.clientY }
    setIsInteracting(true)
    stopAutoRotation()
  }, [stopAutoRotation])
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!lastMousePos.current) return
    
    const deltaX = e.clientX - lastMousePos.current.x
    const deltaY = e.clientY - lastMousePos.current.y
    
    setCamera(prev => rotateCamera(prev, deltaX, deltaY))
    
    lastMousePos.current = { x: e.clientX, y: e.clientY }
  }, [])
  
  const handleMouseUp = useCallback(() => {
    lastMousePos.current = null
    setIsInteracting(false)
    
    // Clear cache when interaction ends to force high-quality render
    renderCacheRef.current.clear()
  }, [])
  
  // Change render mode (unified for both renderers)
  const setRenderMode = useCallback((mode: 'mip' | 'volume' | 'isosurface') => {
    if (rendererType === 'vtk' && vtkRendererRef.current) {
      vtkRendererRef.current.setRenderMode(mode as RenderMode)
    } else {
      setRenderSettings(prev => ({ ...prev, mode }))
    }
  }, [rendererType])
  
  // Change transfer function preset (unified for both renderers)
  const setPreset = useCallback((preset: keyof typeof TRANSFER_FUNCTIONS) => {
    const tf = TRANSFER_FUNCTIONS[preset]
    setTransferFunction(tf)
    
    if (rendererType === 'vtk' && vtkRendererRef.current && volumeData) {
      vtkRendererRef.current.setTransferFunction(tf, volumeData.min || 0, volumeData.max || 1)
    }
  }, [rendererType])
  
  // Update opacity (unified for both renderers)
  const setOpacity = useCallback((opacity: number) => {
    if (rendererType === 'vtk' && vtkRendererRef.current) {
      vtkRendererRef.current.setOpacity(opacity)
    } else {
      setTransferFunction(prev => ({
        ...prev,
        opacityPoints: prev.opacityPoints.map(p => ({
          ...p,
          opacity: p.opacity * opacity
        }))
      }))
    }
  }, [rendererType])
  
  // Reset camera (unified for both renderers)
  const resetCamera = useCallback(() => {
    if (rendererType === 'vtk' && vtkRendererRef.current) {
      vtkRendererRef.current.resetCamera()
    } else if (volume) {
      const { width, height, depth } = volume.dimensions
      const maxDim = Math.max(width, height, depth)
      
      setCamera({
        position: { x: width / 2, y: height / 2, z: maxDim * 1.5 },
        target: { x: width / 2, y: height / 2, z: depth / 2 },
        up: { x: 0, y: 1, z: 0 },
        fov: 45
      })
    }
  }, [rendererType, volume])
  
  // Load volume when enabled
  useEffect(() => {
    if (enabled && !volume && frameUrls.length > 0) {
      loadVolume()
    }
  }, [enabled, volume, frameUrls, loadVolume])
  
  // Render when camera or settings change (canvas renderer only)
  useEffect(() => {
    if (rendererType === 'canvas' && volume && enabled) {
      render()
    }
  }, [rendererType, volume, camera, transferFunction, renderSettings, enabled, render])
  
  // Cleanup
  useEffect(() => {
    return () => {
      stopAutoRotation()
    }
  }, [stopAutoRotation])
  
  // Clear cache when settings change
  useEffect(() => {
    renderCacheRef.current.clear()
  }, [renderSettings.mode, transferFunction])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 Cleaning up volume renderer...')
      
      // Dispose VTK.js renderer
      if (vtkRendererRef.current) {
        try {
          vtkRendererRef.current.dispose()
          console.log('  ✓ VTK.js renderer disposed')
        } catch (err) {
          console.error('  ❌ Error disposing VTK.js renderer:', err)
        }
        vtkRendererRef.current = null
      }
      
      // Stop auto-rotation
      if (rotationRef.current) {
        cancelAnimationFrame(rotationRef.current)
        rotationRef.current = null
      }
      
      // Terminate web worker
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
      
      // Clear cache
      renderCacheRef.current.clear()
      
      console.log('✅ Volume renderer cleanup complete')
    }
  }, [])
  
  // Unified quality setter
  const setQuality = useCallback((quality: QualityLevel) => {
    setRenderQuality(quality)
    if (rendererType === 'vtk' && vtkRendererRef.current) {
      vtkRendererRef.current.setQuality(quality)
    }
  }, [rendererType])
  
  return {
    volume,
    isLoading,
    loadProgress,
    error,
    camera,
    renderSettings,
    isRotating,
    isInteracting,
    renderQuality,
    renderTime,
    useWebWorker,
    rendererType,
    
    // Performance metrics
    fps,
    gpuMemoryMB,
    webglVersion: webglCapabilities?.version ? `${webglCapabilities.version}.0` : null,
    loadingStage,
    performanceWarning,
    clearPerformanceWarning: () => setPerformanceWarning(null),
    
    // Actions
    loadVolume,
    render,
    setRenderMode,
    setPreset,
    setOpacity,
    resetCamera,
    startAutoRotation,
    stopAutoRotation,
    setRenderQuality: setQuality,
    
    // Mouse handlers
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    
    // Settings
    setRenderSettings,
    setTransferFunction,
    
    // Cache control
    clearCache: () => renderCacheRef.current.clear()
  }
}
