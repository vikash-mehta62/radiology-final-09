const axios = require('axios');
const Study = require('../models/Study');
const Instance = require('../models/Instance');

/**
 * OrthancStudyService - Integrates with Orthanc PACS server to fetch and sync studies
 * Provides unified access to studies from both database and PACS server
 */
class OrthancStudyService {
  constructor(config = {}) {
    this.config = {
      orthancUrl: config.orthancUrl || process.env.ORTHANC_URL || 'http://69.62.70.102:8042',
      orthancUsername: config.orthancUsername || process.env.ORTHANC_USERNAME || 'orthanc',
      orthancPassword: config.orthancPassword || process.env.ORTHANC_PASSWORD || 'orthanc',
      timeout: config.timeout || 30000,
      enablePacsIntegration: config.enablePacsIntegration !== false, // Default enabled
      ...config
    };

    this.axiosInstance = axios.create({
      baseURL: this.config.orthancUrl,
      timeout: this.config.timeout,
      auth: {
        username: this.config.orthancUsername,
        password: this.config.orthancPassword
      }
    });
  }

  /**
   * Test connection to Orthanc PACS server
   */
  async testConnection() {
    try {
      const response = await this.axiosInstance.get('/system');
      console.log('Orthanc PACS connection successful', {
        version: response.data.Version,
        name: response.data.Name
      });
      return true;
    } catch (error) {
      console.warn('Orthanc PACS connection failed:', error.message);
      return false;
    }
  }

  /**
   * Fetch all studies from Orthanc PACS server
   */
  async fetchStudiesFromPacs() {
    if (!this.config.enablePacsIntegration) {
      return [];
    }

    try {
      // Get all studies from Orthanc
      const studiesResponse = await this.axiosInstance.get('/studies');
      const studyIds = studiesResponse.data;

      console.log(`Found ${studyIds.length} studies in Orthanc PACS`);

      // Get detailed information for each study
      const studiesWithDetails = await Promise.all(
        studyIds.map(async (studyId) => {
          try {
            return await this.getStudyDetailsFromPacs(studyId);
          } catch (error) {
            console.warn(`Failed to get details for study ${studyId}:`, error.message);
            return null;
          }
        })
      );

      // Filter out failed studies
      return studiesWithDetails.filter(study => study !== null);
    } catch (error) {
      console.error('Failed to fetch studies from Orthanc PACS:', error.message);
      return [];
    }
  }

  /**
   * Get detailed study information from Orthanc PACS
   */
  async getStudyDetailsFromPacs(studyId) {
    try {
      // Get study metadata
      const studyResponse = await this.axiosInstance.get(`/studies/${studyId}`);
      const studyData = studyResponse.data;

      // Get study tags for patient information
      const tagsResponse = await this.axiosInstance.get(`/studies/${studyId}/simplified-tags`);
      const tags = tagsResponse.data;

      // Count instances in study
      const instancesResponse = await this.axiosInstance.get(`/studies/${studyId}/instances`);
      const instances = instancesResponse.data;

      // Count total frames across all instances
      let totalFrames = 0;
      for (const instanceId of instances) {
        try {
          const instanceTags = await this.axiosInstance.get(`/instances/${instanceId}/simplified-tags`);
          const frames = parseInt(instanceTags.data.NumberOfFrames) || 1;
          totalFrames += frames;
        } catch (error) {
          console.warn(`Failed to get frame count for instance ${instanceId}:`, error.message);
          totalFrames += 1; // Default to 1 frame
        }
      }

      return {
        studyInstanceUID: tags.StudyInstanceUID,
        studyDate: tags.StudyDate,
        studyTime: tags.StudyTime,
        patientName: tags.PatientName || 'Unknown',
        patientID: tags.PatientID,
        patientBirthDate: tags.PatientBirthDate,
        patientSex: tags.PatientSex,
        modality: tags.Modality || 'OT',
        studyDescription: tags.StudyDescription,
        numberOfSeries: studyData.Series ? studyData.Series.length : 1,
        numberOfInstances: totalFrames,
        orthancStudyId: studyId,
        source: 'pacs',
        lastSyncDate: new Date()
      };
    } catch (error) {
      console.error(`Failed to get study details for ${studyId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get unified studies list from both database and PACS
   */
  async getUnifiedStudies() {
    try {
      // Fetch studies from database
      const dbStudies = await Study.find({}, {
        studyInstanceUID: 1,
        patientName: 1,
        modality: 1,
        numberOfSeries: 1,
        numberOfInstances: 1,
        studyDate: 1,
        studyTime: 1,
        patientID: 1,
        studyDescription: 1
      }).lean();

      console.log(`Found ${dbStudies.length} studies in database`);

      // Fetch studies from PACS if enabled
      let pacsStudies = [];
      if (this.config.enablePacsIntegration) {
        const isConnected = await this.testConnection();
        if (isConnected) {
          pacsStudies = await this.fetchStudiesFromPacs();
          console.log(`Found ${pacsStudies.length} studies in PACS`);
        }
      }

      // Merge studies by StudyInstanceUID
      const studyMap = new Map();

      // Add database studies
      for (const study of dbStudies) {
        studyMap.set(study.studyInstanceUID, {
          ...study,
          source: 'database'
        });
      }

      // Add or update with PACS studies (PACS data takes precedence for frame counts)
      for (const pacsStudy of pacsStudies) {
        const existingStudy = studyMap.get(pacsStudy.studyInstanceUID);
        if (existingStudy) {
          // Merge database and PACS data, preferring PACS for frame counts
          studyMap.set(pacsStudy.studyInstanceUID, {
            ...existingStudy,
            ...pacsStudy,
            numberOfInstances: pacsStudy.numberOfInstances, // Use PACS frame count
            source: 'merged'
          });
        } else {
          // New study from PACS only
          studyMap.set(pacsStudy.studyInstanceUID, pacsStudy);
        }
      }

      // Convert map to array and ensure proper frame counts
      const unifiedStudies = Array.from(studyMap.values());

      // For database-only studies, try to get accurate frame counts
      const studiesWithFrameCounts = await Promise.all(
        unifiedStudies.map(async (study) => {
          if (study.source === 'database') {
            // Try to get accurate frame count from instances
            try {
              const inst = await Instance.findOne({ studyInstanceUID: study.studyInstanceUID }).lean();
              if (inst && inst.orthancInstanceId) {
                // Use existing countFramesFromOrthanc logic
                const { countFramesFromOrthanc } = require('../controllers/studyController');
                const frameCount = await countFramesFromOrthanc(inst);
                study.numberOfInstances = frameCount;
              }
            } catch (error) {
              console.warn(`Failed to get frame count for database study ${study.studyInstanceUID}:`, error.message);
            }
          }

          return {
            studyInstanceUID: study.studyInstanceUID,
            patientName: study.patientName || 'Unknown',
            modality: study.modality || 'OT',
            numberOfSeries: study.numberOfSeries || 1,
            numberOfInstances: study.numberOfInstances || 1,
            studyDate: study.studyDate,
            studyTime: study.studyTime,
            patientID: study.patientID,
            studyDescription: study.studyDescription,
            source: study.source,
            orthancStudyId: study.orthancStudyId
          };
        })
      );

      console.log(`Returning ${studiesWithFrameCounts.length} unified studies`);
      return studiesWithFrameCounts;

    } catch (error) {
      console.error('Failed to get unified studies:', error.message);
      throw error;
    }
  }

  /**
   * Sync PACS studies to database (background operation)
   */
  async syncPacsToDatabase() {
    if (!this.config.enablePacsIntegration) {
      console.log('PACS integration disabled, skipping sync');
      return;
    }

    try {
      console.log('Starting PACS to database sync...');
      
      const pacsStudies = await this.fetchStudiesFromPacs();
      let syncedCount = 0;
      let errorCount = 0;

      for (const pacsStudy of pacsStudies) {
        try {
          // Check if study exists in database
          const existingStudy = await Study.findOne({ 
            studyInstanceUID: pacsStudy.studyInstanceUID 
          });

          if (existingStudy) {
            // Update existing study with PACS data
            await Study.updateOne(
              { studyInstanceUID: pacsStudy.studyInstanceUID },
              {
                $set: {
                  numberOfInstances: pacsStudy.numberOfInstances,
                  numberOfSeries: pacsStudy.numberOfSeries,
                  patientName: pacsStudy.patientName || existingStudy.patientName,
                  modality: pacsStudy.modality || existingStudy.modality,
                  studyDescription: pacsStudy.studyDescription || existingStudy.studyDescription,
                  lastSyncDate: new Date()
                }
              }
            );
            console.log(`Updated study ${pacsStudy.studyInstanceUID} from PACS`);
          } else {
            // Create new study from PACS data
            await Study.create({
              studyInstanceUID: pacsStudy.studyInstanceUID,
              studyDate: pacsStudy.studyDate,
              studyTime: pacsStudy.studyTime,
              patientName: pacsStudy.patientName,
              patientID: pacsStudy.patientID,
              patientBirthDate: pacsStudy.patientBirthDate,
              patientSex: pacsStudy.patientSex,
              modality: pacsStudy.modality,
              studyDescription: pacsStudy.studyDescription,
              numberOfSeries: pacsStudy.numberOfSeries,
              numberOfInstances: pacsStudy.numberOfInstances
            });
            console.log(`Created new study ${pacsStudy.studyInstanceUID} from PACS`);
          }
          syncedCount++;
        } catch (error) {
          console.error(`Failed to sync study ${pacsStudy.studyInstanceUID}:`, error.message);
          errorCount++;
        }
      }

      console.log(`PACS sync completed: ${syncedCount} synced, ${errorCount} errors`);
      return { syncedCount, errorCount };

    } catch (error) {
      console.error('PACS sync failed:', error.message);
      throw error;
    }
  }

  /**
   * Get study from PACS by StudyInstanceUID
   */
  async getStudyFromPacs(studyInstanceUID) {
    if (!this.config.enablePacsIntegration) {
      return null;
    }

    try {
      // Search for study in PACS
      const studiesResponse = await this.axiosInstance.get('/studies');
      const studyIds = studiesResponse.data;

      for (const studyId of studyIds) {
        try {
          const tagsResponse = await this.axiosInstance.get(`/studies/${studyId}/simplified-tags`);
          const tags = tagsResponse.data;
          
          if (tags.StudyInstanceUID === studyInstanceUID) {
            return await this.getStudyDetailsFromPacs(studyId);
          }
        } catch (error) {
          console.warn(`Failed to check study ${studyId}:`, error.message);
          continue;
        }
      }

      return null; // Study not found in PACS
    } catch (error) {
      console.error(`Failed to get study ${studyInstanceUID} from PACS:`, error.message);
      return null;
    }
  }
}

// Singleton instance
let orthancStudyServiceInstance = null;

/**
 * Get singleton instance of OrthancStudyService
 */
function getOrthancStudyService(config = {}) {
  if (!orthancStudyServiceInstance) {
    orthancStudyServiceInstance = new OrthancStudyService(config);
  }
  return orthancStudyServiceInstance;
}

module.exports = { OrthancStudyService, getOrthancStudyService };