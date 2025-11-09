# VTK.js 3D Volume Rendering - Testing Guide

## Overview

This document describes the comprehensive test suite for the VTK.js 3D volume rendering migration. The tests cover all aspects of the implementation including volume loading, render modes, transfer functions, camera controls, performance, browser compatibility, fallback mechanisms, error handling, and memory cleanup.

## Test Structure

### Test Files

1. **`viewer/src/utils/__tests__/volumeRendererVTK.test.ts`**
   - Volume loading tests
   - Render mode tests
   - Transfer function tests
   - Camera control tests
   - Performance tests
   - Error handling tests
   - Memory cleanup tests

2. **`viewer/src/utils/__tests__/webglDetection.test.ts`**
   - Browser compatibility tests
   - WebGL capability detection tests

3. **`viewer/src/hooks/__tests__/useVolumeRenderer.test.ts`**
   - Fallback mechanism tests
   - Unified interface tests

## Running Tests

### Run All Tests
```bash
cd viewer
npm test
```

### Run Tests in Watch Mode
```bash
npm test -- --watch
```

### Run Tests with Coverage
```bash
npm test:coverage
```

### Run Specific Test File
```bash
npm test -- volumeRendererVTK.test.ts
```

### Run Tests with UI
```bash
npm test:ui
```

## Test Coverage

### 9.1 Volume Loading Tests

Tests volume loading with different sizes and validates GPU upload:

- ✅ Load 50-frame volume (512×512×50)
- ✅ Load 100-frame volume (512×512×100)
- ✅ Load 200-frame volume (512×512×200)
- ✅ Verify loading progress reporting
- ✅ Verify GPU memory allocation
- ✅ Handle invalid volume dimensions
- ✅ Handle mismatched data array size

**Requirements Covered:** 1.4, 1.5, 11.2

### 9.2 Render Mode Tests

Tests switching between different rendering modes:

- ✅ Switch to MIP mode
- ✅ Switch to Volume mode
- ✅ Switch to Isosurface mode
- ✅ Verify smooth transitions (<500ms)
- ✅ Maintain camera position when switching modes

**Requirements Covered:** 2.7, 8.4, 11.3

### 9.3 Transfer Function Tests

Tests applying and switching between transfer function presets:

- ✅ Apply CT-Bone preset
- ✅ Apply CT-Soft-Tissue preset
- ✅ Apply MR-Default preset
- ✅ Adjust opacity in real-time
- ✅ Handle transfer functions with multiple control points
- ✅ Smooth transitions between presets

**Requirements Covered:** 2.2, 7.3, 11.4

### 9.4 Camera Control Tests

Tests camera interaction and controls:

- ✅ Mouse drag rotation
- ✅ Mouse wheel zoom
- ✅ Reset camera to default position
- ✅ Auto-rotation with configurable speed
- ✅ Immediate response to interactions (<16ms)
- ✅ Enable/disable interaction

**Requirements Covered:** 2.3, 2.4, 9.5, 11.5

### 9.5 Performance Tests

Tests rendering performance and metrics:

- ✅ Achieve 60 FPS for 512×512×100 volume
- ✅ Achieve 30 FPS for 512×512×200 volume
- ✅ Load volume in under 3 seconds
- ✅ Interaction latency under 16ms
- ✅ Accurate performance metrics reporting
- ✅ Maintain performance with quality settings

**Requirements Covered:** 3.1, 3.2, 3.3, 3.4, 11.6

### 9.6 Browser Compatibility Tests

Tests WebGL detection and browser support:

- ✅ Detect WebGL 2.0 support (Chrome 90+)
- ✅ Detect WebGL 2.0 support (Firefox 88+)
- ✅ Detect WebGL 2.0 support (Safari 14+)
- ✅ Detect WebGL 2.0 support (Edge 90+)
- ✅ Detect GPU renderer information
- ✅ Detect maximum texture sizes
- ✅ Detect available WebGL extensions
- ✅ Estimate GPU memory

**Requirements Covered:** 11.1

### 9.7 Fallback Mechanism Tests

Tests graceful fallback to canvas rendering:

- ✅ Use VTK.js when WebGL 2.0 is supported
- ✅ Fall back to canvas when WebGL is not supported
- ✅ Fall back to canvas when only WebGL 1.0 is available
- ✅ Display warning message when falling back
- ✅ Verify all features work in canvas mode
- ✅ Handle VTK.js initialization failure gracefully
- ✅ Provide unified interface for both renderers

**Requirements Covered:** 10.1, 10.4

### 9.8 Error Handling Tests

Tests error handling and recovery:

- ✅ Handle oversized volume with clear error message
- ✅ Handle invalid data with clear error message
- ✅ Handle invalid dimensions with clear error message
- ✅ Handle invalid spacing with clear error message
- ✅ Simulate WebGL context loss
- ✅ Handle WebGL context restoration
- ✅ Verify error messages are user-friendly
- ✅ Handle GPU memory exhaustion gracefully
- ✅ Clean up resources after error

**Requirements Covered:** 10.2, 10.3, 10.5

### 9.9 Memory Cleanup Tests

Tests proper resource cleanup and memory management:

- ✅ Load multiple volumes sequentially without memory leaks
- ✅ Verify GPU memory is released after dispose
- ✅ Check for memory leaks with repeated load/dispose cycles
- ✅ Test unmount cleanup
- ✅ Clean up event listeners on dispose
- ✅ Handle dispose called multiple times
- ✅ Clean up WebGL resources properly
- ✅ No memory leaks when switching render modes
- ✅ No memory leaks when changing transfer functions

**Requirements Covered:** 4.2, 4.3

## Test Configuration

### Vitest Configuration

The test suite uses Vitest with the following configuration:

```typescript
{
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./src/test/setup.ts'],
  coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'html']
  }
}
```

### Test Setup

The test setup file (`viewer/src/test/setup.ts`) provides:

- Mock WebGL context
- Mock WebGL2RenderingContext
- Mock requestAnimationFrame
- Mock performance.now
- Mock Worker
- Automatic cleanup after each test

## Mocking Strategy

### VTK.js Mocking

VTK.js modules are mocked to avoid requiring actual WebGL context in tests:

```typescript
vi.mock('@kitware/vtk.js/Rendering/Profiles/Volume', () => ({}))
vi.mock('@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow', () => ({
  default: {
    newInstance: vi.fn(() => mockRenderer)
  }
}))
```

### WebGL Mocking

WebGL context is mocked to simulate GPU capabilities:

```typescript
class MockWebGLRenderingContext {
  getParameter(param: number) {
    if (param === 0x0D33) return 16384 // MAX_TEXTURE_SIZE
    if (param === 0x8073) return 2048 // MAX_3D_TEXTURE_SIZE
    return 0
  }
}
```

## Performance Benchmarks

### Expected Performance Metrics

| Volume Size | Target FPS | Load Time | GPU Memory |
|-------------|-----------|-----------|------------|
| 512×512×50  | 60 FPS    | <2s       | ~50 MB     |
| 512×512×100 | 60 FPS    | <3s       | ~100 MB    |
| 512×512×200 | 30 FPS    | <3s       | ~200 MB    |

### Quality Settings Impact

| Quality | Sample Distance | Max Samples | Expected FPS |
|---------|----------------|-------------|--------------|
| Low     | 2.0            | 500         | 60 FPS       |
| Medium  | 1.0            | 1000        | 30-45 FPS    |
| High    | 0.5            | 2000        | 15-30 FPS    |

## Troubleshooting

### Common Test Failures

#### WebGL Context Not Available

**Symptom:** Tests fail with "WebGL context creation failed"

**Solution:** Ensure test setup properly mocks WebGL2RenderingContext:
```typescript
global.WebGL2RenderingContext = MockWebGLRenderingContext as any
```

#### VTK.js Module Not Found

**Symptom:** Tests fail with "Cannot find module '@kitware/vtk.js'"

**Solution:** Ensure VTK.js modules are properly mocked in test file

#### Memory Leak Detection

**Symptom:** Memory cleanup tests fail

**Solution:** Verify dispose() is called and all resources are cleaned up

### Running Tests in CI/CD

For CI/CD environments, use headless mode:

```bash
npm test -- --run --reporter=json --outputFile=test-results.json
```

## Test Maintenance

### Adding New Tests

1. Create test file in `__tests__` directory
2. Import necessary utilities and mocks
3. Write descriptive test cases
4. Verify tests pass locally
5. Update this documentation

### Updating Mocks

When VTK.js API changes:

1. Update mock implementations in test files
2. Verify all tests still pass
3. Update test expectations if needed

## Coverage Goals

- **Line Coverage:** >80%
- **Branch Coverage:** >75%
- **Function Coverage:** >85%
- **Statement Coverage:** >80%

## Continuous Integration

Tests are automatically run on:

- Pull requests
- Commits to main branch
- Nightly builds

## Related Documentation

- [VTK.js Migration Design](../../../.kiro/specs/vtk-3d-migration/design.md)
- [VTK.js Migration Requirements](../../../.kiro/specs/vtk-3d-migration/requirements.md)
- [VTK.js Migration Tasks](../../../.kiro/specs/vtk-3d-migration/tasks.md)

## Success Criteria

All tests must pass before the VTK.js migration is considered complete:

- ✅ All volume loading tests pass
- ✅ All render mode tests pass
- ✅ All transfer function tests pass
- ✅ All camera control tests pass
- ✅ All performance tests meet targets
- ✅ All browser compatibility tests pass
- ✅ All fallback mechanism tests pass
- ✅ All error handling tests pass
- ✅ All memory cleanup tests pass

## Contact

For questions or issues with the test suite, please contact the development team.
