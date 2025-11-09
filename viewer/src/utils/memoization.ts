/**
 * Memoization Utilities
 * 
 * Provides memoization functions for expensive computations
 */

import type { Annotation, ControlPoint, Point } from '../types/viewer'
import { MemoCache } from './performanceUtils'

/**
 * Memoized control point generation
 */
class ControlPointMemoizer {
  private cache = new MemoCache<string, ControlPoint[]>(200)

  /**
   * Generate cache key from annotation
   */
  private getCacheKey(annotation: Annotation): string {
    return `${annotation.id}-${annotation.type}-${JSON.stringify(annotation.points)}-${annotation.transform.scale.x}-${annotation.transform.scale.y}`
  }

  /**
   * Get memoized control points or generate new ones
   */
  getControlPoints(
    annotation: Annotation,
    generator: (annotation: Annotation) => ControlPoint[]
  ): ControlPoint[] {
    const key = this.getCacheKey(annotation)
    const cached = this.cache.get(key)

    if (cached) {
      return cached
    }

    const controlPoints = generator(annotation)
    this.cache.set(key, controlPoints)
    return controlPoints
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Invalidate cache for specific annotation
   */
  invalidate(annotationId: string): void {
    // Note: This is a simple implementation. For better performance,
    // we could maintain a separate index of annotation IDs to cache keys
    this.cache.clear()
  }
}

/**
 * Memoized bounding box calculation
 */
class BoundingBoxMemoizer {
  private cache = new MemoCache<string, { x: number; y: number; width: number; height: number }>(200)

  /**
   * Generate cache key from points
   */
  private getCacheKey(points: Point[], transform?: { scale: { x: number; y: number } }): string {
    const pointsKey = points.map(p => `${p.x.toFixed(4)},${p.y.toFixed(4)}`).join('|')
    const scaleKey = transform ? `${transform.scale.x},${transform.scale.y}` : '1,1'
    return `${pointsKey}-${scaleKey}`
  }

  /**
   * Get memoized bounding box or calculate new one
   */
  getBoundingBox(
    points: Point[],
    calculator: (points: Point[]) => { x: number; y: number; width: number; height: number },
    transform?: { scale: { x: number; y: number } }
  ): { x: number; y: number; width: number; height: number } {
    const key = this.getCacheKey(points, transform)
    const cached = this.cache.get(key)

    if (cached) {
      return cached
    }

    const boundingBox = calculator(points)
    this.cache.set(key, boundingBox)
    return boundingBox
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear()
  }
}

/**
 * Memoized annotation rendering
 */
class AnnotationRenderMemoizer {
  private cache = new MemoCache<string, ImageData>(50)
  private canvasCache = new Map<string, HTMLCanvasElement>()

  /**
   * Generate cache key from annotation
   */
  private getCacheKey(annotation: Annotation): string {
    return `${annotation.id}-${annotation.type}-${JSON.stringify(annotation.points)}-${annotation.style.strokeColor}-${annotation.style.strokeWidth}-${annotation.style.opacity}-${annotation.text || ''}`
  }

  /**
   * Get memoized rendered annotation or render new one
   */
  getRenderedAnnotation(
    annotation: Annotation,
    renderer: (ctx: CanvasRenderingContext2D, annotation: Annotation) => void,
    width: number,
    height: number
  ): ImageData | null {
    const key = this.getCacheKey(annotation)
    const cached = this.cache.get(key)

    if (cached) {
      return cached
    }

    // Create temporary canvas for rendering
    let canvas = this.canvasCache.get(key)
    if (!canvas) {
      canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      this.canvasCache.set(key, canvas)
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // Clear and render
    ctx.clearRect(0, 0, width, height)
    renderer(ctx, annotation)

    // Get image data
    const imageData = ctx.getImageData(0, 0, width, height)
    this.cache.set(key, imageData)

    return imageData
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear()
    this.canvasCache.clear()
  }

  /**
   * Invalidate cache for specific annotation
   */
  invalidate(annotationId: string): void {
    // Simple implementation - clear all
    this.clear()
  }
}

/**
 * Memoized distance calculation
 */
class DistanceMemoizer {
  private cache = new MemoCache<string, number>(500)

  /**
   * Generate cache key from two points
   */
  private getCacheKey(p1: Point, p2: Point): string {
    return `${p1.x.toFixed(4)},${p1.y.toFixed(4)}-${p2.x.toFixed(4)},${p2.y.toFixed(4)}`
  }

  /**
   * Get memoized distance or calculate new one
   */
  getDistance(
    p1: Point,
    p2: Point,
    calculator: (p1: Point, p2: Point) => number
  ): number {
    const key = this.getCacheKey(p1, p2)
    const cached = this.cache.get(key)

    if (cached !== undefined) {
      return cached
    }

    const distance = calculator(p1, p2)
    this.cache.set(key, distance)
    return distance
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear()
  }
}

// Export singleton instances
export const controlPointMemoizer = new ControlPointMemoizer()
export const boundingBoxMemoizer = new BoundingBoxMemoizer()
export const annotationRenderMemoizer = new AnnotationRenderMemoizer()
export const distanceMemoizer = new DistanceMemoizer()

/**
 * Clear all memoization caches
 */
export function clearAllMemoizationCaches(): void {
  controlPointMemoizer.clear()
  boundingBoxMemoizer.clear()
  annotationRenderMemoizer.clear()
  distanceMemoizer.clear()
}
