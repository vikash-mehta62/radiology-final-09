/**
 * WebGL Detection and Capability Checking Utility
 * 
 * This module provides utilities to detect WebGL support and query GPU capabilities
 * for 3D volume rendering with VTK.js.
 */

/**
 * Interface representing WebGL capabilities of the current browser/GPU
 */
export interface WebGLCapabilities {
  /** Whether WebGL is supported at all */
  supported: boolean;
  /** WebGL version (1 or 2), null if not supported */
  version: 1 | 2 | null;
  /** Maximum 2D texture size */
  maxTextureSize: number;
  /** Maximum 3D texture size (0 if not supported) */
  maxTexture3DSize: number;
  /** Available WebGL extensions */
  extensions: string[];
  /** Estimated available GPU memory in MB (rough estimate) */
  estimatedGPUMemoryMB: number;
  /** GPU renderer string (if available) */
  renderer: string;
  /** GPU vendor string (if available) */
  vendor: string;
}

/**
 * Detects WebGL support and queries GPU capabilities
 * 
 * This function attempts to create a WebGL context and query various
 * capabilities that are important for 3D volume rendering.
 * 
 * @returns WebGLCapabilities object with detected capabilities
 */
export function detectWebGL(): WebGLCapabilities {
  const capabilities: WebGLCapabilities = {
    supported: false,
    version: null,
    maxTextureSize: 0,
    maxTexture3DSize: 0,
    extensions: [],
    estimatedGPUMemoryMB: 0,
    renderer: 'Unknown',
    vendor: 'Unknown',
  };

  // Create a temporary canvas for testing
  const canvas = document.createElement('canvas');
  
  // Try WebGL 2.0 first (preferred for VTK.js)
  let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  
  try {
    gl = canvas.getContext('webgl2') as WebGL2RenderingContext;
    if (gl) {
      capabilities.supported = true;
      capabilities.version = 2;
    }
  } catch (e) {
    // WebGL 2.0 not supported, will try WebGL 1.0
  }

  // Fall back to WebGL 1.0 if WebGL 2.0 is not available
  if (!gl) {
    try {
      gl = canvas.getContext('webgl') as WebGLRenderingContext || 
           canvas.getContext('experimental-webgl') as WebGLRenderingContext;
      if (gl) {
        capabilities.supported = true;
        capabilities.version = 1;
      }
    } catch (e) {
      // WebGL not supported at all
      return capabilities;
    }
  }

  // If we still don't have a context, WebGL is not supported
  if (!gl) {
    return capabilities;
  }

  // Query GPU capabilities
  try {
    // Max 2D texture size
    capabilities.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);

    // Max 3D texture size (WebGL 2.0 only)
    if (capabilities.version === 2) {
      const gl2 = gl as WebGL2RenderingContext;
      capabilities.maxTexture3DSize = gl2.getParameter(gl2.MAX_3D_TEXTURE_SIZE);
    } else {
      // WebGL 1.0 doesn't support 3D textures natively
      capabilities.maxTexture3DSize = 0;
    }

    // Get available extensions
    const extensionList = gl.getSupportedExtensions();
    if (extensionList) {
      capabilities.extensions = extensionList;
    }

    // Get GPU info (if available)
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      capabilities.renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'Unknown';
      capabilities.vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'Unknown';
    }

    // Estimate GPU memory (rough heuristic based on max texture size)
    capabilities.estimatedGPUMemoryMB = estimateGPUMemory(
      capabilities.maxTextureSize,
      capabilities.maxTexture3DSize
    );

  } catch (e) {
    console.warn('Error querying WebGL capabilities:', e);
  }

  // Clean up
  const loseContext = gl.getExtension('WEBGL_lose_context');
  if (loseContext) {
    loseContext.loseContext();
  }

  return capabilities;
}

/**
 * Estimates available GPU memory based on texture capabilities
 * 
 * This is a rough heuristic and not accurate, but provides a ballpark estimate.
 * 
 * @param maxTextureSize - Maximum 2D texture size
 * @param maxTexture3DSize - Maximum 3D texture size
 * @returns Estimated GPU memory in MB
 */
function estimateGPUMemory(maxTextureSize: number, maxTexture3DSize: number): number {
  // Very rough heuristic:
  // - maxTextureSize 4096 → ~512MB
  // - maxTextureSize 8192 → ~1024MB
  // - maxTextureSize 16384 → ~2048MB
  
  if (maxTextureSize >= 16384) {
    return 2048;
  } else if (maxTextureSize >= 8192) {
    return 1024;
  } else if (maxTextureSize >= 4096) {
    return 512;
  } else if (maxTextureSize >= 2048) {
    return 256;
  } else {
    return 128;
  }
}

/**
 * Checks if the GPU supports 3D textures (required for volume rendering)
 * 
 * @param capabilities - WebGL capabilities object
 * @returns true if 3D textures are supported
 */
export function supports3DTextures(capabilities: WebGLCapabilities): boolean {
  return capabilities.version === 2 && capabilities.maxTexture3DSize > 0;
}

/**
 * Checks if the GPU can handle a volume of given dimensions
 * 
 * @param capabilities - WebGL capabilities object
 * @param width - Volume width
 * @param height - Volume height
 * @param depth - Volume depth
 * @returns true if the volume can be rendered
 */
export function canRenderVolume(
  capabilities: WebGLCapabilities,
  width: number,
  height: number,
  depth: number
): boolean {
  if (!capabilities.supported || capabilities.version !== 2) {
    return false;
  }

  // Check if dimensions exceed max 3D texture size
  const maxDim = Math.max(width, height, depth);
  if (maxDim > capabilities.maxTexture3DSize) {
    return false;
  }

  // Estimate memory required (4 bytes per voxel for Float32)
  const requiredMemoryMB = (width * height * depth * 4) / (1024 * 1024);
  
  // Check if we have enough estimated GPU memory (with 50% safety margin)
  if (requiredMemoryMB * 1.5 > capabilities.estimatedGPUMemoryMB) {
    return false;
  }

  return true;
}

/**
 * Checks if a specific WebGL extension is available
 * 
 * @param capabilities - WebGL capabilities object
 * @param extensionName - Name of the extension to check
 * @returns true if the extension is available
 */
export function hasExtension(capabilities: WebGLCapabilities, extensionName: string): boolean {
  return capabilities.extensions.includes(extensionName);
}

/**
 * Checks if the GPU has sufficient capabilities for VTK.js volume rendering
 * 
 * @param capabilities - WebGL capabilities object
 * @returns Object with detailed capability check results
 */
export function checkVolumeRenderingCapabilities(capabilities: WebGLCapabilities): {
  canRender: boolean;
  reasons: string[];
  warnings: string[];
} {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let canRender = true;

  // Check WebGL 2.0 support
  if (!capabilities.supported) {
    canRender = false;
    reasons.push('WebGL is not supported');
  } else if (capabilities.version !== 2) {
    canRender = false;
    reasons.push('WebGL 2.0 is required (only WebGL 1.0 detected)');
  }

  // Check 3D texture support
  if (capabilities.maxTexture3DSize === 0) {
    canRender = false;
    reasons.push('3D textures are not supported');
  } else if (capabilities.maxTexture3DSize < 512) {
    warnings.push(`Max 3D texture size is small (${capabilities.maxTexture3DSize})`);
  }

  // Check 2D texture size
  if (capabilities.maxTextureSize < 2048) {
    warnings.push(`Max 2D texture size is small (${capabilities.maxTextureSize})`);
  }

  // Check GPU memory estimate
  if (capabilities.estimatedGPUMemoryMB < 256) {
    warnings.push(`Low estimated GPU memory (${capabilities.estimatedGPUMemoryMB}MB)`);
  }

  // Check for useful extensions
  const usefulExtensions = [
    'EXT_color_buffer_float',
    'OES_texture_float_linear',
    'EXT_float_blend'
  ];

  const missingExtensions = usefulExtensions.filter(
    ext => !hasExtension(capabilities, ext)
  );

  if (missingExtensions.length > 0) {
    warnings.push(`Missing optional extensions: ${missingExtensions.join(', ')}`);
  }

  return { canRender, reasons, warnings };
}

/**
 * Gets recommended quality settings based on GPU capabilities
 * 
 * @param capabilities - WebGL capabilities object
 * @returns Recommended quality level ('low', 'medium', or 'high')
 */
export function getRecommendedQuality(capabilities: WebGLCapabilities): 'low' | 'medium' | 'high' {
  if (!capabilities.supported || capabilities.version !== 2) {
    return 'low';
  }

  // High-end GPU
  if (capabilities.estimatedGPUMemoryMB >= 1024 && capabilities.maxTexture3DSize >= 2048) {
    return 'high';
  }

  // Mid-range GPU
  if (capabilities.estimatedGPUMemoryMB >= 512 && capabilities.maxTexture3DSize >= 1024) {
    return 'medium';
  }

  // Low-end GPU
  return 'low';
}

/**
 * Calculates maximum safe volume dimensions for the GPU
 * 
 * @param capabilities - WebGL capabilities object
 * @returns Maximum safe dimensions for each axis
 */
export function getMaxSafeVolumeDimensions(capabilities: WebGLCapabilities): {
  maxWidth: number;
  maxHeight: number;
  maxDepth: number;
} {
  if (!capabilities.supported || capabilities.version !== 2) {
    return { maxWidth: 0, maxHeight: 0, maxDepth: 0 };
  }

  // Use 75% of max 3D texture size as safe limit
  const safeLimit = Math.floor(capabilities.maxTexture3DSize * 0.75);

  return {
    maxWidth: safeLimit,
    maxHeight: safeLimit,
    maxDepth: safeLimit,
  };
}

/**
 * Estimates memory usage for a volume of given dimensions
 * 
 * @param width - Volume width
 * @param height - Volume height
 * @param depth - Volume depth
 * @param bytesPerVoxel - Bytes per voxel (default: 4 for Float32)
 * @returns Estimated memory usage in MB
 */
export function estimateVolumeMemoryUsage(
  width: number,
  height: number,
  depth: number,
  bytesPerVoxel: number = 4
): number {
  const totalBytes = width * height * depth * bytesPerVoxel;
  return totalBytes / (1024 * 1024);
}

/**
 * Gets a human-readable description of WebGL support status
 * 
 * @param capabilities - WebGL capabilities object
 * @returns Description string
 */
export function getWebGLStatusMessage(capabilities: WebGLCapabilities): string {
  if (!capabilities.supported) {
    return 'WebGL is not supported in your browser. 3D rendering will use slower canvas fallback.';
  }

  if (capabilities.version === 1) {
    return 'WebGL 1.0 detected. 3D volume rendering requires WebGL 2.0. Using canvas fallback.';
  }

  if (capabilities.maxTexture3DSize === 0) {
    return 'Your GPU does not support 3D textures. Using canvas fallback.';
  }

  return `WebGL 2.0 supported. GPU: ${capabilities.renderer}`;
}
