const express = require('express');
const router = express.Router();
const signatureController = require('../controllers/signatureController');
const { authenticate } = require('../middleware/authMiddleware');

/**
 * Signature Upload API Routes
 * All routes require authentication
 */

// Upload signature to filesystem
router.post('/upload', 
  authenticate,
  signatureController.uploadSignature
);

// Get signature file (requires authentication to prevent unauthorized access)
router.get('/file/:filename', 
  authenticate,
  signatureController.getSignature
);

// Delete signature
router.delete('/:filename', 
  authenticate,
  signatureController.deleteSignature
);

module.exports = router;
