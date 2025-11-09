# Auto-Rotation Implementation for VTK.js Volume Renderer

## Overview

This document describes the auto-rotation feature implemented for the VTK.js volume renderer as part of task 5.3 in the VTK.js 3D Volume Rendering Migration spec.

## Implementation Details

### New Properties

Added three private properties to the `VTKVolumeRenderer` class:

```typescript
private autoRotationEnabled: boolean = false
private autoRotationSpeed: number = 1.0 // degrees per frame
private autoRotationAnimationId?: number
```

### Public Methods

#### `startAutoRotation(speed?: number): void`

Starts continuous rotation of the volume around the vertical axis.

- **Parameters:**
  - `speed` (optional): Rotation speed in degrees per frame (default: 1.0)
- **Behavior:**
  - Checks if auto-rotation is already enabled (prevents duplicate starts)
  - Validates camera is initialized
  - Sets rotation speed and enables flag
  - Starts the animation loop using `requestAnimationFrame`

#### `stopAutoRotation(): void`

Stops the auto-rotation animation.

- **Behavior:**
  - Disables auto-rotation flag
  - Cancels the animation frame request
  - Cleans up animation ID

#### `isAutoRotationEnabled(): boolean`

Returns whether auto-rotation is currently active.

#### `getAutoRotationSpeed(): number`

Returns the current rotation speed in degrees per frame.

#### `setAutoRotationSpeed(speed: number): void`

Updates the rotation speed while rotation is active or for the next start.

- **Parameters:**
  - `speed`: New rotation speed in degrees per frame

### Private Methods

#### `autoRotationLoop(): void`

The animation loop that performs the rotation.

- **Behavior:**
  - Checks if auto-rotation is still enabled
  - Rotates camera using VTK.js `azimuth()` method
  - Orthogonalizes the view up vector for stability
  - Triggers a render
  - Schedules the next frame using `requestAnimationFrame`
  - Handles errors gracefully by stopping rotation

### Integration with Dispose

The `dispose()` method was updated to call `stopAutoRotation()` to ensure proper cleanup when the renderer is destroyed.

## Usage Example

```typescript
// Create renderer
const renderer = new VTKVolumeRenderer(container)

// Start auto-rotation with default speed (1°/frame)
renderer.startAutoRotation()

// Start with custom speed (2.5°/frame)
renderer.startAutoRotation(2.5)

// Change speed while rotating
renderer.setAutoRotationSpeed(0.5)

// Check if rotating
if (renderer.isAutoRotationEnabled()) {
  console.log(`Rotating at ${renderer.getAutoRotationSpeed()}°/frame`)
}

// Stop rotation
renderer.stopAutoRotation()
```

## Requirements Satisfied

This implementation satisfies the following requirements from the spec:

- **Requirement 2.4**: Auto-rotation functionality
- **Requirement 9.4**: Configurable rotation speed

## Technical Details

### Animation Loop

The implementation uses `requestAnimationFrame` for smooth, browser-optimized animation:

1. Each frame, the camera rotates by the configured speed (in degrees)
2. The VTK.js `azimuth()` method rotates around the vertical axis
3. `orthogonalizeViewUp()` maintains camera stability
4. The render is triggered to display the new view
5. The next frame is scheduled

### Performance

- Uses native browser animation timing for optimal performance
- Integrates with existing performance monitoring (FPS tracking)
- Works with adaptive quality system (quality reduces during interaction)
- Minimal overhead - only active when enabled

### Error Handling

- Validates camera is initialized before starting
- Prevents duplicate starts with warning
- Catches and logs errors in animation loop
- Automatically stops on error to prevent infinite error loops
- Proper cleanup on dispose

## Future Enhancements

Potential improvements for future iterations:

1. **Rotation Axis Control**: Allow rotation around different axes (X, Y, Z)
2. **Easing Functions**: Add acceleration/deceleration for smoother start/stop
3. **Pause/Resume**: Add ability to pause without resetting position
4. **Rotation Limits**: Add min/max rotation angles
5. **Multi-axis Rotation**: Combine rotations around multiple axes

## Testing

While automated tests cannot run in jsdom (no WebGL support), the implementation can be tested manually:

1. Load a volume in the 3D viewer
2. Click the auto-rotation button
3. Verify smooth continuous rotation
4. Adjust speed and verify changes
5. Stop rotation and verify it stops cleanly
6. Switch studies and verify cleanup

## Notes

- Auto-rotation is automatically stopped when user interacts with the volume (via existing mouse interaction handlers)
- The rotation speed is in degrees per frame, not per second, so actual speed depends on frame rate
- For 60 FPS, 1°/frame = 60°/second = 1 full rotation every 6 seconds
- The implementation is compatible with all existing features (render modes, transfer functions, quality settings)
