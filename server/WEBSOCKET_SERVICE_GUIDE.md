# WebSocket Service Guide

## Overview

The WebSocket service provides real-time bidirectional communication between the server and clients using Socket.IO. It supports critical notifications, session monitoring, and real-time updates.

## Features

### ✅ Implemented Features

1. **JWT Authentication** - Secure WebSocket connections with JWT token verification
2. **User Session Tracking** - Track connected users and their sessions
3. **Room-Based Broadcasting** - Send messages to specific users or roles
4. **Notification Delivery** - Real-time critical notification delivery
5. **Session Monitoring** - Monitor session status and send timeout warnings
6. **Connection Management** - Handle connections, disconnections, and errors
7. **Activity Tracking** - Track user activity for session management

## Architecture

### Service Structure

```
WebSocketService
├── initialize()              - Initialize Socket.IO server
├── setupAuthentication()     - Set up JWT authentication
├── setupConnectionHandlers() - Handle connections/disconnections
├── sendNotificationToUser()  - Send notification to specific user
├── broadcastNotification()   - Broadcast to multiple users
├── broadcastToRole()         - Broadcast to users with specific role
├── sendSessionTimeoutWarning() - Send session timeout warning
├── sendSessionExpired()      - Notify user of session expiration
└── disconnectUser()          - Disconnect user from WebSocket
```

## Installation

The WebSocket service is automatically initialized when the server starts. Socket.IO is installed as a dependency:

```bash
npm install socket.io
```

## Configuration

### Server-Side Configuration

The WebSocket service is initialized in `server/src/index.js`:

```javascript
const { getWebSocketService } = require('./services/websocket-service');
const websocketService = getWebSocketService();

websocketService.initialize(httpServer, {
  corsOrigins: [
    'http://localhost:3010',
    'http://localhost:5173',
    'http://localhost:3000'
  ]
});
```

### Environment Variables

No additional environment variables are required. The service uses the existing `JWT_SECRET` for authentication.

## Client-Side Integration

### Basic Connection

```typescript
import { io } from 'socket.io-client';

// Get JWT token from auth context
const token = localStorage.getItem('accessToken');

// Connect to WebSocket server
const socket = io('http://3.144.196.75:8001', {
  auth: {
    token: token
  },
  transports: ['websocket', 'polling']
});

// Handle connection
socket.on('connected', (data) => {
  console.log('Connected to WebSocket:', data);
});

// Handle disconnection
socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});
```

### Listening for Events

```typescript
// Listen for critical notifications
socket.on('critical_notification', (notification) => {
  console.log('Received notification:', notification);
  // Show notification to user
  showNotification(notification);
});

// Listen for session timeout warnings
socket.on('session_timeout_warning', (data) => {
  console.log('Session expiring soon:', data);
  // Show warning dialog
  showSessionWarning(data.timeRemaining);
});

// Listen for session expiration
socket.on('session_expired', (data) => {
  console.log('Session expired:', data);
  // Redirect to login
  window.location.href = '/login';
});
```

### Emitting Events

```typescript
// Send activity ping
socket.emit('activity');

// Acknowledge notification
socket.emit('acknowledge_notification', {
  notificationId: 'notification-123',
  userId: 'user-456'
});

// Request session extension
socket.emit('extend_session', {
  sessionId: 'session-789'
});
```

## Server-Side Usage

### Sending Notifications

```javascript
const { getWebSocketService } = require('./services/websocket-service');
const websocketService = getWebSocketService();

// Send notification to specific user
websocketService.sendNotificationToUser('user-123', {
  id: 'notification-456',
  type: 'critical_finding',
  severity: 'critical',
  title: 'Critical Finding Detected',
  message: 'Urgent review required',
  patientId: 'patient-789',
  studyId: 'study-012'
});

// Broadcast to multiple users
websocketService.broadcastNotification(['user-1', 'user-2', 'user-3'], notification);

// Broadcast to all radiologists
websocketService.broadcastToRole('radiologist', 'system_alert', {
  message: 'System maintenance in 10 minutes'
});
```

### Session Monitoring

```javascript
// Send session timeout warning
websocketService.sendSessionTimeoutWarning('user-123', {
  timeRemaining: 300000, // 5 minutes in milliseconds
  sessionId: 'session-456'
});

// Notify session expiration
websocketService.sendSessionExpired('user-123', 'session-456');

// Disconnect user
websocketService.disconnectUser('user-123', 'Session expired');
```

### Checking Connection Status

```javascript
// Check if user is connected
const isConnected = websocketService.isUserConnected('user-123');

// Get connected users count
const count = websocketService.getConnectedUsersCount();

// Get all connected users
const users = websocketService.getConnectedUsers();

// Get user's active sessions
const sessions = websocketService.getUserSessions('user-123');
```

## Events Reference

### Server → Client Events

| Event | Description | Data |
|-------|-------------|------|
| `connected` | Connection established | `{ socketId, userId, timestamp }` |
| `critical_notification` | Critical notification received | `CriticalNotification` object |
| `notification_acknowledged` | Notification acknowledged | `{ notificationId, acknowledgedAt }` |
| `session_timeout_warning` | Session expiring soon | `{ timeRemaining, sessionId, timestamp }` |
| `session_expired` | Session has expired | `{ sessionId, timestamp }` |
| `session_extended` | Session extended successfully | `{ sessionId, extendedAt }` |

### Client → Server Events

| Event | Description | Data |
|-------|-------------|------|
| `activity` | User activity ping | None |
| `acknowledge_notification` | Acknowledge notification | `{ notificationId, userId }` |
| `extend_session` | Request session extension | `{ sessionId }` |

## Authentication

### JWT Token Verification

The WebSocket service verifies JWT tokens on connection:

1. Client sends token in `auth.token` or `query.token`
2. Server verifies token using `JWT_SECRET`
3. User info is attached to socket: `userId`, `sessionId`, `userRole`
4. User joins room: `user:{userId}` and `role:{userRole}`

### Token Format

```javascript
{
  userId: 'user-123',
  sessionId: 'session-456',
  role: 'radiologist',
  iat: 1234567890,
  exp: 1234569890
}
```

## Room Management

### User Rooms

Each connected user automatically joins:
- `user:{userId}` - User-specific room for targeted messages
- `role:{userRole}` - Role-specific room for broadcasts

### Broadcasting Strategies

1. **To Specific User** - All user's connections receive the message
2. **To Role** - All users with that role receive the message
3. **To All** - Broadcast to all connected clients

## Error Handling

### Connection Errors

```javascript
socket.on('error', (error) => {
  console.error('WebSocket error:', error);
  // Handle error (retry, show message, etc.)
});
```

### Authentication Errors

If authentication fails, the connection is rejected with an error:
- `Authentication token required`
- `Invalid authentication token`
- `Authentication failed`

## Performance Considerations

### Connection Limits

- No hard limit on connections per user
- Each user can have multiple connections (multiple tabs/devices)
- Connections are tracked in memory using Maps

### Ping/Pong

- Ping interval: 25 seconds
- Ping timeout: 60 seconds
- Automatic reconnection on disconnect

### Memory Usage

- Connected users: `Map<userId, Set<socketId>>`
- User sessions: `Map<socketId, sessionInfo>`
- Minimal memory footprint per connection

## Testing

### Run Tests

```bash
node server/test-websocket-service.js
```

### Test Coverage

- ✅ Service initialization
- ✅ Singleton pattern
- ✅ Method existence
- ✅ Initial state
- ✅ HTTP server integration

### Manual Testing

Use a WebSocket client like [Socket.IO Client Tool](https://amritb.github.io/socketio-client-tool/) to test connections.

## Troubleshooting

### Connection Refused

**Problem**: Client cannot connect to WebSocket server

**Solutions**:
1. Verify server is running
2. Check CORS configuration
3. Verify JWT token is valid
4. Check firewall settings

### Authentication Failed

**Problem**: Connection rejected with authentication error

**Solutions**:
1. Verify JWT token is included in connection
2. Check token expiration
3. Verify `JWT_SECRET` matches between client and server
4. Check token format

### Messages Not Received

**Problem**: Client not receiving messages

**Solutions**:
1. Verify user is connected: `websocketService.isUserConnected(userId)`
2. Check event name matches
3. Verify user is in correct room
4. Check browser console for errors

## Security

### Best Practices

1. **Always use JWT authentication** - Never allow unauthenticated connections
2. **Validate all incoming data** - Sanitize and validate client messages
3. **Use HTTPS in production** - Encrypt WebSocket traffic with WSS
4. **Implement rate limiting** - Prevent abuse of WebSocket events
5. **Log security events** - Track authentication failures and suspicious activity

### CORS Configuration

CORS is configured to allow specific origins:
- `http://localhost:3010`
- `http://localhost:5173`
- `http://localhost:3000`

Update `corsOrigins` in production to match your domain.

## Integration with Other Services

### Notification Service

```javascript
// In notification-service.js
const { getWebSocketService } = require('./websocket-service');

async function sendCriticalNotification(notification) {
  // ... create notification in database
  
  // Send via WebSocket
  const websocketService = getWebSocketService();
  websocketService.sendNotificationToUser(notification.userId, notification);
}
```

### Session Service

```javascript
// In session-service.js
const { getWebSocketService } = require('./websocket-service');

async function sendTimeoutWarning(userId, sessionId, timeRemaining) {
  const websocketService = getWebSocketService();
  websocketService.sendSessionTimeoutWarning(userId, {
    sessionId,
    timeRemaining
  });
}
```

## Future Enhancements

### Planned Features

- [ ] Redis adapter for horizontal scaling
- [ ] Message persistence and replay
- [ ] Typing indicators for collaborative editing
- [ ] Presence detection (online/offline status)
- [ ] File transfer support
- [ ] Video/audio streaming

## Support

For issues or questions:
1. Check this documentation
2. Review the source code: `server/src/services/websocket-service.js`
3. Run tests: `node server/test-websocket-service.js`
4. Check server logs for errors

## License

Part of the DICOM PACS system - Internal use only
