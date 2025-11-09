// Unified Viewer Controller - Shows both Orthanc + Database data
const unifiedViewerService = require('../services/unified-viewer-service');

class UnifiedViewController {
  
  // Get all studies from both sources
  async getAllStudies(req, res) {
    try {
      const studies = await unifiedViewerService.getAllStudies();
      
      res.json({
        success: true,
        count: studies.length,
        studies: studies,
        sources: {
          orthanc: studies.filter(s => s.hasOrthancData).length,
          database: studies.filter(s => s.hasDatabaseData).length,
          both: studies.filter(s => s.source === 'both').length
        }
      });
    } catch (error) {
      console.error('Error in getAllStudies:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch studies',
        message: error.message
      });
    }
  }
  
  // Search studies across both sources
  async searchStudies(req, res) {
    try {
      const { q } = req.query;
      
      if (!q) {
        return res.status(400).json({
          success: false,
          error: 'Search query required'
        });
      }
      
      const studies = await unifiedViewerService.searchStudies(q);
      
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
  
  // Get study details
  async getStudy(req, res) {
    try {
      const { studyId } = req.params;
      const { source } = req.query; // Optional: 'orthanc', 'database', or 'auto'
      
      const study = await unifiedViewerService.getStudyDetails(studyId, source || 'auto');
      
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
  
  // Get statistics
  async getStats(req, res) {
    try {
      const stats = await unifiedViewerService.getStatistics();
      
      res.json({
        success: true,
        statistics: stats
      });
    } catch (error) {
      console.error('Error in getStats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch statistics',
        message: error.message
      });
    }
  }
}

module.exports = new UnifiedViewController();
