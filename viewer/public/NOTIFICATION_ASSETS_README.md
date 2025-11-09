# Notification Assets

This directory contains assets for browser push notifications.

## Required Assets

### Icons
- `notification-icon.png` (64x64 or 128x128) - Main notification icon
- `notification-badge.png` (32x32) - Small badge icon for notification badge
- `notification-critical.png` (64x64) - Icon for critical severity notifications
- `notification-high.png` (64x64) - Icon for high severity notifications
- `notification-medium.png` (64x64) - Icon for medium severity notifications

### Current Status
- SVG placeholders have been created for `notification-icon.svg` and `notification-badge.svg`
- PNG versions should be created for better browser compatibility
- Severity-specific icons should be created with appropriate colors:
  - Critical: Red (#f44336)
  - High: Orange (#ff9800)
  - Medium: Blue (#2196f3)

## Creating PNG Icons

You can convert the SVG files to PNG using:
1. Online tools like CloudConvert or SVG to PNG converters
2. Command line tools like ImageMagick: `convert notification-icon.svg -resize 128x128 notification-icon.png`
3. Design tools like Figma, Sketch, or Adobe Illustrator

## Browser Compatibility

- PNG format is recommended for maximum browser compatibility
- Icons should be square (1:1 aspect ratio)
- Recommended sizes:
  - Main icon: 128x128px
  - Badge: 32x32px or 64x64px
- Use transparent backgrounds
- Keep file sizes small (< 50KB per icon)

## Testing

After adding PNG icons, test notifications in different browsers:
- Chrome/Edge: Full support for all features
- Firefox: Full support for all features
- Safari: Limited support (macOS only, requires user interaction)
- Mobile browsers: Varies by platform and browser
