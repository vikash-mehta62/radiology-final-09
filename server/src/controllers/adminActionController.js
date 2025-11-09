const AdminActionLogger = require('../services/admin-action-logger');

class AdminActionController {
  constructor() {
    this.adminLogger = new AdminActionLogger();
  }

  // Get action reports
  getActionReport = async (req, res) => {
    try {
      const filters = {
        userId: req.query.userId,
        action: req.query.action,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        limit: parseInt(req.query.limit) || 100,
        offset: parseInt(req.query.offset) || 0
      };

      const actions = await this.adminLogger.getActionReport(filters);
      
      // Apply pagination
      const paginatedActions = actions.slice(filters.offset, filters.offset + filters.limit);
      
      res.json({
        success: true,
        actions: paginatedActions,
        total: actions.length,
        filters,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          hasMore: actions.length > (filters.offset + filters.limit)
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get action report' });
    }
  };

  // Get user action summary
  getUserActionSummary = async (req, res) => {
    try {
      const { userId } = req.params;
      const timeRange = req.query.timeRange || '24h';
      
      const summary = await this.adminLogger.getUserActionSummary(userId, timeRange);
      
      res.json({
        success: true,
        summary
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get user action summary' });
    }
  };

  // Get current user's action summary
  getCurrentUserActionSummary = async (req, res) => {
    try {
      const timeRange = req.query.timeRange || '24h';
      
      const summary = await this.adminLogger.getUserActionSummary(req.user.id, timeRange);
      
      res.json({
        success: true,
        summary
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get user action summary' });
    }
  };

  // Get active sessions
  getActiveSessions = async (req, res) => {
    try {
      const sessions = Array.from(this.adminLogger.sessions.values()).map(session => ({
        sessionId: session.sessionId,
        userId: session.userId,
        username: session.username,
        ipAddress: session.ipAddress,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        actionsCount: session.actions.length,
        userAgent: session.userAgent
      }));

      res.json({
        success: true,
        sessions,
        total: sessions.length
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get active sessions' });
    }
  };

  // End a session (admin only)
  endSession = async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      this.adminLogger.endSession(sessionId, req);
      
      res.json({
        success: true,
        message: 'Session ended successfully'
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to end session' });
    }
  };

  // Export audit trail
  exportAuditTrail = async (req, res) => {
    try {
      const filters = {
        userId: req.query.userId,
        action: req.query.action,
        startDate: req.query.startDate,
        endDate: req.query.endDate
      };

      const actions = await this.adminLogger.getActionReport(filters);
      
      // Log the export action
      this.adminLogger.logAction('audit_export', {
        exportedRecords: actions.length,
        filters,
        exportedBy: req.user.id
      }, req);

      // Set headers for file download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="audit-trail-${new Date().toISOString().split('T')[0]}.json"`);
      
      res.json({
        exportInfo: {
          exportedAt: new Date().toISOString(),
          exportedBy: {
            id: req.user.id,
            username: req.user.username
          },
          filters,
          recordCount: actions.length
        },
        actions
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to export audit trail' });
    }
  };

  // Get action statistics
  getActionStatistics = async (req, res) => {
    try {
      const timeRange = req.query.timeRange || '24h';
      const actions = await this.adminLogger.getActionReport({});
      
      // Calculate cutoff time
      const cutoffTime = new Date();
      switch (timeRange) {
        case '1h':
          cutoffTime.setHours(cutoffTime.getHours() - 1);
          break;
        case '24h':
          cutoffTime.setDate(cutoffTime.getDate() - 1);
          break;
        case '7d':
          cutoffTime.setDate(cutoffTime.getDate() - 7);
          break;
        case '30d':
          cutoffTime.setDate(cutoffTime.getDate() - 30);
          break;
      }

      const recentActions = actions.filter(a => a.timestamp >= cutoffTime);
      
      // Calculate statistics
      const stats = {
        timeRange,
        totalActions: recentActions.length,
        uniqueUsers: new Set(recentActions.map(a => a.userId)).size,
        actionsByCategory: {},
        actionsBySeverity: { high: 0, medium: 0, low: 0 },
        actionsByHour: {},
        topUsers: {},
        topActions: {}
      };

      recentActions.forEach(action => {
        const category = this.adminLogger.categorizeAction(action.action);
        const severity = this.adminLogger.getSeverity(action.action);
        const hour = new Date(action.timestamp).getHours();
        
        // By category
        stats.actionsByCategory[category] = (stats.actionsByCategory[category] || 0) + 1;
        
        // By severity
        stats.actionsBySeverity[severity]++;
        
        // By hour
        stats.actionsByHour[hour] = (stats.actionsByHour[hour] || 0) + 1;
        
        // Top users
        stats.topUsers[action.userId] = (stats.topUsers[action.userId] || 0) + 1;
        
        // Top actions
        stats.topActions[action.action] = (stats.topActions[action.action] || 0) + 1;
      });

      // Convert to sorted arrays for top users and actions
      stats.topUsers = Object.entries(stats.topUsers)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([userId, count]) => ({ userId, count }));
        
      stats.topActions = Object.entries(stats.topActions)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([action, count]) => ({ action, count }));

      res.json({
        success: true,
        statistics: stats
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get action statistics' });
    }
  };

  // Get admin logger instance for middleware
  getAdminLogger() {
    return this.adminLogger;
  }
}

module.exports = new AdminActionController();