# Performance Optimizations Guide

## Overview

This document describes the performance optimization strategies implemented for the annotation post-editing system. These optimizations ensure smooth 60 FPS performance even with hundreds of annotations.

## 1. Layered Rendering

### Concept
Instead of redrawing everything on a single canvas, we use multiple canvas layers:
- **Base Layer**: DICOM image (rarely changes)
- **Annotation Layer**: All annotations (redrawn on annotation changes)
- **Control Layer**: Control points and UI overlays (redrawn on selection/hover)

### Implementation

```typescript
import { layeredCanvasManager } from '../services/layeredCanvasManager'

// Initialize layers
const layers = layeredCanvasManager.initializeLayers(width, height)

// Set the visible canvas
layeredCanvasManager.setCompositeCanvas(visibleCanvas)

// Draw on specific layers
const baseCtx = layeredCanvasManager.getContext('base')
const annotationCtx = layeredCanvasManager.getContext('annotation')
const controlCtx = layeredCanvasManager.getContext('control')

// Mark layers as dirty when they need redrawing
layeredCanvasManager.markDirty('annotation')

// Composite all layers onto visible canvas
layeredCanvasManager.composite()
```

### Benefits
- **Reduced Redraws**: DICOM image is only drawn once, not on every annotation change
- **Selective Updates**: Only changed layers are redrawn
- **Better Performance**: 3-5x faster rendering for annotation edits

### Usage Pattern

```typescript
// On DICOM image load
if (layeredCanvasManager.isDirty('base')) {
  const ctx = layeredCanvasManager.getContext('base')
  drawDicomImage(ctx, image)
  layeredCanvasManager.markClean('base')
}

// On annotation change
layeredCanvasManager.clearLayer('annotation')
const ctx = layeredCanvasManager.getContext('annotation')
annotations.forEach(ann => drawAnnotation(ctx, ann))
layeredCanvasManager.markClean('annotation')

// On selection change
layeredCanvasManager.clearLayer('control')
const ctx = layeredCanvasManager.getContext('control')
drawControlPoints(ctx, selectedAnnotation)
layeredCanvasManager.markClean('control')

// Composite to visible canvas
layeredCanvasManager.composite()
```

## 2. Dirty Rectangle Optimization

### Concept
Track which regions of the canvas have changed and only redraw those regions instead of the entire canvas.

### Implementation

```typescript
import { dirtyRectManager } from '../services/dirtyRectManager'

// Add dirty rectangle for changed annotation
const boundingBox = calculateBoundingBox(annotation)
dirtyRectManager.addAnnotationDirtyRect(boundingBox)

// Clear only dirty regions
dirtyRectManager.clearDirtyRegions(ctx)

// Redraw only annotations in dirty regions
annotations.forEach(annotation => {
  const bbox = calculateBoundingBox(annotation)
  if (dirtyRectManager.isRectDirty(bbox)) {
    drawAnnotation(ctx, annotation)
  }
})

// Clear dirty rects after redraw
dirtyRectManager.clear()
```

### Benefits
- **Partial Redraws**: Only changed regions are redrawn
- **Automatic Merging**: Overlapping dirty rects are merged
- **Smart Fallback**: Falls back to full redraw if dirty area > 50% of canvas

### Advanced Features

```typescript
// Check if full redraw is more efficient
if (dirtyRectManager.shouldRedrawAll(canvasWidth, canvasHeight)) {
  // Redraw entire canvas
} else {
  // Redraw only dirty regions
}

// Get merged dirty rectangles
const dirtyRects = dirtyRectManager.getDirtyRects()

// Get total dirty area
const area = dirtyRectManager.getTotalDirtyArea()
```

## 3. Throttling and Debouncing

### Throttle with RequestAnimationFrame

Limits updates to 60 FPS for smooth performance:

```typescript
import { throttleRAF } from '../utils/performanceUtils'

// Throttle drag updates to 60 FPS
const handleDragThrottled = throttleRAF((position) => {
  updateAnnotationPosition(position)
  redrawCanvas()
})

// Use in mouse move handler
canvas.addEventListener('mousemove', (e) => {
  handleDragThrottled({ x: e.clientX, y: e.clientY })
})
```

### Debounce for Redux Updates

Delays Redux updates until user stops dragging:

```typescript
import { DragUpdateManager } from '../utils/performanceUtils'

const dragManager = new DragUpdateManager(
  // Local update (immediate visual feedback)
  (state) => {
    setLocalAnnotation(state)
    redrawCanvas()
  },
  // Redux commit (only on drag end)
  (initialState, finalState) => {
    dispatch(updateAnnotation(finalState))
    dispatch(addToHistory({ before: initialState, after: finalState }))
  }
)

// On drag start
dragManager.startDrag(annotation)

// During drag (throttled)
dragManager.updateDrag(updatedAnnotation)

// On drag end
dragManager.endDrag() // Commits to Redux
```

### Debounce Search Input

```typescript
import { debounce } from '../utils/performanceUtils'

// Debounce search to avoid filtering on every keystroke
const debouncedSearch = debounce((query) => {
  setSearchQuery(query)
  filterAnnotations(query)
}, 300)

// Use in input handler
<TextField onChange={(e) => debouncedSearch(e.target.value)} />
```

### Benefits
- **Smooth Animations**: 60 FPS updates via RAF throttling
- **Reduced Redux Updates**: Only commit on drag end
- **Better UX**: Immediate visual feedback with deferred state updates
- **Less CPU Usage**: Fewer unnecessary computations

## 4. Memoization

### Control Point Memoization

Cache control points to avoid regenerating them on every render:

```typescript
import { controlPointMemoizer } from '../utils/memoization'

// Get memoized control points
const controlPoints = controlPointMemoizer.getControlPoints(
  annotation,
  (ann) => generateControlPoints(ann) // Generator function
)

// Invalidate cache when annotation changes
controlPointMemoizer.invalidate(annotationId)
```

### Bounding Box Memoization

Cache bounding box calculations:

```typescript
import { boundingBoxMemoizer } from '../utils/memoization'

const bbox = boundingBoxMemoizer.getBoundingBox(
  annotation.points,
  (points) => calculateBoundingBox(points),
  annotation.transform
)
```

### React Component Memoization

Prevent unnecessary re-renders of list items:

```typescript
import { memo } from 'react'

const AnnotationListItem = memo(
  ({ annotation, onSelect, onDelete }) => {
    return (
      <ListItem onClick={() => onSelect(annotation.id)}>
        {/* ... */}
      </ListItem>
    )
  },
  // Custom comparison function
  (prevProps, nextProps) => {
    return (
      prevProps.annotation.id === nextProps.annotation.id &&
      prevProps.annotation.updatedAt === nextProps.annotation.updatedAt &&
      prevProps.isSelected === nextProps.isSelected
    )
  }
)
```

### Benefits
- **Faster Rendering**: Avoid recalculating expensive operations
- **Less Memory Allocation**: Reuse cached results
- **Fewer Re-renders**: React.memo prevents unnecessary component updates

## 5. Batch Updates

### Batch Multiple Annotation Updates

```typescript
import { BatchUpdater } from '../utils/performanceUtils'

const batchUpdater = new BatchUpdater(
  (updates) => {
    // Process all updates at once
    updates.forEach(update => dispatch(updateAnnotation(update)))
  },
  100 // Wait 100ms before processing
)

// Add updates
batchUpdater.add(annotation1)
batchUpdater.add(annotation2)
batchUpdater.add(annotation3)

// Updates are automatically batched and processed together
```

## Performance Monitoring

### Track Frame Rate

```typescript
import { PerformanceMonitor } from '../utils/performanceUtils'

const perfMonitor = new PerformanceMonitor()

function renderLoop() {
  perfMonitor.recordFrame()
  
  // Your render code
  
  requestAnimationFrame(renderLoop)
}

// Get metrics
console.log('Average FPS:', perfMonitor.getAverageFPS())
console.log('Average Frame Time:', perfMonitor.getAverageFrameTime())
```

## Best Practices

### 1. Use Layered Rendering for Static Content
```typescript
// ✅ Good: Separate layers
drawDicomImage(baseLayer)
drawAnnotations(annotationLayer)
drawControlPoints(controlLayer)

// ❌ Bad: Everything on one layer
drawEverything(singleLayer)
```

### 2. Mark Dirty Regions for Partial Updates
```typescript
// ✅ Good: Only redraw changed area
dirtyRectManager.addDirtyRect(annotationBounds)
redrawDirtyRegions()

// ❌ Bad: Redraw entire canvas
clearCanvas()
redrawEverything()
```

### 3. Throttle High-Frequency Events
```typescript
// ✅ Good: Throttle to 60 FPS
const handleMove = throttleRAF((pos) => updatePosition(pos))

// ❌ Bad: Update on every event
canvas.addEventListener('mousemove', (e) => updatePosition(e))
```

### 4. Debounce State Updates
```typescript
// ✅ Good: Update Redux only on drag end
dragManager.endDrag() // Commits to Redux

// ❌ Bad: Update Redux on every move
canvas.addEventListener('mousemove', () => dispatch(update()))
```

### 5. Memoize Expensive Calculations
```typescript
// ✅ Good: Cache control points
const points = controlPointMemoizer.getControlPoints(annotation, generator)

// ❌ Bad: Recalculate every time
const points = generateControlPoints(annotation)
```

### 6. Use React.memo for List Items
```typescript
// ✅ Good: Memoized component
const Item = memo(({ data }) => <div>{data}</div>)

// ❌ Bad: Re-renders on every parent update
const Item = ({ data }) => <div>{data}</div>
```

## Performance Targets

- **Frame Rate**: 60 FPS during drag operations
- **Drag Latency**: < 16ms (one frame)
- **Search Response**: < 300ms after last keystroke
- **Canvas Redraw**: < 10ms for partial updates
- **Full Redraw**: < 50ms for complete canvas

## Measuring Performance

### Chrome DevTools
1. Open Performance tab
2. Record during annotation editing
3. Look for:
   - Long tasks (> 50ms)
   - Frame drops (< 60 FPS)
   - Excessive repaints

### React DevTools Profiler
1. Enable profiler
2. Record during list scrolling
3. Check for:
   - Unnecessary re-renders
   - Expensive components
   - Render time per component

### Custom Metrics
```typescript
const start = performance.now()
// Your code
const end = performance.now()
console.log(`Operation took ${end - start}ms`)
```

## Troubleshooting

### Slow Drag Performance
- Check if throttleRAF is applied
- Verify layered rendering is used
- Ensure dirty rect optimization is active

### Laggy Search
- Verify debounce is applied (300ms)
- Check if React.memo is used for list items
- Ensure useMemo is used for filtering

### High Memory Usage
- Clear memoization caches periodically
- Limit cache sizes (default: 100-200 items)
- Check for memory leaks in event listeners

### Janky Animations
- Use requestAnimationFrame for updates
- Avoid synchronous Redux updates during drag
- Minimize DOM operations during animation

## Future Optimizations

1. **Web Workers**: Offload heavy calculations to background threads
2. **OffscreenCanvas**: Render in worker thread
3. **Virtual Scrolling**: Only render visible list items
4. **WebGL Rendering**: Hardware-accelerated annotation rendering
5. **Incremental Rendering**: Spread rendering across multiple frames
