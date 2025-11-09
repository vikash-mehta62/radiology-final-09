// Orthanc Viewer Service - Fetch data directly from Orthanc for display
const axios = require('axios');

const ORTHANC_URL = process.env.ORTHANC_URL || 'http://69.62.70.102:8042';
const ORTHANC_USERNAME = process.env.ORTHANC_USERNAME || 'orthanc';
const ORTHANC_PASSWORD = process.env.ORTHANC_PASSWORD || 'orthanc_secure_2024';

// Create axios instance with auth
const orthancClient = axios.create({
  baseURL: ORTHANC_URL,
  auth: {
    username: ORTHANC_USERNAME,
    password: ORTHANC_PASSWORD
  },
  timeout: 30000
});

class OrthancViewerService {
  
  // Get all studies from Orthanc
  async getAllStudies() {
    try {
      const response = await orthancClient.get('/studies');
      const studyIds = response.data;
      
      // Get detailed info for each study
      const studies = await Promise.all(
        studyIds.map(id => this.getStudyDetails(id))
      );
      
      return studies.filter(s => s !== null);
    } catch (error) {
      console.error('Error fetching studies from Orthanc:', error.message);
      throw error;
    }
  }
  
  // Get study details
  async getStudyDetails(studyId) {
    try {
      const response = await orthancClient.get(`/studies/${studyId}`);
      const study = response.data;
      
      return {
        id: study.ID,
        patientID: study.PatientMainDicomTags?.PatientID || 'Unknown',
        patientName: study.PatientMainDicomTags?.PatientName || 'Unknown',
        studyDate: study.MainDicomTags?.StudyDate || '',
        studyTime: study.MainDicomTags?.StudyTime || '',
        studyDescription: study.MainDicomTags?.StudyDescription || '',
        modality: study.MainDicomTags?.Modality || '',
        studyInstanceUID: study.MainDicomTags?.StudyInstanceUID || '',
        seriesCount: study.Series?.length || 0,
        instancesCount: study.Instances?.length || 0,
        series: study.Series || []
      };
    } catch (error) {
      console.error(`Error fetching study ${studyId}:`, error.message);
      return null;
    }
  }
  
  // Get series details
  async getSeriesDetails(seriesId) {
    try {
      const response = await orthancClient.get(`/series/${seriesId}`);
      const series = response.data;
      
      return {
        id: series.ID,
        seriesInstanceUID: series.MainDicomTags?.SeriesInstanceUID || '',
        seriesDescription: series.MainDicomTags?.SeriesDescription || '',
        seriesNumber: series.MainDicomTags?.SeriesNumber || '',
        modality: series.MainDicomTags?.Modality || '',
        instancesCount: series.Instances?.length || 0,
        instances: series.Instances || []
      };
    } catch (error) {
      console.error(`Error fetching series ${seriesId}:`, error.message);
      return null;
    }
  }
  
  // Get instance details
  async getInstanceDetails(instanceId) {
    try {
      const response = await orthancClient.get(`/instances/${instanceId}`);
      const instance = response.data;
      
      return {
        id: instance.ID,
        sopInstanceUID: instance.MainDicomTags?.SOPInstanceUID || '',
        instanceNumber: instance.MainDicomTags?.InstanceNumber || '',
        imagePositionPatient: instance.MainDicomTags?.ImagePositionPatient || '',
        imageOrientationPatient: instance.MainDicomTags?.ImageOrientationPatient || ''
      };
    } catch (error) {
      console.error(`Error fetching instance ${instanceId}:`, error.message);
      return null;
    }
  }
  
  // Get instance preview image (JPEG)
  getInstancePreviewUrl(instanceId) {
    return `${ORTHANC_URL}/instances/${instanceId}/preview`;
  }
  
  // Get instance full image
  getInstanceImageUrl(instanceId) {
    return `${ORTHANC_URL}/instances/${instanceId}/image-uint8`;
  }
  
  // Get DICOM file download URL
  getInstanceDicomUrl(instanceId) {
    return `${ORTHANC_URL}/instances/${instanceId}/file`;
  }
  
  // Search studies by patient name or ID
  async searchStudies(query) {
    try {
      const allStudies = await this.getAllStudies();
      
      const searchTerm = query.toLowerCase();
      return allStudies.filter(study => 
        study.patientName.toLowerCase().includes(searchTerm) ||
        study.patientID.toLowerCase().includes(searchTerm) ||
        study.studyDescription.toLowerCase().includes(searchTerm)
      );
    } catch (error) {
      console.error('Error searching studies:', error.message);
      throw error;
    }
  }
  
  // Get study with all series and instances
  async getStudyComplete(studyId) {
    try {
      const study = await this.getStudyDetails(studyId);
      
      if (!study) return null;
      
      // Get all series details
      const seriesDetails = await Promise.all(
        study.series.map(seriesId => this.getSeriesDetails(seriesId))
      );
      
      study.seriesDetails = seriesDetails.filter(s => s !== null);
      
      // Get first instance of first series for preview
      if (study.seriesDetails.length > 0 && study.seriesDetails[0].instances.length > 0) {
        study.previewInstanceId = study.seriesDetails[0].instances[0];
      }
      
      return study;
    } catch (error) {
      console.error(`Error fetching complete study ${studyId}:`, error.message);
      throw error;
    }
  }
  
  // Get Orthanc system info
  async getSystemInfo() {
    try {
      const response = await orthancClient.get('/system');
      return response.data;
    } catch (error) {
      console.error('Error fetching Orthanc system info:', error.message);
      throw error;
    }
  }
  
  // Get Orthanc statistics
  async getStatistics() {
    try {
      const response = await orthancClient.get('/statistics');
      return response.data;
    } catch (error) {
      console.error('Error fetching Orthanc statistics:', error.message);
      throw error;
    }
  }
}

module.exports = new OrthancViewerService();
