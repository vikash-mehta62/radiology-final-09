const Hospital = require('../models/Hospital');
const User = require('../models/User');

/**
 * Tenant isolation middleware
 * Ensures users can only access data from their hospital(s)
 */
async function tenantMiddleware(req, res, next) {
  try {
    // Skip if no user (public routes)
    if (!req.user || !req.user.id) {
      return next();
    }

    // Get user with hospital info
    const user = await User.findById(req.user.id).select('hospitalId accessibleHospitals roles');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Get hospital info
    const hospital = await Hospital.findOne({ hospitalId: user.hospitalId });
    
    if (!hospital) {
      return res.status(403).json({ 
        success: false, 
        message: 'Hospital not found' 
      });
    }

    // Check hospital status
    if (hospital.status !== 'active' && hospital.status !== 'trial') {
      return res.status(403).json({ 
        success: false, 
        message: `Hospital account is ${hospital.status}. Please contact support.` 
      });
    }

    // Check subscription
    if (!hospital.isSubscriptionActive()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Hospital subscription has expired. Please renew.' 
      });
    }

    // Attach tenant info to request
    req.tenant = {
      hospitalId: user.hospitalId,
      hospitalName: hospital.name,
      accessibleHospitals: user.accessibleHospitals || [user.hospitalId],
      subscription: hospital.subscription,
      settings: hospital.settings,
      isAdmin: user.roles.includes('admin') || user.roles.includes('system:admin')
    };

    console.log(`[Tenant] User ${user.username} accessing as ${hospital.name}`);
    
    next();
  } catch (error) {
    console.error('Tenant middleware error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Tenant validation failed',
      error: error.message 
    });
  }
}

/**
 * Filter MongoDB query by tenant
 * Ensures data isolation between hospitals
 */
function filterByTenant(query, req) {
  if (!req.tenant) {
    return query;
  }

  // If user has access to multiple hospitals (e.g., radiologist covering multiple sites)
  if (req.tenant.accessibleHospitals && req.tenant.accessibleHospitals.length > 1) {
    query.hospitalId = { $in: req.tenant.accessibleHospitals };
  } else {
    // Single hospital access
    query.hospitalId = req.tenant.hospitalId;
  }

  return query;
}

/**
 * Check if user can access specific hospital's data
 */
function canAccessHospital(req, hospitalId) {
  if (!req.tenant) {
    return false;
  }

  // System admins can access all
  if (req.tenant.isAdmin) {
    return true;
  }

  // Check if hospital is in accessible list
  return req.tenant.accessibleHospitals.includes(hospitalId);
}

/**
 * Require specific hospital access
 */
function requireHospitalAccess(hospitalId) {
  return (req, res, next) => {
    if (!canAccessHospital(req, hospitalId)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this hospital\'s data'
      });
    }
    next();
  };
}

/**
 * Check storage quota
 */
async function checkStorageQuota(req, res, next) {
  try {
    if (!req.tenant) {
      return next();
    }

    const hospital = await Hospital.findOne({ hospitalId: req.tenant.hospitalId });
    
    if (!hospital.hasStorageAvailable()) {
      return res.status(403).json({
        success: false,
        message: 'Storage quota exceeded. Please upgrade your plan or contact support.',
        quota: {
          used: hospital.subscription.currentStorage,
          max: hospital.subscription.maxStorage,
          unit: 'GB'
        }
      });
    }

    next();
  } catch (error) {
    console.error('Storage quota check error:', error);
    next(); // Don't block on error
  }
}

module.exports = {
  tenantMiddleware,
  filterByTenant,
  canAccessHospital,
  requireHospitalAccess,
  checkStorageQuota
};
