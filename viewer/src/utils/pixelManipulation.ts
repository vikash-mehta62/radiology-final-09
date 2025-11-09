/**
 * Advanced Pixel Manipulation Utilities
 * Provides diagnostic-grade image processing for medical imaging
 */

/**
 * Apply Window/Level (Brightness/Contrast) using manual pixel manipulation
 * This is the medical imaging standard for adjusting image display
 */
export function applyWindowLevel(
  imageData: ImageData,
  windowWidth: number,
  windowLevel: number
): ImageData {
  const data = imageData.data
  const length = data.length

  // Calculate window bounds
  const windowMin = windowLevel - windowWidth / 2
  const windowMax = windowLevel + windowWidth / 2

  // Process each pixel
  for (let i = 0; i < length; i += 4) {
    // Get original grayscale value (assuming R=G=B for medical images)
    const pixelValue = data[i]

    // Apply window/level transformation
    let newValue: number
    if (pixelValue <= windowMin) {
      newValue = 0
    } else if (pixelValue >= windowMax) {
      newValue = 255
    } else {
      // Linear interpolation within window
      newValue = ((pixelValue - windowMin) / windowWidth) * 255
    }

    // Apply to RGB channels (keep alpha unchanged)
    data[i] = newValue     // Red
    data[i + 1] = newValue // Green
    data[i + 2] = newValue // Blue
    // data[i + 3] is alpha - leave unchanged
  }

  return imageData
}

/**
 * Apply custom LUT (Look-Up Table) for color mapping
 */
export function applyLUT(
  imageData: ImageData,
  lut: number[][]
): ImageData {
  const data = imageData.data
  const length = data.length

  for (let i = 0; i < length; i += 4) {
    const pixelValue = data[i]
    const lutEntry = lut[pixelValue] || [pixelValue, pixelValue, pixelValue]

    data[i] = lutEntry[0]     // Red
    data[i + 1] = lutEntry[1] // Green
    data[i + 2] = lutEntry[2] // Blue
  }

  return imageData
}

/**
 * Invert image colors (useful for X-rays)
 */
export function invertImage(imageData: ImageData): ImageData {
  const data = imageData.data
  const length = data.length

  for (let i = 0; i < length; i += 4) {
    data[i] = 255 - data[i]         // Red
    data[i + 1] = 255 - data[i + 1] // Green
    data[i + 2] = 255 - data[i + 2] // Blue
  }

  return imageData
}

/**
 * Apply gamma correction
 */
export function applyGamma(
  imageData: ImageData,
  gamma: number
): ImageData {
  const data = imageData.data
  const length = data.length

  // Pre-calculate gamma LUT for performance
  const gammaLUT = new Uint8Array(256)
  for (let i = 0; i < 256; i++) {
    gammaLUT[i] = Math.pow(i / 255, gamma) * 255
  }

  for (let i = 0; i < length; i += 4) {
    data[i] = gammaLUT[data[i]]         // Red
    data[i + 1] = gammaLUT[data[i + 1]] // Green
    data[i + 2] = gammaLUT[data[i + 2]] // Blue
  }

  return imageData
}

/**
 * Apply sharpening filter
 */
export function sharpenImage(
  imageData: ImageData,
  amount: number = 1.0
): ImageData {
  const width = imageData.width
  const height = imageData.height
  const data = imageData.data
  const output = new Uint8ClampedArray(data)

  // Sharpening kernel
  const kernel = [
    0, -amount, 0,
    -amount, 1 + 4 * amount, -amount,
    0, -amount, 0
  ]

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) { // RGB channels only
        let sum = 0
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c
            const kernelIdx = (ky + 1) * 3 + (kx + 1)
            sum += data[idx] * kernel[kernelIdx]
          }
        }
        const outputIdx = (y * width + x) * 4 + c
        output[outputIdx] = Math.max(0, Math.min(255, sum))
      }
    }
  }

  return new ImageData(output, width, height)
}

/**
 * Apply pseudo-color (heat map) for enhanced visualization
 */
export function applyPseudoColor(
  imageData: ImageData,
  colorMap: 'hot' | 'cool' | 'rainbow' | 'bone' = 'hot'
): ImageData {
  const data = imageData.data
  const length = data.length

  for (let i = 0; i < length; i += 4) {
    const intensity = data[i] / 255

    let r, g, b
    switch (colorMap) {
      case 'hot':
        r = Math.min(255, intensity * 3 * 255)
        g = Math.min(255, Math.max(0, intensity * 3 - 1) * 255)
        b = Math.min(255, Math.max(0, intensity * 3 - 2) * 255)
        break
      case 'cool':
        r = intensity * 255
        g = (1 - intensity) * 255
        b = 255
        break
      case 'rainbow':
        const hue = intensity * 360
        const rgb = hslToRgb(hue, 100, 50)
        r = rgb[0]
        g = rgb[1]
        b = rgb[2]
        break
      case 'bone':
        r = (7 * intensity + 1) / 8 * 255
        g = (7 * intensity + 1) / 8 * 255
        b = (7 * intensity + 1) / 8 * 255
        break
      default:
        r = g = b = intensity * 255
    }

    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
  }

  return imageData
}

/**
 * Helper: HSL to RGB conversion
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100
  l /= 100

  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs((h / 60) % 2 - 1))
  const m = l - c / 2

  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else { r = c; g = 0; b = x }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  ]
}

/**
 * Apply histogram equalization for better contrast
 */
export function equalizeHistogram(imageData: ImageData): ImageData {
  const data = imageData.data
  const length = data.length

  // Calculate histogram
  const histogram = new Array(256).fill(0)
  for (let i = 0; i < length; i += 4) {
    histogram[data[i]]++
  }

  // Calculate cumulative distribution
  const cdf = new Array(256)
  cdf[0] = histogram[0]
  for (let i = 1; i < 256; i++) {
    cdf[i] = cdf[i - 1] + histogram[i]
  }

  // Normalize CDF
  const cdfMin = cdf.find(v => v > 0) || 0
  const totalPixels = length / 4
  const lut = new Uint8Array(256)
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.round(((cdf[i] - cdfMin) / (totalPixels - cdfMin)) * 255)
  }

  // Apply equalization
  for (let i = 0; i < length; i += 4) {
    const newValue = lut[data[i]]
    data[i] = newValue
    data[i + 1] = newValue
    data[i + 2] = newValue
  }

  return imageData
}

/**
 * Get pixel value at specific coordinates (for measurements)
 */
export function getPixelValue(
  imageData: ImageData,
  x: number,
  y: number
): number {
  const index = (y * imageData.width + x) * 4
  return imageData.data[index]
}

/**
 * Get region statistics (for ROI analysis)
 */
export function getRegionStats(
  imageData: ImageData,
  x: number,
  y: number,
  width: number,
  height: number
): {
  min: number
  max: number
  mean: number
  stdDev: number
} {
  const data = imageData.data
  const values: number[] = []

  for (let py = y; py < y + height; py++) {
    for (let px = x; px < x + width; px++) {
      const index = (py * imageData.width + px) * 4
      values.push(data[index])
    }
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
  const stdDev = Math.sqrt(variance)

  return { min, max, mean, stdDev }
}
