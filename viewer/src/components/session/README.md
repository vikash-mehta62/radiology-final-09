# Session Management UI Components

This directory contains the session management UI components for the Medical Imaging Viewer application. These components implement HIPAA-compliant session handling with automatic timeout, activity monitoring, and token refresh.

## Components

### SessionTimeoutWarning

A dialog component that warns users when their session is about to expire.

**Features:**
- Shows warning 5 minutes before session timeout
- Displays countdown timer with visual progress bar
- Provides "Stay Logged In" button to extend session
- Provides "Logout Now" button for immediate logout
- Cannot be dismissed by clicking outside or pressing ESC

**Props:**
```typescript
interface SessionTimeoutWarningProps {
  open: boolean              // Whether the dialog is open
  timeRemaining: number      // Time remaining in seconds
  onExtendSession: () => void // Callback to extend session
  onLogoutNow: () => void    // Callback to logout immediately
}
```

**Usage:**
```tsx
import { SessionTimeoutWarning } from './components/session'

<SessionTimeoutWarning
  open={showWarning}
  timeRemaining={timeLeft}
  onExtendSession={handleExtendSession}
  onLogoutNow={handleLogoutNow}
/>
```

### SessionMonitor

A component that monitors user activity and tracks session expiration.

**Features:**
- Monitors user activity (mouse, keyboard, scroll, touch)
- Tracks session expiration time
- Shows optional session status indicator
- Throttles activity updates to avoid excessive processing
- Dispatches custom events for session expiration

**Props:**
```typescript
interface SessionMonitorProps {
  sessionStatus: 'active' | 'warning' | 'expired'
  timeRemaining: number      // Time remaining in seconds
  onActivity: () => void     // Callback when user activity detected
  showIndicator?: boolean    // Whether to show status indicator (default: false)
}
```

**Usage:**
```tsx
import { SessionMonitor } from './components/session'

<SessionMonitor
  sessionStatus={sessionStatus}
  timeRemaining={timeLeft}
  onActivity={handleActivity}
  showIndicator={true}
/>
```

## Hook

### useSessionManagement

A custom hook that manages session state, activity monitoring, and token refresh.

**Features:**
- Automatic session timeout after inactivity
- Warning notification before timeout
- Activity-based session extension
- Automatic token refresh
- Manual session extension
- Session status tracking

**Configuration:**
```typescript
interface SessionConfig {
  timeoutMinutes: number           // Default: 30 minutes
  warningMinutes: number           // Default: 5 minutes before timeout
  extendOnActivity: boolean        // Default: true
  autoRefreshToken: boolean        // Default: true
  refreshIntervalMinutes: number   // Default: 10 minutes
}
```

**Return Values:**
```typescript
{
  // Status
  isActive: boolean
  status: 'active' | 'warning' | 'expired'
  timeLeft: number                 // in seconds
  showWarning: boolean
  lastActivity: Date
  
  // Formatted values
  formatTimeLeft: string           // "MM:SS" format
  
  // Actions
  extendSession: () => Promise<void>
  endSession: () => void
  resetTimer: () => void
  handleActivity: () => void
  
  // Info
  getSessionInfo: () => SessionInfo
}
```

**Usage:**
```tsx
import { useSessionManagement } from './hooks/useSessionManagement'

const {
  status,
  timeLeft,
  showWarning,
  extendSession,
  handleActivity
} = useSessionManagement(
  // onTimeout callback
  () => {
    logout()
    navigate('/login?reason=timeout')
  },
  // onWarning callback
  (minutesLeft) => {
    console.log(`Session expiring in ${minutesLeft} minutes`)
  },
  // config
  {
    timeoutMinutes: 30,
    warningMinutes: 5,
    extendOnActivity: true,
    autoRefreshToken: true,
    refreshIntervalMinutes: 10
  }
)
```

## Integration

The session management is integrated into the main App component:

```tsx
// In App.tsx
import { useSessionManagement } from './hooks/useSessionManagement'
import SessionTimeoutWarning from './components/session/SessionTimeoutWarning'
import SessionMonitor from './components/session/SessionMonitor'

function App() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const {
    status: sessionStatus,
    timeLeft,
    showWarning,
    extendSession,
    handleActivity
  } = useSessionManagement(
    () => {
      logout()
      navigate('/login?reason=timeout')
    },
    (minutesLeft) => {
      console.log(`Session expiring in ${minutesLeft} minutes`)
    }
  )

  return (
    <>
      {isAuthenticated && (
        <SessionTimeoutWarning
          open={showWarning}
          timeRemaining={timeLeft}
          onExtendSession={extendSession}
          onLogoutNow={() => {
            logout()
            navigate('/login')
          }}
        />
      )}

      {isAuthenticated && process.env.NODE_ENV === 'development' && (
        <SessionMonitor
          sessionStatus={sessionStatus}
          timeRemaining={timeLeft}
          onActivity={handleActivity}
          showIndicator={true}
        />
      )}

      {/* Rest of app */}
    </>
  )
}
```

## Requirements Compliance

This implementation satisfies the following requirements:

### Requirement 10.3
- ✅ Session timeout warning displayed 5 minutes before expiration
- ✅ User can extend session without re-login

### Requirement 10.4
- ✅ Session automatically refreshes authentication tokens before expiration
- ✅ User activity extends session timeout
- ✅ Session expires after 30 minutes of inactivity

### Requirement 10.1-10.12
- ✅ JWT-based session authentication
- ✅ 30-minute inactivity timeout
- ✅ 5-minute warning before expiration
- ✅ Session extension without re-login
- ✅ Automatic token refresh
- ✅ Session data cleared on logout
- ✅ Session events logged
- ✅ Activity monitoring

### Requirement 11.1-11.10
- ✅ Token refresh 5 minutes before expiration
- ✅ Refresh tokens with 7-day expiration
- ✅ Silent token refresh without user interaction
- ✅ Graceful handling of refresh failures
- ✅ Work preservation before re-authentication

### Requirement 13.1-13.10
- ✅ Real-time session monitoring
- ✅ Session activity tracking
- ✅ Session status display
- ✅ Activity-based session extension

## Security Features

- **Automatic Timeout**: Sessions expire after 30 minutes of inactivity
- **Token Refresh**: Access tokens automatically refresh every 10 minutes
- **Activity Monitoring**: User activity extends session automatically
- **Secure Logout**: All session data cleared on logout
- **Audit Logging**: Session extensions logged for compliance
- **HIPAA Compliance**: Meets HIPAA security requirements for session management

## Testing

Tests are located in `__tests__/SessionManagement.test.tsx` and cover:

- Hook initialization and state management
- Warning display before timeout
- Session extension functionality
- Activity-based timer reset
- Component rendering and interactions
- Countdown timer updates
- Status indicator display

Run tests with:
```bash
npm test -- SessionManagement.test.tsx
```

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance Considerations

- Activity events are throttled to once per 10 seconds
- Token refresh happens in background without blocking UI
- Countdown updates every second (minimal performance impact)
- Event listeners use passive mode where possible

## Future Enhancements

- [ ] Multi-device session management
- [ ] Session history tracking
- [ ] Configurable timeout per user role
- [ ] Push notifications for session warnings
- [ ] Session analytics dashboard
