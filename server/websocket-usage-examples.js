/**
 * WebSocket Service Usage Examples
 * 
 * This file demonstrates how to use the WebSocket service
 * in various scenarios throughout the application.
 */

const { getWebSocketService } = require('./src/services/websocket-service');

// ============================================================================
// Example 1: Sending Critical Notifications
// ============================================================================

async function sendCriticalFindingNotification(userId, finding) {
  const websocketService = getWebSocketService();
  
  const notification = {
    id: `notification-${Date.now()}`,
    type: 'critical_finding',
    severity: 'critical',
    title: 'Critical Finding Detected',
    message: `Critical finding in ${finding.location}`,
    patientId: finding.patientId,
    studyId: finding.studyId,
    findingDetails: {
      location: finding.location,
      description: finding.description,
      urgency: 'immediate'
    },
    timestamp: new Date()
  };
  
  // Send to specific user
  websocketService.sendNotificationToUser(userId, notification);
  
  console.log(`✅ Critical notification sent to user ${userId}`);
}

// ============================================================================
// Example 2: Broadcasting to Multiple Users
// ============================================================================

async function notifyRadiologyTeam(notification) {
  const websocketService = getWebSocketService();
  
  // Get all radiologists (this would come from your user service)
  const radiologistIds = ['user-1', 'user-2', 'user-3'];
  
  // Broadcast to all radiologists
  websocketService.broadcastNotification(radiologistIds, notification);
  
  console.log(`✅ Notification broadcast to ${radiologistIds.length} radiologists`);
}

// ============================================================================
// Example 3: Role-Based Broadcasting
// ============================================================================

async function sendSystemAlert(message) {
  const websocketService = getWebSocketService();
  
  const alert = {
    type: 'system_alert',
    severity: 'high',
    message: message,
    timestamp: new Date()
  };
  
  // Send to all users with 'admin' role
  websocketService.broadcastToRole('admin', 'system_alert', alert);
  
  // Also send to all radiologists
  websocketService.broadcastToRole('radiologist', 'system_alert', alert);
  
  console.log('✅ System alert broadcast to admins and radiologists');
}

// ============================================================================
// Example 4: Session Timeout Warning
// ============================================================================

async function sendSessionWarning(userId, sessionId, minutesRemaining) {
  const websocketService = getWebSocketService();
  
  const timeRemaining = minutesRemaining * 60 * 1000; // Convert to milliseconds
  
  websocketService.sendSessionTimeoutWarning(userId, {
    sessionId,
    timeRemaining,
    message: `Your session will expire in ${minutesRemaining} minutes`
  });
  
  console.log(`✅ Session warning sent to user ${userId}`);
}

// ============================================================================
// Example 5: Session Expiration
// ============================================================================

async function handleSessionExpiration(userId, sessionId) {
  const websocketService = getWebSocketService();
  
  // Notify user of expiration
  websocketService.sendSessionExpired(userId, sessionId);
  
  // Disconnect user after a short delay
  setTimeout(() => {
    websocketService.disconnectUser(userId, 'Session expired');
  }, 5000); // 5 second grace period
  
  console.log(`✅ Session expiration handled for user ${userId}`);
}

// ============================================================================
// Example 6: Checking Connection Status
// ============================================================================

async function checkUserStatus(userId) {
  const websocketService = getWebSocketService();
  
  // Check if user is connected
  const isConnected = websocketService.isUserConnected(userId);
  console.log(`User ${userId} connected: ${isConnected}`);
  
  if (isConnected) {
    // Get user's active sessions
    const sessions = websocketService.getUserSessions(userId);
    console.log(`User has ${sessions.length} active WebSocket connections`);
    
    sessions.forEach(session => {
      console.log(`  - Socket ${session.socketId}`);
      console.log(`    Connected at: ${session.connectedAt}`);
      console.log(`    Last activity: ${session.lastActivity}`);
    });
  }
}

// ============================================================================
// Example 7: Integration with Notification Service
// ============================================================================

class NotificationService {
  constructor() {
    this.websocketService = getWebSocketService();
  }
  
  async sendCriticalNotification(notification) {
    // Save to database
    // await this.saveNotificationToDatabase(notification);
    
    // Send via WebSocket to all recipients
    notification.recipients.forEach(recipient => {
      this.websocketService.sendNotificationToUser(recipient.userId, notification);
    });
    
    // Start escalation timer if needed
    if (notification.severity === 'critical') {
      this.startEscalationTimer(notification);
    }
    
    console.log(`✅ Critical notification sent to ${notification.recipients.length} recipients`);
  }
  
  startEscalationTimer(notification) {
    // Escalate after 15 minutes if not acknowledged
    setTimeout(() => {
      this.escalateNotification(notification);
    }, 15 * 60 * 1000);
  }
  
  escalateNotification(notification) {
    // Send to supervisor
    const supervisorNotification = {
      ...notification,
      escalationLevel: (notification.escalationLevel || 0) + 1,
      message: `ESCALATED: ${notification.message}`
    };
    
    this.websocketService.broadcastToRole('supervisor', 'critical_notification', supervisorNotification);
  }
}

// ============================================================================
// Example 8: Integration with Session Service
// ============================================================================

class SessionService {
  constructor() {
    this.websocketService = getWebSocketService();
    this.SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
    this.WARNING_TIME = 5 * 60 * 1000; // 5 minutes
  }
  
  startSessionMonitoring(userId, sessionId) {
    // Send warning 5 minutes before expiration
    const warningTimeout = this.SESSION_TIMEOUT - this.WARNING_TIME;
    
    setTimeout(() => {
      this.websocketService.sendSessionTimeoutWarning(userId, {
        sessionId,
        timeRemaining: this.WARNING_TIME
      });
    }, warningTimeout);
    
    // Expire session after timeout
    setTimeout(() => {
      this.expireSession(userId, sessionId);
    }, this.SESSION_TIMEOUT);
  }
  
  expireSession(userId, sessionId) {
    // Update session in database
    // await this.updateSessionStatus(sessionId, 'expired');
    
    // Notify user via WebSocket
    this.websocketService.sendSessionExpired(userId, sessionId);
    
    // Disconnect user
    this.websocketService.disconnectUser(userId, 'Session expired');
  }
}

// ============================================================================
// Example 9: Real-time Study Updates
// ============================================================================

async function notifyStudyUpdate(studyId, updateType, data) {
  const websocketService = getWebSocketService();
  
  // Get users who have access to this study
  // const authorizedUsers = await getAuthorizedUsers(studyId);
  const authorizedUsers = ['user-1', 'user-2'];
  
  const update = {
    type: 'study_update',
    studyId,
    updateType, // 'new_image', 'report_updated', 'status_changed'
    data,
    timestamp: new Date()
  };
  
  // Broadcast to authorized users
  websocketService.broadcastNotification(authorizedUsers, update);
  
  console.log(`✅ Study update broadcast to ${authorizedUsers.length} users`);
}

// ============================================================================
// Example 10: Admin Actions
// ============================================================================

async function notifyUserAction(targetUserId, action, adminId) {
  const websocketService = getWebSocketService();
  
  const notification = {
    type: 'admin_action',
    action, // 'account_suspended', 'permissions_changed', etc.
    message: `Your account has been ${action}`,
    timestamp: new Date()
  };
  
  // Notify the affected user
  websocketService.sendNotificationToUser(targetUserId, notification);
  
  // If it's a suspension, disconnect them
  if (action === 'account_suspended') {
    setTimeout(() => {
      websocketService.disconnectUser(targetUserId, 'Account suspended');
    }, 3000);
  }
  
  console.log(`✅ User ${targetUserId} notified of admin action: ${action}`);
}

// ============================================================================
// Example 11: Monitoring Connected Users
// ============================================================================

function monitorConnections() {
  const websocketService = getWebSocketService();
  
  setInterval(() => {
    const count = websocketService.getConnectedUsersCount();
    const users = websocketService.getConnectedUsers();
    
    console.log(`📊 WebSocket Status:`);
    console.log(`   Connected users: ${count}`);
    console.log(`   User IDs: ${users.join(', ')}`);
    
    // Log detailed session info
    users.forEach(userId => {
      const sessions = websocketService.getUserSessions(userId);
      console.log(`   ${userId}: ${sessions.length} connections`);
    });
  }, 60000); // Every minute
}

// ============================================================================
// Example 12: Graceful Shutdown
// ============================================================================

async function gracefulShutdown() {
  const websocketService = getWebSocketService();
  
  // Notify all connected users
  const users = websocketService.getConnectedUsers();
  
  const shutdownNotification = {
    type: 'system_shutdown',
    message: 'Server is shutting down for maintenance',
    timestamp: new Date()
  };
  
  users.forEach(userId => {
    websocketService.sendNotificationToUser(userId, shutdownNotification);
  });
  
  // Wait a bit for messages to be delivered
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Disconnect all users
  users.forEach(userId => {
    websocketService.disconnectUser(userId, 'Server shutdown');
  });
  
  console.log('✅ All users notified and disconnected');
}

// ============================================================================
// Export examples for use in other modules
// ============================================================================

module.exports = {
  sendCriticalFindingNotification,
  notifyRadiologyTeam,
  sendSystemAlert,
  sendSessionWarning,
  handleSessionExpiration,
  checkUserStatus,
  NotificationService,
  SessionService,
  notifyStudyUpdate,
  notifyUserAction,
  monitorConnections,
  gracefulShutdown
};

// ============================================================================
// Usage in Express Routes
// ============================================================================

/*
// In your route handler:
const express = require('express');
const router = express.Router();
const { getWebSocketService } = require('../services/websocket-service');

router.post('/api/notifications/send', async (req, res) => {
  try {
    const { userId, notification } = req.body;
    
    const websocketService = getWebSocketService();
    const sent = websocketService.sendNotificationToUser(userId, notification);
    
    if (sent) {
      res.json({ success: true, message: 'Notification sent' });
    } else {
      res.status(400).json({ success: false, message: 'User not connected' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
*/
