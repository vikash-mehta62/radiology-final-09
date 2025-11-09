const fs = require('fs');
const path = require('path');

/**
 * Filesystem Study Loader
 * Loads study information from filesystem when MongoDB is not available
 */
class FilesystemStudyLoader {
  constructor(config = {}) {
    this.backendDir = config.backendDir || path.resolve(__dirname, '../../backend');
  }

  /**
   * Get all studies from filesystem
   */
  getAllStudies() {
    try {
      const studiesDir = path.join(this.backendDir, 'uploaded_studies');
      
      if (!fs.existsSync(studiesDir)) {
        return [];
      }

      const studyDirs = fs.readdirSync(studiesDir);
      const studies = [];

      for (const studyUID of studyDirs) {
        const studyPath = path.join(studiesDir, studyUID);
        const stat = fs.statSync(studyPath);
        
        if (stat.isDirectory()) {
          const studyInfo = this.getStudyInfo(studyUID);
          if (studyInfo) {
            studies.push(studyInfo);
          }
        }
      }

      return studies;
    } catch (error) {
      console.error('Error loading studies from filesystem:', error);
      return [];
    }
  }

  /**
   * Get study information from filesystem
   */
  getStudyInfo(studyUID) {
    try {
      const studyDir = path.join(this.backendDir, 'uploaded_studies', studyUID);
      const framesDir = path.join(this.backendDir, `uploaded_frames_${studyUID}`);

      if (!fs.existsSync(studyDir)) {
        return null;
      }

      // Count series
      const seriesDirs = fs.readdirSync(studyDir).filter(item => {
        const itemPath = path.join(studyDir, item);
        return fs.statSync(itemPath).isDirectory();
      });

      // Count total instances
      let totalInstances = 0;
      for (const seriesUID of seriesDirs) {
        const seriesPath = path.join(studyDir, seriesUID);
        const files = fs.readdirSync(seriesPath).filter(f => f.endsWith('.dcm'));
        totalInstances += files.length;
      }

      // Count frames
      let totalFrames = 0;
      if (fs.existsSync(framesDir)) {
        const frames = fs.readdirSync(framesDir).filter(f => f.endsWith('.png'));
        totalFrames = frames.length;
      }

      // Get creation time
      const stat = fs.statSync(studyDir);

      return {
        studyInstanceUID: studyUID,
        studyDescription: `Study from filesystem`,
        patientName: 'Unknown',
        patientID: 'Unknown',
        studyDate: stat.birthtime.toISOString().split('T')[0].replace(/-/g, ''),
        studyTime: stat.birthtime.toISOString().split('T')[1].split('.')[0].replace(/:/g, ''),
        modality: 'OT',
        numberOfSeries: seriesDirs.length,
        numberOfInstances: totalFrames || totalInstances,
        source: 'filesystem'
      };
    } catch (error) {
      console.error(`Error loading study ${studyUID}:`, error);
      return null;
    }
  }

  /**
   * Check if study exists in filesystem
   */
  studyExists(studyUID) {
    const studyDir = path.join(this.backendDir, 'uploaded_studies', studyUID);
    return fs.existsSync(studyDir);
  }

  /**
   * Get frame count for study
   */
  getFrameCount(studyUID) {
    try {
      const framesDir = path.join(this.backendDir, `uploaded_frames_${studyUID}`);
      
      if (!fs.existsSync(framesDir)) {
        return 0;
      }

      const frames = fs.readdirSync(framesDir).filter(f => f.endsWith('.png'));
      return frames.length;
    } catch (error) {
      return 0;
    }
  }
}

// Singleton instance
let filesystemStudyLoader = null;

function getFilesystemStudyLoader(config = {}) {
  if (!filesystemStudyLoader) {
    filesystemStudyLoader = new FilesystemStudyLoader(config);
  }
  return filesystemStudyLoader;
}

module.exports = { FilesystemStudyLoader, getFilesystemStudyLoader };
