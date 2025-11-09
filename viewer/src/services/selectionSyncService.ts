import { store } from '../store'
import type { Measurement, Annotation } from '../types/viewer'
import {
  rollbackMeasurementRemoval,
  rollbackAnnotationRemoval,
  clearAllSelections,
} from '../store/slices/viewerSlice'
import { showToast } from '../store/slices/toastSlice'
import { setOfflineMode } from '../store/slices/uiSlice'

// Pending operation interface
interface PendingOperation {
  id: string
  type: 'select' | 'deselect' | 'remove'
  itemId: string
  itemType: 'measurement' | 'annotation'
  timestamp: number
  retryCount: number
  maxRetries: number
  beforeState: Measurement | Annotation | null
  afterState: Measurement | Annotation | null
}

// Selection sync service class
class SelectionSyncService {
  private static instance: SelectionSyncService
  private pendingOperations: Map<string, PendingOperation>
  private operationQueue: PendingOperation[]
  private isOnline: boolean

  private constructor() {
    this.pendingOperations = new Map()
    this.operationQueue = []
    this.isOnline = navigator.onLine

    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline())
    window.addEventListener('offline', () => this.handleOffline())
  }

  // Singleton pattern
  public static getInstance(): SelectionSyncService {
    if (!SelectionSyncService.instance) {
      SelectionSyncService.instance = new SelectionSyncService()
    }
    return SelectionSyncService.instance
  }

  // Handle online event
  private handleOnline(): void {
    this.isOnline = true
    console.log('SelectionSyncService: Back online, processing queue...')
    
    // Dispatch offline mode action
    store.dispatch(setOfflineMode(false))
    
    // Show toast notification
    store.dispatch(showToast({
      message: 'Back online. Syncing changes...',
      severity: 'success',
      duration: 3000,
    }))
    
    // Process queued operations
    this.processQueue()
  }

  // Handle offline event
  private handleOffline(): void {
    this.isOnline = false
    console.log('SelectionSyncService: Offline mode activated')
    
    // Dispatch offline mode action
    store.dispatch(setOfflineMode(true))
    
    // Show toast notification
    store.dispatch(showToast({
      message: 'You are offline. Changes will sync when online.',
      severity: 'warning',
      duration: 5000,
    }))
  }

  // Sync selection to server
  async syncSelection(
    itemId: string,
    itemType: 'measurement' | 'annotation',
    action: 'select' | 'deselect'
  ): Promise<void> {
    const operationId = `${action}-${itemType}-${itemId}-${Date.now()}`
    
    const operation: PendingOperation = {
      id: operationId,
      type: action,
      itemId,
      itemType,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      beforeState: null,
      afterState: null,
    }

    // Track operation
    this.pendingOperations.set(operationId, operation)

    // If offline, queue the operation
    if (!this.isOnline) {
      console.log('Offline: queueing selection sync operation')
      this.queueOperation(operation)
      this.pendingOperations.delete(operationId)
      return
    }

    try {
      // Get current study from store
      const state = store.getState()
      const studyInstanceUID = state.viewer.currentStudy?.studyInstanceUID || 'unknown'
      const frameIndex = state.viewer.viewports[state.viewer.activeViewportIndex]?.imageIndex || 0

      // Make API call
      const response = await fetch('/api/viewer/selection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId,
          itemType,
          action,
          timestamp: operation.timestamp,
          studyInstanceUID,
          frameIndex,
        }),
      })

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      console.log('Selection synced successfully:', result)

      // Remove from pending operations
      this.pendingOperations.delete(operationId)
    } catch (error) {
      console.error('Failed to sync selection:', error)
      
      // Handle error with retry logic
      await this.handleSyncError(operation, error as Error)
    }
  }

  // Sync removal to server
  async syncRemoval(
    itemId: string,
    itemType: 'measurement' | 'annotation',
    beforeState?: Measurement | Annotation
  ): Promise<void> {
    const operationId = `remove-${itemType}-${itemId}-${Date.now()}`
    
    const operation: PendingOperation = {
      id: operationId,
      type: 'remove',
      itemId,
      itemType,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      beforeState: beforeState || null,
      afterState: null,
    }

    // Track operation
    this.pendingOperations.set(operationId, operation)

    // If offline, queue the operation
    if (!this.isOnline) {
      console.log('Offline: queueing removal sync operation')
      this.queueOperation(operation)
      this.pendingOperations.delete(operationId)
      return
    }

    try {
      // Get current study from store
      const state = store.getState()
      const studyInstanceUID = state.viewer.currentStudy?.studyInstanceUID || 'unknown'

      // Make API call
      const response = await fetch(`/api/viewer/items/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemType,
          timestamp: operation.timestamp,
          studyInstanceUID,
        }),
      })

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      console.log('Removal synced successfully:', result)

      // Remove from pending operations
      this.pendingOperations.delete(operationId)
    } catch (error) {
      console.error('Failed to sync removal:', error)
      
      // Handle error with retry logic
      await this.handleSyncError(operation, error as Error)
    }
  }

  // Handle sync errors with rollback
  private async handleSyncError(
    operation: PendingOperation,
    error: Error
  ): Promise<void> {
    // Increment retry count
    operation.retryCount++

    // Check if we should retry
    if (operation.retryCount < operation.maxRetries) {
      // Calculate exponential backoff delay
      const delay = Math.min(1000 * Math.pow(2, operation.retryCount), 10000)
      
      console.log(`Retrying operation ${operation.id} in ${delay}ms (attempt ${operation.retryCount + 1}/${operation.maxRetries})`)
      
      // Wait for delay
      await new Promise(resolve => setTimeout(resolve, delay))
      
      // Retry operation
      try {
        await this.retryOperation(operation)
        
        // Success - remove from pending operations
        this.pendingOperations.delete(operation.id)
      } catch (retryError) {
        // Retry failed, handle error again
        await this.handleSyncError(operation, retryError as Error)
      }
    } else {
      // Max retries exceeded - rollback
      console.error(`Max retries exceeded for operation ${operation.id}`)
      
      this.rollbackOperation(operation)
      
      // Show error to user
      this.showErrorToast(operation, error)
      
      // Remove from pending operations
      this.pendingOperations.delete(operation.id)
      
      // Log error for debugging
      console.error('Selection sync failed:', {
        operation,
        error,
        timestamp: Date.now(),
      })
    }
  }

  // Rollback operation
  private rollbackOperation(operation: PendingOperation): void {
    const { type, itemType, beforeState } = operation

    console.log('Rolling back operation:', operation)

    if (type === 'remove' && beforeState) {
      // Restore removed item
      if (itemType === 'measurement') {
        store.dispatch(rollbackMeasurementRemoval(beforeState as Measurement))
        console.log('Rolled back measurement removal:', beforeState)
      } else {
        store.dispatch(rollbackAnnotationRemoval(beforeState as Annotation))
        console.log('Rolled back annotation removal:', beforeState)
      }
    } else if (type === 'select' || type === 'deselect') {
      // Revert selection state - clear all selections
      store.dispatch(clearAllSelections())
      console.log('Cleared selections due to failed sync')
    }
  }

  // Queue operation for offline support
  private queueOperation(operation: PendingOperation): void {
    console.log('Queueing operation for offline sync:', operation)
    
    // Add to queue if not already present
    const existingIndex = this.operationQueue.findIndex(op => op.id === operation.id)
    if (existingIndex === -1) {
      this.operationQueue.push(operation)
      console.log(`Operation queued. Queue size: ${this.operationQueue.length}`)
    }
  }

  // Process queued operations
  async processQueue(): Promise<void> {
    if (!this.isOnline || this.operationQueue.length === 0) {
      console.log('Cannot process queue: offline or empty queue')
      return
    }

    console.log(`Processing ${this.operationQueue.length} queued operations...`)

    // Process operations in order
    const operations = [...this.operationQueue]
    
    for (const operation of operations) {
      try {
        console.log(`Processing queued operation: ${operation.id}`)
        
        await this.retryOperation(operation)
        
        // Remove from queue on success
        this.operationQueue = this.operationQueue.filter(op => op.id !== operation.id)
        
        console.log(`Operation ${operation.id} processed successfully`)
      } catch (error) {
        console.error('Failed to process queued operation:', operation, error)
        
        // Increment retry count
        operation.retryCount++
        
        // If max retries exceeded, remove from queue and rollback
        if (operation.retryCount >= operation.maxRetries) {
          console.error(`Max retries exceeded for queued operation ${operation.id}`)
          this.operationQueue = this.operationQueue.filter(op => op.id !== operation.id)
          this.rollbackOperation(operation)
          this.showErrorToast(operation, error as Error)
        }
      }
    }

    console.log(`Queue processing complete. Remaining: ${this.operationQueue.length}`)
  }

  // Retry operation
  private async retryOperation(operation: PendingOperation): Promise<void> {
    if (operation.type === 'select' || operation.type === 'deselect') {
      await this.syncSelection(operation.itemId, operation.itemType, operation.type)
    } else if (operation.type === 'remove') {
      await this.syncRemoval(operation.itemId, operation.itemType, operation.beforeState || undefined)
    }
  }

  // Show error toast
  private showErrorToast(operation: PendingOperation, error: Error): void {
    console.error('Operation failed:', operation, error)
    
    const message = this.getErrorMessage(operation, error)
    
    // Dispatch toast notification
    store.dispatch(showToast({
      message,
      severity: 'error',
      duration: 5000,
    }))
  }

  // Get user-friendly error message
  private getErrorMessage(operation: PendingOperation, error: Error): string {
    const itemType = operation.itemType === 'measurement' ? 'measurement' : 'annotation'
    
    switch (operation.type) {
      case 'select':
        return `Failed to select ${itemType}. ${error.message}`
      case 'deselect':
        return `Failed to deselect ${itemType}. ${error.message}`
      case 'remove':
        return `Failed to remove ${itemType}. Please try again.`
      default:
        return `Operation failed: ${error.message}`
    }
  }
}

// Export singleton instance
export default SelectionSyncService.getInstance()
