/**
 * User Profile and Settings Routes
 * Manage user profile, signature, and preferences
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const bcrypt = require('bcryptjs');

// Configure multer for signature uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/signatures');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const userId = req.user.userId || req.user._id || req.user.id;
    const uniqueName = `signature-${userId}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed for signatures'));
  }
});

// All routes require authentication
router.use(authenticate);


// Helper to normalize current user id
function getCurrentUserId(req) {
  return (
    req.user?.userId ||
    req.user?.id ||
    req.user?.sub ||
    req.user?._id
  );
}

router.get("/", async (req, res) => {
  try {
    const query = {};

    const isSuperAdmin = req.user?.roles?.includes("superadmin");

    if (!isSuperAdmin) {
      // Login user ko DB se fetch karo
      const hospitalUser = await User.findById(req.user._id).lean();

      if (!hospitalUser) {
        return res.status(404).json({ success: false, message: "Hospital user not found" });
      }

      // Admin hai to _id use karega, baaki hospitalId ya fallback _id
      const isAdminUser = req.user.roles?.includes("admin");

      const finalHospitalId = isAdminUser
        ? hospitalUser._id.toString()
        : (hospitalUser.hospitalId || hospitalUser._id.toString());

      query.hospitalId = finalHospitalId;

      console.log(`🏥 User Roles: ${req.user.roles}`);
      console.log(`🔒 Filtering patients by hospitalId: ${finalHospitalId}`);
    } else {
      console.log("👑 SuperAdmin detected, returning all patients");
    }

    // Patients fetch
    const patients = await Patient.find(query).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: patients.length,
      data: patients
    });

  } catch (error) {
    console.error("❌ Error fetching patients:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch patients",
      error: error.message
    });
  }
});

/**
 * POST /api/users
 * Create a new user; set createdBy to current user
 */
router.post('/', async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      firstName,
      lastName,
      roles,
      permissions,
      hospitalId,
      hospitalName
    } = req.body;

    if (!username || !email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'username, email, password, firstName, and lastName are required'
      });
    }

    // Check duplicates
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Username or email already exists'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const createdBy = getCurrentUserId(req);

    const user = await User.create({
      username,
      email,
      passwordHash,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      roles: Array.isArray(roles) && roles.length ? roles : ['user'],
      permissions: Array.isArray(permissions) && permissions.length ? permissions : ['studies:read'],
      hospitalId: hospitalId || req.user?.hospitalId,
      hospitalName,
      createdBy,
      isActive: true,
      isVerified: true
    });

    res.status(201).json({
      success: true,
      data: user.toPublicJSON()
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: error.message
    });
  }
});


/**
 * DELETE /api/users/signature
 * Delete signature image
 */
router.delete('/signature', async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id || req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Delete signature file if exists
    if (user.signatureImagePath) {
      try {
        await fs.unlink(user.signatureImagePath);
      } catch (err) {
        console.warn('Failed to delete signature file:', err.message);
      }
    }

    // Clear signature fields
    user.signatureImagePath = undefined;
    user.signatureImageUrl = undefined;
    
    await user.save();

    res.json({
      success: true,
      message: 'Signature deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting signature:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/users/signature/image/:filename
 * Serve signature image
 */
router.get('/signature/image/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '../../uploads/signatures', filename);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (err) {
      return res.status(404).json({
        success: false,
        error: 'Signature image not found'
      });
    }

    res.sendFile(filePath);

  } catch (error) {
    console.error('❌ Error serving signature:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
