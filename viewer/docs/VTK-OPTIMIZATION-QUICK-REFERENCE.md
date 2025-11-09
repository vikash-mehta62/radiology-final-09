# VTK.js Optimization - Quick Reference Guide

## Quick Start

### Enable Progressive Loading

```typescript
const { loadVolume, loadingStage } = useVolumeRenderer({
  frameUrls,
  canvasRef,
  containerRef,
  enabled: true,
  useProgressiveLoading: true // Enable for large volumes
})

// Monitor loading stages
useEffect(() => {
  if (loadingStage === 'low') console.log('Low-res preview ready')
  if (loadingStage === 'medium') console.log('Medium-res ready')
  if (loadingStage === 'high') console.log('Full resolution ready')
}, [loadingStage])
```

### Handle Performance Warnings

```typescript
const { performanceWarning, clearPerformanceWarning } = useVolumeRenderer({...})

useEffect(() => {
  if (performanceWarning) {
    // Show warning to user
    alert(`⚠️ ${performanceWarning.message}\n💡 ${performanceWarning.suggestion}`)
    
    // Auto-clear after 5 seconds
    setTimeout(clearPerformanceWarning, 5000)
  }
}, [performanceWarning])
```

### Custom Quality Settings

```typescript
// Get renderer instance
const renderer = vtkRendererRef.current

// Ultra-low quality for very large volumes
renderer.setCustomQuality(2.5, 400, true)

// Ultra-high quality for screenshots
renderer.setCustomQuality(0.25, 3000, false)

// Benchmark current quality
const avgFPS = await renderer.benchmarkQuality(5000)
console.log(`Average FPS: ${avgFPS.toFixed(1)}`)

// Auto-adjust to maintain 30 FPS
renderer.autoAdjustQuality(30, 5)
```

## Common Scenarios

### Scenario 1: Large Volume (300+ slices)

```typescript
// Enable progressive loading
useProgressiveLoading: true

// Start with low quality
renderer.setQuality('low')

// Monitor performance
renderer.setPerformanceWarningCallback((warning) => {
  if (warning.type === 'low-fps') {
    // Stay at low quality
    console.log('Keeping low quality for large volume')
  }
})
```

### Scenario 2: Screenshot/Export

```typescript
// Save current quality
const originalQuality = renderer.getQuality()

// Switch to high quality
renderer.setQuality('high')

// Wait for high-quality render
await new Promise(resolve => setTimeout(resolve, 500))

// Capture screenshot
const screenshot = captureScreenshot()

// Restore original quality
renderer.setQuality(originalQuality)
```

### Scenario 3: Slow GPU

```typescript
// Benchmark to determine capabilities
const fps = await renderer.benchmarkQuality(3000)

if (fps < 20) {
  console.log('Slow GPU detected, using low quality')
  renderer.setQuality('low')
} else if (fps < 40) {
  console.log('Medium GPU, using medium quality')
  renderer.setQuality('medium')
} else {
  console.log('Fast GPU, using high quality')
  renderer.setQuality('high')
}
```

### Scenario 4: Adaptive Performance

```typescript
// Auto-adjust quality every second
useEffect(() => {
  const interval = setInterval(() => {
    renderer.autoAdjustQuality(30, 5) // Target 30 FPS ±5
  }, 1000)
  
  return () => clearInterval(interval)
}, [renderer])
```

## Performance Tips

### Bundle Size

- ✅ VTK.js is lazy-loaded automatically
- ✅ Preloading happens in background
- ✅ No action needed from developers

### Loading Speed

- Use `useProgressiveLoading: true` for volumes > 150 slices
- Show loading stage indicator to user
- Consider preloading VTK.js on page load

### Rendering Performance

- Start with medium quality
- Use low quality during interaction (automatic)
- Switch to high quality for screenshots
- Monitor FPS and adjust accordingly

### Memory Management

- Watch for high-memory warnings
- Dispose renderer when unmounting
- Clear cache when switching studies

## API Reference

### Hook Options

```typescript
interface UseVolumeRendererOptions {
  frameUrls: string[]
  canvasRef: React.RefObject<HTMLCanvasElement>
  containerRef: React.RefObject<HTMLDivElement>
  enabled: boolean
  useProgressiveLoading?: boolean // NEW
}
```

### Hook Returns

```typescript
{
  // ... existing returns
  loadingStage: 'low' | 'medium' | 'high' | null,
  performanceWarning: PerformanceWarning | null,
  clearPerformanceWarning: () => void
}
```

### Renderer Methods

```typescript
// Quality control
renderer.setQuality('low' | 'medium' | 'high')
renderer.setCustomQuality(sampleDistance, maxSamples, autoAdjust)
renderer.getQuality()

// Progressive loading
renderer.loadVolumeProgressive(volumeData, onProgress, onStageComplete)

// Performance monitoring
renderer.benchmarkQuality(durationMs): Promise<number>
renderer.autoAdjustQuality(targetFPS, tolerance)
renderer.setPerformanceWarningCallback(callback)

// Existing methods
renderer.loadVolume(volumeData, onProgress)
renderer.setRenderMode('mip' | 'volume' | 'isosurface')
renderer.setTransferFunction(transferFunction)
renderer.resetCamera()
renderer.dispose()
```

### Warning Types

```typescript
interface PerformanceWarning {
  type: 'low-fps' | 'large-volume' | 'high-memory' | 'slow-gpu'
  message: string
  suggestion: string
  data?: any
}
```

## Troubleshooting

### Issue: Slow initial 3D activation

**Solution:** VTK.js is being loaded. This is a one-time delay.

```typescript
// Preload VTK.js earlier
import { preloadVTK } from '../utils/volumeRendererVTKLazy'

useEffect(() => {
  preloadVTK() // Preload when component mounts
}, [])
```

### Issue: Low FPS with small volumes

**Solution:** GPU may be slow or quality too high.

```typescript
// Benchmark and adjust
const fps = await renderer.benchmarkQuality(3000)
if (fps < 30) {
  renderer.setQuality('low')
}
```

### Issue: Large volumes take too long to load

**Solution:** Enable progressive loading.

```typescript
useProgressiveLoading: true
```

### Issue: Too many performance warnings

**Solution:** Warnings have 10-second cooldown. If still too many:

```typescript
// Disable warnings
renderer.setPerformanceWarningCallback(undefined)

// Or filter warnings
renderer.setPerformanceWarningCallback((warning) => {
  if (warning.type !== 'low-fps') {
    // Only show non-FPS warnings
    showWarning(warning)
  }
})
```

## Best Practices

1. **Always enable progressive loading for large volumes**
   ```typescript
   useProgressiveLoading: volumeData.dimensions.depth > 150
   ```

2. **Monitor performance warnings**
   ```typescript
   useEffect(() => {
     if (performanceWarning) {
       logAnalytics('performance-warning', performanceWarning)
     }
   }, [performanceWarning])
   ```

3. **Benchmark on first load**
   ```typescript
   useEffect(() => {
     if (renderer && !benchmarked) {
       renderer.benchmarkQuality(3000).then(fps => {
         console.log(`GPU capability: ${fps.toFixed(1)} FPS`)
         setBenchmarked(true)
       })
     }
   }, [renderer])
   ```

4. **Clean up properly**
   ```typescript
   useEffect(() => {
     return () => {
       renderer?.dispose()
     }
   }, [renderer])
   ```

5. **Provide user feedback**
   ```typescript
   {loadingStage && (
     <div>Loading: {loadingStage} quality...</div>
   )}
   
   {performanceWarning && (
     <Alert severity="warning">
       {performanceWarning.message}
       <br />
       {performanceWarning.suggestion}
     </Alert>
   )}
   ```

## Performance Targets

| Volume Size | Quality | Target FPS | Expected Load Time |
|-------------|---------|------------|-------------------|
| < 100 slices | High | 30-60 | < 2s |
| 100-200 slices | Medium | 25-45 | 2-4s |
| 200-400 slices | Low-Medium | 20-35 | 4-8s |
| > 400 slices | Low | 15-25 | > 8s |

## Support

For issues or questions:
1. Check console for detailed logs
2. Review VTK-OPTIMIZATION-SUMMARY.md
3. Check VTK.js documentation: https://kitware.github.io/vtk-js/

---

**Last Updated:** 2025-10-13
