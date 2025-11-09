/**
 * Color Image Renderer for Echocardiograms and Color Ultrasound
 * Handles RGB, YBR_FULL, and other color photometric interpretations
 */

export interface ColorRenderingOptions {
  photometricInterpretation?: string;
  samplesPerPixel?: number;
  planarConfiguration?: number;
  bitsAllocated?: number;
}

/**
 * Convert YBR_FULL to RGB
 */
export function ybrToRgb(y: number, cb: number, cr: number): [number, number, number] {
  // ITU-R BT.601 conversion
  const r = Math.round(y + 1.402 * (cr - 128));
  const g = Math.round(y - 0.344136 * (cb - 128) - 0.714136 * (cr - 128));
  const b = Math.round(y + 1.772 * (cb - 128));
  
  return [
    Math.max(0, Math.min(255, r)),
    Math.max(0, Math.min(255, g)),
    Math.max(0, Math.min(255, b))
  ];
}

/**
 * Detect if image is color
 */
export function isColorImage(metadata: any): boolean {
  const photometric = metadata?.PhotometricInterpretation || '';
  const samplesPerPixel = parseInt(metadata?.SamplesPerPixel || '1');
  
  return (
    samplesPerPixel === 3 ||
    photometric === 'RGB' ||
    photometric === 'YBR_FULL' ||
    photometric === 'YBR_FULL_422' ||
    photometric === 'YBR_PARTIAL_422' ||
    photometric === 'PALETTE COLOR'
  );
}

/**
 * Render color image to canvas
 */
export function renderColorImage(
  canvas: HTMLCanvasElement,
  pixelData: Uint8Array | Uint16Array,
  width: number,
  height: number,
  options: ColorRenderingOptions = {}
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = width;
  canvas.height = height;

  const imageData = ctx.createImageData(width, height);
  const output = imageData.data;
  
  const {
    photometricInterpretation = 'RGB',
    samplesPerPixel = 3,
    planarConfiguration = 0,
    bitsAllocated = 8
  } = options;

  const pixelCount = width * height;
  const is16Bit = bitsAllocated > 8;

  if (photometricInterpretation === 'RGB') {
    // Direct RGB
    if (planarConfiguration === 0) {
      // Interleaved: RGBRGBRGB...
      for (let i = 0; i < pixelCount; i++) {
        const srcIdx = i * samplesPerPixel;
        const dstIdx = i * 4;
        
        if (is16Bit) {
          output[dstIdx] = (pixelData[srcIdx] as number) >> 8;     // R
          output[dstIdx + 1] = (pixelData[srcIdx + 1] as number) >> 8; // G
          output[dstIdx + 2] = (pixelData[srcIdx + 2] as number) >> 8; // B
        } else {
          output[dstIdx] = pixelData[srcIdx];     // R
          output[dstIdx + 1] = pixelData[srcIdx + 1]; // G
          output[dstIdx + 2] = pixelData[srcIdx + 2]; // B
        }
        output[dstIdx + 3] = 255; // A
      }
    } else {
      // Planar: RRR...GGG...BBB...
      for (let i = 0; i < pixelCount; i++) {
        const dstIdx = i * 4;
        
        if (is16Bit) {
          output[dstIdx] = (pixelData[i] as number) >> 8;                    // R
          output[dstIdx + 1] = (pixelData[pixelCount + i] as number) >> 8;   // G
          output[dstIdx + 2] = (pixelData[pixelCount * 2 + i] as number) >> 8; // B
        } else {
          output[dstIdx] = pixelData[i];                    // R
          output[dstIdx + 1] = pixelData[pixelCount + i];   // G
          output[dstIdx + 2] = pixelData[pixelCount * 2 + i]; // B
        }
        output[dstIdx + 3] = 255; // A
      }
    }
  } else if (photometricInterpretation.startsWith('YBR')) {
    // YBR color space - convert to RGB
    if (planarConfiguration === 0) {
      // Interleaved: YCbCrYCbCr...
      for (let i = 0; i < pixelCount; i++) {
        const srcIdx = i * samplesPerPixel;
        const dstIdx = i * 4;
        
        let y, cb, cr;
        if (is16Bit) {
          y = (pixelData[srcIdx] as number) >> 8;
          cb = (pixelData[srcIdx + 1] as number) >> 8;
          cr = (pixelData[srcIdx + 2] as number) >> 8;
        } else {
          y = pixelData[srcIdx];
          cb = pixelData[srcIdx + 1];
          cr = pixelData[srcIdx + 2];
        }
        
        const [r, g, b] = ybrToRgb(y, cb, cr);
        output[dstIdx] = r;
        output[dstIdx + 1] = g;
        output[dstIdx + 2] = b;
        output[dstIdx + 3] = 255;
      }
    } else {
      // Planar: YYY...CbCbCb...CrCrCr...
      for (let i = 0; i < pixelCount; i++) {
        const dstIdx = i * 4;
        
        let y, cb, cr;
        if (is16Bit) {
          y = (pixelData[i] as number) >> 8;
          cb = (pixelData[pixelCount + i] as number) >> 8;
          cr = (pixelData[pixelCount * 2 + i] as number) >> 8;
        } else {
          y = pixelData[i];
          cb = pixelData[pixelCount + i];
          cr = pixelData[pixelCount * 2 + i];
        }
        
        const [r, g, b] = ybrToRgb(y, cb, cr);
        output[dstIdx] = r;
        output[dstIdx + 1] = g;
        output[dstIdx + 2] = b;
        output[dstIdx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Auto-detect and render color image
 */
export function autoRenderColorImage(
  canvas: HTMLCanvasElement,
  pixelData: Uint8Array | Uint16Array,
  width: number,
  height: number,
  metadata: any
): boolean {
  if (!isColorImage(metadata)) {
    return false; // Not a color image
  }

  const options: ColorRenderingOptions = {
    photometricInterpretation: metadata.PhotometricInterpretation,
    samplesPerPixel: parseInt(metadata.SamplesPerPixel || '3'),
    planarConfiguration: parseInt(metadata.PlanarConfiguration || '0'),
    bitsAllocated: parseInt(metadata.BitsAllocated || '8')
  };

  renderColorImage(canvas, pixelData, width, height, options);
  return true; // Successfully rendered as color
}

export default {
  isColorImage,
  renderColorImage,
  autoRenderColorImage,
  ybrToRgb
};
