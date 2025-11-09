# Accessibility Guide

## Overview

This document describes the accessibility features implemented for the annotation post-editing system, including keyboard navigation, screen reader support, and high contrast mode.

## 1. Keyboard Navigation

### Purpose
Enable users to navigate and edit annotations using only the keyboard, without requiring a mouse.

### Implementation

```typescript
import { keyboardNavigationManager } from '../services/keyboardNavigationManager'

// Initialize with callbacks
keyboardNavigationManager.initialize({
  onSelectNext: () => selectNextAnnotation(),
  onSelectPrevious: () => selectPreviousAnnotation(),
  onMoveAnnotation: (delta) => moveAnnotation(delta),
  onStartTextEdit: () => startTextEdit(),
  onDeleteAnnotation: () => deleteAnnotation(),
  onDeselectAll: () => deselectAll(),
  onUndo: () => undo(),
  onRedo: () => redo(),
  onCopy: () => copyAnnotation(),
  onPaste: () => pasteAnnotation(),
  onDuplicate: () => duplicateAnnotation(),
  onShowHelp: () => showKeyboardShortcuts(),
})

// Handle keyboard events
document.addEventListener('keydown', (e) => {
  keyboardNavigationManager.handleKeyDown(e)
})
```

### Keyboard Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| **Navigation** |
| `Tab` | Select next | Cycle to next annotation |
| `Shift + Tab` | Select previous | Cycle to previous annotation |
| **Movement (1px)** |
| `↑` | Move up | Move annotation up by 1 pixel |
| `↓` | Move down | Move annotation down by 1 pixel |
| `←` | Move left | Move annotation left by 1 pixel |
| `→` | Move right | Move annotation right by 1 pixel |
| **Movement (10px)** |
| `Shift + ↑` | Move up fast | Move annotation up by 10 pixels |
| `Shift + ↓` | Move down fast | Move annotation down by 10 pixels |
| `Shift + ←` | Move left fast | Move annotation left by 10 pixels |
| `Shift + →` | Move right fast | Move annotation right by 10 pixels |
| **Editing** |
| `Enter` | Edit text | Start editing text annotation |
| `Delete` | Delete | Remove selected annotation |
| `Backspace` | Delete | Remove selected annotation |
| `Escape` | Deselect | Clear selection and exit edit mode |
| **Undo/Redo** |
| `Ctrl + Z` | Undo | Undo last action |
| `Ctrl + Y` | Redo | Redo last undone action |
| `Ctrl + Shift + Z` | Redo | Redo last undone action |
| **Copy/Paste** |
| `Ctrl + C` | Copy | Copy selected annotation |
| `Ctrl + V` | Paste | Paste copied annotation |
| `Ctrl + D` | Duplicate | Duplicate selected annotation |
| **Help** |
| `Ctrl + ?` | Show help | Display keyboard shortcuts dialog |

### Usage Examples

```typescript
// Enable/disable keyboard navigation
keyboardNavigationManager.enable()
keyboardNavigationManager.disable()

// Set text input focus state (disables shortcuts except Escape)
keyboardNavigationManager.setTextInputFocused(true)

// Check if navigation is enabled
const isEnabled = keyboardNavigationManager.isNavigationEnabled()

// Get all shortcuts
const shortcuts = keyboardNavigationManager.getAllShortcuts()

// Get shortcuts by category
const byCategory = keyboardNavigationManager.getShortcutsByCategory()

// Format shortcut for display
const formatted = keyboardNavigationManager.formatShortcut(shortcut)
// "Ctrl + Shift + Z"
```

### Custom Shortcuts

```typescript
// Register custom shortcut
keyboardNavigationManager.registerShortcut({
  key: 's',
  ctrl: true,
  description: 'Save annotations',
  action: () => saveAnnotations(),
})

// Unregister shortcut
keyboardNavigationManager.unregisterShortcut('s', true)
```

## 2. Screen Reader Support

### Purpose
Provide audio feedback for users with visual impairments using screen readers.

### Implementation

```typescript
import { accessibilityManager } from '../services/accessibilityManager'

// Initialize
accessibilityManager.initialize()

// Announce to screen reader
accessibilityManager.announce('Annotation selected', 'polite')

// Announce with priority
accessibilityManager.announce('Error occurred', 'assertive')
```

### Announcements

#### Selection Changes
```typescript
// Announce annotation selection
accessibilityManager.announceAnnotationSelection(annotation)
// "Selected Arrow: Important Finding"

// Announce deselection
accessibilityManager.announceAnnotationSelection(null)
// "No annotation selected"
```

#### CRUD Operations
```typescript
// Announce creation
accessibilityManager.announceAnnotationCreation(annotation)
// "Created Arrow annotation"

// Announce deletion
accessibilityManager.announceAnnotationDeletion(annotation)
// "Deleted Arrow: Important Finding"

// Announce movement
accessibilityManager.announceAnnotationMovement({ x: 10, y: 0 })
// "Moved annotation right by 10 pixels"
```

#### Undo/Redo
```typescript
accessibilityManager.announceUndoRedo('undo', 'Move annotation')
// "Undid: Move annotation"

accessibilityManager.announceUndoRedo('redo', 'Delete annotation')
// "Redid: Delete annotation"
```

#### Visibility Toggle
```typescript
accessibilityManager.announceVisibilityToggle(annotation, false)
// "Arrow Important Finding is now hidden"
```

#### Export/Import
```typescript
accessibilityManager.announceExportImport('export', 5)
// "Exported 5 annotations"

accessibilityManager.announceExportImport('import', 3)
// "Imported 3 annotations"
```

### ARIA Labels

#### Canvas
```typescript
// Set canvas ARIA attributes
accessibilityManager.setCanvasAriaAttributes(canvas)

// Attributes set:
// role="application"
// aria-label="Medical image viewer with annotation tools..."
// tabindex="0"
```

#### Annotations
```typescript
// Get ARIA label for annotation
const label = accessibilityManager.getAnnotationAriaLabel(annotation)
// "Arrow annotation: Important Finding, visible, unlocked"
```

#### Control Points
```typescript
// Get ARIA label for control point
const label = accessibilityManager.getControlPointAriaLabel(controlPoint)
// "Corner resize handle. Press arrow keys to adjust."
```

### Type Descriptions
```typescript
// Get description for annotation type
const description = accessibilityManager.getAnnotationTypeDescription('arrow')
// "Arrow annotation for pointing to features"
```

## 3. High Contrast Mode

### Purpose
Improve visibility for users with low vision or color blindness.

### Implementation

```typescript
import { highContrastManager } from '../services/highContrastManager'

// Initialize
highContrastManager.initialize()

// Check if high contrast is enabled
const isHighContrast = highContrastManager.isHighContrastMode()

// Listen for changes
highContrastManager.addListener((isHighContrast) => {
  console.log('High contrast mode:', isHighContrast)
  redrawCanvas()
})
```

### Theme Configuration

#### High Contrast Theme
```typescript
const highContrastTheme = {
  selectionColor: '#000000',           // Black
  hoverColor: '#333333',               // Dark gray
  annotationStrokeColor: '#000000',    // Black
  annotationFillColor: 'rgba(255, 255, 255, 0.3)', // Light fill
  controlPointColor: '#ffffff',        // White
  controlPointBorderColor: '#000000',  // Black
  backgroundColor: '#ffffff',          // White
  textColor: '#000000',                // Black
  strokeWidth: 3,                      // Thicker strokes
  controlPointSize: 12,                // Larger control points
  glowEnabled: false,                  // No glow effects
}
```

#### Normal Theme
```typescript
const normalTheme = {
  selectionColor: '#2196f3',           // Blue
  hoverColor: '#64b5f6',               // Light blue
  annotationStrokeColor: '#00ff41',    // Green
  annotationFillColor: 'rgba(0, 255, 65, 0.2)', // Light green
  controlPointColor: '#f0f0f0',        // Light gray
  controlPointBorderColor: '#333333',  // Dark gray
  backgroundColor: '#000000',          // Black
  textColor: '#ffffff',                // White
  strokeWidth: 2,                      // Normal strokes
  controlPointSize: 8,                 // Normal control points
  glowEnabled: true,                   // Glow effects enabled
}
```

### Usage

```typescript
// Get current theme
const theme = highContrastManager.getCurrentTheme()

// Get annotation style for high contrast
const style = highContrastManager.getAnnotationStyle(annotation)

// Get selection color
const selectionColor = highContrastManager.getSelectionColor()

// Get control point size
const size = highContrastManager.getControlPointSize(8)

// Get stroke width
const width = highContrastManager.getStrokeWidth(2)

// Check if glow effects should be enabled
const glowEnabled = highContrastManager.isGlowEnabled()

// Check if animations should be enabled
const animationsEnabled = highContrastManager.areAnimationsEnabled()

// Get control point colors
const colors = highContrastManager.getControlPointColors()
// { fill: '#ffffff', stroke: '#000000' }

// Apply canvas styles
highContrastManager.applyCanvasStyles(canvas)
```

### Reduced Motion Support

```typescript
// Check if reduced motion is preferred
const prefersReducedMotion = highContrastManager.prefersReducedMotionMode()

if (prefersReducedMotion) {
  // Disable animations
  selectionVisualFeedback.stopAnimation()
  // Use static effects only
}
```

### Customization

```typescript
// Customize high contrast theme
highContrastManager.setHighContrastTheme({
  selectionColor: '#ff0000',
  strokeWidth: 4,
})

// Customize normal theme
highContrastManager.setNormalTheme({
  selectionColor: '#00ff00',
})

// Force high contrast mode (for testing)
highContrastManager.forceHighContrast(true)
```

## 4. Keyboard Shortcuts Dialog

### Purpose
Display all available keyboard shortcuts to users.

### Implementation

```typescript
import KeyboardShortcutsDialog from './KeyboardShortcutsDialog'

function MyComponent() {
  const [showHelp, setShowHelp] = useState(false)

  return (
    <>
      <Button onClick={() => setShowHelp(true)}>
        Show Shortcuts
      </Button>

      <KeyboardShortcutsDialog
        open={showHelp}
        onClose={() => setShowHelp(false)}
      />
    </>
  )
}
```

### Features
- Organized by category (Navigation, Movement, Editing, etc.)
- Visual keyboard key chips
- Tips section with usage hints
- Responsive design
- Accessible dialog

## Integration Example

### Complete Accessibility Setup

```typescript
import { keyboardNavigationManager } from '../services/keyboardNavigationManager'
import { accessibilityManager } from '../services/accessibilityManager'
import { highContrastManager } from '../services/highContrastManager'

// Initialize all accessibility features
function initializeAccessibility() {
  // 1. Initialize accessibility manager
  accessibilityManager.initialize()

  // 2. Initialize high contrast manager
  highContrastManager.initialize()

  // 3. Set canvas ARIA attributes
  accessibilityManager.setCanvasAriaAttributes(canvas)

  // 4. Initialize keyboard navigation
  keyboardNavigationManager.initialize({
    onSelectNext: () => {
      const next = getNextAnnotation()
      selectAnnotation(next)
      accessibilityManager.announceAnnotationSelection(next)
    },
    onSelectPrevious: () => {
      const prev = getPreviousAnnotation()
      selectAnnotation(prev)
      accessibilityManager.announceAnnotationSelection(prev)
    },
    onMoveAnnotation: (delta) => {
      moveAnnotation(delta)
      accessibilityManager.announceAnnotationMovement(delta)
    },
    onDeleteAnnotation: () => {
      const annotation = getSelectedAnnotation()
      deleteAnnotation(annotation)
      accessibilityManager.announceAnnotationDeletion(annotation)
    },
    // ... other callbacks
  })

  // 5. Listen for high contrast changes
  highContrastManager.addListener((isHighContrast) => {
    redrawCanvas()
  })

  // 6. Add keyboard event listener
  document.addEventListener('keydown', (e) => {
    keyboardNavigationManager.handleKeyDown(e)
  })
}

// Render with accessibility
function render() {
  const theme = highContrastManager.getCurrentTheme()
  const isHighContrast = highContrastManager.isHighContrastMode()

  // Apply theme
  ctx.strokeStyle = theme.annotationStrokeColor
  ctx.lineWidth = theme.strokeWidth

  // Draw annotations
  annotations.forEach(annotation => {
    const style = highContrastManager.getAnnotationStyle(annotation)
    drawAnnotation(ctx, annotation, style)
  })

  // Draw control points with high contrast support
  if (selectedAnnotation) {
    const size = highContrastManager.getControlPointSize(8)
    const colors = highContrastManager.getControlPointColors()

    controlPoints.forEach(cp => {
      drawControlPoint(ctx, cp, size, colors)
    })
  }
}
```

## Best Practices

### 1. Always Announce Important Changes
```typescript
// ✅ Good: Announce selection changes
accessibilityManager.announceAnnotationSelection(annotation)

// ❌ Bad: Silent selection change
selectAnnotation(annotation)
```

### 2. Provide ARIA Labels
```typescript
// ✅ Good: Set ARIA attributes
accessibilityManager.setCanvasAriaAttributes(canvas)

// ❌ Bad: No ARIA attributes
<canvas></canvas>
```

### 3. Support High Contrast
```typescript
// ✅ Good: Use theme colors
const color = highContrastManager.getSelectionColor()

// ❌ Bad: Hardcoded colors
const color = '#2196f3'
```

### 4. Respect Reduced Motion
```typescript
// ✅ Good: Check preference
if (!highContrastManager.prefersReducedMotionMode()) {
  startAnimation()
}

// ❌ Bad: Always animate
startAnimation()
```

### 5. Disable Shortcuts During Text Input
```typescript
// ✅ Good: Disable during text input
keyboardNavigationManager.setTextInputFocused(true)

// ❌ Bad: Shortcuts interfere with typing
// User types "Delete" and annotation is deleted
```

## Testing

### Keyboard Navigation
1. Tab through all annotations
2. Use arrow keys to move annotations
3. Press Enter to edit text
4. Press Delete to remove
5. Press Escape to deselect

### Screen Reader
1. Enable screen reader (NVDA, JAWS, VoiceOver)
2. Navigate with Tab
3. Listen for announcements
4. Verify ARIA labels are read correctly

### High Contrast
1. Enable high contrast mode in OS settings
2. Verify colors change automatically
3. Check stroke widths increase
4. Verify control points are larger

### Reduced Motion
1. Enable reduced motion in OS settings
2. Verify animations are disabled
3. Check glow effects are removed

## Troubleshooting

### Keyboard Shortcuts Not Working
- Check if navigation is enabled
- Verify text input focus state
- Ensure event listener is attached

### Screen Reader Not Announcing
- Verify live region is created
- Check announcement queue
- Ensure ARIA attributes are set

### High Contrast Not Applying
- Check media query support
- Verify listener is attached
- Force high contrast for testing

### Reduced Motion Not Respected
- Check media query support
- Verify animation checks
- Test with OS settings

## Compliance

### WCAG 2.1 Level AA
- ✅ 1.4.3 Contrast (Minimum)
- ✅ 2.1.1 Keyboard
- ✅ 2.1.2 No Keyboard Trap
- ✅ 2.4.3 Focus Order
- ✅ 2.4.7 Focus Visible
- ✅ 4.1.2 Name, Role, Value
- ✅ 4.1.3 Status Messages

### Section 508
- ✅ Keyboard access
- ✅ Screen reader support
- ✅ High contrast mode
- ✅ Focus indicators
