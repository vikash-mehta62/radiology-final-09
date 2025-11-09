/**
 * Color utility functions for annotation visibility
 */

/**
 * Calculate relative luminance of a color (WCAG formula)
 * @param color - Hex color string (e.g., '#ff0000' or 'rgb(255, 0, 0)')
 * @returns Luminance value between 0 and 1
 */
export function getColorLuminance(color: string): number {
  // Convert color to RGB
  let r = 0, g = 0, b = 0

  if (color.startsWith('#')) {
    // Hex color
    const hex = color.replace('#', '')
    r = parseInt(hex.substring(0, 2), 16)
    g = parseInt(hex.substring(2, 4), 16)
    b = parseInt(hex.substring(4, 6), 16)
  } else if (color.startsWith('rgb')) {
    // RGB color
    const match = color.match(/\d+/g)
    if (match) {
      r = parseInt(match[0])
      g = parseInt(match[1])
      b = parseInt(match[2])
    }
  }

  // Normalize to 0-1 range
  const rNorm = r / 255
  const gNorm = g / 255
  const bNorm = b / 255

  // Apply gamma correction
  const rLinear = rNorm <= 0.03928 ? rNorm / 12.92 : Math.pow((rNorm + 0.055) / 1.055, 2.4)
  const gLinear = gNorm <= 0.03928 ? gNorm / 12.92 : Math.pow((gNorm + 0.055) / 1.055, 2.4)
  const bLinear = bNorm <= 0.03928 ? bNorm / 12.92 : Math.pow((bNorm + 0.055) / 1.055, 2.4)

  // Calculate luminance
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear
}

/**
 * Calculate contrast ratio between two colors (WCAG formula)
 * @param color1 - First color
 * @param color2 - Second color
 * @returns Contrast ratio (1 to 21)
 */
export function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getColorLuminance(color1)
  const lum2 = getColorLuminance(color2)
  const lighter = Math.max(lum1, lum2)
  const darker = Math.min(lum1, lum2)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Check if a color is too dark (close to black)
 * @param color - Color to check
 * @returns True if color is too dark
 */
export function isColorTooDark(color: string): boolean {
  const luminance = getColorLuminance(color)
  return luminance < 0.1 // Threshold for "too dark"
}

/**
 * Check if a color is too light (close to white)
 * @param color - Color to check
 * @returns True if color is too light
 */
export function isColorTooLight(color: string): boolean {
  const luminance = getColorLuminance(color)
  return luminance > 0.9 // Threshold for "too light"
}

/**
 * Get a contrasting color for text based on background
 * @param backgroundColor - Background color
 * @returns Contrasting text color (black or white)
 */
export function getContrastingTextColor(backgroundColor: string): string {
  const luminance = getColorLuminance(backgroundColor)
  return luminance > 0.5 ? '#000000' : '#ffffff'
}

/**
 * Ensure annotation color is visible on medical images (typically dark backgrounds)
 * @param color - Original color
 * @param minLuminance - Minimum luminance threshold (default 0.3)
 * @returns Adjusted color that's guaranteed to be visible
 */
export function ensureVisibleColor(color: string, minLuminance: number = 0.3): string {
  const luminance = getColorLuminance(color)
  
  // If color is too dark, return a bright alternative
  if (luminance < minLuminance) {
    // Map dark colors to bright equivalents
    if (color.toLowerCase().includes('00') || color === '#000000' || color === 'black') {
      return '#00ff41' // Bright green (default)
    }
    
    // Try to brighten the color
    return brightenColor(color, minLuminance)
  }
  
  return color
}

/**
 * Brighten a color to meet minimum luminance
 * @param color - Original color
 * @param targetLuminance - Target luminance
 * @returns Brightened color
 */
export function brightenColor(color: string, targetLuminance: number): string {
  // Convert to RGB
  let r = 0, g = 0, b = 0

  if (color.startsWith('#')) {
    const hex = color.replace('#', '')
    r = parseInt(hex.substring(0, 2), 16)
    g = parseInt(hex.substring(2, 4), 16)
    b = parseInt(hex.substring(4, 6), 16)
  } else if (color.startsWith('rgb')) {
    const match = color.match(/\d+/g)
    if (match) {
      r = parseInt(match[0])
      g = parseInt(match[1])
      b = parseInt(match[2])
    }
  }

  // Calculate brightness factor needed
  const currentLuminance = getColorLuminance(color)
  const factor = Math.sqrt(targetLuminance / Math.max(currentLuminance, 0.01))

  // Apply factor (capped at 255)
  r = Math.min(255, Math.round(r * factor))
  g = Math.min(255, Math.round(g * factor))
  b = Math.min(255, Math.round(b * factor))

  // Convert back to hex
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/**
 * Get recommended colors for medical image annotations
 * These colors have good visibility on dark backgrounds
 */
export const MEDICAL_ANNOTATION_COLORS = {
  green: '#00ff41',      // Bright green (default)
  cyan: '#00ffff',       // Cyan
  yellow: '#ffff00',     // Yellow
  magenta: '#ff00ff',    // Magenta
  orange: '#ff8800',     // Orange
  red: '#ff0000',        // Red
  blue: '#0088ff',       // Bright blue
  white: '#ffffff',      // White
  lime: '#88ff00',       // Lime
  pink: '#ff0088',       // Pink
}

/**
 * Validate and fix annotation color
 * @param color - Color to validate
 * @param defaultColor - Default color if validation fails
 * @returns Valid, visible color
 */
export function validateAnnotationColor(color: string | undefined, defaultColor: string = MEDICAL_ANNOTATION_COLORS.green): string {
  if (!color) {
    return defaultColor
  }

  // Ensure color is visible
  return ensureVisibleColor(color)
}
