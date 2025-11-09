// Orthanc Viewer Controller - API endpoints for UI
const orthancViewerService = require('../services/orthanc-viewer-service');

class OrthancViewController {
  
  // Get all studies
  async getAllStudies(req, res) {
    try {
      const studies = await orthancViewerService.getAllStudies();
      
      res.json({
        success: true,
        count: studies.length,
        studies: studies
      });
    } catch (error) {
      console.error('Error in getAllStudies:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch studies from Orthanc',
        message: error.message
      });
    }
  }
  
  // Get study details
  async getStudy(req, res) {
    try {
      const { studyId } = req.params;
      const study = await orthancViewerService.getStudyComplete(studyId);
      
      if (!study) {
        return res.status(404).json({
          success: false,
          error: 'Study not found'
        });
      }
      
      res.json({
        success: true,
        study: study
      });
    } catch (error) {
      console.error('Error in getStudy:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch study details',
        message: error.message
      });
    }
  }
  
  // Get series details
  async getSeries(req, res) {
    try {
      const { seriesId } = req.params;
      const series = await orthancViewerService.getSeriesDetails(seriesId);
      
      if (!series) {
        return res.status(404).json({
          success: false,
          error: 'Series not found'
        });
      }
      
      res.json({
        success: true,
        series: series
      });
    } catch (error) {
      console.error('Error in getSeries:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch series details',
        message: error.message
      });
    }
  }
  
  // Search studies
  async searchStudies(req, res) {
    try {
      const { q } = req.query;
      
      if (!q) {
        return res.status(400).json({
          success: false,
          error: 'Search query required'
        });
      }
      
      const studies = await orthancViewerService.searchStudies(q);
      
      res.json({
        success: true,
        count: studies.length,
        query: q,
        studies: studies
      });
    } catch (error) {
      console.error('Error in searchStudies:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search studies',
        message: error.message
      });
    }
  }
  
  // Get Orthanc statistics
  async getStats(req, res) {
    try {
      const [systemInfo, statistics] = await Promise.all([
        orthancViewerService.getSystemInfo(),
        orthancViewerService.getStatistics()
      ]);
      
      res.json({
        success: true,
        system: systemInfo,
        statistics: statistics
      });
    } catch (error) {
      console.error('Error in getStats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch Orthanc statistics',
        message: error.message
      });
    }
  }
}

module.exports = new OrthancViewController();
