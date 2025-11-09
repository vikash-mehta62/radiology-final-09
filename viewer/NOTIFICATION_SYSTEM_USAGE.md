# Notification System - User Guide

## Overview

The notification system provides real-time alerts for critical medical findings, ensuring urgent cases receive immediate attention.

## Features

### 1. Notification Bell

Located in the top-right corner of the application header:
- **Badge**: Shows the number of unread notifications
- **Animation**: Pulses when there are unread notifications
- **Click**: Opens the notification panel

### 2. Notification Panel

Opens as a drawer from the right side:

#### Tabs
- **All**: Shows all notifications
- **Critical**: Life-threatening findings requiring immediate action
- **High**: Important findings requiring prompt attention
- **Medium**: Standard priority findings

#### Notification Card
Each notification displays:
- **Severity Icon**: Color-coded (Red=Critical, Orange=High, Blue=Medium)
- **Title**: Brief description of the finding
- **Message**: Detailed information
- **Patient ID**: Patient identifier
- **Study ID**: Study identifier
- **Finding Details**: Location and description
- **Timestamp**: When the notification was created
- **Escalation Level**: If escalated to higher authority
- **Acknowledge Button**: Mark as read

#### Actions
- **Refresh**: Reload notifications
- **Mark All as Read**: Acknowledge all notifications at once
- **Close**: Close the panel

### 3. Notification Settings

Access via Settings page:

#### Notification Channels
Choose how to receive notifications:
- ✉️ **Email**: Receive notifications via email
- 📱 **SMS**: Receive text message alerts
- 🔔 **In-App**: Show notifications in the application
- 🔊 **Push**: Browser push notifications (even when app is closed)

#### Sound Alerts
- Toggle sound alerts for critical notifications
- Plays a notification sound when critical findings arrive

#### Severity Filters
Select which severity levels to receive:
- 🔴 **Critical**: Urgent, life-threatening findings
- 🟠 **High**: Important findings
- 🔵 **Medium**: Standard priority findings

#### Do Not Disturb
Set quiet hours when you don't want notifications:
- Enable/disable DND mode
- Set start time (e.g., 10:00 PM)
- Set end time (e.g., 8:00 AM)
- **Note**: Critical notifications always come through

## Notification Workflow

### 1. Receiving Notifications

When a critical finding is identified:
1. Notification appears in real-time (no refresh needed)
2. Badge count increases
3. Sound plays (if enabled)
4. Browser notification shows (if permitted)

### 2. Viewing Notifications

1. Click the bell icon in the header
2. Panel opens showing all notifications
3. Use tabs to filter by severity
4. Scroll through notifications

### 3. Acknowledging Notifications

1. Read the notification details
2. Click "Acknowledge" button
3. Notification is marked as read
4. Badge count decreases

### 4. Escalation

If a notification is not acknowledged within the time limit:
1. System automatically escalates to next level
2. Escalation level indicator appears
3. Additional recipients are notified
4. Process continues until acknowledged

## Best Practices

### For Radiologists

1. **Enable All Channels**: Ensure you receive critical notifications via multiple channels
2. **Keep Sound On**: Don't miss urgent findings
3. **Acknowledge Promptly**: Respond within 15 minutes to prevent escalation
4. **Check Regularly**: Review notification panel at start of shift

### For Administrators

1. **Configure Recipients**: Set up proper escalation chains
2. **Test Notifications**: Verify delivery to all channels
3. **Monitor Response Times**: Track acknowledgment metrics
4. **Review Settings**: Ensure all users have appropriate settings

### For On-Call Staff

1. **Enable SMS**: Ensure you receive alerts when away from computer
2. **Enable Push**: Get notifications even when browser is closed
3. **Set DND Carefully**: Critical notifications always come through
4. **Test Before Shift**: Verify all channels are working

## Troubleshooting

### Not Receiving Notifications

1. **Check Settings**: Verify channels are enabled
2. **Check Browser Permissions**: Allow notifications in browser settings
3. **Check Connection**: Ensure WebSocket is connected (check browser console)
4. **Check DND**: Verify Do Not Disturb is not blocking notifications

### Sound Not Playing

1. **Check Settings**: Verify sound is enabled in notification settings
2. **Check Browser**: Some browsers block autoplay audio
3. **Check Volume**: Ensure system volume is not muted
4. **Interact First**: Some browsers require user interaction before playing sound

### Browser Notifications Not Showing

1. **Grant Permission**: Click "Allow" when prompted
2. **Check Browser Settings**: Verify notifications are enabled for the site
3. **Check OS Settings**: Ensure system notifications are enabled
4. **Try Different Browser**: Some browsers have better notification support

### WebSocket Connection Issues

1. **Check Network**: Ensure stable internet connection
2. **Check Firewall**: Verify WebSocket connections are not blocked
3. **Refresh Page**: Reconnection happens automatically
4. **Contact IT**: If issues persist, contact system administrator

## Keyboard Shortcuts

- **Alt + N**: Open notification panel (future enhancement)
- **Esc**: Close notification panel
- **Tab**: Navigate between notifications
- **Enter**: Acknowledge selected notification

## Mobile Support

The notification system is fully responsive:
- Panel takes full width on mobile devices
- Touch-friendly buttons and interactions
- Swipe to close panel
- Native mobile notifications supported

## Privacy & Security

- All notifications containing PHI are encrypted
- Notifications are only visible to authorized recipients
- Audit trail maintained for all notification events
- Automatic logout after session timeout

## Compliance

The notification system complies with:
- **HIPAA**: PHI encryption and access controls
- **FDA 21 CFR Part 11**: Audit trails and electronic signatures
- **SOC 2**: Security and availability controls

## Support

For issues or questions:
- Contact IT Support: support@hospital.com
- System Administrator: admin@hospital.com
- Emergency: Call hospital operator

## Version

Current Version: 1.0.0
Last Updated: 2024
