/**
 * Viewer Selection Controller
 * Handles selection synchronization for the medical image viewer
 */

// In-memory storage for viewer annotations/measurements (per study)
// This will be cleared when server restarts or after 24 hours
const viewerDataStore = new Map();

// Cleanup old data every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of viewerDataStore.entries()) {
    if (now - data.timestamp > 24 * 60 * 60 * 1000) { // 24 hours
      viewerDataStore.delete(key);
    }
  }
}, 60 * 60 * 1000);

/**
 * Sync selection state
 * POST /api/viewer/selection
 */
exports.syncSelection = async (req, res) => {
  try {
    const { itemId, itemType, action, timestamp, studyInstanceUID, frameIndex, itemData } = req.body

    // Validate request body
    if (!itemId || !itemType || !action) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: itemId, itemType, action'
      })
    }

    // Validate itemType
    if (!['measurement', 'annotation'].includes(itemType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid itemType. Must be "measurement" or "annotation"'
      })
    }

    // Validate action
    if (!['select', 'deselect'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Must be "select" or "deselect"'
      })
    }

    // ✅ NEW: Store annotation/measurement data for report generation
    if (studyInstanceUID && itemData && action === 'select') {
      const storeKey = `${studyInstanceUID}_${req.user?.userId || 'anonymous'}`;
      
      if (!viewerDataStore.has(storeKey)) {
        viewerDataStore.set(storeKey, {
          studyInstanceUID,
          userId: req.user?.userId,
          measurements: [],
          annotations: [],
          timestamp: Date.now()
        });
      }
      
      const store = viewerDataStore.get(storeKey);
      
      if (itemType === 'measurement') {
        // Remove existing if updating
        store.measurements = store.measurements.filter(m => m.id !== itemId);
        store.measurements.push({
          id: itemId,
          type: itemData.type || 'length',
          value: itemData.value,
          unit: itemData.unit || 'mm',
          label: itemData.label || itemData.type,
          points: itemData.points || [],
          frameIndex: frameIndex || 0,
          timestamp: new Date()
        });
      } else if (itemType === 'annotation') {
        // Remove existing if updating
        store.annotations = store.annotations.filter(a => a.id !== itemId);
        store.annotations.push({
          id: itemId,
          type: itemData.type || 'text',
          text: itemData.text || '',
          color: itemData.color || '#FF0000',
          points: itemData.points || [],
          frameIndex: frameIndex || 0,
          timestamp: new Date()
        });
      }
      
      store.timestamp = Date.now();
      console.log(`✅ Stored ${itemType} for study ${studyInstanceUID}:`, itemId);
    }

    // Log the selection event
    console.log('Selection sync:', {
      itemId,
      itemType,
      action,
      timestamp,
      studyInstanceUID,
      frameIndex,
      user: req.user?.username || 'anonymous'
    })

    res.json({
      success: true,
      itemId,
      timestamp: Date.now()
    })
  } catch (error) {
    console.error('Error syncing selection:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to sync selection'
    })
  }
}

/**
 * Sync item removal
 * DELETE /api/viewer/items/:itemId
 */
exports.syncRemoval = async (req, res) => {
  try {
    const { itemId } = req.params
    const { itemType, timestamp, studyInstanceUID } = req.body

    // Validate request
    if (!itemId || !itemType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: itemId, itemType'
      })
    }

    // Validate itemType
    if (!['measurement', 'annotation'].includes(itemType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid itemType. Must be "measurement" or "annotation"'
      })
    }

    // ✅ NEW: Remove from store
    if (studyInstanceUID) {
      const storeKey = `${studyInstanceUID}_${req.user?.userId || 'anonymous'}`;
      const store = viewerDataStore.get(storeKey);
      
      if (store) {
        if (itemType === 'measurement') {
          store.measurements = store.measurements.filter(m => m.id !== itemId);
        } else if (itemType === 'annotation') {
          store.annotations = store.annotations.filter(a => a.id !== itemId);
        }
        console.log(`✅ Removed ${itemType} ${itemId} from study ${studyInstanceUID}`);
      }
    }

    // Log the removal event
    console.log('Item removal sync:', {
      itemId,
      itemType,
      timestamp,
      studyInstanceUID,
      user: req.user?.username || 'anonymous'
    })

    res.json({
      success: true,
      itemId,
      timestamp: Date.now()
    })
  } catch (error) {
    console.error('Error syncing removal:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to sync removal'
    })
  }
}

/**
 * Get viewer data for a study (annotations + measurements)
 * GET /api/viewer/data/:studyInstanceUID
 */
exports.getViewerData = async (req, res) => {
  try {
    const { studyInstanceUID } = req.params;
    const storeKey = `${studyInstanceUID}_${req.user?.userId || 'anonymous'}`;
    
    const store = viewerDataStore.get(storeKey);
    
    if (!store) {
      return res.json({
        success: true,
        studyInstanceUID,
        measurements: [],
        annotations: [],
        message: 'No viewer data found for this study'
      });
    }
    
    console.log(`✅ Retrieved viewer data for study ${studyInstanceUID}:`, {
      measurements: store.measurements.length,
      annotations: store.annotations.length
    });
    
    res.json({
      success: true,
      studyInstanceUID,
      measurements: store.measurements,
      annotations: store.annotations,
      timestamp: store.timestamp
    });
  } catch (error) {
    console.error('Error getting viewer data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get viewer data'
    });
  }
}

/**
 * Clear viewer data for a study
 * DELETE /api/viewer/data/:studyInstanceUID
 */
exports.clearViewerData = async (req, res) => {
  try {
    const { studyInstanceUID } = req.params;
    const storeKey = `${studyInstanceUID}_${req.user?.userId || 'anonymous'}`;
    
    viewerDataStore.delete(storeKey);
    
    console.log(`✅ Cleared viewer data for study ${studyInstanceUID}`);
    
    res.json({
      success: true,
      message: 'Viewer data cleared'
    });
  } catch (error) {
    console.error('Error clearing viewer data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear viewer data'
    });
  }
}
