const express = require('express');
const router = express.Router();
const Study = require('../models/Study');
const Series = require('../models/Series');
const Instance = require('../models/Instance');

/**
 * System Monitoring Routes
 * Dashboard for monitoring multiple machines and system health
 */

/**
 * GET /api/monitoring/machines
 * Get statistics for all connected machines (modalities)
 */
router.get('/machines', async (req, res) => {
  try {
    const { timeRange = '24h' } = req.query;
    
    // Calculate time range
    const now = new Date();
    const startTime = new Date();
    switch (timeRange) {
      case '1h': startTime.setHours(now.getHours() - 1); break;
      case '24h': startTime.setHours(now.getHours() - 24); break;
      case '7d': startTime.setDate(now.getDate() - 7); break;
      case '30d': startTime.setDate(now.getDate() - 30); break;
      default: startTime.setHours(now.getHours() - 24);
    }

    // Get studies grouped by modality
    const machineStats = await Study.aggregate([
      {
        $match: {
          createdAt: { $gte: startTime }
        }
      },
      {
        $group: {
          _id: '$modality',
          totalStudies: { $sum: 1 },
          totalSeries: { $sum: '$numberOfSeries' },
          totalInstances: { $sum: '$numberOfInstances' },
          lastActivity: { $max: '$createdAt' },
          patients: { $addToSet: '$patientID' }
        }
      },
      {
        $project: {
          modality: '$_id',
          totalStudies: 1,
          totalSeries: 1,
          totalInstances: 1,
          lastActivity: 1,
          uniquePatients: { $size: '$patients' },
          status: {
            $cond: {
              if: { $gte: ['$lastActivity', new Date(Date.now() - 3600000)] },
              then: 'active',
              else: 'idle'
            }
          }
        }
      },
      {
        $sort: { totalStudies: -1 }
      }
    ]);

    // Get machine names mapping
    const machineNames = {
      'CT': 'CT Scanner',
      'MR': 'MRI Machine',
      'CR': 'X-Ray (CR)',
      'DX': 'X-Ray (Digital)',
      'US': 'Ultrasound',
      'XA': 'Angiography',
      'MG': 'Mammography',
      'NM': 'Nuclear Medicine',
      'PT': 'PET Scanner',
      'RF': 'Fluoroscopy',
      'OT': 'Other'
    };

    const enrichedStats = machineStats.map(stat => ({
      ...stat,
      machineName: machineNames[stat.modality] || stat.modality,
      avgStudiesPerHour: (stat.totalStudies / ((now - startTime) / 3600000)).toFixed(2)
    }));

    res.json({
      success: true,
      data: {
        machines: enrichedStats,
        timeRange,
        totalMachines: enrichedStats.length,
        activeMachines: enrichedStats.filter(m => m.status === 'active').length
      }
    });
  } catch (error) {
    console.error('Error fetching machine statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch machine statistics',
      error: error.message
    });
  }
});

/**
 * GET /api/monitoring/system-health
 * Get overall system health metrics
 */
router.get('/system-health', async (req, res) => {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get counts
    const [totalStudies, totalSeries, totalInstances, recentStudies] = await Promise.all([
      Study.countDocuments(),
      Series.countDocuments(),
      Instance.countDocuments(),
      Study.countDocuments({ createdAt: { $gte: last24h } })
    ]);

    // Get storage info (approximate)
    const storageStats = await Instance.aggregate([
      {
        $group: {
          _id: null,
          totalSize: { $sum: '$fileSize' }
        }
      }
    ]);

    const totalStorageBytes = storageStats[0]?.totalSize || 0;
    const totalStorageGB = (totalStorageBytes / (1024 * 1024 * 1024)).toFixed(2);

    // Get recent activity
    const recentActivity = await Study.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('studyInstanceUID patientName modality createdAt')
      .lean();

    // Calculate system status
    const avgStudiesPerHour = recentStudies / 24;
    let systemStatus = 'healthy';
    if (avgStudiesPerHour < 1) systemStatus = 'low-activity';
    if (avgStudiesPerHour > 50) systemStatus = 'high-load';

    res.json({
      success: true,
      data: {
        systemStatus,
        metrics: {
          totalStudies,
          totalSeries,
          totalInstances,
          recentStudies24h: recentStudies,
          avgStudiesPerHour: avgStudiesPerHour.toFixed(2),
          totalStorageGB
        },
        recentActivity,
        timestamp: now
      }
    });
  } catch (error) {
    console.error('Error fetching system health:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system health',
      error: error.message
    });
  }
});

/**
 * GET /api/monitoring/activity-timeline
 * Get activity timeline for visualization
 */
router.get('/activity-timeline', async (req, res) => {
  try {
    const { timeRange = '24h', interval = '1h' } = req.query;

    const now = new Date();
    const startTime = new Date();
    let intervalMs = 3600000; // 1 hour

    switch (timeRange) {
      case '1h':
        startTime.setHours(now.getHours() - 1);
        intervalMs = 300000; // 5 minutes
        break;
      case '24h':
        startTime.setHours(now.getHours() - 24);
        intervalMs = 3600000; // 1 hour
        break;
      case '7d':
        startTime.setDate(now.getDate() - 7);
        intervalMs = 86400000; // 1 day
        break;
      case '30d':
        startTime.setDate(now.getDate() - 30);
        intervalMs = 86400000; // 1 day
        break;
    }

    const timeline = await Study.aggregate([
      {
        $match: {
          createdAt: { $gte: startTime }
        }
      },
      {
        $group: {
          _id: {
            interval: {
              $subtract: [
                { $toLong: '$createdAt' },
                { $mod: [{ $toLong: '$createdAt' }, intervalMs] }
              ]
            },
            modality: '$modality'
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.interval': 1 }
      }
    ]);

    // Format timeline data
    const formattedTimeline = timeline.map(item => ({
      timestamp: new Date(item._id.interval),
      modality: item._id.modality,
      count: item.count
    }));

    res.json({
      success: true,
      data: {
        timeline: formattedTimeline,
        timeRange,
        interval: intervalMs
      }
    });
  } catch (error) {
    console.error('Error fetching activity timeline:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity timeline',
      error: error.message
    });
  }
});

/**
 * GET /api/monitoring/alerts
 * Get system alerts and warnings
 */
router.get('/alerts', async (req, res) => {
  try {
    const alerts = [];
    const now = new Date();

    // Check for inactive machines (no activity in last 2 hours)
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const activeMachines = await Study.distinct('modality', {
      createdAt: { $gte: twoHoursAgo }
    });

    const allMachines = await Study.distinct('modality');
    const inactiveMachines = allMachines.filter(m => !activeMachines.includes(m));

    inactiveMachines.forEach(modality => {
      alerts.push({
        type: 'warning',
        severity: 'medium',
        message: `${modality} machine has been inactive for 2+ hours`,
        timestamp: now,
        category: 'machine-inactive'
      });
    });

    // Check for high load (more than 100 studies in last hour)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recentStudies = await Study.countDocuments({
      createdAt: { $gte: oneHourAgo }
    });

    if (recentStudies > 100) {
      alerts.push({
        type: 'info',
        severity: 'low',
        message: `High system load: ${recentStudies} studies in last hour`,
        timestamp: now,
        category: 'high-load'
      });
    }

    res.json({
      success: true,
      data: {
        alerts,
        totalAlerts: alerts.length,
        criticalAlerts: alerts.filter(a => a.severity === 'high').length
      }
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch alerts',
      error: error.message
    });
  }
});

module.exports = router;
