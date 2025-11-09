# 3D Volume Rendering - Quick Guide

## What's New

Your viewer now has **full 3D volume rendering capabilities** with a simple toggle!

## How to Use

1. **Open any study** in the viewer
2. **Look for the toggle buttons** in the top-right of the Image Viewer tab:
   - `2D Stack` - Traditional 2D slice viewing
   - `Cornerstone` - Cornerstone3D viewer
   - `🎨 3D Volume` - **NEW! 3D volume rendering**

3. **Click "3D Volume"** to activate 3D mode
4. **Click "Start 3D Rendering"** to load the volume

## Features

### Automatic Renderer Selection
- **VTK.js (GPU)** - Hardware-accelerated WebGL 2.0 rendering (if supported)
- **Canvas (CPU)** - Software fallback for older browsers

### Render Modes
- **MIP** (Maximum Intensity Projection) - Shows brightest voxels
- **Volume** - Full volumetric rendering with transfer functions
- **Isosurface** - Surface rendering at specific intensity threshold

### Transfer Function Presets
Pre-configured for medical imaging:
- **Bone** - CT bone visualization
- **Soft-Tissue** - Soft tissue contrast
- **Lung** - Lung window settings
- **Angio** - Angiography visualization

### Interactive Controls
- **Click & Drag** - Rotate the volume
- **Scroll** - Zoom in/out
- **Auto-rotation** - Automatic 360° rotation
- **Opacity slider** - Adjust transparency
- **Reset Camera** - Return to default view

### Performance Features
- **Progressive Loading** - Shows low-res preview first, then upgrades quality
- **Lazy Loading** - VTK.js (~600KB) only loads when you activate 3D mode
- **Performance Monitoring** - Real-time FPS, render time, and GPU memory usage
- **Adaptive Quality** - Automatically adjusts quality based on GPU capabilities

## Technical Details

### Architecture
```
ViewerPage.tsx
  └─> VolumeViewer3D.tsx (UI Component)
       └─> useVolumeRenderer.ts (Hook)
            ├─> volumeRendererVTKLazy.ts (VTK.js lazy loader)
            │    └─> volumeRendererVTK.ts (VTK.js implementation)
            └─> volumeRenderer.ts (Canvas fallback)
```

### WebGL Detection
The system automatically detects:
- WebGL 2.0 support
- 3D texture capabilities
- GPU memory
- Maximum texture sizes

If WebGL 2.0 is not available, it falls back to canvas-based rendering.

### Progressive Loading
For large volumes (>100 frames):
1. **Low quality** - Fast preview (25% resolution)
2. **Medium quality** - Better detail (50% resolution)
3. **High quality** - Full resolution

## Browser Compatibility

| Browser | VTK.js (GPU) | Canvas (CPU) |
|---------|--------------|--------------|
| Chrome 90+ | ✅ | ✅ |
| Firefox 88+ | ✅ | ✅ |
| Safari 15+ | ✅ | ✅ |
| Edge 90+ | ✅ | ✅ |
| Older browsers | ❌ | ✅ |

## Performance Tips

1. **Use VTK.js mode** when available (much faster)
2. **Enable auto-rotation** for smooth presentation
3. **Adjust opacity** to see internal structures
4. **Use MIP mode** for quick overview of dense structures
5. **Progressive loading** helps with large datasets

## Troubleshooting

### "Canvas (CPU)" mode instead of "VTK.js (GPU)"
- Your browser/GPU doesn't support WebGL 2.0
- Update your browser or graphics drivers
- Canvas mode still works, just slower

### Slow loading
- Large volumes take time to load
- Progressive loading shows preview quickly
- Wait for "high quality" stage to complete

### Low FPS
- Reduce opacity for better performance
- Use MIP mode instead of Volume mode
- Close other GPU-intensive applications

## Next Steps

Want to customize further?
- Add more transfer function presets in `utils/volumeRenderer.ts`
- Adjust quality thresholds in `hooks/useVolumeRenderer.ts`
- Customize UI in `components/viewer/VolumeViewer3D.tsx`
