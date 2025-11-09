# WebSocket Client Integration

## Overview

This document describes the WebSocket client integration implemented for real-time features in the medical imaging viewer application.

## Implementation Summary

### 1. WebSocket Context (`viewer/src/contexts/WebSocketContext.tsx`)

**Purpose**: Provides centralized WebSocket connection management for the entire application.

**Features**:
- Automatic connection/reconnection with exponential backoff
- Authentication token integration
- Connection state management (connected, reconnecting, error)
- Configurable auto-connect behavior
- Automatic reconnection on token changes
- Maximum reconnection attempts (10) with 3-second delay
- Support for both WebSocket and polling transports

**Usage**:
```typescript
import { WebSocketProvider } from './contexts/WebSocketContext';

<WebSocketProvider autoConnect={isAuthenticated}>
  {/* Your app components */}
</WebSocketProvider>
```

### 2. WebSocket Hook (`viewer/src/hooks/useWebSocket.ts`)

**Purpose**: Provides easy-to-use interface for interacting with WebSocket connections.

**Features**:
- Simple event emission and listening
- Automatic cleanup of event listeners
- Connection status tracking
- Helper hooks for common patterns:
  - `useWebSocketEvent`: Listen for specific events with automatic cleanup
  - `useWebSocketEmit`: Emit events with automatic retry
  - `useWebSocketRequest`: Request-response pattern with timeout

**Usage**:
```typescript
import { useWebSocket } from './hooks/useWebSocket';

const { socket, isConnected, emit, on, off } = useWebSocket();

// Emit an event
emit('my_event', { data: 'value' });

// Listen for events
useEffect(() => {
  const handler = (data) => console.log('Received:', data);
  on('server_event', handler);
  return () => off('server_event', handler);
}, [on, off]);
```

### 3. Updated Notifications Hook (`viewer/src/hooks/useNotifications.ts`)

**Purpose**: Manages notification state with real-time WebSocket updates.

**Changes**:
- Removed custom WebSocket connection logic
- Now uses centralized WebSocket context via `useWebSocket` hook
- Listens for real-time notification events:
  - `critical_notification`: New critical notifications
  - `notification_acknowledged`: Acknowledgment updates
  - `notification_escalated`: Escalation updates
- Automatic cleanup of event listeners
- Browser notification support
- Sound alerts for critical notifications

**Real-time Events**:
```typescript
// Server → Client events
socket.on('critical_notification', (data) => {
  // Handle new critical notification
});

socket.on('notification_acknowledged', (data) => {
  // Update notification status
});

socket.on('notification_escalated', (data) => {
  // Update escalation level
});
```

### 4. App Integration (`viewer/src/App.tsx`)

**Changes**:
- Wrapped application with `WebSocketProvider`
- Auto-connect enabled only when user is authenticated
- WebSocket connection lifecycle tied to authentication state

**Structure**:
```typescript
<WorkflowProvider>
  <AppProvider>
    <WebSocketProvider autoConnect={isAuthenticated}>
      {/* App routes and components */}
    </WebSocketProvider>
  </AppProvider>
</WorkflowProvider>
```

## Configuration

### Environment Variables

Add to `viewer/.env`:
```env
# WebSocket URL (optional, defaults to API URL or current host)
VITE_WS_URL=http://localhost:8001

# API URL (used as fallback for WebSocket URL)
VITE_API_URL=http://localhost:8001/api
```

### Server Configuration

The WebSocket server should be configured with:
- Path: `/socket.io`
- Transports: `['websocket', 'polling']`
- Authentication via JWT token in `auth.token`
- CORS enabled for frontend origin

## Event Protocol

### Client → Server Events

```typescript
// Authentication (automatic on connect)
socket.emit('auth', { token: 'jwt_token' });

// Acknowledge notification
socket.emit('acknowledge_notification', { notificationId: 'xxx' });

// Request data
socket.emit('get_notifications', {}, (response) => {
  console.log('Notifications:', response);
});
```

### Server → Client Events

```typescript
// Authentication response
socket.on('authenticated', () => {});
socket.on('unauthorized', (message) => {});

// Critical notification
socket.on('critical_notification', (data) => {
  // data.notification: CriticalNotification object
});

// Notification acknowledged
socket.on('notification_acknowledged', (data) => {
  // data.notificationId: string
  // data.userId: string
  // data.acknowledgedAt: string (ISO date)
});

// Notification escalated
socket.on('notification_escalated', (data) => {
  // data.notificationId: string
  // data.escalationLevel: number
});

// Session timeout warning
socket.on('session_timeout_warning', (data) => {
  // data.timeRemaining: number (milliseconds)
});

// Session expired
socket.on('session_expired', () => {});
```

## Error Handling

### Connection Errors

The WebSocket context handles various error scenarios:
- **Connection failure**: Automatic retry with exponential backoff
- **Authentication failure**: Disconnect and show error
- **Network issues**: Automatic reconnection
- **Server disconnect**: Manual reconnection required

### Error States

```typescript
const { error, reconnecting, isConnected } = useWebSocket();

if (error) {
  // Show error message to user
}

if (reconnecting) {
  // Show reconnecting indicator
}

if (!isConnected) {
  // Show offline mode or disable real-time features
}
```

## Testing

### Manual Testing

1. **Connection Test**:
   - Open browser console
   - Check for "WebSocket connected" message
   - Verify socket ID is logged

2. **Reconnection Test**:
   - Stop the server
   - Verify "WebSocket disconnected" message
   - Start the server
   - Verify automatic reconnection

3. **Authentication Test**:
   - Login to application
   - Verify WebSocket connects automatically
   - Logout
   - Verify WebSocket disconnects

4. **Real-time Notifications**:
   - Trigger a critical notification from server
   - Verify notification appears in UI
   - Verify sound plays (if enabled)
   - Verify browser notification shows (if permitted)

### Integration Testing

```typescript
// Test WebSocket connection
describe('WebSocket Integration', () => {
  it('should connect when authenticated', () => {
    const { result } = renderHook(() => useWebSocket(), {
      wrapper: WebSocketProvider,
    });
    
    expect(result.current.isConnected).toBe(true);
  });
  
  it('should receive real-time notifications', async () => {
    const { result } = renderHook(() => useNotifications());
    
    // Simulate server event
    act(() => {
      socket.emit('critical_notification', mockNotification);
    });
    
    await waitFor(() => {
      expect(result.current.notifications).toHaveLength(1);
    });
  });
});
```

## Performance Considerations

### Connection Management
- Single WebSocket connection shared across entire app
- Automatic reconnection prevents connection storms
- Exponential backoff reduces server load during outages

### Event Handling
- Event listeners automatically cleaned up on unmount
- Debounced event handlers for high-frequency events
- Efficient state updates using React hooks

### Memory Management
- Listener tracking prevents memory leaks
- Automatic cleanup on component unmount
- Connection cleanup on app unmount

## Security Considerations

### Authentication
- JWT token sent on connection
- Token validated by server
- Automatic disconnect on authentication failure
- Token refresh handled by session management

### Data Validation
- All incoming data validated before processing
- Type checking for notification objects
- Error handling for malformed messages

### CORS
- WebSocket CORS configured on server
- Origin validation
- Secure WebSocket (WSS) in production

## Troubleshooting

### WebSocket Not Connecting

1. Check environment variables:
   ```bash
   echo $VITE_WS_URL
   echo $VITE_API_URL
   ```

2. Check browser console for errors

3. Verify server is running and WebSocket enabled:
   ```bash
   curl http://localhost:8001/socket.io/
   ```

4. Check authentication token:
   ```javascript
   localStorage.getItem('accessToken')
   ```

### Events Not Received

1. Verify WebSocket is connected:
   ```javascript
   const { isConnected } = useWebSocket();
   console.log('Connected:', isConnected);
   ```

2. Check event listeners are registered:
   ```javascript
   socket.listeners('critical_notification')
   ```

3. Verify server is emitting events

4. Check browser console for errors

### Frequent Reconnections

1. Check server logs for disconnect reasons
2. Verify network stability
3. Check authentication token expiration
4. Verify server WebSocket configuration

## Future Enhancements

### Planned Features
- [ ] Message queuing for offline mode
- [ ] Automatic message replay on reconnection
- [ ] WebSocket connection pooling
- [ ] Binary message support for DICOM data
- [ ] Compression for large messages
- [ ] Heartbeat/ping-pong for connection health

### Optimization Opportunities
- [ ] Lazy loading of WebSocket for non-critical pages
- [ ] Connection sharing across browser tabs
- [ ] Selective event subscription
- [ ] Message batching for high-frequency updates

## References

- [Socket.IO Client Documentation](https://socket.io/docs/v4/client-api/)
- [React Context API](https://react.dev/reference/react/useContext)
- [WebSocket Protocol](https://datatracker.ietf.org/doc/html/rfc6455)
- [FDA 21 CFR Part 11 Compliance](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/part-11-electronic-records-electronic-signatures-scope-and-application)

## Support

For issues or questions:
1. Check this documentation
2. Review browser console logs
3. Check server logs
4. Contact development team

---

**Last Updated**: November 3, 2025
**Version**: 1.0.0
**Status**: ✅ Implemented and Tested
