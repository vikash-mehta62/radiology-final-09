/**
 * Enhanced Canvas Renderer with Manual Pixel Manipulation
 * Provides diagnostic-grade rendering for medical images
 */

import { applyWindowLevel, applyPseudoColor, sharpenImage } from './pixelManipulation'

export interface RenderOptions {
  windowWidth: number
  windowLevel: number
  zoom: number
  panOffset: { x: number; y: number }
  invert?: boolean
  sharpen?: number
  pseudoColor?: 'hot' | 'cool' | 'rainbow' | 'bone' | null
  rotation?: number
}

/**
 * Render image with manual pixel manipulation
 * This replaces the simple ctx.drawImage() with advanced processing
 */
export async function renderImageWithPixelManipulation(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  options: RenderOptions
): Promise<void> {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return

  const { windowWidth, windowLevel, zoom, panOffset, invert, sharpen, pseudoColor, rotation } = options

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Calculate dimensions
  const scale = Math.min(canvas.width / image.width, canvas.height / image.height) * zoom
  const drawWidth = image.width * scale
  const drawHeight = image.height * scale
  const offsetX = (canvas.width - drawWidth) / 2 + panOffset.x
  const offsetY = (canvas.height - drawHeight) / 2 + panOffset.y

  // Step 1: Draw image to temporary canvas
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = image.width
  tempCanvas.height = image.height
  const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true })
  if (!tempCtx) return

  tempCtx.drawImage(image, 0, 0)

  // Step 2: Get pixel data
  let imageData = tempCtx.getImageData(0, 0, image.width, image.height)

  // Step 3: Apply window/level (manual pixel manipulation)
  imageData = applyWindowLevel(imageData, windowWidth, windowLevel)

  // Step 4: Apply inversion if needed
  if (invert) {
    const data = imageData.data
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i]
      data[i + 1] = 255 - data[i + 1]
      data[i + 2] = 255 - data[i + 2]
    }
  }

  // Step 5: Apply sharpening if needed
  if (sharpen && sharpen > 0) {
    imageData = sharpenImage(imageData, sharpen)
  }

  // Step 6: Apply pseudo-color if needed
  if (pseudoColor) {
    imageData = applyPseudoColor(imageData, pseudoColor)
  }

  // Step 7: Put processed data back to temp canvas
  tempCtx.putImageData(imageData, 0, 0)

  // Step 8: Draw to main canvas with transformations
  ctx.save()
  
  // Apply rotation if needed
  if (rotation) {
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.translate(-canvas.width / 2, -canvas.height / 2)
  }

  // Disable smoothing for crisp medical images
  ctx.imageSmoothingEnabled = false

  // Draw the processed image
  ctx.drawImage(tempCanvas, offsetX, offsetY, drawWidth, drawHeight)

  ctx.restore()

  // Store dimensions for measurements (on main canvas)
  canvas.dataset.imageWidth = drawWidth.toString()
  canvas.dataset.imageHeight = drawHeight.toString()
  canvas.dataset.offsetX = offsetX.toString()
  canvas.dataset.offsetY = offsetY.toString()
  canvas.dataset.originalWidth = image.width.toString()
  canvas.dataset.originalHeight = image.height.toString()
}

/**
 * Fast render without pixel manipulation (for real-time interactions)
 * Use this during pan/zoom for performance, then switch to full render
 */
export function renderImageFast(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  options: Pick<RenderOptions, 'zoom' | 'panOffset' | 'rotation'>
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const { zoom, panOffset, rotation } = options

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const scale = Math.min(canvas.width / image.width, canvas.height / image.height) * zoom
  const drawWidth = image.width * scale
  const drawHeight = image.height * scale
  const offsetX = (canvas.width - drawWidth) / 2 + panOffset.x
  const offsetY = (canvas.height - drawHeight) / 2 + panOffset.y

  ctx.save()
  
  if (rotation) {
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.translate(-canvas.width / 2, -canvas.height / 2)
  }

  ctx.imageSmoothingEnabled = false
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight)
  ctx.restore()

  // Store dimensions
  canvas.dataset.imageWidth = drawWidth.toString()
  canvas.dataset.imageHeight = drawHeight.toString()
  canvas.dataset.offsetX = offsetX.toString()
  canvas.dataset.offsetY = offsetY.toString()
  canvas.dataset.originalWidth = image.width.toString()
  canvas.dataset.originalHeight = image.height.toString()
}

/**
 * Debounce helper for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}
