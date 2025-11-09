# Visual Feedback and Polish Guide

## Overview

This document describes the visual feedback system for the annotation post-editing feature, including cursor management, hover effects, and selection visual feedback.

## 1. Cursor Management

### Purpose
Provide contextual cursor feedback to users based on their interaction with annotations, control points, and tools.

### Implementation

```typescript
import { cursorManager } from '../services/cursorManager'

// Initialize with canvas
cursorManager.setCanvas(canvasElement)

// Update cursor based on context
cursorManager.updateCursorForContext({
  isDrawing: false,
  isDragging: false,
  hoveredControlPoint: null,
  hoveredAnnotation: annotation,
  activeTool: 'pan',
  annotationType: 'arrow'
})
```

### Cursor Types

| Context | Cursor | Description |
|---------|--------|-------------|
| Default | `default` | No interaction |
| Annotation hover | `move` | Can drag annotation |
| Text annotation hover | `text` | Can edit text |
| Control point hover | `nw-resize`, `ne-resize`, etc. | Can resize |
| Drawing mode | `crosshair` | Creating new annotation |
| Dragging | `grabbing` | Currently dragging |
| Pan tool | `grab` / `grabbing` | Pan mode |
| Zoom tool | `zoom-in` / `zoom-out` | Zoom mode |

### Usage Examples

```typescript
// Set cursor for annotation hover
if (hoveredAnnotation) {
  cursorManager.setAnnotationHoverCursor(hoveredAnnotation)
}

// Set cursor for control point hover
if (hoveredControlPoint) {
  cursorManager.setControlPointCursor(hoveredControlPoint)
}

// Set cursor for drawing
if (isDrawing) {
  cursorManager.setDrawingCursor('arrow')
}

// Reset to default
cursorManager.resetCursor()
```

### Advanced Features

```typescript
// Get resize cursor from angle
const cursor = cursorManager.getResizeCursorFromAngle(45) // 'ne-resize'

// Get corner cursor
const cornerCursor = cursorManager.getCornerCursor('nw') // 'nw-resize'

// Get edge cursor
const edgeCursor = cursorManager.getEdgeCursor('n') // 'n-resize'

// Check if near annotation edge
const isNear = cursorManager.isNearAnnotationEdge(point, annotation, 10)
```

## 2. Hover Effects

### Purpose
Provide visual feedback when users hover over annotations and control points.

### Implementation

```typescript
import { hoverEffectsManager } from '../services/hoverEffectsManager'

// Set hovered annotation
hoverEffectsManager.setHoveredAnnotation(annotationId)

// Draw annotation with hover effects
hoverEffectsManager.drawAnnotationWithHover(
  ctx,
  annotation,
  (ctx, style) => {
    // Your drawing code with hover style
    ctx.strokeStyle = style.strokeColor
    ctx.lineWidth = style.strokeWidth
    // ...
  }
)

// Draw control point with hover effects
hoverEffectsManager.drawControlPointWithHover(ctx, controlPoint, 8)
```

### Hover Effects

#### Annotation Hover
- **Color**: Lightened by 30%
- **Stroke Width**: Increased by 1px
- **Opacity**: Increased by 0.2
- **Glow**: 10px blur with annotation color

#### Control Point Hover
- **Size**: 8px → 12px (1.5x)
- **Color**: White fill with blue border
- **Glow**: 8px white shadow
- **Transition**: Smooth size animation

### Tooltips

```typescript
// Get tooltip text
const annotationTooltip = hoverEffectsManager.getAnnotationTooltip(annotation)
// "Arrow: Important Finding"

const controlPointTooltip = hoverEffectsManager.getControlPointTooltip(controlPoint)
// "Drag to resize"

// Draw tooltip
hoverEffectsManager.drawTooltip(ctx, tooltipText, position, { x: 10, y: -10 })
```

### Smooth Transitions

```typescript
// Animate property change
hoverEffectsManager.animateTransition(
  8,    // from size
  12,   // to size
  150,  // duration (ms)
  (value) => {
    // Update and redraw
    controlPointSize = value
    redraw()
  }
)
```

## 3. Selection Visual Feedback

### Purpose
Provide clear visual indication of selected annotations with animated effects.

### Implementation

```typescript
import { selectionVisualFeedback } from '../services/selectionVisualFeedback'

// Start animation loop (call once)
selectionVisualFeedback.startAnimation()

// Draw selection outline
selectionVisualFeedback.drawSelectionOutline(ctx, annotation, boundingBox)

// Draw drop shadow
selectionVisualFeedback.drawDropShadow(ctx, () => {
  // Your drawing code
  drawAnnotation(ctx, annotation)
})

// Draw pulsing control points
controlPoints.forEach(cp => {
  selectionVisualFeedback.drawPulsingControlPoint(ctx, cp.position, 8)
})

// Draw bounding box with dimensions
selectionVisualFeedback.drawBoundingBoxWithDimensions(
  ctx,
  boundingBox,
  [0.35, 0.35] // pixel spacing
)
```

### Selection Effects

#### 1. Animated Dashed Outline
- **Color**: Blue (#2196f3)
- **Line Width**: 2px
- **Dash Pattern**: [8, 4]
- **Animation**: Moving dashes (20px cycle)
- **Glow**: 15px blue shadow

```typescript
// The outline automatically animates
// Dash offset updates at 60 FPS
```

#### 2. Drop Shadow
- **Color**: Black with 30% opacity
- **Blur**: 10px
- **Offset**: 2px right, 2px down

```typescript
selectionVisualFeedback.drawDropShadow(ctx, () => {
  drawAnnotation(ctx, annotation)
})
```

#### 3. Pulsing Control Points
- **Base Size**: 8px
- **Pulse Range**: 8px → 12px
- **Animation**: Sine wave (2π cycle)
- **Glow**: Radial gradient (blue)
- **Border**: 2px blue

```typescript
// Control points pulse automatically
// Phase updates at 60 FPS
```

#### 4. Bounding Box with Dimensions
- **Box Style**: Dashed blue line
- **Labels**: Width and height in mm
- **Background**: Blue with 90% opacity
- **Border**: White 1px

```typescript
selectionVisualFeedback.drawBoundingBoxWithDimensions(
  ctx,
  boundingBox,
  pixelSpacing
)
```

### Selection Handles

```typescript
// Draw corner and edge handles
selectionVisualFeedback.drawSelectionHandles(ctx, boundingBox, 8)

// Corners: Square handles
// Edges: Circle handles
```

### Selection Info Panel

```typescript
// Draw info panel with annotation details
selectionVisualFeedback.drawSelectionInfo(
  ctx,
  annotation,
  { x: 10, y: 10 }
)

// Shows:
// - Type: Arrow
// - Name: Important Finding
```

### Animation Control

```typescript
// Start animation (call once at initialization)
selectionVisualFeedback.startAnimation()

// Stop animation (call on cleanup)
selectionVisualFeedback.stopAnimation()

// Get current animation state
const frame = selectionVisualFeedback.getAnimationFrame()
const dashOffset = selectionVisualFeedback.getDashOffset()
const pulsePhase = selectionVisualFeedback.getPulsePhase()
```

## Integration Example

### Complete Annotation Rendering with All Effects

```typescript
import { cursorManager } from '../services/cursorManager'
import { hoverEffectsManager } from '../services/hoverEffectsManager'
import { selectionVisualFeedback } from '../services/selectionVisualFeedback'

// Initialize
cursorManager.setCanvas(canvas)
selectionVisualFeedback.startAnimation()

// Mouse move handler
canvas.addEventListener('mousemove', (e) => {
  const point = { x: e.offsetX, y: e.offsetY }
  
  // Find hovered elements
  const hoveredAnnotation = findAnnotationAtPoint(point)
  const hoveredControlPoint = findControlPointAtPoint(point)
  
  // Update hover state
  hoverEffectsManager.setHoveredAnnotation(hoveredAnnotation?.id || null)
  hoverEffectsManager.setHoveredControlPoint(hoveredControlPoint?.id || null)
  
  // Update cursor
  cursorManager.updateCursorForContext({
    hoveredAnnotation,
    hoveredControlPoint,
    activeTool: currentTool,
    isDrawing,
    isDragging
  })
  
  // Redraw
  redraw()
})

// Render function
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  // Draw annotations
  annotations.forEach(annotation => {
    const isSelected = annotation.id === selectedAnnotationId
    
    if (isSelected) {
      // Draw with selection effects
      selectionVisualFeedback.drawDropShadow(ctx, () => {
        hoverEffectsManager.drawAnnotationWithHover(
          ctx,
          annotation,
          (ctx, style) => drawAnnotation(ctx, annotation, style)
        )
      })
      
      // Draw selection outline
      const bbox = calculateBoundingBox(annotation)
      selectionVisualFeedback.drawSelectionOutline(ctx, annotation, bbox)
      
      // Draw bounding box with dimensions
      selectionVisualFeedback.drawBoundingBoxWithDimensions(ctx, bbox, pixelSpacing)
      
      // Draw pulsing control points
      const controlPoints = generateControlPoints(annotation)
      controlPoints.forEach(cp => {
        selectionVisualFeedback.drawPulsingControlPoint(ctx, cp.position, 8)
      })
    } else {
      // Draw with hover effects only
      hoverEffectsManager.drawAnnotationWithHover(
        ctx,
        annotation,
        (ctx, style) => drawAnnotation(ctx, annotation, style)
      )
    }
  })
  
  // Draw tooltips
  if (hoveredAnnotation) {
    const tooltip = hoverEffectsManager.getAnnotationTooltip(hoveredAnnotation)
    hoverEffectsManager.drawTooltip(ctx, tooltip, mousePosition)
  }
}
```

## Performance Considerations

### Animation Loop
- Uses `requestAnimationFrame` for 60 FPS
- Only runs when needed (selection active)
- Automatically stops when no selection

### Hover Detection
- Throttled to 60 FPS using RAF
- Uses spatial indexing for large annotation sets
- Caches bounding boxes

### Rendering
- Layered canvas for selection effects
- Only redraws affected layers
- Uses dirty rectangle optimization

## Customization

### Colors

```typescript
// Customize selection color
const SELECTION_COLOR = '#2196f3' // Blue
const HOVER_COLOR = '#4caf50'     // Green

// Customize glow
const GLOW_BLUR = 15
const GLOW_COLOR = 'rgba(33, 150, 243, 0.5)'
```

### Sizes

```typescript
// Customize control point sizes
const BASE_SIZE = 8
const HOVER_SIZE = 12
const PULSE_SCALE = 1.5

// Customize stroke widths
const BASE_STROKE = 2
const HOVER_STROKE = 3
const SELECTION_STROKE = 2
```

### Animation Speed

```typescript
// Customize animation speeds
const DASH_SPEED = 1        // pixels per frame
const PULSE_SPEED = 0.05    // radians per frame
const TRANSITION_DURATION = 150 // ms
```

## Accessibility

### High Contrast Mode

```typescript
// Detect high contrast mode
const isHighContrast = window.matchMedia('(prefers-contrast: high)').matches

if (isHighContrast) {
  // Use higher contrast colors
  SELECTION_COLOR = '#000000'
  STROKE_WIDTH = 3
  GLOW_BLUR = 0 // Disable glow
}
```

### Reduced Motion

```typescript
// Detect reduced motion preference
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

if (prefersReducedMotion) {
  // Disable animations
  selectionVisualFeedback.stopAnimation()
  // Use static effects only
}
```

## Troubleshooting

### Cursor Not Changing
- Verify canvas is set: `cursorManager.setCanvas(canvas)`
- Check z-index of canvas
- Ensure cursor updates are called in mouse handlers

### Hover Effects Not Showing
- Verify hover state is set: `hoverEffectsManager.setHoveredAnnotation(id)`
- Check if redraw is triggered on hover
- Ensure hover detection is working

### Animation Stuttering
- Check if animation loop is running
- Verify RAF is used (not setInterval)
- Check for expensive operations in render loop

### Selection Not Visible
- Verify selection state is set
- Check if selection layer is composited
- Ensure animation loop is started

## Best Practices

1. **Initialize Once**: Set up managers at component mount
2. **Clean Up**: Stop animations on unmount
3. **Throttle Updates**: Use RAF for mouse move handlers
4. **Layer Rendering**: Use separate canvas for selection effects
5. **Cache Calculations**: Memoize bounding boxes and control points
6. **Accessibility**: Support high contrast and reduced motion
7. **Performance**: Only animate when selection is active
