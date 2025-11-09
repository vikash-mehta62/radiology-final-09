/**
 * PACS Filter Middleware
 * Security filtering for PACS connections
 */

const pacsConfig = require('../config/pacs-security');

// Rate limiting storage
const rateLimitStore = new Map();
const blockedAttemptsStore = new Map();

/**
 * Clean up old rate limit entries every 5 minutes
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now > data.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Check if AE Title matches blocked pattern
 */
function isBlocked(aet) {
  return pacsConfig.blockedModalities.some(pattern => {
    const regex = new RegExp('^' + pattern.replace('*', '.*') + '$', 'i');
    return regex.test(aet);
  });
}

/**
 * Check if device is read-only
 */
function isReadOnly(aet) {
  return pacsConfig.readOnlyDevices.some(pattern => {
    const regex = new RegExp('^' + pattern.replace('*', '.*') + '$', 'i');
    return regex.test(aet);
  });
}

/**
 * Check business hours restriction
 */
function isWithinBusinessHours() {
  if (!pacsConfig.businessHours.enabled) {
    return true;
  }
  
  const now = new Date();
  const hour = now.getHours();
  
  return hour >= pacsConfig.businessHours.start && 
         hour < pacsConfig.businessHours.end;
}

/**
 * Check if device is restricted by business hours
 */
function isRestrictedByTime(aet) {
  if (!pacsConfig.businessHours.enabled) {
    return false;
  }
  
  return pacsConfig.businessHours.restrictedDevices.some(pattern => {
    const regex = new RegExp('^' + pattern.replace('*', '.*') + '$', 'i');
    return regex.test(aet);
  });
}

/**
 * Check rate limit for device
 */
function checkRateLimit(aet) {
  const now = Date.now();
  
  if (!rateLimitStore.has(aet)) {
    rateLimitStore.set(aet, {
      count: 1,
      resetTime: now + 60000 // 1 minute
    });
    return { allowed: true, remaining: 99 };
  }
  
  const limit = rateLimitStore.get(aet);
  
  // Reset if time window passed
  if (now > limit.resetTime) {
    limit.count = 1;
    limit.resetTime = now + 60000;
    return { allowed: true, remaining: 99 };
  }
  
  // Get max requests for this device
  const modalityConfig = pacsConfig.allowedModalities[aet];
  const maxRequests = modalityConfig?.maxRequestsPerMinute || pacsConfig.rateLimits.default;
  
  limit.count++;
  
  if (limit.count > maxRequests) {
    return { 
      allowed: false, 
      remaining: 0,
      resetIn: limit.resetTime - now
    };
  }
  
  return { 
    allowed: true, 
    remaining: maxRequests - limit.count 
  };
}

/**
 * Track blocked attempts
 */
function trackBlockedAttempt(aet, ip, reason) {
  const key = `${aet}_${ip}`;
  const now = Date.now();
  
  if (!blockedAttemptsStore.has(key)) {
    blockedAttemptsStore.set(key, {
      count: 1,
      firstAttempt: now,
      lastAttempt: now,
      reasons: [reason]
    });
    return 1;
  }
  
  const attempts = blockedAttemptsStore.get(key);
  
  // Reset if outside time window
  if (now - attempts.firstAttempt > pacsConfig.alerts.timeWindow) {
    attempts.count = 1;
    attempts.firstAttempt = now;
    attempts.reasons = [reason];
  } else {
    attempts.count++;
    attempts.reasons.push(reason);
  }
  
  attempts.lastAttempt = now;
  
  return attempts.count;
}

/**
 * Main PACS filter middleware
 */
const pacsFilterMiddleware = (req, res, next) => {
  // Extract connection info
  const callingAET = req.body?.callingAET || req.headers['x-calling-aet'] || 'UNKNOWN';
  const clientIP = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
  const operation = req.body?.operation || req.method;
  
  // Log attempt
  if (pacsConfig.security.logAllAttempts) {
    console.log('📡 PACS Connection Attempt:', {
      timestamp: new Date().toISOString(),
      callingAET,
      ip: clientIP,
      operation,
      path: req.path
    });
  }
  
  // Check 1: Blacklist (highest priority)
  if (pacsConfig.security.enforceAETWhitelist && isBlocked(callingAET)) {
    const blockedCount = trackBlockedAttempt(callingAET, clientIP, 'BLACKLISTED');
    
    console.log(`⛔ BLOCKED: ${callingAET} is blacklisted (attempt ${blockedCount})`);
    
    if (pacsConfig.security.alertOnBlocked && 
        blockedCount >= pacsConfig.alerts.blockedAttemptsThreshold) {
      console.log(`🚨 ALERT: ${callingAET} exceeded blocked attempt threshold`);
      // TODO: Send alert via email/webhook
    }
    
    return res.status(403).json({
      success: false,
      error: 'Device blocked',
      code: 'AET_BLOCKED',
      message: 'This device is not authorized to connect'
    });
  }
  
  // Check 2: AE Title whitelist
  if (pacsConfig.security.enforceAETWhitelist) {
    const modalityConfig = pacsConfig.allowedModalities[callingAET];
    
    if (!modalityConfig || !modalityConfig.enabled) {
      const blockedCount = trackBlockedAttempt(callingAET, clientIP, 'NOT_WHITELISTED');
      
      console.log(`⛔ BLOCKED: ${callingAET} not in whitelist (attempt ${blockedCount})`);
      
      return res.status(403).json({
        success: false,
        error: 'Device not authorized',
        code: 'AET_NOT_WHITELISTED',
        message: 'This device is not registered in the system'
      });
    }
  }
  
  // Check 3: IP whitelist
  if (pacsConfig.security.enforceIPWhitelist) {
    const normalizedIP = clientIP.replace('::ffff:', ''); // Handle IPv6-mapped IPv4
    
    if (!pacsConfig.allowedIPs.includes(normalizedIP) && 
        !pacsConfig.allowedIPs.includes(clientIP)) {
      const blockedCount = trackBlockedAttempt(callingAET, clientIP, 'IP_NOT_WHITELISTED');
      
      console.log(`⛔ BLOCKED: IP ${clientIP} not in whitelist (attempt ${blockedCount})`);
      
      return res.status(403).json({
        success: false,
        error: 'IP not authorized',
        code: 'IP_NOT_WHITELISTED',
        message: 'Connection from this IP address is not allowed'
      });
    }
  }
  
  // Check 4: Modality type filter
  if (pacsConfig.security.enforceModalityFilter && req.body?.modality) {
    const modality = req.body.modality;
    
    if (!pacsConfig.allowedModalityTypes.includes(modality)) {
      console.log(`⛔ BLOCKED: Modality type ${modality} not allowed`);
      
      return res.status(400).json({
        success: false,
        error: 'Modality type not accepted',
        code: 'MODALITY_NOT_ALLOWED',
        message: `Modality type ${modality} is not accepted by this system`
      });
    }
  }
  
  // Check 5: Business hours restriction
  if (isRestrictedByTime(callingAET) && !isWithinBusinessHours()) {
    console.log(`⛔ BLOCKED: ${callingAET} outside business hours`);
    
    return res.status(403).json({
      success: false,
      error: 'Outside business hours',
      code: 'TIME_RESTRICTED',
      message: 'This device can only connect during business hours',
      businessHours: {
        start: pacsConfig.businessHours.start,
        end: pacsConfig.businessHours.end
      }
    });
  }
  
  // Check 6: Read-only restriction
  if (isReadOnly(callingAET) && (operation === 'C-STORE' || req.method === 'POST')) {
    console.log(`⛔ BLOCKED: ${callingAET} attempted write operation (read-only device)`);
    
    return res.status(403).json({
      success: false,
      error: 'Read-only device',
      code: 'READ_ONLY_DEVICE',
      message: 'This device can only query, not store data'
    });
  }
  
  // Check 7: Rate limiting
  const rateLimit = checkRateLimit(callingAET);
  
  if (!rateLimit.allowed) {
    console.log(`⛔ RATE LIMITED: ${callingAET} exceeded rate limit`);
    
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this device',
      retryAfter: Math.ceil(rateLimit.resetIn / 1000)
    });
  }
  
  // All checks passed - add headers and continue
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);
  res.setHeader('X-Calling-AET', callingAET);
  
  console.log(`✅ ALLOWED: ${callingAET} from ${clientIP}`);
  
  next();
};

/**
 * Get security statistics
 */
function getSecurityStats() {
  const stats = {
    rateLimits: {
      activeDevices: rateLimitStore.size,
      devices: []
    },
    blockedAttempts: {
      total: 0,
      devices: []
    }
  };
  
  // Rate limit stats
  for (const [aet, data] of rateLimitStore.entries()) {
    stats.rateLimits.devices.push({
      aet,
      requests: data.count,
      resetIn: Math.max(0, data.resetTime - Date.now())
    });
  }
  
  // Blocked attempts stats
  for (const [key, data] of blockedAttemptsStore.entries()) {
    stats.blockedAttempts.total += data.count;
    stats.blockedAttempts.devices.push({
      key,
      count: data.count,
      lastAttempt: new Date(data.lastAttempt),
      reasons: data.reasons
    });
  }
  
  return stats;
}

module.exports = {
  pacsFilterMiddleware,
  getSecurityStats,
  isBlocked,
  isReadOnly,
  checkRateLimit
};
