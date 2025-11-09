/**
 * Performance Utilities
 * 
 * Provides throttling, debouncing, and RAF-based optimization utilities
 */

/**
 * Throttle function using requestAnimationFrame (60 FPS)
 * Ensures function is called at most once per frame
 */
export function throttleRAF<T extends (...args: any[]) => void>(
  callback: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null
  let lastArgs: Parameters<T> | null = null

  return (...args: Parameters<T>) => {
    lastArgs = args

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        if (lastArgs) {
          callback(...lastArgs)
        }
        rafId = null
        lastArgs = null
      })
    }
  }
}

/**
 * Debounce function - delays execution until after wait time has elapsed
 * since the last call
 */
export function debounce<T extends (...args: any[]) => void>(
  callback: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      callback(...args)
      timeoutId = null
    }, wait)
  }
}

/**
 * Throttle function - limits execution to once per wait time
 */
export function throttle<T extends (...args: any[]) => void>(
  callback: T,
  wait: number
): (...args: Parameters<T>) => void {
  let lastCall = 0
  let timeoutId: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    const now = Date.now()
    const timeSinceLastCall = now - lastCall

    if (timeSinceLastCall >= wait) {
      lastCall = now
      callback(...args)
    } else {
      // Schedule for later if not already scheduled
      if (!timeoutId) {
        timeoutId = setTimeout(() => {
          lastCall = Date.now()
          callback(...args)
          timeoutId = null
        }, wait - timeSinceLastCall)
      }
    }
  }
}

/**
 * Batch updates - collects multiple updates and executes them together
 */
export class BatchUpdater<T> {
  private updates: T[] = []
  private timeoutId: NodeJS.Timeout | null = null
  private callback: (updates: T[]) => void
  private wait: number

  constructor(callback: (updates: T[]) => void, wait: number = 100) {
    this.callback = callback
    this.wait = wait
  }

  add(update: T): void {
    this.updates.push(update)

    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
    }

    this.timeoutId = setTimeout(() => {
      this.flush()
    }, this.wait)
  }

  flush(): void {
    if (this.updates.length > 0) {
      this.callback([...this.updates])
      this.updates = []
    }

    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }

  clear(): void {
    this.updates = []
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }
}

/**
 * Drag update manager - batches drag updates and only commits to Redux on drag end
 */
export class DragUpdateManager<T> {
  private isDragging = false
  private currentState: T | null = null
  private initialState: T | null = null
  private onUpdate: (state: T) => void
  private onCommit: (initialState: T, finalState: T) => void

  constructor(
    onUpdate: (state: T) => void,
    onCommit: (initialState: T, finalState: T) => void
  ) {
    this.onUpdate = onUpdate
    this.onCommit = onCommit
  }

  startDrag(initialState: T): void {
    this.isDragging = true
    this.initialState = initialState
    this.currentState = initialState
  }

  updateDrag(state: T): void {
    if (!this.isDragging) return

    this.currentState = state
    this.onUpdate(state)
  }

  endDrag(): void {
    if (!this.isDragging || !this.initialState || !this.currentState) return

    this.onCommit(this.initialState, this.currentState)
    this.isDragging = false
    this.initialState = null
    this.currentState = null
  }

  cancelDrag(): void {
    if (!this.isDragging || !this.initialState) return

    this.onUpdate(this.initialState)
    this.isDragging = false
    this.initialState = null
    this.currentState = null
  }

  isDraggingActive(): boolean {
    return this.isDragging
  }
}

/**
 * Memoization cache with LRU eviction
 */
export class MemoCache<K, V> {
  private cache = new Map<string, { value: V; timestamp: number }>()
  private maxSize: number

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize
  }

  private getKey(key: K): string {
    return JSON.stringify(key)
  }

  get(key: K): V | undefined {
    const keyStr = this.getKey(key)
    const entry = this.cache.get(keyStr)

    if (entry) {
      // Update timestamp for LRU
      entry.timestamp = Date.now()
      return entry.value
    }

    return undefined
  }

  set(key: K, value: V): void {
    const keyStr = this.getKey(key)

    // Evict oldest entry if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(keyStr)) {
      let oldestKey: string | null = null
      let oldestTime = Infinity

      this.cache.forEach((entry, key) => {
        if (entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp
          oldestKey = key
        }
      })

      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }

    this.cache.set(keyStr, { value, timestamp: Date.now() })
  }

  has(key: K): boolean {
    return this.cache.has(this.getKey(key))
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }
}

/**
 * Performance monitor - tracks render times and frame rates
 */
export class PerformanceMonitor {
  private frameTimes: number[] = []
  private maxSamples = 60
  private lastFrameTime = 0

  recordFrame(): void {
    const now = performance.now()

    if (this.lastFrameTime > 0) {
      const frameTime = now - this.lastFrameTime
      this.frameTimes.push(frameTime)

      if (this.frameTimes.length > this.maxSamples) {
        this.frameTimes.shift()
      }
    }

    this.lastFrameTime = now
  }

  getAverageFrameTime(): number {
    if (this.frameTimes.length === 0) return 0

    const sum = this.frameTimes.reduce((a, b) => a + b, 0)
    return sum / this.frameTimes.length
  }

  getAverageFPS(): number {
    const avgFrameTime = this.getAverageFrameTime()
    return avgFrameTime > 0 ? 1000 / avgFrameTime : 0
  }

  reset(): void {
    this.frameTimes = []
    this.lastFrameTime = 0
  }
}
