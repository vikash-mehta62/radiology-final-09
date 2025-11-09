const express = require('express');
const router = express.Router();
const superAdminController = require('../controllers/superAdminController');
const rateLimit = require('express-rate-limit');

// Rate limiting for public endpoints
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many requests, please try again later'
});

// Public contact form submission
router.post('/contact-request', contactLimiter, superAdminController.createContactRequest);

module.exports = router;
