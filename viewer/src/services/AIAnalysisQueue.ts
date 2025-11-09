/**
 * AI Analysis Queue System
 * Handles batch processing, rate limiting, and background jobs
 */

export interface QueueJob {
  id: string
  sliceIndex: number
  studyInstanceUID: string
  seriesInstanceUID?: string
  priority: 'urgent' | 'normal' | 'background'
  status: 'queued' | 'processing' | 'complete' | 'failed'
  progress: number
  result?: any
  error?: string
  createdAt: number
  startedAt?: number
  completedAt?: number
  retryCount: number
}

export interface QueueStats {
  total: number
  queued: number
  processing: number
  complete: number
  failed: number
  progress: number
}

export interface RateLimitConfig {
  maxConcurrent: number
  delayBetweenMs: number
  maxPerMinute: number
}

class AIAnalysisQueue {
  private jobs: Map<string, QueueJob> = new Map()
  private processingJobs: Set<string> = new Set()
  private listeners: Set<(stats: QueueStats) => void> = new Set()
  private rateLimitConfig: RateLimitConfig = {
    maxConcurrent: 3,
    delayBetweenMs: 2000,
    maxPerMinute: 15
  }
  private requestTimestamps: number[] = []
  private isProcessing = false

  /**
   * Add job to queue
   */
  addJob(job: Omit<QueueJob, 'id' | 'status' | 'progress' | 'createdAt' | 'retryCount'>): string {
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(7)}`
    
    const queueJob: QueueJob = {
      ...job,
      id: jobId,
      status: 'queued',
      progress: 0,
      createdAt: Date.now(),
      retryCount: 0
    }

    this.jobs.set(jobId, queueJob)
    this.notifyListeners()
    
    console.log(`📋 Job queued: ${jobId} (slice ${job.sliceIndex}, priority: ${job.priority})`)
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue()
    }

    return jobId
  }

  /**
   * Add multiple jobs (batch)
   */
  addBatch(
    slices: number[],
    studyInstanceUID: string,
    seriesInstanceUID?: string,
    priority: 'urgent' | 'normal' | 'background' = 'normal'
  ): string[] {
    const jobIds = slices.map(sliceIndex =>
      this.addJob({
        sliceIndex,
        studyInstanceUID,
        seriesInstanceUID,
        priority
      })
    )

    console.log(`📋 Batch queued: ${jobIds.length} jobs (priority: ${priority})`)
    return jobIds
  }

  /**
   * Process queue with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return
    this.isProcessing = true

    console.log('🔄 Starting queue processing...')

    while (true) {
      // Get next job by priority
      const nextJob = this.getNextJob()
      if (!nextJob) {
        console.log('✅ Queue empty, stopping processor')
        break
      }

      // Check rate limits
      if (!this.canProcessNow()) {
        console.log('⏳ Rate limit reached, waiting...')
        await this.sleep(1000)
        continue
      }

      // Process job
      await this.processJob(nextJob)

      // Delay between requests
      await this.sleep(this.rateLimitConfig.delayBetweenMs)
    }

    this.isProcessing = false
  }

  /**
   * Get next job by priority
   */
  private getNextJob(): QueueJob | null {
    const queuedJobs = Array.from(this.jobs.values())
      .filter(job => job.status === 'queued')
      .sort((a, b) => {
        // Priority order: urgent > normal > background
        const priorityOrder = { urgent: 0, normal: 1, background: 2 }
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
        if (priorityDiff !== 0) return priorityDiff
        
        // Same priority: FIFO
        return a.createdAt - b.createdAt
      })

    return queuedJobs[0] || null
  }

  /**
   * Check if we can process now (rate limiting)
   */
  private canProcessNow(): boolean {
    // Check concurrent limit
    if (this.processingJobs.size >= this.rateLimitConfig.maxConcurrent) {
      return false
    }

    // Check per-minute limit
    const now = Date.now()
    const oneMinuteAgo = now - 60000
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneMinuteAgo)
    
    if (this.requestTimestamps.length >= this.rateLimitConfig.maxPerMinute) {
      return false
    }

    return true
  }

  /**
   * Process single job
   */
  private async processJob(job: QueueJob): Promise<void> {
    console.log(`🔬 Processing job: ${job.id} (slice ${job.sliceIndex})`)

    // Mark as processing
    job.status = 'processing'
    job.startedAt = Date.now()
    job.progress = 10
    this.processingJobs.add(job.id)
    this.requestTimestamps.push(Date.now())
    this.notifyListeners()

    try {
      // Import analysis service dynamically to avoid circular dependency
      const { autoAnalysisService } = await import('./AutoAnalysisService')

      // Trigger analysis
      await autoAnalysisService.autoAnalyze({
        studyInstanceUID: job.studyInstanceUID,
        seriesInstanceUID: job.seriesInstanceUID,
        slices: [job.sliceIndex],
        mode: 'single'
      })

      // Get result
      const analysis = autoAnalysisService.getSliceAnalysis(job.sliceIndex)
      
      if (analysis?.status === 'complete') {
        job.status = 'complete'
        job.progress = 100
        job.result = analysis.results
        job.completedAt = Date.now()
        console.log(`✅ Job complete: ${job.id}`)
      } else if (analysis?.status === 'failed') {
        throw new Error(analysis.error || 'Analysis failed')
      } else {
        throw new Error('Analysis did not complete')
      }

    } catch (error) {
      console.error(`❌ Job failed: ${job.id}`, error)
      
      // Retry logic
      if (job.retryCount < 3) {
        job.retryCount++
        job.status = 'queued'
        job.progress = 0
        console.log(`🔄 Retrying job: ${job.id} (attempt ${job.retryCount}/3)`)
      } else {
        job.status = 'failed'
        job.error = error instanceof Error ? error.message : 'Unknown error'
        job.completedAt = Date.now()
      }
    } finally {
      this.processingJobs.delete(job.id)
      this.notifyListeners()
    }
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): QueueJob | undefined {
    return this.jobs.get(jobId)
  }

  /**
   * Get all jobs
   */
  getAllJobs(): QueueJob[] {
    return Array.from(this.jobs.values())
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const jobs = Array.from(this.jobs.values())
    
    const total = jobs.length
    const queued = jobs.filter(j => j.status === 'queued').length
    const processing = jobs.filter(j => j.status === 'processing').length
    const complete = jobs.filter(j => j.status === 'complete').length
    const failed = jobs.filter(j => j.status === 'failed').length
    
    const progress = total > 0 ? Math.round((complete / total) * 100) : 0

    return { total, queued, processing, complete, failed, progress }
  }

  /**
   * Cancel job
   */
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId)
    if (!job) return false

    if (job.status === 'queued') {
      this.jobs.delete(jobId)
      this.notifyListeners()
      console.log(`🚫 Job cancelled: ${jobId}`)
      return true
    }

    return false
  }

  /**
   * Cancel all jobs
   */
  cancelAll(): void {
    const queuedJobs = Array.from(this.jobs.values())
      .filter(job => job.status === 'queued')
    
    queuedJobs.forEach(job => this.jobs.delete(job.id))
    this.notifyListeners()
    
    console.log(`🚫 Cancelled ${queuedJobs.length} queued jobs`)
  }

  /**
   * Clear completed jobs
   */
  clearCompleted(): void {
    const completedJobs = Array.from(this.jobs.values())
      .filter(job => job.status === 'complete')
    
    completedJobs.forEach(job => this.jobs.delete(job.id))
    this.notifyListeners()
    
    console.log(`🗑️ Cleared ${completedJobs.length} completed jobs`)
  }

  /**
   * Retry failed jobs
   */
  retryFailed(): void {
    const failedJobs = Array.from(this.jobs.values())
      .filter(job => job.status === 'failed')
    
    failedJobs.forEach(job => {
      job.status = 'queued'
      job.progress = 0
      job.error = undefined
      job.retryCount = 0
    })

    this.notifyListeners()
    console.log(`🔄 Retrying ${failedJobs.length} failed jobs`)

    if (!this.isProcessing) {
      this.processQueue()
    }
  }

  /**
   * Subscribe to queue updates
   */
  subscribe(listener: (stats: QueueStats) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Notify listeners
   */
  private notifyListeners(): void {
    const stats = this.getStats()
    this.listeners.forEach(listener => listener(stats))
  }

  /**
   * Update rate limit config
   */
  setRateLimitConfig(config: Partial<RateLimitConfig>): void {
    this.rateLimitConfig = { ...this.rateLimitConfig, ...config }
    console.log('⚙️ Rate limit config updated:', this.rateLimitConfig)
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Clear all jobs
   */
  clear(): void {
    this.jobs.clear()
    this.processingJobs.clear()
    this.requestTimestamps = []
    this.notifyListeners()
    console.log('🗑️ Queue cleared')
  }
}

// Singleton instance
export const aiAnalysisQueue = new AIAnalysisQueue()
