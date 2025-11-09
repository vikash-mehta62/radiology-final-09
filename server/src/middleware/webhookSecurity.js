const crypto = require('crypto');
const winston = require('winston');
const { randomUUID } = require('../utils/crypto-polyfill');

/**
 * WebhookSecurity class for HMAC-SHA256 validation, replay attack prevention, and rate limiting
 */
class WebhookSecurity {
  constructor(options = {}) {
    this.secret = options.secret || process.env.WEBHOOK_SECRET;
    this.timestampTolerance = options.timestampTolerance || 300; // 5 minutes in seconds
    this.rateLimit = options.rateLimit || 100; // requests per minute
    this.rateLimitWindow = options.rateLimitWindow || 60; // window in seconds
    
    // In-memory rate limiting store (in production, use Redis)
    this.rateLimitStore = new Map();
    
    // Security audit logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'security-audit.log' })
      ]
    });
  }

  /**
   * Generate HMAC-SHA256 signature for webhook payload
   */
  generateSignature(payload, timestamp, nonce) {
    const data = `${timestamp}.${nonce}.${JSON.stringify(payload)}`;
    return crypto.createHmac('sha256', this.secret).update(data).digest('hex');
  }

  /**
   * Validate HMAC-SHA256 signature
   */
  validateSignature(payload, signature, timestamp, nonce) {
    try {
      const expectedSignature = this.generateSignature(payload, timestamp, nonce);
      
      // Ensure both signatures are the same length to prevent timing attacks
      if (signature.length !== expectedSignature.length) {
        return false;
      }
      
      // Use constant-time comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      // Invalid hex string or other error
      return false;
    }
  }

  /**
   * Check if timestamp is within acceptable range to prevent replay attacks
   */
  validateTimestamp(timestamp) {
    const now = Math.floor(Date.now() / 1000);
    const requestTime = parseInt(timestamp);
    
    return Math.abs(now - requestTime) <= this.timestampTolerance;
  }

  /**
   * Rate limiting using sliding window algorithm
   */
  checkRateLimit(clientIP) {
    const now = Date.now();
    const windowStart = now - (this.rateLimitWindow * 1000);
    
    if (!this.rateLimitStore.has(clientIP)) {
      this.rateLimitStore.set(clientIP, []);
    }
    
    const requests = this.rateLimitStore.get(clientIP);
    
    // Remove old requests outside the window
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    
    // Check if rate limit exceeded
    if (validRequests.length >= this.rateLimit) {
      return false;
    }
    
    // Add current request
    validRequests.push(now);
    this.rateLimitStore.set(clientIP, validRequests);
    
    return true;
  }

  /**
   * Log security events
   */
  logSecurityEvent(event, details) {
    this.logger.warn('Security Event', {
      event,
      timestamp: new Date().toISOString(),
      correlationId: randomUUID(),
      ...details
    });
  }

  /**
   * Express middleware for webhook security validation
   */
  middleware() {
    return (req, res, next) => {
      const clientIP = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
      const signature = req.headers['x-webhook-signature'];
      const timestamp = req.headers['x-webhook-timestamp'];
      const nonce = req.headers['x-webhook-nonce'];

      // Rate limiting check
      if (!this.checkRateLimit(clientIP)) {
        this.logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          clientIP,
          endpoint: req.path
        });
        return res.status(429).json({ error: 'Rate limit exceeded' });
      }

      // Validate required headers
      if (!signature || !timestamp || !nonce) {
        this.logSecurityEvent('MISSING_SECURITY_HEADERS', {
          clientIP,
          endpoint: req.path,
          headers: { signature: !!signature, timestamp: !!timestamp, nonce: !!nonce }
        });
        return res.status(401).json({ error: 'Missing security headers' });
      }

      // Validate timestamp to prevent replay attacks
      if (!this.validateTimestamp(timestamp)) {
        this.logSecurityEvent('REPLAY_ATTACK_ATTEMPT', {
          clientIP,
          endpoint: req.path,
          timestamp,
          currentTime: Math.floor(Date.now() / 1000)
        });
        return res.status(401).json({ error: 'Invalid timestamp' });
      }

      // Validate HMAC signature
      if (!this.validateSignature(req.body, signature, timestamp, nonce)) {
        this.logSecurityEvent('INVALID_SIGNATURE', {
          clientIP,
          endpoint: req.path,
          providedSignature: signature
        });
        return res.status(401).json({ error: 'Invalid signature' });
      }

      // Log successful validation
      this.logSecurityEvent('WEBHOOK_VALIDATED', {
        clientIP,
        endpoint: req.path,
        timestamp,
        nonce
      });

      next();
    };
  }
}

module.exports = WebhookSecurity;