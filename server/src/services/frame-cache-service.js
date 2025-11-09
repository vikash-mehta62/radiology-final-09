const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { PNG } = require('pngjs');
const dicomParser = require('dicom-parser');

/**
 * Frame Cache Service
 * Manages filesystem caching of DICOM frames for fast access
 * Eliminates need for Cloudinary or other external storage
 */
class FrameCacheService {
  constructor(config = {}) {
    this.cacheDir = config.cacheDir || path.resolve(__dirname, '../../backend');
    this.orthancUrl = config.orthancUrl || process.env.ORTHANC_URL || 'http://69.62.70.102:8042';
    this.orthancAuth = {
      username: process.env.ORTHANC_USERNAME || 'orthanc',
      password: process.env.ORTHANC_PASSWORD || 'orthanc'
    };
    
    // Ensure cache directory exists
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Get frame from cache or generate it
   */
  async getFrame(studyUID, frameIndex) {
    // 1. Try cache first
    const cachedFrame = this.getFromCache(studyUID, frameIndex);
    if (cachedFrame) {
      return cachedFrame;
    }

    // 2. Try to generate from Orthanc (may fail for legacy studies)
    try {
      const frameBuffer = await this.generateFrame(studyUID, frameIndex);
      
      // 3. Cache for next time
      this.saveToCache(studyUID, frameIndex, frameBuffer);
      
      return frameBuffer;
    } catch (error) {
      console.warn(`⚠️  Could not generate frame from Orthanc: ${error.message}`);
      console.warn(`   This may be a legacy study without MongoDB instance records.`);
      
      // Return null to let caller handle fallback
      return null;
    }
  }

  /**
   * Get frame from filesystem cache
   */
  getFromCache(studyUID, frameIndex) {
    const framePath = this.getFramePath(studyUID, frameIndex);
    
    if (fs.existsSync(framePath)) {
      console.log(`✅ Cache HIT: ${framePath}`);
      return fs.readFileSync(framePath);
    }
    
    console.log(`❌ Cache MISS: ${framePath}`);
    return null;
  }

  /**
   * Generate frame from Orthanc
   */
  async generateFrame(studyUID, frameIndex) {
    // Get instance from MongoDB
    const Instance = require('../models/Instance');
    const instances = await Instance.find({ studyInstanceUID: studyUID })
      .sort({ instanceNumber: 1 })
      .lean();

    if (!instances || instances.length === 0) {
      throw new Error(`No instances found for study ${studyUID}`);
    }

    // Map global frame index to instance
    let currentFrame = 0;
    let targetInstance = null;
    let localFrameIndex = 0;

    for (const inst of instances) {
      const framesInInstance = inst.numberOfFrames || 1;
      
      if (frameIndex < currentFrame + framesInInstance) {
        targetInstance = inst;
        localFrameIndex = frameIndex - currentFrame;
        break;
      }
      
      currentFrame += framesInInstance;
    }

    if (!targetInstance || !targetInstance.orthancInstanceId) {
      throw new Error(`Could not map frame ${frameIndex} to Orthanc instance`);
    }

    // Fetch full-resolution frame from Orthanc with proper windowing
    // The /rendered endpoint applies DICOM windowing and returns PNG at full resolution
    const orthancFrameUrl = `${this.orthancUrl}/instances/${targetInstance.orthancInstanceId}/frames/${localFrameIndex}/rendered`;
    
    console.log(`📥 Fetching full-resolution frame from Orthanc: ${orthancFrameUrl}`);
    
    const response = await axios.get(orthancFrameUrl, {
      auth: this.orthancAuth,
      responseType: 'arraybuffer',
      timeout: 10000,
      params: {
        // Request full quality rendering
        quality: 100
      }
    });

    return Buffer.from(response.data);
  }

  /**
   * Save frame to filesystem cache
   */
  saveToCache(studyUID, frameIndex, frameBuffer) {
    try {
      const framePath = this.getFramePath(studyUID, frameIndex);
      const frameDir = path.dirname(framePath);
      
      // Ensure directory exists
      if (!fs.existsSync(frameDir)) {
        fs.mkdirSync(frameDir, { recursive: true });
      }
      
      // Write frame
      fs.writeFileSync(framePath, frameBuffer);
      console.log(`💾 Cached frame: ${framePath}`);
      
      // Update MongoDB cache status
      this.updateCacheStatus(studyUID, frameIndex, framePath);
      
    } catch (error) {
      console.error(`Failed to cache frame ${frameIndex}:`, error.message);
    }
  }

  /**
   * Update MongoDB with cache status
   */
  async updateCacheStatus(studyUID, frameIndex, framePath) {
    try {
      const Instance = require('../models/Instance');
      await Instance.updateOne(
        { studyInstanceUID: studyUID, instanceNumber: frameIndex },
        { 
          $set: { 
            filesystemPath: framePath,
            filesystemCached: true,
            cachedAt: new Date()
          }
        }
      );
    } catch (error) {
      // Non-critical error, just log it
      console.warn(`Could not update cache status: ${error.message}`);
    }
  }

  /**
   * Get frame path in filesystem
   */
  getFramePath(studyUID, frameIndex) {
    const frameDir = path.join(this.cacheDir, `uploaded_frames_${studyUID}`);
    const frameName = `frame_${String(frameIndex).padStart(3, '0')}.png`;
    return path.join(frameDir, frameName);
  }

  /**
   * Generate placeholder image
   */
  generatePlaceholder(width = 512, height = 512) {
    const png = new PNG({ width, height });
    
    // Create checkerboard pattern
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (width * y + x) << 2;
        const checker = ((x >> 4) ^ (y >> 4)) & 1;
        const value = checker ? 64 : 32;
        
        png.data[idx] = value;
        png.data[idx + 1] = value;
        png.data[idx + 2] = value;
        png.data[idx + 3] = 255;
      }
    }
    
    return PNG.sync.write(png);
  }

  /**
   * Clear cache for a study
   */
  clearStudyCache(studyUID) {
    const frameDir = path.join(this.cacheDir, `uploaded_frames_${studyUID}`);
    
    if (fs.existsSync(frameDir)) {
      fs.rmSync(frameDir, { recursive: true, force: true });
      console.log(`🗑️  Cleared cache for study: ${studyUID}`);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(studyUID) {
    const frameDir = path.join(this.cacheDir, `uploaded_frames_${studyUID}`);
    
    if (!fs.existsSync(frameDir)) {
      return { cached: 0, totalSize: 0 };
    }
    
    const files = fs.readdirSync(frameDir);
    const totalSize = files.reduce((sum, file) => {
      const filePath = path.join(frameDir, file);
      const stats = fs.statSync(filePath);
      return sum + stats.size;
    }, 0);
    
    return {
      cached: files.length,
      totalSize: totalSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2)
    };
  }
}

// Singleton instance
let frameCacheService = null;

function getFrameCacheService(config = {}) {
  if (!frameCacheService) {
    frameCacheService = new FrameCacheService(config);
  }
  return frameCacheService;
}

module.exports = { FrameCacheService, getFrameCacheService };
