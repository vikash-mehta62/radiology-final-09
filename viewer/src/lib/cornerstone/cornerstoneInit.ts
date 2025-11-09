/**
 * Cornerstone3D initialization and configuration
 */

import { init as csRenderInit, setPreferSizeOverAccuracy, resetUseCPURendering } from '@cornerstonejs/core'
// Tools are loaded dynamically to avoid build-time initialization issues
import { initToolsOnce, initializeToolEnumsInConfig } from './toolsLoader'
import { initializeToolEnums } from './config'
// @ts-ignore - No type definitions available
import dicomImageLoader from '@cornerstonejs/dicom-image-loader'
import * as cornerstoneCore from '@cornerstonejs/core'

// Import DICOM image loader
import '@cornerstonejs/dicom-image-loader'

let isInitialized = false

export interface CornerstoneConfig {
  maxWebWorkers?: number
  startWebWorkersOnDemand?: boolean
  taskConfiguration?: {
    decodeTask?: {
      initializeCodecsOnStartup?: boolean
      usePDFJS?: boolean
      strict?: boolean
    }
  }
  useSharedArrayBuffer?: boolean
  preferSizeOverAccuracy?: boolean
  useNorm16Texture?: boolean
}

const defaultConfig: CornerstoneConfig = {
  maxWebWorkers: Math.min(navigator.hardwareConcurrency || 4, 7),
  startWebWorkersOnDemand: false,
  taskConfiguration: {
    decodeTask: {
      initializeCodecsOnStartup: false,
      usePDFJS: false,
      strict: false,
    },
  },
  useSharedArrayBuffer: 'SharedArrayBuffer' in window,
  preferSizeOverAccuracy: false,
  useNorm16Texture: false,
}

export async function initializeCornerstone(config: CornerstoneConfig = {}): Promise<void> {
  if (isInitialized) {
    console.warn('Cornerstone3D is already initialized')
    return
  }

  try {
    const finalConfig = { ...defaultConfig, ...config }

    // Configure performance settings
    if (finalConfig.preferSizeOverAccuracy) {
      setPreferSizeOverAccuracy(true)
    }

    // Initialize Cornerstone3D Core
    await csRenderInit({
      // @ts-ignore - Config options may vary by version
      gpuTier: undefined, // Let Cornerstone detect GPU capabilities
      useSharedArrayBuffer: finalConfig.useSharedArrayBuffer,
      useNorm16Texture: finalConfig.useNorm16Texture,
    })

    // Initialize Cornerstone3D Tools (dynamic)
    await initToolsOnce()
    await initializeToolEnumsInConfig(initializeToolEnums)

    // Configure DICOM Image Loader
    configureDicomImageLoader(finalConfig)

    isInitialized = true
    console.log('✓ Cornerstone3D initialized successfully')
  } catch (error) {
    console.error('Failed to initialize Cornerstone3D:', error)
    throw error
  }
}

function configureDicomImageLoader(config: CornerstoneConfig): void {
  const { maxWebWorkers, startWebWorkersOnDemand, taskConfiguration } = config

  // Configure web workers
  dicomImageLoader.webWorkerManager.initialize({
    maxWebWorkers,
    startWebWorkersOnDemand,
    taskConfiguration,
  })

  // Configure DICOM parser
  dicomImageLoader.configure({
    useWebWorkers: true,
    decodeConfig: {
      convertFloatPixelDataToInt: false,
      use16BitDataType: true,
    },
  })

  // Set up external libraries
  dicomImageLoader.external.cornerstone = cornerstoneCore
  dicomImageLoader.external.dicomParser = (window as any).dicomParser || {}
}

export function resetCornerstoneToDefaults(): void {
  resetUseCPURendering()
  preferSizeOverAccuracy(false)
}

export function getInitializationStatus(): boolean {
  return isInitialized
}

export function destroyCornerstone(): void {
  if (isInitialized) {
    // Clean up web workers
    dicomImageLoader.webWorkerManager.terminate()
    
    // Reset initialization flag
    isInitialized = false
    
    console.log('✓ Cornerstone3D destroyed')
  }
}