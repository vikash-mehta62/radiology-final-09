const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

/**
 * WebSocket Service for real-time communication
 * Handles notifications, session monitoring, and real-time updates
 */
class WebSocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> Set of socket IDs
    this.userSessions = new Map(); // socketId -> { userId, sessionId, connectedAt }
  }

  /**
   * Initialize Socket.IO server
   * @param {Object} httpServer - HTTP server instance
   * @param {Object} options - Configuration options
   */
  initialize(httpServer, options = {}) {
    const corsOrigins = options.corsOrigins || [
      'http://localhost:3010',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:3010',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000'
    ];

    this.io = new Server(httpServer, {
      cors: {
        origin: corsOrigins,
        methods: ['GET', 'POST'],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      transports: ['websocket', 'polling']
    });

    console.log('✅ Socket.IO server initialized with CORS origins:', corsOrigins);

    // Set up authentication middleware
    this.setupAuthentication();

    // Set up connection handlers
    this.setupConnectionHandlers();

    return this.io;
  }

  /**
   * Set up JWT authentication middleware for WebSocket connections
   */
  setupAuthentication() {
    this.io.use(async (socket, next) => {
      try {
        // Extract token from handshake auth or query
        const token = socket.handshake.auth.token || socket.handshake.query.token;

        if (!token) {
          console.warn('WebSocket connection rejected: No token provided');
          return next(new Error('Authentication token required'));
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded || !decoded.userId) {
          console.warn('WebSocket connection rejected: Invalid token');
          return next(new Error('Invalid authentication token'));
        }

        // Attach user info to socket
        socket.userId = decoded.userId;
        socket.sessionId = decoded.sessionId || null;
        socket.userRole = decoded.role || 'user';

        console.log(`✅ WebSocket authenticated: User ${decoded.userId}`);
        next();
      } catch (error) {
        console.error('WebSocket authentication error:', error.message);
        next(new Error('Authentication failed'));
      }
    });
  }

  /**
   * Set up connection and disconnection handlers
   */
  setupConnectionHandlers() {
    this.io.on('connection', (socket) => {
      const userId = socket.userId;
      const sessionId = socket.sessionId;

      console.log(`🔌 WebSocket connected: User ${userId}, Socket ${socket.id}`);

      // Track user connection
      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, new Set());
      }
      this.connectedUsers.get(userId).add(socket.id);

      // Track session info
      this.userSessions.set(socket.id, {
        userId,
        sessionId,
        connectedAt: new Date(),
        lastActivity: new Date()
      });

      // Join user-specific room
      socket.join(`user:${userId}`);

      // Join role-specific room if applicable
      if (socket.userRole) {
        socket.join(`role:${socket.userRole}`);
      }

      // Send connection confirmation
      socket.emit('connected', {
        socketId: socket.id,
        userId,
        timestamp: new Date()
      });

      // Handle activity tracking
      socket.on('activity', () => {
        const session = this.userSessions.get(socket.id);
        if (session) {
          session.lastActivity = new Date();
        }
      });

      // Handle notification acknowledgment
      socket.on('acknowledge_notification', (data) => {
        this.handleNotificationAcknowledgment(socket, data);
      });

      // Handle session extension request
      socket.on('extend_session', (data) => {
        this.handleSessionExtension(socket, data);
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        console.log(`🔌 WebSocket disconnected: User ${userId}, Socket ${socket.id}, Reason: ${reason}`);

        // Remove from connected users
        const userSockets = this.connectedUsers.get(userId);
        if (userSockets) {
          userSockets.delete(socket.id);
          if (userSockets.size === 0) {
            this.connectedUsers.delete(userId);
          }
        }

        // Remove session info
        this.userSessions.delete(socket.id);
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error(`WebSocket error for user ${userId}:`, error);
      });
    });
  }

  /**
   * Handle notification acknowledgment from client
   */
  handleNotificationAcknowledgment(socket, data) {
    const { notificationId, userId } = data;
    console.log(`Notification ${notificationId} acknowledged by user ${userId}`);

    // Emit acknowledgment confirmation
    socket.emit('notification_acknowledged', {
      notificationId,
      acknowledgedAt: new Date()
    });

    // Broadcast to other user sessions
    this.broadcastToUser(userId, 'notification_acknowledged', {
      notificationId,
      acknowledgedAt: new Date()
    }, socket.id);
  }

  /**
   * Handle session extension request
   */
  handleSessionExtension(socket, data) {
    const session = this.userSessions.get(socket.id);
    if (session) {
      session.lastActivity = new Date();
      socket.emit('session_extended', {
        sessionId: session.sessionId,
        extendedAt: new Date()
      });
    }
  }

  /**
   * Send notification to specific user
   * @param {String} userId - User ID
   * @param {Object} notification - Notification data
   */
  sendNotificationToUser(userId, notification) {
    if (!this.io) {
      console.warn('WebSocket service not initialized');
      return false;
    }

    const room = `user:${userId}`;
    this.io.to(room).emit('critical_notification', notification);

    console.log(`📢 Notification sent to user ${userId}:`, notification.id);
    return true;
  }

  /**
   * Broadcast notification to multiple users
   * @param {Array} userIds - Array of user IDs
   * @param {Object} notification - Notification data
   */
  broadcastNotification(userIds, notification) {
    if (!this.io) {
      console.warn('WebSocket service not initialized');
      return false;
    }

    userIds.forEach(userId => {
      this.sendNotificationToUser(userId, notification);
    });

    return true;
  }

  /**
   * Broadcast to all users in a role
   * @param {String} role - User role
   * @param {String} event - Event name
   * @param {Object} data - Event data
   */
  broadcastToRole(role, event, data) {
    if (!this.io) {
      console.warn('WebSocket service not initialized');
      return false;
    }

    const room = `role:${role}`;
    this.io.to(room).emit(event, data);

    console.log(`📢 Broadcast to role ${role}:`, event);
    return true;
  }

  /**
   * Broadcast to specific user (all their connections)
   * @param {String} userId - User ID
   * @param {String} event - Event name
   * @param {Object} data - Event data
   * @param {String} excludeSocketId - Socket ID to exclude from broadcast
   */
  broadcastToUser(userId, event, data, excludeSocketId = null) {
    if (!this.io) {
      console.warn('WebSocket service not initialized');
      return false;
    }

    const userSockets = this.connectedUsers.get(userId);
    if (!userSockets || userSockets.size === 0) {
      return false;
    }

    userSockets.forEach(socketId => {
      if (socketId !== excludeSocketId) {
        this.io.to(socketId).emit(event, data);
      }
    });

    return true;
  }

  /**
   * Send session timeout warning to user
   * @param {String} userId - User ID
   * @param {Object} warningData - Warning data (timeRemaining, etc.)
   */
  sendSessionTimeoutWarning(userId, warningData) {
    if (!this.io) {
      console.warn('WebSocket service not initialized');
      return false;
    }

    this.broadcastToUser(userId, 'session_timeout_warning', {
      ...warningData,
      timestamp: new Date()
    });

    console.log(`⚠️  Session timeout warning sent to user ${userId}`);
    return true;
  }

  /**
   * Send session expired notification to user
   * @param {String} userId - User ID
   * @param {String} sessionId - Session ID
   */
  sendSessionExpired(userId, sessionId) {
    if (!this.io) {
      console.warn('WebSocket service not initialized');
      return false;
    }

    this.broadcastToUser(userId, 'session_expired', {
      sessionId,
      timestamp: new Date()
    });

    console.log(`🔒 Session expired notification sent to user ${userId}`);
    return true;
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  /**
   * Get user connection status
   * @param {String} userId - User ID
   */
  isUserConnected(userId) {
    const userSockets = this.connectedUsers.get(userId);
    return userSockets && userSockets.size > 0;
  }

  /**
   * Get all connected users
   */
  getConnectedUsers() {
    return Array.from(this.connectedUsers.keys());
  }

  /**
   * Get user session info
   * @param {String} userId - User ID
   */
  getUserSessions(userId) {
    const sessions = [];
    this.userSessions.forEach((session, socketId) => {
      if (session.userId === userId) {
        sessions.push({
          socketId,
          ...session
        });
      }
    });
    return sessions;
  }

  /**
   * Disconnect user (all their connections)
   * @param {String} userId - User ID
   * @param {String} reason - Disconnect reason
   */
  disconnectUser(userId, reason = 'Server initiated disconnect') {
    if (!this.io) {
      console.warn('WebSocket service not initialized');
      return false;
    }

    const userSockets = this.connectedUsers.get(userId);
    if (!userSockets || userSockets.size === 0) {
      return false;
    }

    userSockets.forEach(socketId => {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.disconnect(true);
      }
    });

    console.log(`🔌 User ${userId} disconnected: ${reason}`);
    return true;
  }

  /**
   * Get Socket.IO instance
   */
  getIO() {
    return this.io;
  }
}

// Singleton instance
let websocketServiceInstance = null;

/**
 * Get WebSocket service instance
 */
function getWebSocketService() {
  if (!websocketServiceInstance) {
    websocketServiceInstance = new WebSocketService();
  }
  return websocketServiceInstance;
}

module.exports = {
  WebSocketService,
  getWebSocketService
};
