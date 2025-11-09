/**
 * Web Worker for 3D Volume Rendering
 * Offloads rendering to background thread to keep UI responsive
 */

import {
  VolumeData,
  Camera,
  TransferFunction,
  RenderSettings,
  sampleVolume,
  applyTransferFunction,
} from '../utils/volumeRenderer'

interface RenderMessage {
  type: 'render'
  volume: VolumeData
  camera: Camera
  transferFunction: TransferFunction
  settings: RenderSettings
  width: number
  height: number
}

interface RenderResponse {
  type: 'rendered'
  imageData: ImageData
  renderTime: number
}

// Worker message handler
self.onmessage = (e: MessageEvent<RenderMessage>) => {
  const { type, volume, camera, transferFunction, settings, width, height } = e.data

  if (type === 'render') {
    const startTime = performance.now()

    try {
      const imageData = renderVolume(volume, camera, transferFunction, settings, width, height)
      const renderTime = performance.now() - startTime

      const response: RenderResponse = {
        type: 'rendered',
        imageData,
        renderTime,
      }

      // Transfer imageData buffer for zero-copy
      // @ts-ignore - Worker postMessage transfer array
      self.postMessage(response, { transfer: [imageData.data.buffer] })
    } catch (error) {
      self.postMessage({
        type: 'error',
        error: error instanceof Error ? error.message : 'Render failed',
      })
    }
  }
}

/**
 * Render volume in worker thread
 */
function renderVolume(
  volume: VolumeData,
  camera: Camera,
  transferFunction: TransferFunction,
  settings: RenderSettings,
  width: number,
  height: number
): ImageData {
  const imageData = new ImageData(width, height)
  const pixels = imageData.data

  const { dimensions } = volume
  const volumeCenter = {
    x: dimensions.width / 2,
    y: dimensions.height / 2,
    z: dimensions.depth / 2,
  }

  const maxDim = Math.max(dimensions.width, dimensions.height, dimensions.depth)
  const steps = Math.floor(maxDim * 2 / settings.stepSize)

  // Render based on mode
  if (settings.mode === 'mip') {
    renderMIP(volume, camera, volumeCenter, width, height, steps, pixels)
  } else if (settings.mode === 'volume') {
    renderVolumeMode(
      volume,
      camera,
      transferFunction,
      volumeCenter,
      width,
      height,
      steps,
      settings,
      pixels
    )
  } else {
    renderIsosurface(
      volume,
      camera,
      transferFunction,
      volumeCenter,
      width,
      height,
      steps,
      settings,
      pixels
    )
  }

  return imageData
}

/**
 * MIP rendering
 */
function renderMIP(
  volume: VolumeData,
  camera: Camera,
  volumeCenter: { x: number; y: number; z: number },
  width: number,
  height: number,
  steps: number,
  pixels: Uint8ClampedArray
) {
  const { dimensions } = volume

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const ray = getRay(px, py, width, height, camera, volumeCenter)

      let maxValue = 0

      for (let step = 0; step < steps; step++) {
        const t = step / steps
        const x = ray.origin.x + ray.direction.x * t * dimensions.width
        const y = ray.origin.y + ray.direction.y * t * dimensions.height
        const z = ray.origin.z + ray.direction.z * t * dimensions.depth

        const value = sampleVolume(volume, x, y, z)
        maxValue = Math.max(maxValue, value)
      }

      const normalized = (maxValue - volume.min) / (volume.max - volume.min)
      const intensity = Math.floor(normalized * 255)

      const pixelIndex = (py * width + px) * 4
      pixels[pixelIndex] = intensity
      pixels[pixelIndex + 1] = intensity
      pixels[pixelIndex + 2] = intensity
      pixels[pixelIndex + 3] = 255
    }
  }
}

/**
 * Volume rendering
 */
function renderVolumeMode(
  volume: VolumeData,
  camera: Camera,
  transferFunction: TransferFunction,
  volumeCenter: { x: number; y: number; z: number },
  width: number,
  height: number,
  steps: number,
  settings: RenderSettings,
  pixels: Uint8ClampedArray
) {
  const { dimensions } = volume

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const ray = getRay(px, py, width, height, camera, volumeCenter)

      let r = 0, g = 0, b = 0, a = 0

      for (let step = 0; step < steps; step++) {
        if (a >= 0.95) break // Early ray termination

        const t = step * settings.stepSize / Math.max(dimensions.width, dimensions.height, dimensions.depth)
        const x = ray.origin.x + ray.direction.x * t * dimensions.width
        const y = ray.origin.y + ray.direction.y * t * dimensions.height
        const z = ray.origin.z + ray.direction.z * t * dimensions.depth

        const value = sampleVolume(volume, x, y, z)
        const color = applyTransferFunction(value, transferFunction, volume.min, volume.max)

        // Front-to-back compositing
        const weight = color.a * (1 - a)
        r += color.r * weight
        g += color.g * weight
        b += color.b * weight
        a += weight
      }

      const pixelIndex = (py * width + px) * 4
      pixels[pixelIndex] = Math.floor(r * 255 * settings.brightness)
      pixels[pixelIndex + 1] = Math.floor(g * 255 * settings.brightness)
      pixels[pixelIndex + 2] = Math.floor(b * 255 * settings.brightness)
      pixels[pixelIndex + 3] = 255
    }
  }
}

/**
 * Isosurface rendering
 */
function renderIsosurface(
  volume: VolumeData,
  camera: Camera,
  transferFunction: TransferFunction,
  volumeCenter: { x: number; y: number; z: number },
  width: number,
  height: number,
  steps: number,
  settings: RenderSettings,
  pixels: Uint8ClampedArray
) {
  const { dimensions } = volume
  const isoValue = settings.isoValue || 0.5

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const ray = getRay(px, py, width, height, camera, volumeCenter)

      let found = false

      for (let step = 0; step < steps; step++) {
        const t = step / steps
        const x = ray.origin.x + ray.direction.x * t * dimensions.width
        const y = ray.origin.y + ray.direction.y * t * dimensions.height
        const z = ray.origin.z + ray.direction.z * t * dimensions.depth

        const value = sampleVolume(volume, x, y, z)
        const normalized = (value - volume.min) / (volume.max - volume.min)

        if (normalized >= isoValue) {
          const color = applyTransferFunction(value, transferFunction, volume.min, volume.max)

          const pixelIndex = (py * width + px) * 4
          pixels[pixelIndex] = Math.floor(color.r * 255)
          pixels[pixelIndex + 1] = Math.floor(color.g * 255)
          pixels[pixelIndex + 2] = Math.floor(color.b * 255)
          pixels[pixelIndex + 3] = 255

          found = true
          break
        }
      }

      if (!found) {
        const pixelIndex = (py * width + px) * 4
        pixels[pixelIndex] = 0
        pixels[pixelIndex + 1] = 0
        pixels[pixelIndex + 2] = 0
        pixels[pixelIndex + 3] = 255
      }
    }
  }
}

/**
 * Get ray for pixel
 */
function getRay(
  px: number,
  py: number,
  width: number,
  height: number,
  camera: Camera,
  volumeCenter: { x: number; y: number; z: number }
) {
  const ndcX = (px / width) * 2 - 1
  const ndcY = 1 - (py / height) * 2

  const origin = {
    x: volumeCenter.x + ndcX * volumeCenter.x,
    y: volumeCenter.y + ndcY * volumeCenter.y,
    z: camera.position.z,
  }

  const direction = normalize({
    x: camera.target.x - camera.position.x,
    y: camera.target.y - camera.position.y,
    z: camera.target.z - camera.position.z,
  })

  return { origin, direction }
}

/**
 * Normalize vector
 */
function normalize(v: { x: number; y: number; z: number }) {
  const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
  return {
    x: v.x / length,
    y: v.y / length,
    z: v.z / length,
  }
}
