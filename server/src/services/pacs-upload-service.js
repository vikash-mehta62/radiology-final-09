const axios = require('axios');
const FormData = require('form-data');
const Study = require('../models/Study');
const Instance = require('../models/Instance');
const { getMetricsCollector } = require('./metrics-collector');

/**
 * PACS Upload Service - Handles DICOM file upload to Orthanc PACS and real-time processing
 * Provides seamless upload, processing, and immediate availability for viewing
 */
class PacsUploadService {
  constructor(config = {}) {
    this.config = {
      orthancUrl: config.orthancUrl || process.env.ORTHANC_URL || 'http://69.62.70.102:8042',
      orthancUsername: config.orthancUsername || process.env.ORTHANC_USERNAME || 'orthanc',
      orthancPassword: config.orthancPassword || process.env.ORTHANC_PASSWORD || 'orthanc',
      timeout: config.timeout || 60000, // 60 seconds for large files
      enableRealTimeProcessing: config.enableRealTimeProcessing !== false,
      ...config
    };

    // Validate required configuration
    this.validateConfiguration();

    this.metricsCollector = getMetricsCollector();
    this.axiosInstance = axios.create({
      baseURL: this.config.orthancUrl,
      timeout: this.config.timeout,
      auth: {
        username: this.config.orthancUsername,
        password: this.config.orthancPassword
      }
    });

    console.log('PACS Upload Service initialized:', {
      orthancUrl: this.config.orthancUrl,
      username: this.config.orthancUsername,
      timeout: this.config.timeout
    });
  }

  /**
   * Validate required configuration
   * @private
   */
  validateConfiguration() {
    const errors = [];

    if (!this.config.orthancUrl) {
      errors.push('ORTHANC_URL is not configured');
    }

    if (!this.config.orthancUsername) {
      errors.push('ORTHANC_USERNAME is not configured');
    }

    if (!this.config.orthancPassword) {
      errors.push('ORTHANC_PASSWORD is not configured');
    }

    if (errors.length > 0) {
      const errorMessage = `PACS Upload Service configuration errors:\n${errors.join('\n')}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Upload DICOM file to Orthanc PACS and process for immediate viewing
   * @param {Buffer} fileBuffer - DICOM file buffer
   * @param {string} originalFilename - Original filename
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload and processing result
   */
  async uploadAndProcess(fileBuffer, originalFilename, options = {}) {
    const timer = this.metricsCollector.startTimer('pacs_upload_processing');
    
    try {
      console.log(`Starting PACS upload and processing for file: ${originalFilename}`);
      
      // Step 1: Upload to Orthanc PACS
      const uploadResult = await this.uploadToOrthanc(fileBuffer, originalFilename);
      
      // Step 2: Process uploaded instances for immediate viewing
      const processingResult = await this.processUploadedInstances(uploadResult);
      
      // Step 3: Update database with processed data
      const dbResult = await this.updateDatabase(processingResult);
      
      timer.end({ status: 'success' });
      
      const result = {
        success: true,
        upload: uploadResult,
        processing: processingResult,
        database: dbResult,
        readyForViewing: true,
        studyInstanceUID: processingResult.studyInstanceUID,
        totalFrames: processingResult.totalFrames,
        message: `Successfully uploaded and processed ${originalFilename}. Ready for immediate viewing.`
      };
      
      console.log(`PACS upload and processing completed for ${originalFilename}:`, {
        studyUID: result.studyInstanceUID,
        instances: processingResult.instances.length,
        totalFrames: result.totalFrames
      });
      
      return result;
      
    } catch (error) {
      timer.end({ status: 'error' });
      console.error(`PACS upload and processing failed for ${originalFilename}:`, error.message);
      
      return {
        success: false,
        error: error.message,
        readyForViewing: false,
        message: `Failed to upload and process ${originalFilename}: ${error.message}`
      };
    }
  }

  /**
   * Upload DICOM file to Orthanc PACS server
   * @private
   */
  async uploadToOrthanc(fileBuffer, filename) {
    try {
      console.log(`Uploading ${filename} to Orthanc PACS (${fileBuffer.length} bytes)...`);
      
      // Check if buffer looks like DICOM (starts with DICM magic number after 128 byte preamble)
      const isDicomLike = fileBuffer.length > 132 && 
                          fileBuffer[128] === 0x44 && // 'D'
                          fileBuffer[129] === 0x49 && // 'I'
                          fileBuffer[130] === 0x43 && // 'C'
                          fileBuffer[131] === 0x4D;   // 'M'
      
      console.log(`DICOM validation: ${isDicomLike ? '✅ Has DICM header' : '⚠️  No DICM header (might still be valid)'}`);
      console.log(`First 16 bytes: ${fileBuffer.slice(0, 16).toString('hex')}`);
      
      // Orthanc expects raw DICOM data, not multipart form data
      // POST the raw buffer directly to /instances endpoint
      const response = await this.axiosInstance.post('/instances', fileBuffer, {
        headers: {
          'Content-Type': 'application/dicom'
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });
      
      const uploadData = response.data;
      
      console.log(`Successfully uploaded to Orthanc:`, {
        instanceId: uploadData.ID,
        studyId: uploadData.ParentStudy,
        seriesId: uploadData.ParentSeries,
        status: uploadData.Status
      });
      
      return {
        success: true,
        orthancInstanceId: uploadData.ID,
        orthancStudyId: uploadData.ParentStudy,
        orthancSeriesId: uploadData.ParentSeries,
        status: uploadData.Status,
        path: uploadData.Path
      };
      
    } catch (error) {
      console.error(`❌ Failed to upload ${filename} to Orthanc`);
      console.error(`   Error message: ${error.message}`);
      console.error(`   HTTP status: ${error.response?.status}`);
      console.error(`   Orthanc response: ${JSON.stringify(error.response?.data)}`);
      console.error(`   Response headers: ${JSON.stringify(error.response?.headers)}`);
      
      // Provide more detailed error information
      let errorMessage = `Orthanc upload failed: ${error.message}`;
      if (error.response) {
        errorMessage += ` (HTTP ${error.response.status})`;
        if (error.response.data) {
          if (typeof error.response.data === 'object') {
            errorMessage += ` - ${JSON.stringify(error.response.data)}`;
          } else {
            errorMessage += ` - ${error.response.data}`;
          }
        }
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Process uploaded instances to extract metadata and prepare for viewing
   * @private
   */
  async processUploadedInstances(uploadResult) {
    try {
      const { orthancInstanceId, orthancStudyId } = uploadResult;
      
      console.log(`Processing uploaded instance ${orthancInstanceId}...`);
      
      // Get instance metadata from Orthanc
      const instanceMetadata = await this.getInstanceMetadata(orthancInstanceId);
      
      // Get study metadata from Orthanc
      const studyMetadata = await this.getStudyMetadata(orthancStudyId);
      
      // Get all instances in the study
      const studyInstances = await this.getStudyInstances(orthancStudyId);
      
      // Process each instance to get frame counts and metadata
      const processedInstances = await Promise.all(
        studyInstances.map(async (instanceId) => {
          try {
            const metadata = await this.getInstanceMetadata(instanceId);
            const frameCount = parseInt(metadata.NumberOfFrames) || 1;
            
            return {
              orthancInstanceId: instanceId,
              instanceNumber: parseInt(metadata.InstanceNumber) || 1,
              sopInstanceUID: metadata.SOPInstanceUID,
              frameCount: frameCount,
              metadata: metadata
            };
          } catch (error) {
            console.warn(`Failed to process instance ${instanceId}:`, error.message);
            return null;
          }
        })
      );
      
      // Filter out failed instances
      const validInstances = processedInstances.filter(inst => inst !== null);
      
      // Calculate total frames
      const totalFrames = validInstances.reduce((sum, inst) => sum + inst.frameCount, 0);
      
      console.log(`Processed ${validInstances.length} instances with ${totalFrames} total frames`);
      
      return {
        studyInstanceUID: studyMetadata.StudyInstanceUID,
        studyMetadata: studyMetadata,
        instances: validInstances,
        totalFrames: totalFrames,
        orthancStudyId: orthancStudyId
      };
      
    } catch (error) {
      console.error('Failed to process uploaded instances:', error.message);
      throw new Error(`Instance processing failed: ${error.message}`);
    }
  }

  /**
   * Update database with processed PACS data for immediate viewing
   * @private
   */
  async updateDatabase(processingResult) {
    try {
      const { studyInstanceUID, studyMetadata, instances, totalFrames, orthancStudyId } = processingResult;
      
      console.log(`Updating database for study ${studyInstanceUID}...`);
      
      // Create or update study record
      const studyData = {
        studyInstanceUID: studyInstanceUID,
        studyDate: studyMetadata.StudyDate,
        studyTime: studyMetadata.StudyTime,
        patientName: studyMetadata.PatientName || 'Unknown',
        patientID: studyMetadata.PatientID,
        patientBirthDate: studyMetadata.PatientBirthDate,
        patientSex: studyMetadata.PatientSex,
        modality: studyMetadata.Modality || 'OT',
        studyDescription: studyMetadata.StudyDescription,
        numberOfSeries: instances.length > 0 ? 1 : 0, // Simplified for now
        numberOfInstances: totalFrames,
        orthancStudyId: orthancStudyId
      };
      
      // Upsert study
      await Study.findOneAndUpdate(
        { studyInstanceUID: studyInstanceUID },
        studyData,
        { upsert: true, new: true }
      );
      
      // Create instance records for frame retrieval
      // For multi-frame DICOM files, create one instance record per frame
      const instancePromises = [];
      
      instances.forEach((inst) => {
        const frameCount = inst.frameCount || 1;
        
        // Create an instance record for each frame
        for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
          const instanceData = {
            studyInstanceUID: studyInstanceUID,
            seriesInstanceUID: inst.metadata.SeriesInstanceUID || `${studyInstanceUID}.1`,
            sopInstanceUID: `${inst.sopInstanceUID}.frame${frameIndex}`, // Unique SOP UID per frame
            instanceNumber: (inst.instanceNumber * 1000) + frameIndex, // Unique instance number
            modality: studyMetadata.Modality || 'OT',
            orthancInstanceId: inst.orthancInstanceId, // Same Orthanc instance for all frames
            orthancUrl: `${this.config.orthancUrl}/instances/${inst.orthancInstanceId}`,
            orthancFrameIndex: frameIndex, // Store which frame this is
            useOrthancPreview: true // Enable Orthanc preview for this instance
          };
          
          // Upsert instance
          instancePromises.push(
            Instance.findOneAndUpdate(
              { 
                studyInstanceUID: studyInstanceUID,
                sopInstanceUID: instanceData.sopInstanceUID 
              },
              instanceData,
              { upsert: true, new: true }
            )
          );
        }
      });
      
      const createdInstances = await Promise.all(instancePromises);
      
      console.log(`Database updated: study and ${createdInstances.length} instances created/updated`);
      
      return {
        studyCreated: true,
        instancesCreated: createdInstances.length,
        totalFrames: totalFrames,
        readyForViewing: true
      };
      
    } catch (error) {
      console.error('Failed to update database:', error.message);
      throw new Error(`Database update failed: ${error.message}`);
    }
  }

  /**
   * Get instance metadata from Orthanc
   * @private
   */
  async getInstanceMetadata(instanceId) {
    try {
      const response = await this.axiosInstance.get(`/instances/${instanceId}/simplified-tags`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get instance metadata: ${error.message}`);
    }
  }

  /**
   * Get study metadata from Orthanc
   * @private
   */
  async getStudyMetadata(studyId) {
    try {
      const response = await this.axiosInstance.get(`/studies/${studyId}/simplified-tags`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get study metadata: ${error.message}`);
    }
  }

  /**
   * Get all instances in a study from Orthanc
   * @private
   */
  async getStudyInstances(studyId) {
    try {
      const response = await this.axiosInstance.get(`/studies/${studyId}/instances`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get study instances: ${error.message}`);
    }
  }

  /**
   * Test connection to Orthanc PACS
   */
  async testConnection() {
    try {
      const response = await this.axiosInstance.get('/system');
      console.log('PACS upload service connected to Orthanc:', {
        version: response.data.Version,
        name: response.data.Name
      });
      return true;
    } catch (error) {
      console.error('PACS upload service connection failed:', error.message);
      return false;
    }
  }

  /**
   * Get upload statistics
   */
  getUploadStats() {
    // This could be enhanced with actual metrics
    return {
      uploadsToday: 0,
      totalUploads: 0,
      averageProcessingTime: 0,
      successRate: 100
    };
  }
}

// Singleton instance
let pacsUploadServiceInstance = null;

/**
 * Get singleton instance of PacsUploadService
 */
function getPacsUploadService(config = {}) {
  if (!pacsUploadServiceInstance) {
    pacsUploadServiceInstance = new PacsUploadService(config);
  }
  return pacsUploadServiceInstance;
}

module.exports = { PacsUploadService, getPacsUploadService };