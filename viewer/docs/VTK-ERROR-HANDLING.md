# VTK.js Error Handling Implementation

## Overview

This document describes the comprehensive error handling implemented in the VTK.js volume renderer to ensure robust operation and graceful degradation when issues occur.

## Error Handling Categories

### 1. WebGL Initialization Error Handling

**Location:** `initializeRenderer()` method

**Features:**
- Validates container element before initialization
- Checks for successful creation of all VTK.js components
- Verifies WebGL context creation
- Detects and logs WebGL version (1.0 or 2.0)
- Provides clear error messages for upstream handling
- Cleans up partial initialization on failure

**Error Messages:**
- "Container element is null or undefined"
- "Container must be an HTMLElement"
- "Failed to create VTK.js full screen renderer"
- "WebGL context creation failed. Your browser may not support WebGL or it may be disabled."
- "Failed to get VTK.js renderer/render window/camera/interactor"

**Recovery:**
- Calls `cleanupPartialInitialization()` to prevent memory leaks
- Throws descriptive error for upstream fallback to canvas renderer

### 2. Volume Loading Error Handling

**Location:** `loadVolume()` method

**Features:**
- Validates renderer initialization state
- Comprehensive volume data validation
- GPU memory availability checks
- Texture upload failure detection
- Cleanup of partial loads on failure

**Validation Checks:**

#### Volume Data Validation (`validateVolumeData()`)
- Checks for null/undefined volume data
- Validates dimensions are positive integers
- Enforces maximum dimension limit (2048)
- Verifies data array is Float32Array
- Confirms data size matches dimensions
- Validates spacing values are positive numbers

#### GPU Memory Checks (`checkGPUMemoryAvailability()`)
- Calculates required GPU memory
- Warns if exceeding recommended limit (500 MB)
- Throws error if exceeding absolute limit (1000 MB)
- Checks against GPU max texture sizes
- Validates 2D and 3D texture size limits

**Error Messages:**
- "Renderer not initialized. Cannot load volume."
- "Invalid volume width/height/depth: Must be a positive integer."
- "Volume dimensions too large. Maximum dimension is 2048."
- "Volume data must be a Float32Array"
- "Volume data size mismatch"
- "Volume too large for GPU memory (X MB required)"
- "Volume dimensions exceed GPU max texture size"
- "Failed to upload texture to GPU. GPU memory may be exhausted."

**Recovery Suggestions:**
- "Try reducing the number of frames or image resolution"
- "Consider reducing volume size"
- "Your GPU cannot handle this volume size"

### 3. WebGL Context Lost Handling

**Location:** `setupContextLossHandling()`, `onContextLost()`, `onContextRestored()` methods

**Features:**
- Listens for `webglcontextlost` and `webglcontextrestored` events
- Prevents default context loss behavior
- Saves last loaded volume data for reload
- Automatically attempts to reload volume after restoration
- Provides callback mechanism for UI notification
- Stops auto-rotation during context loss
- Cleans up pending timeouts

**Event Flow:**

```
Context Lost Event
    ↓
onContextLost()
    ↓
- Set isContextLost flag
- Stop auto-rotation
- Clear timeouts
- Notify callback (true)
    ↓
Context Restored Event
    ↓
onContextRestored()
    ↓
- Clear isContextLost flag
- Notify callback (false)
- Reload last volume if available
```

**API Methods:**
- `setContextLostCallback(callback)` - Set notification callback
- `isContextCurrentlyLost()` - Check context state
- `loseContext()` - Manually trigger loss (testing)
- `restoreContext()` - Manually trigger restoration (testing)

## Error Handling Best Practices

### 1. Try-Catch Blocks
All critical operations are wrapped in try-catch blocks with:
- Descriptive error logging
- Resource cleanup on failure
- Clear error messages for users
- Error propagation for upstream handling

### 2. Validation Before Operations
- Check initialization state before operations
- Validate input parameters
- Verify resource availability
- Check GPU capabilities

### 3. Resource Cleanup
- `cleanupPartialInitialization()` - Cleans up failed renderer init
- `cleanupFailedVolumeLoad()` - Cleans up failed volume load
- `dispose()` - Comprehensive cleanup on unmount

### 4. User-Friendly Error Messages
All errors include:
- Clear description of what went wrong
- Why it happened (when possible)
- Suggestions for recovery
- Technical details for debugging

## Integration with UI

### Fallback Mechanism
When VTK.js initialization fails, the error is caught by `useVolumeRenderer` hook which:
1. Logs the error
2. Falls back to canvas renderer
3. Shows warning message to user
4. Continues operation with reduced performance

### Context Loss Notification
UI can register a callback to be notified of context loss:

```typescript
renderer.setContextLostCallback((lost: boolean) => {
  if (lost) {
    // Show "WebGL context lost, attempting to restore..." message
  } else {
    // Show "WebGL context restored" message
  }
})
```

## Testing Error Handling

### Manual Testing
1. **WebGL Initialization Errors:**
   - Disable WebGL in browser settings
   - Use browser without WebGL support
   - Simulate WebGL creation failure

2. **Volume Loading Errors:**
   - Load oversized volume (>1000 MB)
   - Load volume with invalid dimensions
   - Load volume with mismatched data size
   - Simulate GPU memory exhaustion

3. **Context Loss:**
   - Use `renderer.loseContext()` to simulate
   - Open many GPU-intensive tabs
   - Switch between integrated/discrete GPU
   - Put computer to sleep during rendering

### Automated Testing
```typescript
// Test WebGL initialization error
try {
  const renderer = new VTKVolumeRenderer(null) // Invalid container
  // Should throw error
} catch (error) {
  console.log('✓ Caught initialization error:', error.message)
}

// Test volume validation
try {
  await renderer.loadVolume({
    data: new Float32Array(100), // Too small
    dimensions: { width: 10, height: 10, depth: 10 },
    spacing: { x: 1, y: 1, z: 1 }
  })
  // Should throw error
} catch (error) {
  console.log('✓ Caught validation error:', error.message)
}

// Test context loss
renderer.setContextLostCallback((lost) => {
  console.log(lost ? '✓ Context lost detected' : '✓ Context restored detected')
})
renderer.loseContext()
setTimeout(() => renderer.restoreContext(), 1000)
```

## Error Logging

All errors are logged with appropriate emoji prefixes:
- ❌ - Critical errors
- ⚠️ - Warnings
- ℹ️ - Informational messages
- ✅ - Success messages
- 🧹 - Cleanup operations

## Requirements Satisfied

### Requirement 10.1: WebGL Initialization Error Handling
✅ Try-catch around WebGL context creation
✅ Clear error messages
✅ Errors thrown for upstream handling

### Requirement 10.3: Volume Loading Error Handling
✅ Volume dimension validation
✅ GPU memory availability checks
✅ Texture upload failure handling
✅ Recovery suggestions provided

### Requirement 10.2: WebGL Context Lost Handling
✅ Listen for webglcontextlost event
✅ Attempt context restoration
✅ Notify user of context loss
✅ Reload volume if context restored

### Requirement 10.4: Clear Error Messages
✅ User-friendly error messages
✅ Technical details for debugging
✅ Recovery suggestions
✅ Proper error propagation

### Requirement 10.5: Error Logging
✅ Detailed error information logged to console
✅ Stack traces preserved
✅ Context information included

## Summary

The VTK.js renderer now has comprehensive error handling that:
- Validates all inputs before operations
- Checks GPU capabilities and memory
- Handles WebGL context loss gracefully
- Provides clear error messages
- Cleans up resources on failure
- Enables graceful fallback to canvas renderer
- Supports automatic recovery when possible

This ensures a robust and reliable 3D rendering experience even when issues occur.
