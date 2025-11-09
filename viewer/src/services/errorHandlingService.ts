/**
 * Error Handling Service
 * 
 * Handles errors, validation, and rollback for annotation operations
 */

import type { Annotation } from '../types/viewer'
import { validationService, ValidationResult } from './validationService'

export interface ErrorContext {
  operation: string
  annotationId?: string
  timestamp: number
  error: Error | string
  stack?: string
  metadata?: Record<string, any>
}

export interface RollbackState {
  annotationId: string
  beforeState: Annotation
  afterState: Annotation
  timestamp: number
}

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical'

export interface ErrorLog {
  id: string
  severity: ErrorSeverity
  message: string
  context: ErrorContext
  userMessage: string
}

class ErrorHandlingService {
  private errorLogs: ErrorLog[] = []
  private maxLogs = 100
  private rollbackStates = new Map<string, RollbackState>()
  private errorCallbacks: Array<(error: ErrorLog) => void> = []

  /**
   * Log error with context
   */
  logError(
    severity: ErrorSeverity,
    message: string,
    context: Partial<ErrorContext>,
    userMessage?: string
  ): string {
    const errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const errorLog: ErrorLog = {
      id: errorId,
      severity,
      message,
      context: {
        operation: context.operation || 'unknown',
        annotationId: context.annotationId,
        timestamp: Date.now(),
        error: context.error || message,
        stack: context.stack,
        metadata: context.metadata,
      },
      userMessage: userMessage || this.getUserFriendlyMessage(message),
    }

    this.errorLogs.push(errorLog)

    // Limit log size
    if (this.errorLogs.length > this.maxLogs) {
      this.errorLogs.shift()
    }

    // Log to console
    const consoleMethod = severity === 'critical' || severity === 'error' ? 'error' : 'warn'
    console[consoleMethod](`[${severity.toUpperCase()}] ${message}`, context)

    // Notify callbacks
    this.errorCallbacks.forEach((callback) => callback(errorLog))

    return errorId
  }

  /**
   * Get user-friendly error message
   */
  private getUserFriendlyMessage(technicalMessage: string): string {
    const messageMap: Record<string, string> = {
      MIN_WIDTH: 'The annotation is too small. Minimum width is 10 pixels.',
      MIN_HEIGHT: 'The annotation is too small. Minimum height is 10 pixels.',
      OUT_OF_BOUNDS: 'The annotation must stay within the image boundaries.',
      MISSING_ID: 'Invalid annotation: missing ID.',
      MISSING_TYPE: 'Invalid annotation: missing type.',
      MISSING_POINTS: 'Invalid annotation: missing points.',
      INVALID_POINTS: 'Invalid annotation: points must have x and y coordinates.',
      MISSING_STYLE: 'Invalid annotation: missing style.',
      MISSING_TRANSFORM: 'Invalid annotation: missing transform.',
      MISSING_METADATA: 'Invalid annotation: missing metadata.',
      LOCK_FAILED: 'Another operation is in progress. Please wait.',
      VALIDATION_FAILED: 'The annotation could not be saved due to validation errors.',
    }

    // Check if technical message contains a known error code
    for (const [code, message] of Object.entries(messageMap)) {
      if (technicalMessage.includes(code)) {
        return message
      }
    }

    return 'An error occurred. Please try again.'
  }

  /**
   * Validate annotation before saving
   */
  validateBeforeSave(
    annotation: Annotation,
    canvasWidth: number,
    canvasHeight: number
  ): ValidationResult {
    // Validate data structure
    const dataResult = validationService.validateAnnotationData(annotation)
    if (!dataResult.valid) {
      this.logError(
        'error',
        `Validation failed: ${dataResult.error}`,
        {
          operation: 'validateBeforeSave',
          annotationId: annotation.id,
          error: dataResult.error || 'Unknown validation error',
          metadata: { errorCode: dataResult.errorCode },
        }
      )
      return dataResult
    }

    // Validate transform
    const transformResult = validationService.validateTransform(
      annotation,
      canvasWidth,
      canvasHeight
    )

    if (!transformResult.valid) {
      this.logError(
        'error',
        `Transform validation failed: ${transformResult.error}`,
        {
          operation: 'validateBeforeSave',
          annotationId: annotation.id,
          error: transformResult.error || 'Unknown validation error',
          metadata: { errorCode: transformResult.errorCode },
        }
      )
      return transformResult
    }

    return { valid: true }
  }

  /**
   * Save rollback state
   */
  saveRollbackState(annotationId: string, beforeState: Annotation, afterState: Annotation): void {
    const rollbackState: RollbackState = {
      annotationId,
      beforeState,
      afterState,
      timestamp: Date.now(),
    }

    this.rollbackStates.set(annotationId, rollbackState)

    // Log
    console.log(`Saved rollback state for annotation ${annotationId}`)
  }

  /**
   * Rollback to previous state
   */
  rollback(annotationId: string): Annotation | null {
    const rollbackState = this.rollbackStates.get(annotationId)

    if (!rollbackState) {
      this.logError(
        'warning',
        `No rollback state found for annotation ${annotationId}`,
        {
          operation: 'rollback',
          annotationId,
          error: 'No rollback state',
        }
      )
      return null
    }

    // Remove rollback state
    this.rollbackStates.delete(annotationId)

    // Log
    this.logError(
      'info',
      `Rolled back annotation ${annotationId}`,
      {
        operation: 'rollback',
        annotationId,
        error: 'Rollback executed',
      },
      'Changes have been reverted'
    )

    return rollbackState.beforeState
  }

  /**
   * Execute operation with validation and rollback
   */
  async executeWithValidation<T>(
    operation: string,
    annotationId: string,
    beforeState: Annotation,
    callback: () => Promise<T> | T,
    canvasWidth: number,
    canvasHeight: number
  ): Promise<{ success: boolean; result?: T; error?: string }> {
    try {
      // Execute operation
      const result = await callback()

      // If result is an annotation, validate it
      if (result && typeof result === 'object' && 'id' in result) {
        const annotation = result as unknown as Annotation

        const validationResult = this.validateBeforeSave(
          annotation,
          canvasWidth,
          canvasHeight
        )

        if (!validationResult.valid) {
          // Validation failed - rollback
          this.logError(
            'error',
            `Validation failed for ${operation}: ${validationResult.error}`,
            {
              operation,
              annotationId,
              error: validationResult.error || 'Validation failed',
              metadata: { errorCode: validationResult.errorCode },
            }
          )

          return {
            success: false,
            error: validationResult.error,
          }
        }

        // Save rollback state
        this.saveRollbackState(annotationId, beforeState, annotation)
      }

      return { success: true, result }
    } catch (error) {
      // Operation failed - log error
      this.logError(
        'error',
        `Operation ${operation} failed: ${error}`,
        {
          operation,
          annotationId,
          error: error instanceof Error ? error : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }
      )

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Add error callback
   */
  addErrorCallback(callback: (error: ErrorLog) => void): void {
    this.errorCallbacks.push(callback)
  }

  /**
   * Remove error callback
   */
  removeErrorCallback(callback: (error: ErrorLog) => void): void {
    this.errorCallbacks = this.errorCallbacks.filter((cb) => cb !== callback)
  }

  /**
   * Get error logs
   */
  getErrorLogs(severity?: ErrorSeverity): ErrorLog[] {
    if (severity) {
      return this.errorLogs.filter((log) => log.severity === severity)
    }
    return [...this.errorLogs]
  }

  /**
   * Get recent errors
   */
  getRecentErrors(count: number = 10): ErrorLog[] {
    return this.errorLogs.slice(-count)
  }

  /**
   * Clear error logs
   */
  clearErrorLogs(): void {
    this.errorLogs = []
  }

  /**
   * Clear rollback states
   */
  clearRollbackStates(): void {
    this.rollbackStates.clear()
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): {
    total: number
    byLevel: Record<ErrorSeverity, number>
    recentCount: number
  } {
    const byLevel: Record<ErrorSeverity, number> = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0,
    }

    this.errorLogs.forEach((log) => {
      byLevel[log.severity]++
    })

    const oneHourAgo = Date.now() - 3600000
    const recentCount = this.errorLogs.filter(
      (log) => log.context.timestamp > oneHourAgo
    ).length

    return {
      total: this.errorLogs.length,
      byLevel,
      recentCount,
    }
  }

  /**
   * Export error logs
   */
  exportErrorLogs(): string {
    return JSON.stringify(this.errorLogs, null, 2)
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.clearErrorLogs()
    this.clearRollbackStates()
    this.errorCallbacks = []
  }
}

// Singleton instance
export const errorHandlingService = new ErrorHandlingService()
