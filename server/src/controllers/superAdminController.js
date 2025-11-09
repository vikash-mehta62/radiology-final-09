const Hospital = require('../models/Hospital');
const User = require('../models/User');
const Study = require('../models/Study');
const ContactRequest = require('../models/ContactRequest');
const UsageMetrics = require('../models/UsageMetrics');
const { v4: uuidv4 } = require('uuid');

// Dashboard Overview
exports.getDashboardStats = async (req, res) => {
  try {
    const [
      totalHospitals,
      activeHospitals,
      totalUsers,
      totalStudies,
      pendingRequests,
      recentActivity
    ] = await Promise.all([
      Hospital.countDocuments(),
      Hospital.countDocuments({ status: 'active' }),
      User.countDocuments({ isActive: true }),
      Study.countDocuments(),
      ContactRequest.countDocuments({ status: { $in: ['new', 'in_progress'] } }),
      getRecentActivity()
    ]);

    // Get storage stats
    const hospitals = await Hospital.find({}, 'subscription.currentStorage subscription.maxStorage');
    const totalStorage = hospitals.reduce((sum, h) => sum + (h.subscription.currentStorage || 0), 0);
    const maxStorage = hospitals.reduce((sum, h) => sum + (h.subscription.maxStorage || 0), 0);

    // Get today's metrics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMetrics = await UsageMetrics.aggregate([
      { $match: { date: { $gte: today } } },
      {
        $group: {
          _id: null,
          totalUploads: { $sum: '$studies.uploaded' },
          totalViews: { $sum: '$studies.viewed' },
          activeUsers: { $sum: '$users.activeUsers' }
        }
      }
    ]);

    res.json({
      overview: {
        totalHospitals,
        activeHospitals,
        totalUsers,
        totalStudies,
        pendingRequests,
        storage: {
          used: totalStorage,
          total: maxStorage,
          percentage: maxStorage > 0 ? (totalStorage / maxStorage * 100).toFixed(2) : 0
        }
      },
      today: todayMetrics[0] || { totalUploads: 0, totalViews: 0, activeUsers: 0 },
      recentActivity
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
};

// Hospital Analytics
exports.getHospitalAnalytics = async (req, res) => {
  try {
    const { hospitalId, startDate, endDate } = req.query;
    
    const query = {};
    if (hospitalId) query.hospitalId = hospitalId;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const metrics = await UsageMetrics.find(query).sort({ date: -1 }).limit(90);
    
    // Aggregate data
    const aggregated = {
      totalStudies: metrics.reduce((sum, m) => sum + m.studies.uploaded, 0),
      totalViews: metrics.reduce((sum, m) => sum + m.studies.viewed, 0),
      totalReports: metrics.reduce((sum, m) => sum + m.studies.reported, 0),
      avgActiveUsers: metrics.length > 0 
        ? (metrics.reduce((sum, m) => sum + m.users.activeUsers, 0) / metrics.length).toFixed(1)
        : 0,
      modalityBreakdown: aggregateModalities(metrics),
      dailyTrend: metrics.reverse().map(m => ({
        date: m.date,
        uploads: m.studies.uploaded,
        views: m.studies.viewed,
        activeUsers: m.users.activeUsers
      }))
    };

    res.json(aggregated);
  } catch (error) {
    console.error('Error fetching hospital analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

// Hospital List with Stats
exports.getHospitalsList = async (req, res) => {
  try {
    const hospitals = await Hospital.find({})
      .select('-apiKey')
      .sort({ createdAt: -1 });

    // Get user counts for each hospital
    const hospitalStats = await Promise.all(
      hospitals.map(async (hospital) => {
        const userCount = await User.countDocuments({ 
          hospitalId: hospital.hospitalId 
        });
        
        // Get last 30 days metrics
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentMetrics = await UsageMetrics.aggregate([
          {
            $match: {
              hospitalId: hospital.hospitalId,
              date: { $gte: thirtyDaysAgo }
            }
          },
          {
            $group: {
              _id: null,
              totalUploads: { $sum: '$studies.uploaded' },
              totalViews: { $sum: '$studies.viewed' },
              avgActiveUsers: { $avg: '$users.activeUsers' }
            }
          }
        ]);

        return {
          ...hospital.toObject(),
          userCount,
          last30Days: recentMetrics[0] || { 
            totalUploads: 0, 
            totalViews: 0, 
            avgActiveUsers: 0 
          }
        };
      })
    );

    res.json(hospitalStats);
  } catch (error) {
    console.error('Error fetching hospitals list:', error);
    res.status(500).json({ error: 'Failed to fetch hospitals' });
  }
};

// Contact Requests Management
exports.getContactRequests = async (req, res) => {
  try {
    const { status, priority, type } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (type) query.type = type;

    const requests = await ContactRequest.find(query)
      .populate('assignedTo', 'firstName lastName email')
      .sort({ priority: -1, createdAt: -1 })
      .limit(100);

    res.json(requests);
  } catch (error) {
    console.error('Error fetching contact requests:', error);
    res.status(500).json({ error: 'Failed to fetch contact requests' });
  }
};

exports.createContactRequest = async (req, res) => {
  try {
    const requestData = {
      requestId: `REQ-${uuidv4().substring(0, 8).toUpperCase()}`,
      ...req.body,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      referrer: req.get('referer')
    };

    const request = new ContactRequest(requestData);
    await request.save();

    // TODO: Send notification to admin
    
    res.status(201).json({
      success: true,
      message: 'Request submitted successfully',
      requestId: request.requestId
    });
  } catch (error) {
    console.error('Error creating contact request:', error);
    res.status(500).json({ error: 'Failed to submit request' });
  }
};

exports.updateContactRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const request = await ContactRequest.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    ).populate('assignedTo', 'firstName lastName email');

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json(request);
  } catch (error) {
    console.error('Error updating contact request:', error);
    res.status(500).json({ error: 'Failed to update request' });
  }
};

exports.addRequestNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const request = await ContactRequest.findByIdAndUpdate(
      id,
      {
        $push: {
          notes: {
            addedBy: req.user.id,
            note,
            createdAt: new Date()
          }
        }
      },
      { new: true }
    ).populate('assignedTo', 'firstName lastName email')
     .populate('notes.addedBy', 'firstName lastName');

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json(request);
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({ error: 'Failed to add note' });
  }
};

// System-wide Analytics
exports.getSystemAnalytics = async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const metrics = await UsageMetrics.aggregate([
      { $match: { date: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          totalUploads: { $sum: '$studies.uploaded' },
          totalViews: { $sum: '$studies.viewed' },
          totalReports: { $sum: '$studies.reported' },
          activeUsers: { $sum: '$users.activeUsers' },
          totalLogins: { $sum: '$users.totalLogins' },
          storageAdded: { $sum: '$storage.addedBytes' },
          errorCount: { $sum: '$performance.errorCount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get modality distribution
    const modalityStats = await UsageMetrics.aggregate([
      { $match: { date: { $gte: startDate } } },
      {
        $group: {
          _id: null,
          CT: { $sum: '$modalityBreakdown.CT' },
          MR: { $sum: '$modalityBreakdown.MR' },
          XR: { $sum: '$modalityBreakdown.XR' },
          US: { $sum: '$modalityBreakdown.US' },
          CR: { $sum: '$modalityBreakdown.CR' },
          DX: { $sum: '$modalityBreakdown.DX' },
          MG: { $sum: '$modalityBreakdown.MG' },
          PT: { $sum: '$modalityBreakdown.PT' },
          NM: { $sum: '$modalityBreakdown.NM' },
          OTHER: { $sum: '$modalityBreakdown.OTHER' }
        }
      }
    ]);

    res.json({
      dailyMetrics: metrics,
      modalityDistribution: modalityStats[0] || {},
      period: days
    });
  } catch (error) {
    console.error('Error fetching system analytics:', error);
    res.status(500).json({ error: 'Failed to fetch system analytics' });
  }
};

// Helper Functions
async function getRecentActivity() {
  try {
    const activities = [];
    
    // Recent hospitals
    const recentHospitals = await Hospital.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name createdAt');
    
    recentHospitals.forEach(h => {
      activities.push({
        type: 'hospital_created',
        description: `New hospital registered: ${h.name}`,
        timestamp: h.createdAt
      });
    });

    // Recent contact requests
    const recentRequests = await ContactRequest.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('type contactInfo.organization createdAt');
    
    recentRequests.forEach(r => {
      activities.push({
        type: 'contact_request',
        description: `New ${r.type} request from ${r.contactInfo.organization || 'Unknown'}`,
        timestamp: r.createdAt
      });
    });

    // Sort by timestamp
    activities.sort((a, b) => b.timestamp - a.timestamp);
    
    return activities.slice(0, 10);
  } catch (error) {
    console.error('Error getting recent activity:', error);
    return [];
  }
}

function aggregateModalities(metrics) {
  const totals = {
    CT: 0, MR: 0, XR: 0, US: 0, CR: 0,
    DX: 0, MG: 0, PT: 0, NM: 0, OTHER: 0
  };
  
  metrics.forEach(m => {
    Object.keys(totals).forEach(modality => {
      totals[modality] += m.modalityBreakdown[modality] || 0;
    });
  });
  
  return totals;
}

module.exports = exports;
