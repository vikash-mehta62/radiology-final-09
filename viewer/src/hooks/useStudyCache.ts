import { useState, useEffect, useCallback, useRef } from 'react'
import { worklistService } from '@/services/worklistService'
import type { Study, WorklistResponse, WorklistFilters, SortOptions } from '@/types/worklist'

interface StudyCacheEntry {
  data: Study
  timestamp: number
  expiresAt: number
}

interface UseStudyCacheOptions {
  cacheTimeout?: number // Cache timeout in milliseconds (default: 5 minutes)
  maxCacheSize?: number // Maximum number of cached studies (default: 100)
  prefetchRelated?: boolean // Whether to prefetch related studies (default: true)
}

interface UseStudyCacheReturn {
  // Worklist operations
  studies: Study[]
  total: number
  loading: boolean
  error: string | null
  
  // Cache operations
  getStudy: (studyInstanceUID: string) => Study | null
  loadStudy: (studyInstanceUID: string) => Promise<Study | null>
  prefetchStudy: (studyInstanceUID: string) => void
  clearCache: () => void
  getCacheStats: () => { size: number; hitRate: number }
  
  // Worklist management
  loadWorklist: (params?: {
    page?: number
    pageSize?: number
    filters?: Partial<WorklistFilters>
    sort?: Partial<SortOptions>
    search?: string
  }) => Promise<void>
  
  refreshWorklist: () => Promise<void>
  updateStudy: (studyInstanceUID: string, updates: Partial<Study>) => void
}

const DEFAULT_CACHE_TIMEOUT = 5 * 60 * 1000 // 5 minutes
const DEFAULT_MAX_CACHE_SIZE = 100

export const useStudyCache = (options: UseStudyCacheOptions = {}): UseStudyCacheReturn => {
  const {
    cacheTimeout = DEFAULT_CACHE_TIMEOUT,
    maxCacheSize = DEFAULT_MAX_CACHE_SIZE,
    prefetchRelated = true,
  } = options

  // State
  const [studies, setStudies] = useState<Study[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cache and stats
  const cacheRef = useRef<Map<string, StudyCacheEntry>>(new Map())
  const statsRef = useRef({ hits: 0, misses: 0 })
  const lastParamsRef = useRef<any>(null)

  // Cache management
  const isExpired = useCallback((entry: StudyCacheEntry): boolean => {
    return Date.now() > entry.expiresAt
  }, [])

  const evictExpired = useCallback(() => {
    const cache = cacheRef.current
    const now = Date.now()
    
    for (const [key, entry] of cache.entries()) {
      if (now > entry.expiresAt) {
        cache.delete(key)
      }
    }
  }, [])

  const evictOldest = useCallback(() => {
    const cache = cacheRef.current
    if (cache.size <= maxCacheSize) return

    // Sort by timestamp and remove oldest entries
    const entries = Array.from(cache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp)
    
    const toRemove = entries.slice(0, cache.size - maxCacheSize)
    toRemove.forEach(([key]) => cache.delete(key))
  }, [maxCacheSize])

  const addToCache = useCallback((study: Study) => {
    const cache = cacheRef.current
    const now = Date.now()
    
    // Evict expired entries first
    evictExpired()
    
    // Add new entry
    cache.set(study.studyInstanceUID, {
      data: study,
      timestamp: now,
      expiresAt: now + cacheTimeout,
    })
    
    // Evict oldest if over limit
    evictOldest()
  }, [cacheTimeout, evictExpired, evictOldest])

  const getStudy = useCallback((studyInstanceUID: string): Study | null => {
    const cache = cacheRef.current
    const entry = cache.get(studyInstanceUID)
    
    if (!entry) {
      statsRef.current.misses++
      return null
    }
    
    if (isExpired(entry)) {
      cache.delete(studyInstanceUID)
      statsRef.current.misses++
      return null
    }
    
    statsRef.current.hits++
    return entry.data
  }, [isExpired])

  const loadStudy = useCallback(async (studyInstanceUID: string): Promise<Study | null> => {
    // Check cache first
    const cached = getStudy(studyInstanceUID)
    if (cached) {
      return cached
    }

    try {
      const study = await worklistService.getStudyDetails(studyInstanceUID)
      addToCache(study)
      return study
    } catch (err) {
      console.error('Failed to load study:', err)
      return null
    }
  }, [getStudy, addToCache])

  const prefetchStudy = useCallback((studyInstanceUID: string) => {
    // Don't prefetch if already cached
    if (getStudy(studyInstanceUID)) {
      return
    }

    // Prefetch in background
    loadStudy(studyInstanceUID).catch(err => {
      console.warn('Failed to prefetch study:', studyInstanceUID, err)
    })
  }, [getStudy, loadStudy])

  const loadWorklist = useCallback(async (params: {
    page?: number
    pageSize?: number
    filters?: Partial<WorklistFilters>
    sort?: Partial<SortOptions>
    search?: string
  } = {}) => {
    setLoading(true)
    setError(null)
    lastParamsRef.current = params

    try {
      const response: WorklistResponse = await worklistService.getWorklist(params)
      
      setStudies(response.studies)
      setTotal(response.total)
      
      // Cache all loaded studies
      response.studies.forEach(study => {
        addToCache(study)
      })
      
      // Prefetch related studies if enabled
      if (prefetchRelated && response.studies.length > 0) {
        // Prefetch next page if we're not on the last page
        const currentPage = params.page || 1
        const pageSize = params.pageSize || 20
        const hasNextPage = currentPage * pageSize < response.total
        
        if (hasNextPage) {
          // Prefetch next page in background
          setTimeout(() => {
            worklistService.getWorklist({
              ...params,
              page: currentPage + 1,
            }).then(nextResponse => {
              nextResponse.studies.forEach(study => {
                addToCache(study)
              })
            }).catch(() => {
              // Ignore prefetch errors
            })
          }, 100)
        }
      }
      
    } catch (err) {
      console.error('Failed to load worklist:', err)
      setError(err instanceof Error ? err.message : 'Failed to load worklist')
    } finally {
      setLoading(false)
    }
  }, [addToCache, prefetchRelated])

  const refreshWorklist = useCallback(async () => {
    if (lastParamsRef.current) {
      await loadWorklist(lastParamsRef.current)
    }
  }, [loadWorklist])

  const updateStudy = useCallback((studyInstanceUID: string, updates: Partial<Study>) => {
    // Update in cache
    const cached = getStudy(studyInstanceUID)
    if (cached) {
      const updatedStudy = { ...cached, ...updates }
      addToCache(updatedStudy)
    }

    // Update in current studies list
    setStudies(prevStudies => 
      prevStudies.map(study => 
        study.studyInstanceUID === studyInstanceUID 
          ? { ...study, ...updates }
          : study
      )
    )
  }, [getStudy, addToCache])

  const clearCache = useCallback(() => {
    cacheRef.current.clear()
    statsRef.current = { hits: 0, misses: 0 }
  }, [])

  const getCacheStats = useCallback(() => {
    const stats = statsRef.current
    const total = stats.hits + stats.misses
    const hitRate = total > 0 ? stats.hits / total : 0
    
    return {
      size: cacheRef.current.size,
      hitRate: Math.round(hitRate * 100) / 100,
    }
  }, [])

  // Cleanup expired entries periodically
  useEffect(() => {
    const interval = setInterval(() => {
      evictExpired()
    }, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [evictExpired])

  return {
    // Worklist state
    studies,
    total,
    loading,
    error,
    
    // Cache operations
    getStudy,
    loadStudy,
    prefetchStudy,
    clearCache,
    getCacheStats,
    
    // Worklist operations
    loadWorklist,
    refreshWorklist,
    updateStudy,
  }
}