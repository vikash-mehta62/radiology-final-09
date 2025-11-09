/**
 * Image loading utilities for Cornerstone3D
 */

import {
  imageLoader,
  metaData,
  Types,
} from '@cornerstonejs/core'
// @ts-ignore - No type definitions available
import dicomImageLoader from '@cornerstonejs/dicom-image-loader'
import { logger } from '@/utils/logger'

export interface ImageLoadOptions {
  studyInstanceUID: string
  seriesInstanceUID: string
  sopInstanceUID?: string
  frameIndex?: number
  transferSyntaxUID?: string
  useWebWorkers?: boolean
}

export interface VolumeLoadOptions {
  studyInstanceUID: string
  seriesInstanceUID: string
  volumeId: string
  imageIds?: string[]
}

export class ImageLoader {
  private static instance: ImageLoader
  private loadedImages: Map<string, Types.IImage> = new Map()
  private loadingPromises: Map<string, Promise<Types.IImage>> = new Map()

  private constructor() {
    this.configureDicomImageLoader()
  }

  static getInstance(): ImageLoader {
    if (!ImageLoader.instance) {
      ImageLoader.instance = new ImageLoader()
    }
    return ImageLoader.instance
  }

  private configureDicomImageLoader(): void {
    // Configure DICOM image loader for multi-frame angiography
    dicomImageLoader.configure({
      useWebWorkers: false, // Disable for compatibility with multi-frame DICOM
      decodeConfig: {
        convertFloatPixelDataToInt: false,
        use16BitDataType: true,
      },
    })

    // Configure web workers
    const config = {
      maxWebWorkers: Math.min(navigator.hardwareConcurrency || 4, 7),
      startWebWorkersOnDemand: false,
      taskConfiguration: {
        decodeTask: {
          initializeCodecsOnStartup: false,
          usePDFJS: false,
          strict: false,
        },
      },
    }

    dicomImageLoader.webWorkerManager.initialize(config)
  }

  /**
   * Load a single DICOM image
   */
  async loadImage(options: ImageLoadOptions): Promise<Types.IImage> {
    const imageId = this.createImageId(options)
    
    // Return cached image if available
    if (this.loadedImages.has(imageId)) {
      return this.loadedImages.get(imageId)!
    }

    // Return existing loading promise if in progress
    if (this.loadingPromises.has(imageId)) {
      return this.loadingPromises.get(imageId)!
    }

    // Start loading
    const loadingPromise = this.loadImageInternal(imageId, options)
    this.loadingPromises.set(imageId, loadingPromise)

    try {
      const image = await loadingPromise
      this.loadedImages.set(imageId, image)
      this.loadingPromises.delete(imageId)
      return image
    } catch (error) {
      this.loadingPromises.delete(imageId)
      throw error
    }
  }

  private async loadImageInternal(imageId: string, _options: ImageLoadOptions): Promise<Types.IImage> {
    try {
      logger.debug(`Loading image: ${imageId}`)
      
      const image = await imageLoader.loadAndCacheImage(imageId)
      
      logger.debug(`Image loaded successfully: ${imageId}`)
      return image
    } catch (error) {
      logger.error(`Failed to load image ${imageId}:`, error)
      throw error
    }
  }

  /**
   * Load multiple images for a series
   */
  async loadSeries(options: ImageLoadOptions): Promise<Types.IImage[]> {
    try {
      // Get all instance UIDs for the series
      const instanceUIDs = await this.getSeriesInstanceUIDs(
        options.studyInstanceUID,
        options.seriesInstanceUID
      )

      // Load all images in parallel
      const loadPromises = instanceUIDs.map(sopInstanceUID =>
        this.loadImage({
          ...options,
          sopInstanceUID,
        })
      )

      const images = await Promise.all(loadPromises)
      logger.debug(`Series loaded: ${options.seriesInstanceUID} (${images.length} images)`)
      
      return images
    } catch (error) {
      logger.error(`Failed to load series ${options.seriesInstanceUID}:`, error)
      throw error
    }
  }

  /**
   * Create image ID from DICOM identifiers
   */
  createImageId(options: ImageLoadOptions): string {
    const { studyInstanceUID, seriesInstanceUID, sopInstanceUID, frameIndex } = options
    
    if (!sopInstanceUID) {
      throw new Error('SOP Instance UID is required for image loading')
    }

    // Resolve DICOM base URL from env to avoid relying on preview server proxy
    const resolveDicomBaseUrl = (): string => {
      try {
        const envApi = (import.meta as any)?.env?.VITE_API_URL || (import.meta as any)?.env?.VITE_BACKEND_URL || ''
        const api = String(envApi || '').replace(/\/$/, '')
        return api ? `${api}/api/dicom` : '/api/dicom'
      } catch {
        return '/api/dicom'
      }
    }

    const base = resolveDicomBaseUrl()
    let imageId = `wadouri:${base}/studies/${studyInstanceUID}/series/${seriesInstanceUID}/instances/${sopInstanceUID}`
    
    if (frameIndex !== undefined) {
      imageId += `?frame=${frameIndex}`
    }

    return imageId
  }

  /**
   * Create image IDs for a series
   */
  async createSeriesImageIds(
    studyInstanceUID: string,
    seriesInstanceUID: string
  ): Promise<string[]> {
    try {
      const instanceUIDs = await this.getSeriesInstanceUIDs(studyInstanceUID, seriesInstanceUID)
      
      return instanceUIDs.map(sopInstanceUID =>
        this.createImageId({
          studyInstanceUID,
          seriesInstanceUID,
          sopInstanceUID,
        })
      )
    } catch (error) {
      logger.error(`Failed to create series image IDs:`, error)
      throw error
    }
  }

  /**
   * Get instance UIDs for a series (would typically come from DICOM API)
   */
  private async getSeriesInstanceUIDs(
    studyInstanceUID: string,
    seriesInstanceUID: string
  ): Promise<string[]> {
    try {
      // This would typically make an API call to get instance UIDs
      // For now, return a placeholder
      const resolveDicomBaseUrl = (): string => {
        try {
          const envApi = (import.meta as any)?.env?.VITE_API_URL || (import.meta as any)?.env?.VITE_BACKEND_URL || ''
          const api = String(envApi || '').replace(/\/$/, '')
          return api ? `${api}/api/dicom` : '/api/dicom'
        } catch {
          return '/api/dicom'
        }
      }

      const base = resolveDicomBaseUrl()
      const response = await fetch(
        `/studies/${studyInstanceUID}/series/${seriesInstanceUID}/instances`
      )
      
      if (!response.ok) {
        throw new Error(`Failed to fetch instance UIDs: ${response.statusText}`)
      }

      const data = await response.json()
      return data.instances.map((instance: any) => instance.sopInstanceUID)
    } catch (error) {
      logger.error('Failed to get series instance UIDs:', error)
      // Return placeholder for development
      return ['1.2.3.4.5.6.7.8.9.10']
    }
  }

  /**
   * Preload images for better performance
   */
  async preloadImages(imageIds: string[]): Promise<void> {
    try {
      const preloadPromises = imageIds.map(imageId =>
        imageLoader.loadAndCacheImage(imageId).catch(error => {
          logger.warn(`Failed to preload image ${imageId}:`, error)
          return null
        })
      )

      await Promise.allSettled(preloadPromises)
      logger.debug(`Preloaded ${imageIds.length} images`)
    } catch (error) {
      logger.error('Failed to preload images:', error)
    }
  }

  /**
   * Clear image cache
   */
  clearCache(): void {
    try {
      // @ts-ignore - purgeCache may not be in type definitions
      if (imageLoader.purgeCache) {
        imageLoader.purgeCache()
      }
      this.loadedImages.clear()
      this.loadingPromises.clear()
      logger.debug('Image cache cleared')
    } catch (error) {
      logger.error('Failed to clear image cache:', error)
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    loadedImages: number
    loadingImages: number
    cacheSize: number
  } {
    // @ts-ignore - getCacheInfo may not be in type definitions
    const cacheInfo = imageLoader.getCacheInfo ? imageLoader.getCacheInfo() : { numberOfImagesCached: 0 }
    return {
      loadedImages: this.loadedImages.size,
      loadingImages: this.loadingPromises.size,
      cacheSize: cacheInfo.numberOfImagesCached || 0,
    }
  }

  /**
   * Set metadata for DICOM images
   */
  setMetadata(imageId: string, metadata: any): void {
    try {
      // Set various metadata types
      metaData.addProvider(
        (type: string, _imageId: string) => {
          if (type === 'imagePlaneModule') {
            return metadata.imagePlaneModule
          }
          if (type === 'imagePixelModule') {
            return metadata.imagePixelModule
          }
          if (type === 'voiLutModule') {
            return metadata.voiLutModule
          }
          if (type === 'modalityLutModule') {
            return metadata.modalityLutModule
          }
          return undefined
        },
        10000 // High priority
      )
    } catch (error) {
      logger.error(`Failed to set metadata for ${imageId}:`, error)
    }
  }

  /**
   * Get image metadata
   */
  getMetadata(imageId: string, type: string): any {
    try {
      return metaData.get(type, imageId)
    } catch (error) {
      logger.error(`Failed to get metadata for ${imageId}:`, error)
      return undefined
    }
  }
}

// Global image loader instance
export const globalImageLoader = ImageLoader.getInstance()