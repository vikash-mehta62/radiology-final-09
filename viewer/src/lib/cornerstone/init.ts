import { init as csRenderInit, volumeLoader } from '@cornerstonejs/core'
// Tools are loaded dynamically to avoid build-time initialization issues
import { initToolsOnce, initializeToolEnumsInConfig } from './toolsLoader'
import { initializeToolEnums } from './config'
// @ts-ignore - No type definitions available
import dicomImageLoader from '@cornerstonejs/dicom-image-loader'
import { cornerstoneStreamingImageVolumeLoader, cornerstoneStreamingDynamicImageVolumeLoader } from '@cornerstonejs/streaming-image-volume-loader'
import dicomParser from 'dicom-parser'
import * as cornerstoneCore from '@cornerstonejs/core'

let isInitialized = false

function getOfflineGpuTier(): { tier: number; type: string } {
  try {
    const canvas = document.createElement('canvas')
    const gl2 = canvas.getContext('webgl2')
    if (gl2) {
      return { tier: 3, type: 'BENCHMARK' }
    }
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl' as any)
    if (gl) {
      return { tier: 2, type: 'BENCHMARK' }
    }
  } catch {}
  return { tier: 0, type: 'BENCHMARK' }
}

/**
 * Initialize Cornerstone3D and related libraries
 */
export async function initializeCornerstone(): Promise<void> {
  if (isInitialized) {
    return
  }

  try {
    // Initialize Cornerstone3D core
    const gpuTier = getOfflineGpuTier()
    if (gpuTier.tier === 0) {
      throw new Error('WebGL not supported')
    }
    // @ts-ignore - gpuTier type may vary
    await csRenderInit({ gpuTier })
    console.log('Cornerstone3D core initialized')

    // Initialize Cornerstone3D tools (dynamic)
    await initToolsOnce()
    await initializeToolEnumsInConfig(initializeToolEnums)
    console.log('Cornerstone3D tools initialized')

    // Initialize and configure DICOM image loader
    dicomImageLoader.webWorkerManager.initialize({
      maxWebWorkers: navigator.hardwareConcurrency || 1,
      startWebWorkersOnDemand: false,
      taskConfiguration: {
        decodeTask: {
          initializeCodecsOnStartup: false,
          strict: false,
        },
      },
    })

    // Additional DICOM image loader configuration
    dicomImageLoader.configure({
      useWebWorkers: true,
      decodeConfig: {
        convertFloatPixelDataToInt: false,
        use16BitDataType: true,
      },
    })

    // Set up external references
    dicomImageLoader.external.cornerstone = cornerstoneCore
    dicomImageLoader.external.dicomParser = dicomParser

    console.log('DICOM image loader initialized')

    // Register streaming image volume loaders for 3D volumes
    // @ts-ignore - Volume loader type compatibility
    volumeLoader.registerVolumeLoader('cornerstoneStreamingImageVolume', cornerstoneStreamingImageVolumeLoader)
    // @ts-ignore - Volume loader type compatibility
    volumeLoader.registerVolumeLoader('cornerstoneStreamingDynamicImageVolume', cornerstoneStreamingDynamicImageVolumeLoader)
    console.log('Streaming image volume loaders registered')

    // Configure DICOM parser
    ;(window as any).dicomParser = dicomParser
    
    isInitialized = true
    console.log('Cornerstone3D initialization complete')
  } catch (error) {
    console.error('Failed to initialize Cornerstone3D:', error)
    throw error
  }
}

/**
 * Check if Cornerstone3D is initialized
 */
export function isCornerStoneInitialized(): boolean {
  return isInitialized
}