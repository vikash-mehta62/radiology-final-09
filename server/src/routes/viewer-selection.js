/**
 * Viewer Selection Routes
 * Routes for selection synchronization in the medical image viewer
 */

const express = require('express')
const router = express.Router()
const viewerSelectionController = require('../controllers/viewerSelectionController')
const { authenticate } = require('../middleware/authMiddleware')
const { createRateLimiter } = require('../middleware/rateLimitMiddleware')

// Apply authentication middleware to all routes
// Comment out if you want to test without authentication
// router.use(authenticate)

// Apply rate limiting: 100 requests per minute per user/IP
const rateLimiter = createRateLimiter({
  windowMs: 60000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many selection sync requests. Please slow down.'
})

router.use(rateLimiter)

/**
 * @route   POST /api/viewer/selection
 * @desc    Sync selection state (select/deselect measurement or annotation)
 * @access  Private (requires authentication)
 * @body    {
 *            itemId: string,
 *            itemType: 'measurement' | 'annotation',
 *            action: 'select' | 'deselect',
 *            timestamp: number,
 *            studyInstanceUID: string,
 *            frameIndex: number
 *          }
 */
router.post('/selection', viewerSelectionController.syncSelection)

/**
 * @route   DELETE /api/viewer/items/:itemId
 * @desc    Sync item removal (measurement or annotation)
 * @access  Private (requires authentication)
 * @params  itemId - ID of the item to remove
 * @body    {
 *            itemType: 'measurement' | 'annotation',
 *            timestamp: number,
 *            studyInstanceUID: string
 *          }
 */
router.delete('/items/:itemId', viewerSelectionController.syncRemoval)

/**
 * @route   GET /api/viewer/data/:studyInstanceUID
 * @desc    Get all viewer data (annotations + measurements) for a study
 * @access  Private (requires authentication)
 * @params  studyInstanceUID - Study UID
 */
router.get('/data/:studyInstanceUID', viewerSelectionController.getViewerData)

/**
 * @route   DELETE /api/viewer/data/:studyInstanceUID
 * @desc    Clear viewer data for a study
 * @access  Private (requires authentication)
 * @params  studyInstanceUID - Study UID
 */
router.delete('/data/:studyInstanceUID', viewerSelectionController.clearViewerData)

module.exports = router
