/**
 * Canvas-based 3D Volume Renderer
 * Implements real ray casting for medical imaging
 */

export interface VolumeData {
    data: Float32Array
    dimensions: { width: number; height: number; depth: number }
    spacing: { x: number; y: number; z: number }
    min: number
    max: number
}

export interface TransferFunction {
    opacityPoints: Array<{ value: number; opacity: number }>
    colorPoints: Array<{ value: number; r: number; g: number; b: number }>
}

export interface Camera {
    position: { x: number; y: number; z: number }
    target: { x: number; y: number; z: number }
    up: { x: number; y: number; z: number }
    fov: number
}

export interface RenderSettings {
    mode: 'mip' | 'volume' | 'isosurface'
    stepSize: number
    isoValue?: number
    brightness: number
    contrast: number
}

/**
 * Load all frames and create 3D volume
 */
export async function createVolumeFromFrames(
    frameUrls: string[],
    onProgress?: (loaded: number, total: number) => void
): Promise<VolumeData> {
    console.log(`📦 Loading ${frameUrls.length} frames for volume...`)
    console.log(`📋 Frame URLs:`, frameUrls.slice(0, 3), '...') // Log first 3 URLs

    // Load all images
    const images = await Promise.all(
        frameUrls.map((url, index) =>
            loadImage(url).then(img => {
                onProgress?.(index + 1, frameUrls.length)
                console.log(`  ✓ Loaded frame ${index + 1}/${frameUrls.length}`)
                return img
            }).catch(err => {
                console.error(`  ✗ Failed to load frame ${index + 1}/${frameUrls.length}:`, err)
                throw err
            })
        )
    )

    if (images.length === 0) {
        throw new Error('No images loaded')
    }

    console.log(`✅ All ${images.length} images loaded successfully`)

    const width = images[0].width
    const height = images[0].height
    const depth = images.length

    console.log(`📐 Volume dimensions: ${width}x${height}x${depth}`)

    // Create volume data array
    const volumeSize = width * height * depth
    const volumeData = new Float32Array(volumeSize)

    let min = Infinity
    let max = -Infinity

    // Extract pixel data from each image
    for (let z = 0; z < depth; z++) {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!

        ctx.drawImage(images[z], 0, 0)
        const imageData = ctx.getImageData(0, 0, width, height)
        const pixels = imageData.data

        // Convert RGBA to grayscale and store in volume
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const pixelIndex = (y * width + x) * 4
                // Convert to grayscale (average RGB)
                const value = (pixels[pixelIndex] + pixels[pixelIndex + 1] + pixels[pixelIndex + 2]) / 3

                const volumeIndex = x + y * width + z * width * height
                volumeData[volumeIndex] = value

                min = Math.min(min, value)
                max = Math.max(max, value)
            }
        }
    }

    console.log(`✅ Volume created: min=${min.toFixed(2)}, max=${max.toFixed(2)}`)

    return {
        data: volumeData,
        dimensions: { width, height, depth },
        spacing: { x: 1, y: 1, z: 1 }, // Default spacing
        min,
        max
    }
}

/**
 * Load a single image
 */
function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
            console.log(`✅ Image loaded: ${url}`)
            resolve(img)
        }
        img.onerror = (error) => {
            console.error(`❌ Failed to load image: ${url}`, error)
            reject(new Error(`Failed to load image: ${url}`))
        }
        img.src = url
        console.log(`🔄 Loading image: ${url}`)
    })
}

/**
 * Sample volume at 3D position (trilinear interpolation)
 */
export function sampleVolume(
    volume: VolumeData,
    x: number,
    y: number,
    z: number
): number {
    const { data, dimensions } = volume
    const { width, height, depth } = dimensions

    // Clamp to volume bounds
    x = Math.max(0, Math.min(width - 1.001, x))
    y = Math.max(0, Math.min(height - 1.001, y))
    z = Math.max(0, Math.min(depth - 1.001, z))

    // Get integer and fractional parts
    const x0 = Math.floor(x), x1 = x0 + 1
    const y0 = Math.floor(y), y1 = y0 + 1
    const z0 = Math.floor(z), z1 = z0 + 1

    const fx = x - x0
    const fy = y - y0
    const fz = z - z0

    // Trilinear interpolation
    const c000 = getVoxel(data, x0, y0, z0, width, height, depth)
    const c001 = getVoxel(data, x0, y0, z1, width, height, depth)
    const c010 = getVoxel(data, x0, y1, z0, width, height, depth)
    const c011 = getVoxel(data, x0, y1, z1, width, height, depth)
    const c100 = getVoxel(data, x1, y0, z0, width, height, depth)
    const c101 = getVoxel(data, x1, y0, z1, width, height, depth)
    const c110 = getVoxel(data, x1, y1, z0, width, height, depth)
    const c111 = getVoxel(data, x1, y1, z1, width, height, depth)

    const c00 = c000 * (1 - fx) + c100 * fx
    const c01 = c001 * (1 - fx) + c101 * fx
    const c10 = c010 * (1 - fx) + c110 * fx
    const c11 = c011 * (1 - fx) + c111 * fx

    const c0 = c00 * (1 - fy) + c10 * fy
    const c1 = c01 * (1 - fy) + c11 * fy

    return c0 * (1 - fz) + c1 * fz
}

/**
 * Get voxel value at integer coordinates
 */
function getVoxel(
    data: Float32Array,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number
): number {
    if (x < 0 || x >= width || y < 0 || y >= height || z < 0 || z >= depth) {
        return 0
    }
    return data[x + y * width + z * width * height]
}

/**
 * Apply transfer function to get color and opacity
 */
export function applyTransferFunction(
    value: number,
    transferFunction: TransferFunction,
    volumeMin: number,
    volumeMax: number
): { r: number; g: number; b: number; a: number } {
    // Normalize value to 0-1
    const normalized = (value - volumeMin) / (volumeMax - volumeMin)

    // Get opacity
    let opacity = 0
    const opacityPoints = transferFunction.opacityPoints
    for (let i = 0; i < opacityPoints.length - 1; i++) {
        const p0 = opacityPoints[i]
        const p1 = opacityPoints[i + 1]
        if (normalized >= p0.value && normalized <= p1.value) {
            const t = (normalized - p0.value) / (p1.value - p0.value)
            opacity = p0.opacity + (p1.opacity - p0.opacity) * t
            break
        }
    }

    // Get color
    let r = 0, g = 0, b = 0
    const colorPoints = transferFunction.colorPoints
    for (let i = 0; i < colorPoints.length - 1; i++) {
        const p0 = colorPoints[i]
        const p1 = colorPoints[i + 1]
        if (normalized >= p0.value && normalized <= p1.value) {
            const t = (normalized - p0.value) / (p1.value - p0.value)
            r = p0.r + (p1.r - p0.r) * t
            g = p0.g + (p1.g - p0.g) * t
            b = p0.b + (p1.b - p0.b) * t
            break
        }
    }

    return { r, g, b, a: opacity }
}

/**
 * Maximum Intensity Projection (MIP)
 */
export function renderMIP(
    volume: VolumeData,
    camera: Camera,
    width: number,
    height: number
): ImageData {
    const imageData = new ImageData(width, height)
    const pixels = imageData.data

    const { dimensions } = volume
    const volumeCenter = {
        x: dimensions.width / 2,
        y: dimensions.height / 2,
        z: dimensions.depth / 2
    }

    // For each pixel in output image
    for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
            // Cast ray through volume
            const ray = getRay(px, py, width, height, camera, volumeCenter)

            let maxValue = 0
            const steps = Math.max(dimensions.width, dimensions.height, dimensions.depth) * 2

            for (let step = 0; step < steps; step++) {
                const t = step / steps
                const x = ray.origin.x + ray.direction.x * t * dimensions.width
                const y = ray.origin.y + ray.direction.y * t * dimensions.height
                const z = ray.origin.z + ray.direction.z * t * dimensions.depth

                const value = sampleVolume(volume, x, y, z)
                maxValue = Math.max(maxValue, value)
            }

            // Normalize and set pixel
            const normalized = (maxValue - volume.min) / (volume.max - volume.min)
            const intensity = Math.floor(normalized * 255)

            const pixelIndex = (py * width + px) * 4
            pixels[pixelIndex] = intensity
            pixels[pixelIndex + 1] = intensity
            pixels[pixelIndex + 2] = intensity
            pixels[pixelIndex + 3] = 255
        }
    }

    return imageData
}

/**
 * Volume Rendering with transfer function
 */
export function renderVolume(
    volume: VolumeData,
    camera: Camera,
    transferFunction: TransferFunction,
    width: number,
    height: number,
    stepSize: number = 0.5
): ImageData {
    const imageData = new ImageData(width, height)
    const pixels = imageData.data

    const { dimensions } = volume
    const volumeCenter = {
        x: dimensions.width / 2,
        y: dimensions.height / 2,
        z: dimensions.depth / 2
    }

    const maxDim = Math.max(dimensions.width, dimensions.height, dimensions.depth)
    const steps = Math.floor(maxDim * 2 / stepSize)

    // For each pixel in output image
    for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
            // Cast ray through volume
            const ray = getRay(px, py, width, height, camera, volumeCenter)

            let r = 0, g = 0, b = 0, a = 0

            // Ray marching
            for (let step = 0; step < steps; step++) {
                if (a >= 0.95) break // Early ray termination

                const t = step * stepSize / maxDim
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

            // Set pixel
            const pixelIndex = (py * width + px) * 4
            pixels[pixelIndex] = Math.floor(r * 255)
            pixels[pixelIndex + 1] = Math.floor(g * 255)
            pixels[pixelIndex + 2] = Math.floor(b * 255)
            pixels[pixelIndex + 3] = 255
        }
    }

    return imageData
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
    // Normalized device coordinates (-1 to 1)
    const ndcX = (px / width) * 2 - 1
    const ndcY = 1 - (py / height) * 2

    // Simple orthographic projection for now
    const origin = {
        x: volumeCenter.x + ndcX * volumeCenter.x,
        y: volumeCenter.y + ndcY * volumeCenter.y,
        z: camera.position.z
    }

    const direction = normalize({
        x: camera.target.x - camera.position.x,
        y: camera.target.y - camera.position.y,
        z: camera.target.z - camera.position.z
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
        z: v.z / length
    }
}

/**
 * Rotate camera around target
 */
export function rotateCamera(
    camera: Camera,
    deltaX: number,
    deltaY: number
): Camera {
    const radius = Math.sqrt(
        Math.pow(camera.position.x - camera.target.x, 2) +
        Math.pow(camera.position.y - camera.target.y, 2) +
        Math.pow(camera.position.z - camera.target.z, 2)
    )

    // Convert to spherical coordinates
    const dx = camera.position.x - camera.target.x
    const dy = camera.position.y - camera.target.y
    const dz = camera.position.z - camera.target.z

    let theta = Math.atan2(dx, dz)
    let phi = Math.acos(dy / radius)

    // Apply rotation
    theta += deltaX * 0.01
    phi += deltaY * 0.01
    phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi))

    // Convert back to Cartesian
    const newPosition = {
        x: camera.target.x + radius * Math.sin(phi) * Math.sin(theta),
        y: camera.target.y + radius * Math.cos(phi),
        z: camera.target.z + radius * Math.sin(phi) * Math.cos(theta)
    }

    return {
        ...camera,
        position: newPosition
    }
}

/**
 * Predefined transfer functions
 */
export const TRANSFER_FUNCTIONS = {
    'CT-Bone': {
        opacityPoints: [
            { value: 0, opacity: 0 },
            { value: 0.3, opacity: 0 },
            { value: 0.5, opacity: 0.5 },
            { value: 1, opacity: 0.9 }
        ],
        colorPoints: [
            { value: 0, r: 0, g: 0, b: 0 },
            { value: 0.5, r: 0.8, g: 0.7, b: 0.6 },
            { value: 1, r: 1, g: 1, b: 1 }
        ]
    },
    'CT-Soft-Tissue': {
        opacityPoints: [
            { value: 0, opacity: 0 },
            { value: 0.2, opacity: 0.1 },
            { value: 0.5, opacity: 0.3 },
            { value: 1, opacity: 0.7 }
        ],
        colorPoints: [
            { value: 0, r: 0, g: 0, b: 0 },
            { value: 0.3, r: 0.5, g: 0.3, b: 0.2 },
            { value: 0.7, r: 0.9, g: 0.7, b: 0.6 },
            { value: 1, r: 1, g: 0.9, b: 0.8 }
        ]
    },
    'MR-Default': {
        opacityPoints: [
            { value: 0, opacity: 0 },
            { value: 0.1, opacity: 0.1 },
            { value: 0.5, opacity: 0.5 },
            { value: 1, opacity: 0.9 }
        ],
        colorPoints: [
            { value: 0, r: 0, g: 0, b: 0 },
            { value: 0.5, r: 0.5, g: 0.5, b: 0.7 },
            { value: 1, r: 0.9, g: 0.9, b: 1 }
        ]
    }
}
