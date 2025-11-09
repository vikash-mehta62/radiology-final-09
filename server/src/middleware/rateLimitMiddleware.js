/**
 * Rate Limiting Middleware
 * Simple in-memory rate limiter for API endpoints
 */

// Store for tracking requests (in production, use Redis)
const requestStore = new Map()

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, data] of requestStore.entries()) {
    if (now - data.resetTime > 60000) {
      requestStore.delete(key)
    }
  }
}, 300000)

/**
 * Create a rate limiter middleware
 * @param {Object} options - Rate limiter options
 * @param {number} options.windowMs - Time window in milliseconds (default: 60000 = 1 minute)
 * @param {number} options.max - Maximum number of requests per window (default: 100)
 * @param {string} options.message - Error message when limit exceeded
 * @returns {Function} Express middleware function
 */
function createRateLimiter(options = {}) {
  const {
    windowMs = 60000, // 1 minute
    max = 100, // 100 requests per minute
    message = 'Too many requests, please try again later.'
  } = options

  return (req, res, next) => {
    // Get identifier (IP address or user ID)
    const identifier = req.user?.id || req.ip || req.connection.remoteAddress

    const now = Date.now()
    const key = `${identifier}:${req.path}`

    // Get or create request data
    let requestData = requestStore.get(key)

    if (!requestData || now - requestData.resetTime > windowMs) {
      // Create new window
      requestData = {
        count: 0,
        resetTime: now
      }
      requestStore.set(key, requestData)
    }

    // Increment request count
    requestData.count++

    // Check if limit exceeded
    if (requestData.count > max) {
      return res.status(429).json({
        success: false,
        error: message,
        retryAfter: Math.ceil((requestData.resetTime + windowMs - now) / 1000)
      })
    }

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', max)
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - requestData.count))
    res.setHeader('X-RateLimit-Reset', new Date(requestData.resetTime + windowMs).toISOString())

    next()
  }
}

module.exports = {
  createRateLimiter
}
