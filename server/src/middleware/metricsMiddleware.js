const { getMetricsTrackingService } = require('../services/metrics-tracking-service');

// Middleware to automatically track metrics
function metricsMiddleware() {
  return async (req, res, next) => {
    const metricsService = getMetricsTrackingService();
    
    // Track based on route
    const originalSend = res.send;
    res.send = function(data) {
      // Only track successful requests
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const hospitalId = req.user?.hospitalId || 'system';
        const userId = req.user?.id;
        
        // Track study views
        if (req.method === 'GET' && req.path.includes('/studies/') && !req.path.includes('/metadata')) {
          metricsService.trackStudyView(hospitalId, userId).catch(console.error);
        }
        
        // Track study uploads
        if (req.method === 'POST' && req.path.includes('/upload')) {
          const modality = req.body?.modality || 'OTHER';
          const size = req.file?.size || 0;
          metricsService.trackStudyUpload(hospitalId, modality, size).catch(console.error);
        }
        
        // Track report creation
        if (req.method === 'POST' && req.path.includes('/reports')) {
          metricsService.trackReportCreation(hospitalId, userId).catch(console.error);
        }
        
        // Track AI requests
        if (req.path.includes('/medical-ai')) {
          metricsService.trackAIRequest(hospitalId, true).catch(console.error);
        }
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
}

module.exports = metricsMiddleware;
