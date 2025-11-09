/**
 * Validation Service
 * 
 * Validates annotation transforms, sizes, and positions
 */

import type { Annotation, Point, BoundingBox } from '../types/viewer'

export interface ValidationResult {
  valid: boolean
  error?: string
  errorCode?: string
}

export interface ValidationOptions {
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
  canvasWidth?: number
  canvasHeight?: number
  allowOutOfBounds?: boolean
}

class ValidationService {
  // Default validation options
  private defaultOptions: ValidationOptions = {
    minWidth: 10,
    minHeight: 10,
    maxWidth: 10000,
    maxHeight: 10000,
    allowOutOfBounds: false,
  }

  /**
   * Validate annotation size
   */
  validateSize(
    width: number,
    height: number,
    options?: Partial<ValidationOptions>
  ): ValidationResult {
    const opts = { ...this.defaultOptions, ...options }

    // Check minimum size
    if (width < (opts.minWidth || 10)) {
      return {
        valid: false,
        error: `Width must be at least ${opts.minWidth}px`,
        errorCode: 'MIN_WIDTH',
      }
    }

    if (height < (opts.minHeight || 10)) {
      return {
        valid: false,
        error: `Height must be at least ${opts.minHeight}px`,
        errorCode: 'MIN_HEIGHT',
      }
    }

    // Check maximum size
    if (opts.maxWidth && width > opts.maxWidth) {
      return {
        valid: false,
        error: `Width cannot exceed ${opts.maxWidth}px`,
        errorCode: 'MAX_WIDTH',
      }
    }

    if (opts.maxHeight && height > opts.maxHeight) {
      return {
        valid: false,
        error: `Height cannot exceed ${opts.maxHeight}px`,
        errorCode: 'MAX_HEIGHT',
      }
    }

    return { valid: true }
  }

  /**
   * Validate annotation position (within canvas bounds)
   */
  validatePosition(
    annotation: Annotation,
    canvasWidth: number,
    canvasHeight: number,
    options?: Partial<ValidationOptions>
  ): ValidationResult {
    const opts = { ...this.defaultOptions, ...options }

    if (opts.allowOutOfBounds) {
      return { valid: true }
    }

    // Check if any points are out of bounds
    const outOfBounds = annotation.points.some(
      (point) =>
        point.x < 0 ||
        point.x > 1 ||
        point.y < 0 ||
        point.y > 1
    )

    if (outOfBounds) {
      return {
        valid: false,
        error: 'Annotation must stay within canvas bounds',
        errorCode: 'OUT_OF_BOUNDS',
      }
    }

    return { valid: true }
  }

  /**
   * Validate bounding box
   */
  validateBoundingBox(
    boundingBox: BoundingBox,
    canvasWidth: number,
    canvasHeight: number,
    options?: Partial<ValidationOptions>
  ): ValidationResult {
    const opts = { ...this.defaultOptions, ...options }

    // Validate size
    const sizeResult = this.validateSize(
      boundingBox.width,
      boundingBox.height,
      opts
    )

    if (!sizeResult.valid) {
      return sizeResult
    }

    // Validate position
    if (!opts.allowOutOfBounds) {
      if (
        boundingBox.x < 0 ||
        boundingBox.y < 0 ||
        boundingBox.x + boundingBox.width > canvasWidth ||
        boundingBox.y + boundingBox.height > canvasHeight
      ) {
        return {
          valid: false,
          error: 'Annotation must stay within canvas bounds',
          errorCode: 'OUT_OF_BOUNDS',
        }
      }
    }

    return { valid: true }
  }

  /**
   * Validate annotation transform
   */
  validateTransform(
    annotation: Annotation,
    canvasWidth: number,
    canvasHeight: number,
    options?: Partial<ValidationOptions>
  ): ValidationResult {
    // Calculate bounding box
    const boundingBox = this.calculateBoundingBox(annotation)

    // Convert normalized coordinates to canvas coordinates
    const canvasBBox = {
      x: boundingBox.x * canvasWidth,
      y: boundingBox.y * canvasHeight,
      width: boundingBox.width * canvasWidth,
      height: boundingBox.height * canvasHeight,
    }

    // Validate bounding box
    return this.validateBoundingBox(canvasBBox, canvasWidth, canvasHeight, options)
  }

  /**
   * Calculate bounding box from annotation points
   */
  private calculateBoundingBox(annotation: Annotation): BoundingBox {
    if (annotation.points.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 }
    }

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    annotation.points.forEach((point) => {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    })

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    }
  }

  /**
   * Validate annotation data structure
   */
  validateAnnotationData(annotation: any): ValidationResult {
    // Check required fields
    if (!annotation.id) {
      return {
        valid: false,
        error: 'Annotation must have an ID',
        errorCode: 'MISSING_ID',
      }
    }

    if (!annotation.type) {
      return {
        valid: false,
        error: 'Annotation must have a type',
        errorCode: 'MISSING_TYPE',
      }
    }

    if (!Array.isArray(annotation.points)) {
      return {
        valid: false,
        error: 'Annotation must have points array',
        errorCode: 'MISSING_POINTS',
      }
    }

    // Validate points
    const invalidPoint = annotation.points.find(
      (p: any) => typeof p.x !== 'number' || typeof p.y !== 'number'
    )

    if (invalidPoint) {
      return {
        valid: false,
        error: 'All points must have numeric x and y coordinates',
        errorCode: 'INVALID_POINTS',
      }
    }

    // Validate style
    if (!annotation.style || typeof annotation.style !== 'object') {
      return {
        valid: false,
        error: 'Annotation must have a style object',
        errorCode: 'MISSING_STYLE',
      }
    }

    // Validate transform
    if (!annotation.transform || typeof annotation.transform !== 'object') {
      return {
        valid: false,
        error: 'Annotation must have a transform object',
        errorCode: 'MISSING_TRANSFORM',
      }
    }

    // Validate metadata
    if (!annotation.metadata || typeof annotation.metadata !== 'object') {
      return {
        valid: false,
        error: 'Annotation must have a metadata object',
        errorCode: 'MISSING_METADATA',
      }
    }

    return { valid: true }
  }

  /**
   * Constrain annotation to canvas bounds
   */
  constrainToCanvas(
    annotation: Annotation,
    canvasWidth: number,
    canvasHeight: number
  ): Annotation {
    const constrainedPoints = annotation.points.map((point) => ({
      x: Math.max(0, Math.min(1, point.x)),
      y: Math.max(0, Math.min(1, point.y)),
    }))

    return {
      ...annotation,
      points: constrainedPoints,
      updatedAt: new Date().toISOString(),
    }
  }

  /**
   * Enforce minimum size
   */
  enforceMinimumSize(
    annotation: Annotation,
    minWidth: number = 10,
    minHeight: number = 10,
    canvasWidth: number,
    canvasHeight: number
  ): Annotation {
    const boundingBox = this.calculateBoundingBox(annotation)

    const currentWidth = boundingBox.width * canvasWidth
    const currentHeight = boundingBox.height * canvasHeight

    if (currentWidth >= minWidth && currentHeight >= minHeight) {
      return annotation
    }

    // Calculate scale factors
    const scaleX = currentWidth < minWidth ? minWidth / currentWidth : 1
    const scaleY = currentHeight < minHeight ? minHeight / currentHeight : 1
    const scale = Math.max(scaleX, scaleY)

    // Scale points from center
    const centerX = boundingBox.x + boundingBox.width / 2
    const centerY = boundingBox.y + boundingBox.height / 2

    const scaledPoints = annotation.points.map((point) => ({
      x: centerX + (point.x - centerX) * scale,
      y: centerY + (point.y - centerY) * scale,
    }))

    return {
      ...annotation,
      points: scaledPoints,
      updatedAt: new Date().toISOString(),
    }
  }

  /**
   * Validate and fix annotation
   */
  validateAndFix(
    annotation: Annotation,
    canvasWidth: number,
    canvasHeight: number,
    options?: Partial<ValidationOptions>
  ): { annotation: Annotation; fixed: boolean; errors: string[] } {
    const errors: string[] = []
    let fixed = false
    let result = annotation

    // Validate data structure
    const dataResult = this.validateAnnotationData(annotation)
    if (!dataResult.valid) {
      errors.push(dataResult.error || 'Invalid annotation data')
      return { annotation, fixed: false, errors }
    }

    // Enforce minimum size
    const minWidth = options?.minWidth || 10
    const minHeight = options?.minHeight || 10
    const sizeEnforced = this.enforceMinimumSize(
      result,
      minWidth,
      minHeight,
      canvasWidth,
      canvasHeight
    )

    if (sizeEnforced !== result) {
      result = sizeEnforced
      fixed = true
      errors.push('Annotation size was too small and has been adjusted')
    }

    // Constrain to canvas
    if (!options?.allowOutOfBounds) {
      const constrained = this.constrainToCanvas(result, canvasWidth, canvasHeight)

      if (constrained !== result) {
        result = constrained
        fixed = true
        errors.push('Annotation was moved to stay within canvas bounds')
      }
    }

    return { annotation: result, fixed, errors }
  }
}

// Singleton instance
export const validationService = new ValidationService()
