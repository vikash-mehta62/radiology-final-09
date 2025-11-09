const UsageMetrics = require('../models/UsageMetrics');

class MetricsTrackingService {
  constructor() {
    this.dailyCache = new Map();
  }

  async trackStudyUpload(hospitalId, modality = 'OTHER', sizeBytes = 0) {
    try {
      const today = this.getTodayDate();
      const metrics = await this.getOrCreateDailyMetrics(hospitalId, today);
      
      metrics.studies.uploaded += 1;
      metrics.storage.addedBytes += sizeBytes;
      metrics.storage.totalBytes += sizeBytes;
      
      if (modality && metrics.modalityBreakdown[modality] !== undefined) {
        metrics.modalityBreakdown[modality] += 1;
      } else {
        metrics.modalityBreakdown.OTHER += 1;
      }
      
      await metrics.save();
    } catch (error) {
      console.error('Error tracking study upload:', error);
    }
  }

  async trackStudyView(hospitalId, userId) {
    try {
      const today = this.getTodayDate();
      const metrics = await this.getOrCreateDailyMetrics(hospitalId, today);
      
      metrics.studies.viewed += 1;
      
      if (!metrics.users.uniqueUsers.includes(userId)) {
        metrics.users.uniqueUsers.push(userId);
        metrics.users.activeUsers = metrics.users.uniqueUsers.length;
      }
      
      await metrics.save();
    } catch (error) {
      console.error('Error tracking study view:', error);
    }
  }

  async trackReportCreation(hospitalId, userId) {
    try {
      const today = this.getTodayDate();
      const metrics = await this.getOrCreateDailyMetrics(hospitalId, today);
      
      metrics.studies.reported += 1;
      
      if (!metrics.users.uniqueUsers.includes(userId)) {
        metrics.users.uniqueUsers.push(userId);
        metrics.users.activeUsers = metrics.users.uniqueUsers.length;
      }
      
      await metrics.save();
    } catch (error) {
      console.error('Error tracking report creation:', error);
    }
  }

  async trackUserLogin(hospitalId, userId) {
    try {
      const today = this.getTodayDate();
      const metrics = await this.getOrCreateDailyMetrics(hospitalId, today);
      
      metrics.users.totalLogins += 1;
      
      if (!metrics.users.uniqueUsers.includes(userId)) {
        metrics.users.uniqueUsers.push(userId);
        metrics.users.activeUsers = metrics.users.uniqueUsers.length;
      }
      
      await metrics.save();
    } catch (error) {
      console.error('Error tracking user login:', error);
    }
  }

  async trackAIRequest(hospitalId, success = true) {
    try {
      const today = this.getTodayDate();
      const metrics = await this.getOrCreateDailyMetrics(hospitalId, today);
      
      metrics.aiUsage.totalRequests += 1;
      if (success) {
        metrics.aiUsage.successfulRequests += 1;
      } else {
        metrics.aiUsage.failedRequests += 1;
      }
      
      await metrics.save();
    } catch (error) {
      console.error('Error tracking AI request:', error);
    }
  }

  async trackError(hospitalId) {
    try {
      const today = this.getTodayDate();
      const metrics = await this.getOrCreateDailyMetrics(hospitalId, today);
      
      metrics.performance.errorCount += 1;
      
      await metrics.save();
    } catch (error) {
      console.error('Error tracking error:', error);
    }
  }

  async getOrCreateDailyMetrics(hospitalId, date) {
    const cacheKey = `${hospitalId}-${date.toISOString().split('T')[0]}`;
    
    if (this.dailyCache.has(cacheKey)) {
      return this.dailyCache.get(cacheKey);
    }

    let metrics = await UsageMetrics.findOne({
      hospitalId,
      date: {
        $gte: date,
        $lt: new Date(date.getTime() + 24 * 60 * 60 * 1000)
      }
    });

    if (!metrics) {
      metrics = new UsageMetrics({
        hospitalId,
        date
      });
    }

    this.dailyCache.set(cacheKey, metrics);
    
    // Clear cache after 5 minutes
    setTimeout(() => {
      this.dailyCache.delete(cacheKey);
    }, 5 * 60 * 1000);

    return metrics;
  }

  getTodayDate() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  async getHospitalMetrics(hospitalId, startDate, endDate) {
    const query = { hospitalId };
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    return await UsageMetrics.find(query).sort({ date: -1 });
  }

  async getAllMetrics(startDate, endDate) {
    const query = {};
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    return await UsageMetrics.find(query).sort({ date: -1 });
  }
}

// Singleton instance
let metricsTrackingService = null;

function getMetricsTrackingService() {
  if (!metricsTrackingService) {
    metricsTrackingService = new MetricsTrackingService();
  }
  return metricsTrackingService;
}

module.exports = {
  MetricsTrackingService,
  getMetricsTrackingService
};
