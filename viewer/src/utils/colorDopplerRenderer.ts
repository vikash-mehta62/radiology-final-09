/**
 * Color Doppler Ultrasound Renderer
 * Handles RGB color rendering for Doppler ultrasound images
 */

export interface DopplerColorMap {
  name: string;
  colors: [number, number, number][]; // RGB values
}

// Predefined Doppler color maps
export const DOPPLER_COLOR_MAPS: Record<string, DopplerColorMap> = {
  redBlue: {
    name: 'Red-Blue (Standard)',
    colors: [
      [0, 0, 255],     // Blue (away)
      [0, 0, 128],
      [0, 0, 0],       // Black (no flow)
      [128, 0, 0],
      [255, 0, 0]      // Red (towards)
    ]
  },
  rainbow: {
    name: 'Rainbow',
    colors: [
      [0, 0, 255],     // Blue
      [0, 255, 255],   // Cyan
      [0, 255, 0],     // Green
      [255, 255, 0],   // Yellow
      [255, 0, 0]      // Red
    ]
  },
  heatMap: {
    name: 'Heat Map',
    colors: [
      [0, 0, 0],       // Black
      [128, 0, 128],   // Purple
      [255, 0, 0],     // Red
      [255, 128, 0],   // Orange
      [255, 255, 0]    // Yellow
    ]
  }
};

/**
 * Apply color map to grayscale pixel data
 */
export function applyColorMap(
  pixelData: Uint8Array | Uint16Array,
  colorMap: DopplerColorMap,
  outputData: Uint8ClampedArray
): void {
  const colors = colorMap.colors;
  const numColors = colors.length;

  for (let i = 0; i < pixelData.length; i++) {
    const value = pixelData[i];
    const maxValue = pixelData instanceof Uint16Array ? 65535 : 255;
    
    // Normalize to 0-1
    const normalized = value / maxValue;
    
    // Map to color
    const colorIndex = normalized * (numColors - 1);
    const lowerIndex = Math.floor(colorIndex);
    const upperIndex = Math.min(lowerIndex + 1, numColors - 1);
    const fraction = colorIndex - lowerIndex;
    
    const lowerColor = colors[lowerIndex];
    const upperColor = colors[upperIndex];
    
    // Interpolate between colors
    const r = Math.round(lowerColor[0] + (upperColor[0] - lowerColor[0]) * fraction);
    const g = Math.round(lowerColor[1] + (upperColor[1] - lowerColor[1]) * fraction);
    const b = Math.round(lowerColor[2] + (upperColor[2] - lowerColor[2]) * fraction);
    
    // Set RGBA
    const pixelIndex = i * 4;
    outputData[pixelIndex] = r;
    outputData[pixelIndex + 1] = g;
    outputData[pixelIndex + 2] = b;
    outputData[pixelIndex + 3] = 255; // Alpha
  }
}

/**
 * Detect if image is likely a Doppler ultrasound
 */
export function isDopplerImage(metadata: any): boolean {
  const modality = metadata?.Modality || metadata?.modality;
  const imageType = metadata?.ImageType || metadata?.imageType || '';
  const photometricInterpretation = metadata?.PhotometricInterpretation || '';
  
  return (
    modality === 'US' &&
    (imageType.includes('COLOR') ||
     imageType.includes('DOPPLER') ||
     photometricInterpretation === 'RGB' ||
     photometricInterpretation === 'YBR_FULL')
  );
}

/**
 * Render Doppler image to canvas
 */
export function renderDopplerToCanvas(
  canvas: HTMLCanvasElement,
  pixelData: Uint8Array | Uint16Array,
  width: number,
  height: number,
  colorMap: DopplerColorMap = DOPPLER_COLOR_MAPS.redBlue
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = width;
  canvas.height = height;

  const imageData = ctx.createImageData(width, height);
  applyColorMap(pixelData, colorMap, imageData.data);
  
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Create color bar legend
 */
export function createColorBarLegend(
  canvas: HTMLCanvasElement,
  colorMap: DopplerColorMap,
  labels: string[] = ['Away', 'No Flow', 'Towards']
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = 30;
  const height = 200;
  canvas.width = width;
  canvas.height = height;

  // Draw color gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  const colors = colorMap.colors;
  
  colors.forEach((color, index) => {
    const position = index / (colors.length - 1);
    gradient.addColorStop(position, `rgb(${color[0]}, ${color[1]}, ${color[2]})`);
  });

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Draw border
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, width, height);

  // Draw labels
  ctx.fillStyle = '#fff';
  ctx.font = '10px Arial';
  ctx.textAlign = 'left';
  
  labels.forEach((label, index) => {
    const y = (height / (labels.length - 1)) * index;
    ctx.fillText(label, width + 5, y + 5);
  });
}

export default {
  DOPPLER_COLOR_MAPS,
  applyColorMap,
  isDopplerImage,
  renderDopplerToCanvas,
  createColorBarLegend
};
