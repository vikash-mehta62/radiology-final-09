/**
 * Unified Orthanc Service
 * 
 * This service provides a complete abstraction layer over Orthanc PACS.
 * ALL Orthanc operations should go through this service.
 * 
 * Benefits:
 * - Single point of control for all PACS operations
 * - Easy to switch PACS systems in the future
 * - Consistent error handling and logging
 * - Your application never directly touches Orthanc API
 */

const axios = require('axios');
const FormData = require('form-data');

class UnifiedOrthancService {
  constructor(config = {}) {
    this.config = {
      orthancUrl: config.orthancUrl || process.env.ORTHANC_URL || 'http://69.62.70.102:8042',
      orthancUsername: config.orthancUsername || process.env.ORTHANC_USERNAME || 'orthanc',
      orthancPassword: config.orthancPassword || process.env.ORTHANC_PASSWORD || 'orthanc',
      timeout: config.timeout || 600000,
      ...config
    };

    // Create axios instance with auth
    this.client = axios.create({
      baseURL: this.config.orthancUrl,
      timeout: this.config.timeout,
      auth: {
        username: this.config.orthancUsername,
        password: this.config.orthancPassword
      }
    });

    console.log('Unified Orthanc Service initialized');
  }

  // ==================== CONNECTION & HEALTH ====================

  /**
   * Test connection to Orthanc
   */
  async testConnection() {
    try {
      const response = await this.client.get('/system');
      return {
        connected: true,
        version: response.data.Version,
        name: response.data.Name,
        apiVersion: response.data.ApiVersion
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Get Orthanc system information
   */
  async getSystemInfo() {
    const response = await this.client.get('/system');
    return response.data;
  }

  /**
   * Get Orthanc statistics
   */
  async getStatistics() {
    const response = await this.client.get('/statistics');
    return response.data;
  }

  // ==================== STUDY OPERATIONS ====================

  /**
   * Get all studies from Orthanc
   */
  async getAllStudies() {
    const response = await this.client.get('/studies');
    return response.data; // Returns array of study IDs
  }

  /**
   * Get study details by Orthanc study ID
   */
  async getStudyById(orthancStudyId) {
    const response = await this.client.get(`/studies/${orthancStudyId}`);
    return response.data;
  }

  /**
   * Get study metadata/tags
   */
  async getStudyTags(orthancStudyId) {
    const response = await this.client.get(`/studies/${orthancStudyId}/simplified-tags`);
    return response.data;
  }

  /**
   * Get all instances in a study
   */
  async getStudyInstances(orthancStudyId) {
    const response = await this.client.get(`/studies/${orthancStudyId}/instances`);
    return response.data; // Returns array of instance IDs
  }

  /**
   * Find study by StudyInstanceUID
   */
  async findStudyByUID(studyInstanceUID) {
    const studies = await this.getAllStudies();
    
    for (const studyId of studies) {
      try {
        const tags = await this.getStudyTags(studyId);
        if (tags.StudyInstanceUID === studyInstanceUID) {
          return {
            orthancStudyId: studyId,
            tags: tags
          };
        }
      } catch (error) {
        console.warn(`Failed to check study ${studyId}:`, error.message);
      }
    }
    
    return null;
  }

  /**
   * Delete study from Orthanc
   */
  async deleteStudy(orthancStudyId) {
    await this.client.delete(`/studies/${orthancStudyId}`);
    return { success: true };
  }

  /**
   * Export study as ZIP archive
   */
  async exportStudy(orthancStudyId) {
    const response = await this.client.get(`/studies/${orthancStudyId}/archive`, {
      responseType: 'arraybuffer'
    });
    return response.data;
  }

  /**
   * Anonymize study
   */
  async anonymizeStudy(orthancStudyId, options = {}) {
    const payload = {
      Keep: options.keep || ['StudyDate', 'StudyTime'],
      Replace: options.replace || { PatientName: 'Anonymous' },
      ...options
    };
    
    const response = await this.client.post(`/studies/${orthancStudyId}/anonymize`, payload);
    return response.data;
  }

  /**
   * Modify study tags
   */
  async modifyStudy(orthancStudyId, modifications) {
    const response = await this.client.post(`/studies/${orthancStudyId}/modify`, {
      Replace: modifications
    });
    return response.data;
  }

  // ==================== INSTANCE OPERATIONS ====================

  /**
   * Get instance metadata
   */
  async getInstanceMetadata(orthancInstanceId) {
    const response = await this.client.get(`/instances/${orthancInstanceId}/simplified-tags`);
    return response.data;
  }

  /**
   * Get instance file (raw DICOM)
   */
  async getInstanceFile(orthancInstanceId) {
    const response = await this.client.get(`/instances/${orthancInstanceId}/file`, {
      responseType: 'arraybuffer'
    });
    return response.data;
  }

  /**
   * Upload DICOM file to Orthanc
   */
  async uploadDicomFile(fileBuffer) {
    const response = await this.client.post('/instances', fileBuffer, {
      headers: {
        'Content-Type': 'application/dicom'
      }
    });
    return response.data;
  }

  /**
   * Delete instance from Orthanc
   */
  async deleteInstance(orthancInstanceId) {
    await this.client.delete(`/instances/${orthancInstanceId}`);
    return { success: true };
  }

  /**
   * Find instance by SOPInstanceUID
   */
  async findInstanceByUID(sopInstanceUID) {
    const response = await this.client.post('/tools/find', {
      Level: 'Instance',
      Query: {
        SOPInstanceUID: sopInstanceUID
      }
    });
    
    if (response.data && response.data.length > 0) {
      return response.data[0]; // Return first matching instance ID
    }
    
    return null;
  }

  // ==================== FRAME/IMAGE OPERATIONS ====================

  /**
   * Get frame as PNG image
   */
  async getFrameAsPng(orthancInstanceId, frameIndex = 0, options = {}) {
    const quality = options.quality || 90;
    const response = await this.client.get(
      `/instances/${orthancInstanceId}/frames/${frameIndex}/preview`,
      {
        params: { quality },
        responseType: 'arraybuffer'
      }
    );
    return response.data;
  }

  /**
   * Get frame as JPEG image
   */
  async getFrameAsJpeg(orthancInstanceId, frameIndex = 0, options = {}) {
    const quality = options.quality || 90;
    const response = await this.client.get(
      `/instances/${orthancInstanceId}/frames/${frameIndex}/image-uint8`,
      {
        params: { quality },
        responseType: 'arraybuffer'
      }
    );
    return response.data;
  }

  /**
   * Get frame raw data
   */
  async getFrameRaw(orthancInstanceId, frameIndex = 0) {
    const response = await this.client.get(
      `/instances/${orthancInstanceId}/frames/${frameIndex}/raw`,
      {
        responseType: 'arraybuffer'
      }
    );
    return response.data;
  }

  /**
   * Get number of frames in instance
   */
  async getFrameCount(orthancInstanceId) {
    const metadata = await this.getInstanceMetadata(orthancInstanceId);
    return parseInt(metadata.NumberOfFrames) || 1;
  }

  // ==================== SERIES OPERATIONS ====================

  /**
   * Get series details
   */
  async getSeriesById(orthancSeriesId) {
    const response = await this.client.get(`/series/${orthancSeriesId}`);
    return response.data;
  }

  /**
   * Get series tags
   */
  async getSeriesTags(orthancSeriesId) {
    const response = await this.client.get(`/series/${orthancSeriesId}/simplified-tags`);
    return response.data;
  }

  /**
   * Get all instances in a series
   */
  async getSeriesInstances(orthancSeriesId) {
    const response = await this.client.get(`/series/${orthancSeriesId}/instances`);
    return response.data;
  }

  // ==================== PATIENT OPERATIONS ====================

  /**
   * Get all patients
   */
  async getAllPatients() {
    const response = await this.client.get('/patients');
    return response.data;
  }

  /**
   * Get patient details
   */
  async getPatientById(orthancPatientId) {
    const response = await this.client.get(`/patients/${orthancPatientId}`);
    return response.data;
  }

  /**
   * Get patient tags
   */
  async getPatientTags(orthancPatientId) {
    const response = await this.client.get(`/patients/${orthancPatientId}/simplified-tags`);
    return response.data;
  }

  /**
   * Get all studies for a patient
   */
  async getPatientStudies(orthancPatientId) {
    const response = await this.client.get(`/patients/${orthancPatientId}/studies`);
    return response.data;
  }

  // ==================== QUERY/RETRIEVE (DICOM C-FIND, C-MOVE) ====================

  /**
   * Query remote PACS modality
   */
  async queryModality(modalityName, query) {
    const response = await this.client.post(`/modalities/${modalityName}/query`, {
      Level: query.level || 'Study',
      Query: query.tags || {}
    });
    return response.data;
  }

  /**
   * Retrieve study from remote PACS
   */
  async retrieveStudy(modalityName, studyInstanceUID) {
    const response = await this.client.post(`/modalities/${modalityName}/store`, {
      Resources: [studyInstanceUID]
    });
    return response.data;
  }

  /**
   * Get configured DICOM modalities
   */
  async getModalities() {
    const response = await this.client.get('/modalities');
    return response.data;
  }

  /**
   * Echo test to DICOM modality
   */
  async echoModality(modalityName) {
    try {
      await this.client.post(`/modalities/${modalityName}/echo`);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==================== ADVANCED OPERATIONS ====================

  /**
   * Get complete study information with all metadata
   */
  async getCompleteStudyInfo(studyInstanceUID) {
    try {
      // Find study in Orthanc
      const studyInfo = await this.findStudyByUID(studyInstanceUID);
      if (!studyInfo) {
        return null;
      }

      const { orthancStudyId, tags } = studyInfo;

      // Get study details
      const studyDetails = await this.getStudyById(orthancStudyId);

      // Get all instances
      const instanceIds = await this.getStudyInstances(orthancStudyId);

      // Get frame counts for each instance
      const instancesWithFrames = await Promise.all(
        instanceIds.map(async (instanceId) => {
          try {
            const metadata = await this.getInstanceMetadata(instanceId);
            const frameCount = parseInt(metadata.NumberOfFrames) || 1;
            
            return {
              orthancInstanceId: instanceId,
              sopInstanceUID: metadata.SOPInstanceUID,
              instanceNumber: parseInt(metadata.InstanceNumber) || 1,
              frameCount: frameCount,
              metadata: metadata
            };
          } catch (error) {
            console.warn(`Failed to get instance ${instanceId}:`, error.message);
            return null;
          }
        })
      );

      const validInstances = instancesWithFrames.filter(inst => inst !== null);
      const totalFrames = validInstances.reduce((sum, inst) => sum + inst.frameCount, 0);

      return {
        studyInstanceUID: tags.StudyInstanceUID,
        orthancStudyId: orthancStudyId,
        patientName: tags.PatientName || 'Unknown',
        patientID: tags.PatientID,
        patientBirthDate: tags.PatientBirthDate,
        patientSex: tags.PatientSex,
        studyDate: tags.StudyDate,
        studyTime: tags.StudyTime,
        studyDescription: tags.StudyDescription,
        modality: tags.Modality,
        numberOfSeries: studyDetails.Series ? studyDetails.Series.length : 1,
        numberOfInstances: validInstances.length,
        totalFrames: totalFrames,
        instances: validInstances,
        tags: tags
      };
    } catch (error) {
      console.error(`Failed to get complete study info for ${studyInstanceUID}:`, error.message);
      throw error;
    }
  }

  /**
   * Batch upload multiple DICOM files
   */
  async batchUploadDicom(fileBuffers) {
    const results = [];
    
    for (const buffer of fileBuffers) {
      try {
        const result = await this.uploadDicomFile(buffer);
        results.push({ success: true, data: result });
      } catch (error) {
        results.push({ success: false, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Get preview image for study (first frame of first instance)
   */
  async getStudyPreview(orthancStudyId, options = {}) {
    try {
      const instances = await this.getStudyInstances(orthancStudyId);
      if (instances.length === 0) {
        throw new Error('No instances found in study');
      }

      // Get first instance
      const firstInstance = instances[0];
      
      // Get preview of first frame
      return await this.getFrameAsPng(firstInstance, 0, options);
    } catch (error) {
      console.error(`Failed to get study preview:`, error.message);
      throw error;
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Check if Orthanc is available
   */
  async isAvailable() {
    const result = await this.testConnection();
    return result.connected;
  }

  /**
   * Get Orthanc configuration
   */
  getConfig() {
    return {
      url: this.config.orthancUrl,
      username: this.config.orthancUsername,
      timeout: this.config.timeout
    };
  }

  /**
   * Make custom request to Orthanc (for advanced use cases)
   */
  async customRequest(method, endpoint, data = null, options = {}) {
    const response = await this.client.request({
      method: method,
      url: endpoint,
      data: data,
      ...options
    });
    return response.data;
  }
}

// Singleton instance
let unifiedOrthancServiceInstance = null;

/**
 * Get singleton instance of UnifiedOrthancService
 */
function getUnifiedOrthancService(config = {}) {
  if (!unifiedOrthancServiceInstance) {
    unifiedOrthancServiceInstance = new UnifiedOrthancService(config);
  }
  return unifiedOrthancServiceInstance;
}

module.exports = { UnifiedOrthancService, getUnifiedOrthancService };
