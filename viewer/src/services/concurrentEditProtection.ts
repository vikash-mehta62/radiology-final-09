/**
 * Concurrent Edit Protection
 * 
 * Prevents multiple simultaneous edits on the same annotation
 */

import type { Annotation } from '../types/viewer'

export interface EditLock {
  annotationId: string
  operation: 'drag' | 'resize' | 'text-edit' | 'point-edit'
  timestamp: number
  lockId: string
}

export interface OperationQueue {
  annotationId: string
  operation: () => void
  priority: number
}

class ConcurrentEditProtection {
  private locks = new Map<string, EditLock>()
  private operationQueue: OperationQueue[] = []
  private lockTimeout = 30000 // 30 seconds
  private cleanupInterval: NodeJS.Timeout | null = null

  /**
   * Initialize concurrent edit protection
   */
  initialize(): void {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredLocks()
    }, 5000)
  }

  /**
   * Acquire lock for annotation
   */
  acquireLock(
    annotationId: string,
    operation: EditLock['operation']
  ): string | null {
    // Check if already locked
    if (this.isLocked(annotationId)) {
      const existingLock = this.locks.get(annotationId)
      console.warn(
        `Annotation ${annotationId} is already locked for ${existingLock?.operation}`
      )
      return null
    }

    // Create lock
    const lockId = `lock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const lock: EditLock = {
      annotationId,
      operation,
      timestamp: Date.now(),
      lockId,
    }

    this.locks.set(annotationId, lock)
    console.log(`Acquired lock ${lockId} for annotation ${annotationId}`)

    return lockId
  }

  /**
   * Release lock for annotation
   */
  releaseLock(annotationId: string, lockId: string): boolean {
    const lock = this.locks.get(annotationId)

    if (!lock) {
      console.warn(`No lock found for annotation ${annotationId}`)
      return false
    }

    if (lock.lockId !== lockId) {
      console.warn(
        `Lock ID mismatch for annotation ${annotationId}. Expected ${lock.lockId}, got ${lockId}`
      )
      return false
    }

    this.locks.delete(annotationId)
    console.log(`Released lock ${lockId} for annotation ${annotationId}`)

    // Process queued operations
    this.processQueue(annotationId)

    return true
  }

  /**
   * Check if annotation is locked
   */
  isLocked(annotationId: string): boolean {
    return this.locks.has(annotationId)
  }

  /**
   * Get lock for annotation
   */
  getLock(annotationId: string): EditLock | null {
    return this.locks.get(annotationId) || null
  }

  /**
   * Force release lock (use with caution)
   */
  forceReleaseLock(annotationId: string): void {
    this.locks.delete(annotationId)
    console.log(`Force released lock for annotation ${annotationId}`)
    this.processQueue(annotationId)
  }

  /**
   * Queue operation if annotation is locked
   */
  queueOperation(
    annotationId: string,
    operation: () => void,
    priority: number = 0
  ): void {
    this.operationQueue.push({
      annotationId,
      operation,
      priority,
    })

    // Sort by priority (higher first)
    this.operationQueue.sort((a, b) => b.priority - a.priority)

    console.log(
      `Queued operation for annotation ${annotationId} (queue size: ${this.operationQueue.length})`
    )
  }

  /**
   * Process queued operations for annotation
   */
  private processQueue(annotationId: string): void {
    const operations = this.operationQueue.filter(
      (op) => op.annotationId === annotationId
    )

    if (operations.length === 0) return

    // Remove from queue
    this.operationQueue = this.operationQueue.filter(
      (op) => op.annotationId !== annotationId
    )

    // Execute first operation
    const operation = operations[0]
    console.log(`Processing queued operation for annotation ${annotationId}`)

    try {
      operation.operation()
    } catch (error) {
      console.error(
        `Error processing queued operation for annotation ${annotationId}:`,
        error
      )
    }

    // Re-queue remaining operations
    operations.slice(1).forEach((op) => {
      this.operationQueue.push(op)
    })
  }

  /**
   * Clean up expired locks
   */
  private cleanupExpiredLocks(): void {
    const now = Date.now()
    const expiredLocks: string[] = []

    this.locks.forEach((lock, annotationId) => {
      if (now - lock.timestamp > this.lockTimeout) {
        expiredLocks.push(annotationId)
      }
    })

    expiredLocks.forEach((annotationId) => {
      console.warn(`Lock expired for annotation ${annotationId}`)
      this.forceReleaseLock(annotationId)
    })
  }

  /**
   * Get all locked annotations
   */
  getLockedAnnotations(): string[] {
    return Array.from(this.locks.keys())
  }

  /**
   * Get lock count
   */
  getLockCount(): number {
    return this.locks.size
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.operationQueue.length
  }

  /**
   * Clear all locks (use with caution)
   */
  clearAllLocks(): void {
    this.locks.clear()
    console.log('Cleared all locks')
  }

  /**
   * Clear operation queue
   */
  clearQueue(): void {
    this.operationQueue = []
    console.log('Cleared operation queue')
  }

  /**
   * Set lock timeout
   */
  setLockTimeout(timeout: number): void {
    this.lockTimeout = timeout
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.clearAllLocks()
    this.clearQueue()
  }

  /**
   * Execute operation with lock
   */
  async executeWithLock<T>(
    annotationId: string,
    operation: EditLock['operation'],
    callback: () => Promise<T> | T
  ): Promise<T | null> {
    // Try to acquire lock
    const lockId = this.acquireLock(annotationId, operation)

    if (!lockId) {
      console.warn(
        `Could not acquire lock for annotation ${annotationId}. Operation will be queued.`
      )
      return null
    }

    try {
      // Execute operation
      const result = await callback()

      // Release lock
      this.releaseLock(annotationId, lockId)

      return result
    } catch (error) {
      // Release lock on error
      this.releaseLock(annotationId, lockId)
      throw error
    }
  }

  /**
   * Check if operation can proceed
   */
  canProceed(annotationId: string, operation: EditLock['operation']): boolean {
    const lock = this.getLock(annotationId)

    if (!lock) {
      return true
    }

    // Allow same operation type to proceed (e.g., multiple drag events)
    return lock.operation === operation
  }

  /**
   * Get lock status for UI display
   */
  getLockStatus(annotationId: string): {
    locked: boolean
    operation?: string
    duration?: number
  } {
    const lock = this.getLock(annotationId)

    if (!lock) {
      return { locked: false }
    }

    return {
      locked: true,
      operation: lock.operation,
      duration: Date.now() - lock.timestamp,
    }
  }
}

// Singleton instance
export const concurrentEditProtection = new ConcurrentEditProtection()
