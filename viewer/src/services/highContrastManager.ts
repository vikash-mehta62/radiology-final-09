/**
 * High Contrast Manager
 * 
 * Manages high contrast mode for better accessibility
 */

import type { Annotation, AnnotationStyle } from '../types/viewer'

export interface HighContrastTheme {
  selectionColor: string
  hoverColor: string
  annotationStrokeColor: string
  annotationFillColor: string
  controlPointColor: string
  controlPointBorderColor: string
  backgroundColor: string
  textColor: string
  strokeWidth: number
  controlPointSize: number
  glowEnabled: boolean
}

class HighContrastManager {
  private isHighContrast = false
  private prefersReducedMotion = false
  private mediaQueryList: MediaQueryList | null = null
  private reducedMotionQueryList: MediaQueryList | null = null
  private listeners: Array<(isHighContrast: boolean) => void> = []

  // High contrast theme
  private highContrastTheme: HighContrastTheme = {
    selectionColor: '#000000',
    hoverColor: '#333333',
    annotationStrokeColor: '#000000',
    annotationFillColor: 'rgba(255, 255, 255, 0.3)',
    controlPointColor: '#ffffff',
    controlPointBorderColor: '#000000',
    backgroundColor: '#ffffff',
    textColor: '#000000',
    strokeWidth: 3,
    controlPointSize: 12,
    glowEnabled: false,
  }

  // Normal theme
  private normalTheme: HighContrastTheme = {
    selectionColor: '#2196f3',
    hoverColor: '#64b5f6',
    annotationStrokeColor: '#00ff41',
    annotationFillColor: 'rgba(0, 255, 65, 0.2)',
    controlPointColor: '#f0f0f0',
    controlPointBorderColor: '#333333',
    backgroundColor: '#000000',
    textColor: '#ffffff',
    strokeWidth: 2,
    controlPointSize: 8,
    glowEnabled: true,
  }

  /**
   * Initialize high contrast detection
   */
  initialize(): void {
    // Detect high contrast preference
    if (window.matchMedia) {
      this.mediaQueryList = window.matchMedia('(prefers-contrast: high)')
      this.isHighContrast = this.mediaQueryList.matches

      // Listen for changes
      this.mediaQueryList.addEventListener('change', this.handleContrastChange)

      // Detect reduced motion preference
      this.reducedMotionQueryList = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      )
      this.prefersReducedMotion = this.reducedMotionQueryList.matches

      this.reducedMotionQueryList.addEventListener(
        'change',
        this.handleReducedMotionChange
      )
    }
  }

  /**
   * Handle contrast preference change
   */
  private handleContrastChange = (e: MediaQueryListEvent): void => {
    this.isHighContrast = e.matches
    this.notifyListeners()
  }

  /**
   * Handle reduced motion preference change
   */
  private handleReducedMotionChange = (e: MediaQueryListEvent): void => {
    this.prefersReducedMotion = e.matches
  }

  /**
   * Add listener for contrast changes
   */
  addListener(listener: (isHighContrast: boolean) => void): void {
    this.listeners.push(listener)
  }

  /**
   * Remove listener
   */
  removeListener(listener: (isHighContrast: boolean) => void): void {
    this.listeners = this.listeners.filter((l) => l !== listener)
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.isHighContrast))
  }

  /**
   * Check if high contrast mode is enabled
   */
  isHighContrastMode(): boolean {
    return this.isHighContrast
  }

  /**
   * Check if reduced motion is preferred
   */
  prefersReducedMotionMode(): boolean {
    return this.prefersReducedMotion
  }

  /**
   * Get current theme
   */
  getCurrentTheme(): HighContrastTheme {
    return this.isHighContrast ? this.highContrastTheme : this.normalTheme
  }

  /**
   * Get annotation style for high contrast
   */
  getAnnotationStyle(annotation: Annotation): AnnotationStyle {
    const theme = this.getCurrentTheme()

    if (this.isHighContrast) {
      return {
        strokeColor: theme.annotationStrokeColor,
        fillColor: theme.annotationFillColor,
        strokeWidth: theme.strokeWidth,
        fontSize: annotation.style.fontSize
          ? annotation.style.fontSize + 2
          : undefined,
        opacity: 1,
      }
    }

    return annotation.style
  }

  /**
   * Get selection color
   */
  getSelectionColor(): string {
    return this.getCurrentTheme().selectionColor
  }

  /**
   * Get hover color
   */
  getHoverColor(): string {
    return this.getCurrentTheme().hoverColor
  }

  /**
   * Get control point size
   */
  getControlPointSize(baseSize: number = 8): number {
    if (this.isHighContrast) {
      return this.highContrastTheme.controlPointSize
    }
    return baseSize
  }

  /**
   * Get stroke width
   */
  getStrokeWidth(baseWidth: number = 2): number {
    if (this.isHighContrast) {
      return this.highContrastTheme.strokeWidth
    }
    return baseWidth
  }

  /**
   * Check if glow effects should be enabled
   */
  isGlowEnabled(): boolean {
    return this.getCurrentTheme().glowEnabled && !this.prefersReducedMotion
  }

  /**
   * Check if animations should be enabled
   */
  areAnimationsEnabled(): boolean {
    return !this.prefersReducedMotion
  }

  /**
   * Get control point colors
   */
  getControlPointColors(): {
    fill: string
    stroke: string
  } {
    const theme = this.getCurrentTheme()
    return {
      fill: theme.controlPointColor,
      stroke: theme.controlPointBorderColor,
    }
  }

  /**
   * Apply high contrast styles to canvas
   */
  applyCanvasStyles(canvas: HTMLCanvasElement): void {
    if (this.isHighContrast) {
      canvas.style.backgroundColor = this.highContrastTheme.backgroundColor
    } else {
      canvas.style.backgroundColor = this.normalTheme.backgroundColor
    }
  }

  /**
   * Get text color
   */
  getTextColor(): string {
    return this.getCurrentTheme().textColor
  }

  /**
   * Get background color
   */
  getBackgroundColor(): string {
    return this.getCurrentTheme().backgroundColor
  }

  /**
   * Get focus outline style
   */
  getFocusOutlineStyle(): string {
    if (this.isHighContrast) {
      return '3px solid #000000'
    }
    return '2px solid #2196f3'
  }

  /**
   * Customize high contrast theme
   */
  setHighContrastTheme(theme: Partial<HighContrastTheme>): void {
    this.highContrastTheme = { ...this.highContrastTheme, ...theme }
    if (this.isHighContrast) {
      this.notifyListeners()
    }
  }

  /**
   * Customize normal theme
   */
  setNormalTheme(theme: Partial<HighContrastTheme>): void {
    this.normalTheme = { ...this.normalTheme, ...theme }
    if (!this.isHighContrast) {
      this.notifyListeners()
    }
  }

  /**
   * Force high contrast mode (for testing)
   */
  forceHighContrast(enabled: boolean): void {
    this.isHighContrast = enabled
    this.notifyListeners()
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    if (this.mediaQueryList) {
      this.mediaQueryList.removeEventListener('change', this.handleContrastChange)
    }
    if (this.reducedMotionQueryList) {
      this.reducedMotionQueryList.removeEventListener(
        'change',
        this.handleReducedMotionChange
      )
    }
    this.listeners = []
  }
}

// Singleton instance
export const highContrastManager = new HighContrastManager()
