const { getOrthancPreviewClient } = require('./orthanc-preview-client');
const { getMetricsCollector } = require('./metrics-collector');
const Instance = require('../models/Instance');

/**
 * DICOMMigrationService - Handles gradual migration from Node DICOM decoding to Orthanc preview
 * Provides feature flags and performance monitoring for the migration process
 */
class DICOMMigrationService {
  constructor(config = {}) {
    this.config = {
      enableOrthancPreview: config.enableOrthancPreview !== false, // Default to true
      migrationPercentage: config.migrationPercentage || 100, // Percentage of requests to use Orthanc
      performanceThreshold: config.performanceThreshold || 5000, // 5 seconds
      enablePerformanceComparison: config.enablePerformanceComparison || false,
      ...config
    };

    this.orthancClient = getOrthancPreviewClient();
    this.metricsCollector = getMetricsCollector();
  }

  /**
   * Determine if a request should use Orthanc preview based on feature flags
   * @param {Object} context - Request context (studyUid, instanceId, etc.)
   * @returns {boolean} Whether to use Orthanc preview
   */
  shouldUseOrthancPreview(context = {}) {
    // Check global feature flag
    if (!this.config.enableOrthancPreview) {
      return false;
    }

    // Check migration percentage (gradual rollout)
    const random = Math.random() * 100;
    if (random > this.config.migrationPercentage) {
      return false;
    }

    // Check instance-specific flag if available
    if (context.instance && context.instance.useOrthancPreview !== undefined) {
      return context.instance.useOrthancPreview;
    }

    return true;
  }

  /**
   * Get frame with automatic fallback between Orthanc and Node decoding
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} nodeFallback - Node.js DICOM decoding fallback function
   */
  async getFrameWithMigration(req, res, nodeFallback) {
    const { studyUid, seriesUid, frameIndex } = req.params;
    const context = { studyUid, seriesUid, frameIndex };

    console.log('═══════════════════════════════════════════════════════');
    console.log('[MIGRATION SERVICE] Frame request received');
    console.log('[MIGRATION SERVICE] Study UID:', studyUid);
    console.log('[MIGRATION SERVICE] Series UID:', seriesUid || 'NOT PROVIDED');
    console.log('[MIGRATION SERVICE] Frame Index:', frameIndex);
    console.log('═══════════════════════════════════════════════════════');

    // Determine which method to use
    const useOrthanc = this.shouldUseOrthancPreview(context);

    if (useOrthanc) {
      try {
        return await this.getFrameWithOrthanc(req, res, nodeFallback);
      } catch (error) {
        console.warn('Orthanc preview failed, falling back to Node decoding:', error.message);
        this.metricsCollector.recordInstanceProcessed('orthanc_fallback', 'fallback_to_node');
        return await nodeFallback(req, res);
      }
    } else {
      // Use Node.js decoding
      this.metricsCollector.recordInstanceProcessed('node_selected', 'migration_routing');
      return await nodeFallback(req, res);
    }
  }

  /**
   * Get frame using Orthanc preview with performance monitoring
   * @private
   */
  async getFrameWithOrthanc(req, res, nodeFallback) {
    const timer = this.metricsCollector.startTimer('orthanc_preview_migration');

    try {
      const { studyUid, seriesUid, frameIndex } = req.params;
      const gIndex = Math.max(0, parseInt(frameIndex, 10) || 0);

      // Find instances - filter by series if provided
      const query = { studyInstanceUID: studyUid };
      if (seriesUid) {
        query.seriesInstanceUID = seriesUid;
        console.log(`🎯 Migration Service: Filtering by series ${seriesUid}`);
      } else {
        console.log(`⚠️ Migration Service: NO series filter - will return all study instances`);
      }
      const instances = await Instance.find(query).lean();
      console.log(`📊 Migration Service: Found ${instances.length} instances`);
      if (!instances || instances.length === 0) {
        timer.end({ status: 'not_found' });
        throw new Error('No instances found for study');
      }

      // Map global index to Orthanc instance
      const mapping = await this.mapGlobalIndexToOrthancInstance(instances, gIndex);
      if (!mapping) {
        timer.end({ status: 'mapping_failed' });
        throw new Error('Could not map frame index to Orthanc instance');
      }

      const { orthancInstanceId, localFrameIndex, instance } = mapping;

      // Use the local frame index (mapped from global index)
      const actualFrameIndex = localFrameIndex;

      console.log(`📸 Fetching frame from Orthanc: instanceId=${orthancInstanceId}, frameIndex=${actualFrameIndex}`);

      // Generate preview using Orthanc
      const pngBuffer = await this.orthancClient.generatePreview(orthancInstanceId, actualFrameIndex, {
        quality: req.query.quality ? parseInt(req.query.quality) : undefined,
        returnUnsupportedImage: true
      });

      // Record successful migration
      this.metricsCollector.recordInstanceProcessed('success', 'orthanc_preview_migration');
      timer.end({ status: 'success' });

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('X-Preview-Method', 'orthanc'); // Debug header
      return res.end(pngBuffer);

    } catch (error) {
      timer.end({ status: 'error' });
      throw error; // Let caller handle fallback
    }
  }

  /**
   * Map global frame index to Orthanc instance
   * @private
   */
  async mapGlobalIndexToOrthancInstance(instances, globalIndex) {
    // Sort instances by instanceNumber
    instances.sort((a, b) => {
      const ai = (a.instanceNumber !== undefined && a.instanceNumber !== null) ? a.instanceNumber : 0;
      const bi = (b.instanceNumber !== undefined && b.instanceNumber !== null) ? b.instanceNumber : 0;
      return ai - bi || (a._id.toString() < b._id.toString() ? -1 : 1);
    });

    // For multi-frame DICOM, each instance record represents one frame
    // The globalIndex directly maps to the instance index
    if (globalIndex >= 0 && globalIndex < instances.length) {
      const inst = instances[globalIndex];

      // Skip instances without Orthanc ID
      if (!inst.orthancInstanceId) {
        // Try to resolve Orthanc ID from SOP Instance UID
        const orthancInstanceId = await this.resolveOrthancInstanceId(inst.sopInstanceUID);
        if (!orthancInstanceId) {
          console.warn('Instance not available in Orthanc:', inst._id?.toString?.());
          return null;
        }

        // Update instance with Orthanc ID for future use
        await Instance.updateOne(
          { _id: inst._id },
          { $set: { orthancInstanceId } }
        );
        inst.orthancInstanceId = orthancInstanceId;
      }

      return {
        orthancInstanceId: inst.orthancInstanceId,
        localFrameIndex: inst.orthancFrameIndex || 0,
        instance: inst
      };
    }

    return null;
  }

  /**
   * Resolve Orthanc instance ID from SOP Instance UID
   * @private
   */
  async resolveOrthancInstanceId(sopInstanceUID) {
    try {
      // Query Orthanc to find instance by SOP Instance UID
      const response = await this.orthancClient.axiosInstance.post('/tools/find', {
        Level: 'Instance',
        Query: {
          SOPInstanceUID: sopInstanceUID
        }
      });

      if (response.data && response.data.length > 0) {
        return response.data[0]; // Return first matching instance ID
      }
    } catch (error) {
      console.warn('Failed to resolve Orthanc instance ID:', error.message);
    }
    return null;
  }

  /**
   * Compare performance between Orthanc and Node decoding
   * @param {string} studyUid - Study instance UID
   * @param {number} frameIndex - Frame index
   * @returns {Promise<Object>} Performance comparison results
   */
  async comparePerformance(studyUid, frameIndex) {
    if (!this.config.enablePerformanceComparison) {
      return { enabled: false };
    }

    const results = {
      studyUid,
      frameIndex,
      timestamp: new Date().toISOString(),
      orthanc: null,
      node: null,
      winner: null
    };

    try {
      // Test Orthanc performance
      const orthancStart = Date.now();
      await this.testOrthancPreview(studyUid, frameIndex);
      results.orthanc = {
        duration: Date.now() - orthancStart,
        success: true
      };
    } catch (error) {
      results.orthanc = {
        duration: null,
        success: false,
        error: error.message
      };
    }

    try {
      // Test Node performance (would need to be implemented)
      const nodeStart = Date.now();
      await this.testNodeDecoding(studyUid, frameIndex);
      results.node = {
        duration: Date.now() - nodeStart,
        success: true
      };
    } catch (error) {
      results.node = {
        duration: null,
        success: false,
        error: error.message
      };
    }

    // Determine winner
    if (results.orthanc.success && results.node.success) {
      results.winner = results.orthanc.duration < results.node.duration ? 'orthanc' : 'node';
    } else if (results.orthanc.success) {
      results.winner = 'orthanc';
    } else if (results.node.success) {
      results.winner = 'node';
    }

    // Record performance metrics
    this.metricsCollector.recordInstanceProcessed(results.winner || 'both_failed', 'performance_comparison');

    return results;
  }

  /**
   * Test Orthanc preview performance
   * @private
   */
  async testOrthancPreview(studyUid, frameIndex) {
    const instances = await Instance.find({ studyInstanceUID: studyUid }).lean();
    if (!instances || instances.length === 0) {
      throw new Error('No instances found');
    }

    const mapping = await this.mapGlobalIndexToOrthancInstance(instances, frameIndex);
    if (!mapping) {
      throw new Error('Could not map to Orthanc instance');
    }

    await this.orthancClient.generatePreview(mapping.orthancInstanceId, mapping.localFrameIndex);
  }

  /**
   * Test Node decoding performance (placeholder)
   * @private
   */
  async testNodeDecoding(studyUid, frameIndex) {
    // This would call the original Node.js DICOM decoding logic
    // For now, just simulate the call
    throw new Error('Node decoding test not implemented');
  }

  /**
   * Get migration statistics
   * @returns {Object} Migration statistics
   */
  getMigrationStats() {
    return {
      config: {
        enableOrthancPreview: this.config.enableOrthancPreview,
        migrationPercentage: this.config.migrationPercentage,
        performanceThreshold: this.config.performanceThreshold
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Update migration configuration
   * @param {Object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('Migration configuration updated:', this.config);
  }
}

// Singleton instance
let migrationServiceInstance = null;

/**
 * Get singleton instance of DICOMMigrationService
 * @param {Object} config - Configuration options
 * @returns {DICOMMigrationService} Singleton instance
 */
function getDICOMMigrationService(config = {}) {
  if (!migrationServiceInstance) {
    migrationServiceInstance = new DICOMMigrationService(config);
  }
  return migrationServiceInstance;
}

module.exports = { DICOMMigrationService, getDICOMMigrationService };