# Notification Sound Files

This directory contains audio files for notification alerts.

## Required Sound Files

The following MP3 files are required for the notification system:

1. **notification-critical.mp3** - For critical severity notifications
   - Urgent, attention-grabbing sound
   - Recommended: 2-3 second duration
   - Suggested: High-pitched beep or alarm sound

2. **notification-high.mp3** - For high priority notifications
   - Important but less urgent than critical
   - Recommended: 1-2 second duration
   - Suggested: Medium-pitched notification sound

3. **notification-medium.mp3** - For medium priority notifications
   - Standard notification sound
   - Recommended: 1 second duration
   - Suggested: Gentle notification chime

4. **notification-default.mp3** - Default fallback sound
   - General purpose notification
   - Recommended: 1 second duration
   - Suggested: Simple notification tone

## Sound Requirements

### Technical Specifications
- **Format**: MP3 (best browser compatibility)
- **Sample Rate**: 44.1 kHz or 48 kHz
- **Bit Rate**: 128 kbps or higher
- **Channels**: Mono or Stereo
- **Duration**: 1-3 seconds (keep short)
- **File Size**: < 100 KB per file

### Audio Characteristics
- **Critical**: Loud, urgent, attention-grabbing
- **High**: Moderate volume, noticeable
- **Medium**: Gentle, non-intrusive
- **Default**: Neutral, pleasant

## Creating Sound Files

### Option 1: Free Sound Libraries
- [Freesound.org](https://freesound.org/) - Creative Commons sounds
- [Zapsplat.com](https://www.zapsplat.com/) - Free sound effects
- [Notification Sounds](https://notificationsounds.com/) - Notification-specific sounds

### Option 2: Generate Sounds
- Use online tone generators
- Use audio editing software (Audacity, GarageBand)
- Use text-to-speech for voice notifications

### Option 3: Record Custom Sounds
- Record with smartphone or microphone
- Edit in audio software
- Export as MP3

## Browser Autoplay Policy

Modern browsers restrict autoplay of audio to prevent annoying users. The notification system handles this by:

1. **User Interaction Required**: Sounds may not play until user interacts with the page
2. **Permission Request**: System requests notification permission which helps with autoplay
3. **Fallback**: If autoplay is blocked, sound is queued for next user interaction
4. **Settings**: Users can disable sounds in notification settings

## Testing Sounds

After adding sound files:

1. Go to Notification Settings
2. Enable notification sounds
3. Click the play button next to each severity level
4. Adjust volume as needed
5. Test with actual notifications

## Fallback Behavior

If sound files are missing:
- System will log warnings to console
- Notifications will still work (visual only)
- No errors will be shown to users
- Browser notifications will still appear

## Example Sound Sources

### Critical (Urgent)
- Emergency alarm beep
- Hospital alert sound
- Urgent notification tone

### High (Important)
- Standard notification beep
- Message received sound
- Alert chime

### Medium (Standard)
- Gentle notification
- Soft chime
- Message tone

## File Naming Convention

Keep the exact file names as specified:
- `notification-critical.mp3`
- `notification-high.mp3`
- `notification-medium.mp3`
- `notification-default.mp3`

Do not rename these files as they are referenced in the code.

## Volume Levels

Recommended relative volumes:
- Critical: 100% (loudest)
- High: 75%
- Medium: 50%
- Default: 60%

Users can adjust overall volume in settings (0-100%).

## Accessibility

Consider accessibility when choosing sounds:
- Avoid sounds that may trigger seizures (rapid beeping)
- Provide clear distinction between severity levels
- Keep sounds short to avoid annoyance
- Test with users who have hearing impairments

## Legal Considerations

Ensure you have rights to use the sound files:
- Use Creative Commons licensed sounds
- Create original sounds
- Purchase royalty-free sounds
- Attribute sources as required by license

## Maintenance

- Test sounds in different browsers
- Update sounds based on user feedback
- Keep file sizes small for performance
- Monitor browser autoplay policy changes
