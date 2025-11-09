const { getOrthancPreviewClient } = require('../services/orthanc-preview-client');
const { getMetricsCollector } = require('../services/metrics-collector');
const Instance = require('../models/Instance');

/**
 * OrthancInstanceController - Handles DICOM instance operations using Orthanc preview endpoints
 * Replaces Node.js DICOM decoding with Orthanc's native preview generation
 */
class OrthancInstanceController {
  constructor() {
    this.orthancClient = getOrthancPreviewClient();
    this.metricsCollector = getMetricsCollector();
  }

  /**
   * Get frame using Orthanc preview endpoint
   * Route: GET /api/dicom/studies/:studyUid/frames/:frameIndex
   */
  async getFrame(req, res) {
    const timer = this.metricsCollector.startTimer('frame_retrieval_orthanc');
    
    try {
      const { studyUid, seriesUid, frameIndex } = req.params;
      const gIndex = Math.max(0, parseInt(frameIndex, 10) || 0);

      // 1) Find instances - filter by series if seriesUid provided
      const query = { studyInstanceUID: studyUid };
      
      console.log('═══════════════════════════════════════════════════════');
      console.log('[SERIES IDENTIFIER - BACKEND] Frame request received');
      console.log('[SERIES IDENTIFIER - BACKEND] Study UID:', studyUid);
      console.log('[SERIES IDENTIFIER - BACKEND] Series UID:', seriesUid || 'NOT PROVIDED');
      console.log('[SERIES IDENTIFIER - BACKEND] Frame Index:', gIndex);
      
      if (seriesUid) {
        query.seriesInstanceUID = seriesUid;
        console.log('[SERIES IDENTIFIER - BACKEND] ✅ Filtering by series');
      } else {
        console.log('[SERIES IDENTIFIER - BACKEND] ⚠️ NO series filter - returning all study instances');
      }
      
      const instances = await Instance.find(query).lean();
      console.log('[SERIES IDENTIFIER - BACKEND] Found instances:', instances.length);
      console.log('═══════════════════════════════════════════════════════');
      
      if (!instances || instances.length === 0) {
        console.warn('❌ getFrame: no instances found for study', studyUid, seriesUid ? `series ${seriesUid}` : '');
        timer.end({ status: 'not_found' });
        return this.sendPlaceholderPng(res);
      }

      // 2) Map global frame index to instance and local frame
      const mapping = await this.mapGlobalIndexToInstance(instances, gIndex);
      if (!mapping) {
        console.warn('getFrame: mapping not found for globalIndex', gIndex, 'study', studyUid);
        timer.end({ status: 'not_found' });
        return this.sendPlaceholderPng(res);
      }

      const { orthancInstanceId, localFrameIndex, instance, useLegacyMethod } = mapping;

      console.log(`getFrame: study=${studyUid} globalIndex=${gIndex} -> orthancInstance=${orthancInstanceId} localFrame=${localFrameIndex} legacy=${useLegacyMethod}`);

      let pngBuffer;

      if (useLegacyMethod) {
        // Use legacy local file method for old instances
        console.log('Using legacy local file method for frame retrieval');
        const { getFrame: legacyGetFrame } = require('./instanceController');
        
        // Create a mock response object to capture the PNG
        let capturedBuffer = null;
        const mockRes = {
          setHeader: () => {},
          end: (buffer) => { capturedBuffer = buffer; },
          status: () => mockRes,
          json: () => mockRes
        };
        
        await legacyGetFrame(req, mockRes);
        pngBuffer = capturedBuffer || this.generatePlaceholderPng();
      } else {
        // 3) Generate preview using Orthanc for PACS instances
        pngBuffer = await this.orthancClient.generatePreview(orthancInstanceId, localFrameIndex, {
          quality: req.query.quality ? parseInt(req.query.quality) : undefined,
          returnUnsupportedImage: true
        });
      }

      // Record successful frame retrieval
      this.metricsCollector.recordInstanceProcessing('frame_retrieval', 'success');
      timer.end({ status: 'success' });

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      return res.end(pngBuffer);

    } catch (error) {
      console.error('getFrame error:', error);
      this.metricsCollector.recordInstanceProcessing('frame_retrieval', 'error');
      timer.end({ status: 'error' });

      // Send placeholder on error
      return this.sendPlaceholderPng(res);
    }
  }

  /**
   * Get instance metadata using Orthanc
   * Route: GET /api/dicom/instances/:instanceId/metadata
   */
  async getInstanceMetadata(req, res) {
    const timer = this.metricsCollector.startTimer('instance_metadata_retrieval');
    
    try {
      const { instanceId } = req.params;

      // Find instance in database to get Orthanc ID
      const instance = await Instance.findById(instanceId).lean();
      if (!instance || !instance.orthancInstanceId) {
        timer.end({ status: 'not_found' });
        return res.status(404).json({ 
          success: false, 
          message: 'Instance not found or not available in Orthanc' 
        });
      }

      // Get metadata from Orthanc
      const metadata = await this.orthancClient.getInstanceMetadata(instance.orthancInstanceId);
      
      // Check compression support
      const compressionInfo = await this.orthancClient.checkCompressionSupport(instance.orthancInstanceId);

      timer.end({ status: 'success' });

      res.json({
        success: true,
        data: {
          ...metadata,
          compressionInfo,
          orthancInstanceId: instance.orthancInstanceId
        }
      });

    } catch (error) {
      console.error('getInstanceMetadata error:', error);
      timer.end({ status: 'error' });
      
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Map global frame index to Orthanc instance and local frame
   * Enhanced to work with PACS-uploaded instances
   * @private
   */
  async mapGlobalIndexToInstance(instances, globalIndex) {
    // Sort instances by instanceNumber field if present in DB, fallback to _id
    instances.sort((a, b) => {
      const ai = (a.instanceNumber !== undefined && a.instanceNumber !== null) ? a.instanceNumber : 0;
      const bi = (b.instanceNumber !== undefined && b.instanceNumber !== null) ? b.instanceNumber : 0;
      return ai - bi || (a._id.toString() < b._id.toString() ? -1 : 1);
    });

    let acc = 0;
    for (const inst of instances) {
      // Check if instance has Orthanc ID (for PACS-uploaded instances)
      if (!inst.orthancInstanceId) {
        console.warn('mapGlobalIndexToInstance: instance missing orthancInstanceId', inst._id?.toString?.());
        
        // For legacy instances without Orthanc ID, try local file fallback
        if (inst.localFilePath) {
          // Use single frame for legacy instances
          if (globalIndex === acc) {
            return {
              orthancInstanceId: null,
              localFrameIndex: 0,
              instance: inst,
              useLegacyMethod: true
            };
          }
          acc += 1;
        }
        continue;
      }

      try {
        // Get metadata from Orthanc to determine frame count
        const metadata = await this.orthancClient.getInstanceMetadata(inst.orthancInstanceId);
        const frames = parseInt(metadata.NumberOfFrames) || 1;
        
        if (globalIndex < acc + frames) {
          return { 
            orthancInstanceId: inst.orthancInstanceId, 
            localFrameIndex: globalIndex - acc,
            instance: inst,
            useLegacyMethod: false
          };
        }
        acc += frames;
      } catch (e) {
        console.warn('mapGlobalIndexToInstance: metadata error for instance', inst._id?.toString?.(), e.message);
        continue; // skip bad instance
      }
    }
    return null;
  }

  /**
   * Generate placeholder PNG buffer
   * @private
   */
  generatePlaceholderPng() {
    const { PNG } = require('pngjs');
    
    const png = new PNG({ width: 256, height: 256 });
    for (let i = 0; i < png.data.length; i += 4) {
      png.data[i] = 200;     // R
      png.data[i + 1] = 200; // G
      png.data[i + 2] = 200; // B
      png.data[i + 3] = 255; // A
    }
    
    return PNG.sync.write(png);
  }

  /**
   * Send placeholder PNG response
   * @private
   */
  sendPlaceholderPng(res) {
    const pngBuffer = this.generatePlaceholderPng();
    res.setHeader('Content-Type', 'image/png');
    res.end(pngBuffer);
  }

  /**
   * Health check for Orthanc connectivity
   * Route: GET /api/dicom/orthanc/health
   */
  async checkOrthancHealth(req, res) {
    try {
      const isConnected = await this.orthancClient.testConnection();
      
      res.json({
        success: true,
        data: {
          orthancConnected: isConnected,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

// Export singleton instance
const orthancInstanceController = new OrthancInstanceController();

module.exports = {
  getFrame: orthancInstanceController.getFrame.bind(orthancInstanceController),
  getInstanceMetadata: orthancInstanceController.getInstanceMetadata.bind(orthancInstanceController),
  checkOrthancHealth: orthancInstanceController.checkOrthancHealth.bind(orthancInstanceController)
};