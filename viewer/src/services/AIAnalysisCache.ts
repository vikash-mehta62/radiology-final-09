/**
 * AI Analysis Cache
 * Prevents re-analyzing the same slices
 */

export interface CacheEntry {
  sliceIndex: number
  studyInstanceUID: string
  seriesInstanceUID?: string
  result: any
  timestamp: number
  expiresAt: number
}

class AIAnalysisCache {
  private cache: Map<string, CacheEntry> = new Map()
  private defaultTTL = 3600000 // 1 hour in milliseconds

  /**
   * Generate cache key
   */
  private getCacheKey(studyInstanceUID: string, sliceIndex: number, seriesInstanceUID?: string): string {
    return `${studyInstanceUID}:${seriesInstanceUID || 'default'}:${sliceIndex}`
  }

  /**
   * Get cached result
   */
  get(studyInstanceUID: string, sliceIndex: number, seriesInstanceUID?: string): any | null {
    const key = this.getCacheKey(studyInstanceUID, sliceIndex, seriesInstanceUID)
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      console.log(`🗑️ Cache expired: ${key}`)
      return null
    }

    console.log(`✅ Cache hit: ${key}`)
    return entry.result
  }

  /**
   * Set cache entry
   */
  set(
    studyInstanceUID: string,
    sliceIndex: number,
    result: any,
    seriesInstanceUID?: string,
    ttl: number = this.defaultTTL
  ): void {
    const key = this.getCacheKey(studyInstanceUID, sliceIndex, seriesInstanceUID)
    
    const entry: CacheEntry = {
      sliceIndex,
      studyInstanceUID,
      seriesInstanceUID,
      result,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl
    }

    this.cache.set(key, entry)
    console.log(`💾 Cached: ${key} (TTL: ${ttl}ms)`)
  }

  /**
   * Check if cached
   */
  has(studyInstanceUID: string, sliceIndex: number, seriesInstanceUID?: string): boolean {
    return this.get(studyInstanceUID, sliceIndex, seriesInstanceUID) !== null
  }

  /**
   * Clear cache for study
   */
  clearStudy(studyInstanceUID: string): void {
    const keysToDelete: string[] = []
    
    this.cache.forEach((entry, key) => {
      if (entry.studyInstanceUID === studyInstanceUID) {
        keysToDelete.push(key)
      }
    })

    keysToDelete.forEach(key => this.cache.delete(key))
    console.log(`🗑️ Cleared cache for study: ${studyInstanceUID} (${keysToDelete.length} entries)`)
  }

  /**
   * Clear all cache
   */
  clear(): void {
    const size = this.cache.size
    this.cache.clear()
    console.log(`🗑️ Cache cleared (${size} entries)`)
  }

  /**
   * Get cache stats
   */
  getStats(): {
    size: number
    entries: CacheEntry[]
  } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.values())
    }
  }

  /**
   * Clean expired entries
   */
  cleanExpired(): void {
    const now = Date.now()
    const keysToDelete: string[] = []

    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        keysToDelete.push(key)
      }
    })

    keysToDelete.forEach(key => this.cache.delete(key))
    
    if (keysToDelete.length > 0) {
      console.log(`🗑️ Cleaned ${keysToDelete.length} expired cache entries`)
    }
  }
}

// Singleton instance
export const aiAnalysisCache = new AIAnalysisCache()

// Auto-clean expired entries every 5 minutes
setInterval(() => {
  aiAnalysisCache.cleanExpired()
}, 300000)
