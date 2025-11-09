/**
 * Progressive loading service for large 3D datasets
 */

import { Types } from '@cornerstonejs/core'
import { globalImageLoader } from '@/lib/cornerstone/imageLoader'
import { logger } from '@/utils/logger'

export interface ProgressiveLoadingOptions {
  priority: 'low' | 'normal' | 'high'
  chunkSize: number
  maxConcurrentLoads: number
  preloadRadius: number // Number of slices to preload around current slice
  adaptiveQuality: boolean
  networkCondition?: 'slow' | 'medium' | 'fast'
}

export interface LoadingProgress {
  loaded: number
  total: number
  percentage: number
  currentSlice: number
  estimatedTimeRemaining: number
}

export interface VolumeLoadingStrategy {
  loadOrder: 'sequential' | 'center-out' | 'priority-based'
  qualityLevels: Array<{
    level: number
    resolution: number
    quality: number
  }>
}

export class ProgressiveLoadingService {
  private loadingQueue: Map<string, Promise<Types.IImage>> = new Map()
  private loadedSlices: Map<string, Types.IImage> = new Map()
  private loadingProgress: Map<string, LoadingProgress> = new Map()
  private loadingStrategies: Map<string, VolumeLoadingStrategy> = new Map()
  private abortControllers: Map<string, AbortController> = new Map()

  private defaultOptions: ProgressiveLoadingOptions = {
    priority: 'normal',
    chunkSize: 10, // Load 10 slices at a time
    maxConcurrentLoads: 4,
    preloadRadius: 5,
    adaptiveQuality: true,
    networkCondition: 'medium'
  }

  /**
   * Start progressive loading of a volume dataset
   */
  async startProgressiveLoading(
    studyInstanceUID: string,
    seriesInstanceUID: string,
    imageIds: string[],
    options: Partial<ProgressiveLoadingOptions> = {}
  ): Promise<void> {
    const loadingOptions = { ...this.defaultOptions, ...options }
    const volumeId = `${studyInstanceUID}:${seriesInstanceUID}`

    try {
      logger.info(`Starting progressive loading for volume ${volumeId}`, {
        imageCount: imageIds.length,
        options: loadingOptions
      })

      // Initialize progress tracking
      this.loadingProgress.set(volumeId, {
        loaded: 0,
        total: imageIds.length,
        percentage: 0,
        currentSlice: 0,
        estimatedTimeRemaining: 0
      })

      // Set up abort controller for cancellation
      const abortController = new AbortController()
      this.abortControllers.set(volumeId, abortController)

      // Determine loading strategy
      const strategy = this.determineLoadingStrategy(imageIds.length, loadingOptions)
      this.loadingStrategies.set(volumeId, strategy)

      // Start loading based on strategy
      await this.executeLoadingStrategy(volumeId, imageIds, strategy, loadingOptions, abortController.signal)

      logger.info(`Progressive loading completed for volume ${volumeId}`)

    } catch (error) {
      logger.error(`Progressive loading failed for volume ${volumeId}:`, error)
      throw error
    }
  }

  /**
   * Load slices around current position with priority
   */
  async loadAroundCurrentSlice(
    volumeId: string,
    currentSliceIndex: number,
    imageIds: string[],
    options: Partial<ProgressiveLoadingOptions> = {}
  ): Promise<void> {
    const loadingOptions = { ...this.defaultOptions, ...options }
    const { preloadRadius, maxConcurrentLoads } = loadingOptions

    try {
      // Calculate slice range to load
      const startIndex = Math.max(0, currentSliceIndex - preloadRadius)
      const endIndex = Math.min(imageIds.length - 1, currentSliceIndex + preloadRadius)

      // Prioritize slices by distance from current slice
      const slicesToLoad: Array<{ index: number; priority: number }> = []
      
      for (let i = startIndex; i <= endIndex; i++) {
        const distance = Math.abs(i - currentSliceIndex)
        const priority = preloadRadius - distance
        slicesToLoad.push({ index: i, priority })
      }

      // Sort by priority (higher priority first)
      slicesToLoad.sort((a, b) => b.priority - a.priority)

      // Load slices with concurrency control
      const loadPromises: Promise<void>[] = []
      let concurrentLoads = 0

      for (const { index } of slicesToLoad) {
        const imageId = imageIds[index]
        
        if (this.loadedSlices.has(imageId) || this.loadingQueue.has(imageId)) {
          continue // Skip if already loaded or loading
        }

        if (concurrentLoads >= maxConcurrentLoads) {
          // Wait for a slot to become available
          await Promise.race(loadPromises)
          concurrentLoads--
        }

        const loadPromise = this.loadSliceWithProgress(volumeId, imageId, index)
          .finally(() => {
            concurrentLoads--
          })

        loadPromises.push(loadPromise)
        concurrentLoads++
      }

      // Wait for all loads to complete
      await Promise.allSettled(loadPromises)

      // Update current slice in progress
      const progress = this.loadingProgress.get(volumeId)
      if (progress) {
        progress.currentSlice = currentSliceIndex
        this.loadingProgress.set(volumeId, progress)
      }

    } catch (error) {
      logger.error(`Failed to load around current slice for volume ${volumeId}:`, error)
    }
  }

  /**
   * Load slice with adaptive quality based on network conditions
   */
  async loadSliceWithAdaptiveQuality(
    imageId: string,
    networkCondition: 'slow' | 'medium' | 'fast' = 'medium'
  ): Promise<Types.IImage> {
    try {
      // Modify image ID for different quality levels
      const qualityImageId = this.getQualityAdjustedImageId(imageId, networkCondition)
      
      return await globalImageLoader.loadImage({
        studyInstanceUID: this.extractStudyUID(imageId),
        seriesInstanceUID: this.extractSeriesUID(imageId),
        sopInstanceUID: this.extractInstanceUID(imageId)
      })
    } catch (error) {
      logger.error(`Failed to load slice with adaptive quality: ${imageId}`, error)
      throw error
    }
  }

  /**
   * Get loading progress for a volume
   */
  getLoadingProgress(volumeId: string): LoadingProgress | undefined {
    return this.loadingProgress.get(volumeId)
  }

  /**
   * Cancel progressive loading for a volume
   */
  cancelLoading(volumeId: string): void {
    const abortController = this.abortControllers.get(volumeId)
    if (abortController) {
      abortController.abort()
      this.abortControllers.delete(volumeId)
    }

    // Clean up loading state
    this.loadingProgress.delete(volumeId)
    this.loadingStrategies.delete(volumeId)

    logger.info(`Cancelled progressive loading for volume ${volumeId}`)
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    loadedSlices: number
    queuedLoads: number
    memoryUsage: number
  } {
    return {
      loadedSlices: this.loadedSlices.size,
      queuedLoads: this.loadingQueue.size,
      memoryUsage: this.estimateMemoryUsage()
    }
  }

  /**
   * Clear cache to free memory
   */
  clearCache(volumeId?: string): void {
    if (volumeId) {
      // Clear cache for specific volume
      const keysToDelete: string[] = []
      for (const [key] of this.loadedSlices) {
        if (key.includes(volumeId)) {
          keysToDelete.push(key)
        }
      }
      keysToDelete.forEach(key => this.loadedSlices.delete(key))
    } else {
      // Clear all cache
      this.loadedSlices.clear()
      this.loadingQueue.clear()
    }

    logger.debug(`Cache cleared${volumeId ? ` for volume ${volumeId}` : ' (all)'}`)
  }

  private determineLoadingStrategy(
    imageCount: number,
    options: ProgressiveLoadingOptions
  ): VolumeLoadingStrategy {
    // Determine optimal loading strategy based on dataset size and options
    let loadOrder: 'sequential' | 'center-out' | 'priority-based' = 'sequential'
    
    if (imageCount > 100) {
      loadOrder = 'center-out' // Start from middle for large datasets
    } else if (options.priority === 'high') {
      loadOrder = 'priority-based'
    }

    const qualityLevels = options.adaptiveQuality ? [
      { level: 1, resolution: 0.5, quality: 0.6 }, // Low quality first
      { level: 2, resolution: 0.75, quality: 0.8 }, // Medium quality
      { level: 3, resolution: 1.0, quality: 1.0 } // Full quality
    ] : [
      { level: 1, resolution: 1.0, quality: 1.0 } // Full quality only
    ]

    return { loadOrder, qualityLevels }
  }

  private async executeLoadingStrategy(
    volumeId: string,
    imageIds: string[],
    strategy: VolumeLoadingStrategy,
    options: ProgressiveLoadingOptions,
    abortSignal: AbortSignal
  ): Promise<void> {
    const { loadOrder } = strategy
    const { chunkSize, maxConcurrentLoads } = options

    // Determine loading order
    let orderedIndices: number[]
    
    switch (loadOrder) {
      case 'center-out':
        orderedIndices = this.getCenterOutOrder(imageIds.length)
        break
      case 'priority-based':
        orderedIndices = this.getPriorityBasedOrder(imageIds.length)
        break
      default:
        orderedIndices = Array.from({ length: imageIds.length }, (_, i) => i)
    }

    // Load in chunks
    for (let i = 0; i < orderedIndices.length; i += chunkSize) {
      if (abortSignal.aborted) {
        throw new Error('Loading cancelled')
      }

      const chunkIndices = orderedIndices.slice(i, i + chunkSize)
      const chunkPromises = chunkIndices.map(index => 
        this.loadSliceWithProgress(volumeId, imageIds[index], index)
      )

      // Control concurrency within chunk
      const concurrencyLimit = Math.min(maxConcurrentLoads, chunkPromises.length)
      for (let j = 0; j < chunkPromises.length; j += concurrencyLimit) {
        const batch = chunkPromises.slice(j, j + concurrencyLimit)
        await Promise.allSettled(batch)
      }
    }
  }

  private async loadSliceWithProgress(
    volumeId: string,
    imageId: string,
    sliceIndex: number
  ): Promise<void> {
    try {
      const startTime = Date.now()
      
      const loadPromise = globalImageLoader.loadImage({
        studyInstanceUID: this.extractStudyUID(imageId),
        seriesInstanceUID: this.extractSeriesUID(imageId),
        sopInstanceUID: this.extractInstanceUID(imageId)
      })

      this.loadingQueue.set(imageId, loadPromise)
      
      const image = await loadPromise
      this.loadedSlices.set(imageId, image)
      this.loadingQueue.delete(imageId)

      // Update progress
      const progress = this.loadingProgress.get(volumeId)
      if (progress) {
        progress.loaded++
        progress.percentage = (progress.loaded / progress.total) * 100
        
        // Estimate time remaining
        const elapsed = Date.now() - startTime
        const avgTimePerSlice = elapsed / progress.loaded
        progress.estimatedTimeRemaining = avgTimePerSlice * (progress.total - progress.loaded)
        
        this.loadingProgress.set(volumeId, progress)
      }

    } catch (error) {
      this.loadingQueue.delete(imageId)
      logger.warn(`Failed to load slice ${sliceIndex}:`, error)
    }
  }

  private getCenterOutOrder(length: number): number[] {
    const center = Math.floor(length / 2)
    const order: number[] = [center]
    
    for (let i = 1; i <= Math.max(center, length - center - 1); i++) {
      if (center - i >= 0) order.push(center - i)
      if (center + i < length) order.push(center + i)
    }
    
    return order
  }

  private getPriorityBasedOrder(length: number): number[] {
    // Load key slices first (every 10th slice), then fill in gaps
    const keySlices: number[] = []
    const fillSlices: number[] = []
    
    for (let i = 0; i < length; i++) {
      if (i % 10 === 0) {
        keySlices.push(i)
      } else {
        fillSlices.push(i)
      }
    }
    
    return [...keySlices, ...fillSlices]
  }

  private getQualityAdjustedImageId(imageId: string, networkCondition: string): string {
    // Add quality parameters to image ID based on network condition
    const qualityParams = {
      slow: 'quality=0.6&resolution=0.5',
      medium: 'quality=0.8&resolution=0.75',
      fast: 'quality=1.0&resolution=1.0'
    }
    
    const params = qualityParams[networkCondition as keyof typeof qualityParams] || qualityParams.medium
    const separator = imageId.includes('?') ? '&' : '?'
    
    return `${imageId}${separator}${params}`
  }

  private extractStudyUID(imageId: string): string {
    // Extract study UID from image ID
    const match = imageId.match(/studies\/([^\/]+)/)
    return match ? match[1] : ''
  }

  private extractSeriesUID(imageId: string): string {
    // Extract series UID from image ID
    const match = imageId.match(/series\/([^\/]+)/)
    return match ? match[1] : ''
  }

  private extractInstanceUID(imageId: string): string {
    // Extract instance UID from image ID
    const match = imageId.match(/instances\/([^\/\?]+)/)
    return match ? match[1] : ''
  }

  private estimateMemoryUsage(): number {
    // Rough estimate of memory usage (in MB)
    return this.loadedSlices.size * 0.5 // Assume ~0.5MB per slice
  }
}

// Global progressive loading service instance
export const progressiveLoadingService = new ProgressiveLoadingService()