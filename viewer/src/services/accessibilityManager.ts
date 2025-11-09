/**
 * Accessibility Manager
 * 
 * Manages ARIA labels, screen reader announcements, and accessibility features
 */

import type { Annotation, ControlPoint } from '../types/viewer'

class AccessibilityManager {
  private liveRegion: HTMLElement | null = null
  private announcementQueue: string[] = []
  private isAnnouncing = false

  /**
   * Initialize accessibility features
   */
  initialize(): void {
    this.createLiveRegion()
  }

  /**
   * Create ARIA live region for announcements
   */
  private createLiveRegion(): void {
    if (this.liveRegion) return

    this.liveRegion = document.createElement('div')
    this.liveRegion.setAttribute('role', 'status')
    this.liveRegion.setAttribute('aria-live', 'polite')
    this.liveRegion.setAttribute('aria-atomic', 'true')
    this.liveRegion.style.position = 'absolute'
    this.liveRegion.style.left = '-10000px'
    this.liveRegion.style.width = '1px'
    this.liveRegion.style.height = '1px'
    this.liveRegion.style.overflow = 'hidden'

    document.body.appendChild(this.liveRegion)
  }

  /**
   * Announce message to screen readers
   */
  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    if (!this.liveRegion) {
      this.createLiveRegion()
    }

    if (!this.liveRegion) return

    // Update live region priority
    this.liveRegion.setAttribute('aria-live', priority)

    // Queue announcement
    this.announcementQueue.push(message)

    if (!this.isAnnouncing) {
      this.processAnnouncementQueue()
    }
  }

  /**
   * Process announcement queue
   */
  private processAnnouncementQueue(): void {
    if (this.announcementQueue.length === 0) {
      this.isAnnouncing = false
      return
    }

    this.isAnnouncing = true
    const message = this.announcementQueue.shift()

    if (this.liveRegion && message) {
      this.liveRegion.textContent = message

      // Clear after announcement
      setTimeout(() => {
        if (this.liveRegion) {
          this.liveRegion.textContent = ''
        }
        this.processAnnouncementQueue()
      }, 1000)
    }
  }

  /**
   * Announce annotation selection
   */
  announceAnnotationSelection(annotation: Annotation | null): void {
    if (!annotation) {
      this.announce('No annotation selected')
      return
    }

    const type = this.formatAnnotationType(annotation.type)
    const name =
      annotation.metadata?.name ||
      annotation.text ||
      annotation.label ||
      'Unnamed'

    this.announce(`Selected ${type}: ${name}`)
  }

  /**
   * Announce annotation creation
   */
  announceAnnotationCreation(annotation: Annotation): void {
    const type = this.formatAnnotationType(annotation.type)
    this.announce(`Created ${type} annotation`)
  }

  /**
   * Announce annotation deletion
   */
  announceAnnotationDeletion(annotation: Annotation): void {
    const type = this.formatAnnotationType(annotation.type)
    const name =
      annotation.metadata?.name ||
      annotation.text ||
      annotation.label ||
      'Unnamed'

    this.announce(`Deleted ${type}: ${name}`)
  }

  /**
   * Announce annotation movement
   */
  announceAnnotationMovement(delta: { x: number; y: number }): void {
    const direction: string[] = []

    if (delta.y < 0) direction.push('up')
    if (delta.y > 0) direction.push('down')
    if (delta.x < 0) direction.push('left')
    if (delta.x > 0) direction.push('right')

    const distance = Math.max(Math.abs(delta.x), Math.abs(delta.y))

    this.announce(
      `Moved annotation ${direction.join(' ')} by ${distance} pixel${distance !== 1 ? 's' : ''}`
    )
  }

  /**
   * Announce undo/redo
   */
  announceUndoRedo(action: 'undo' | 'redo', description: string): void {
    this.announce(`${action === 'undo' ? 'Undid' : 'Redid'}: ${description}`)
  }

  /**
   * Get ARIA label for annotation
   */
  getAnnotationAriaLabel(annotation: Annotation): string {
    const type = this.formatAnnotationType(annotation.type)
    const name =
      annotation.metadata?.name ||
      annotation.text ||
      annotation.label ||
      'Unnamed'

    const visible = annotation.metadata.visible ? 'visible' : 'hidden'
    const locked = annotation.metadata.locked ? 'locked' : 'unlocked'

    return `${type} annotation: ${name}, ${visible}, ${locked}`
  }

  /**
   * Get ARIA label for control point
   */
  getControlPointAriaLabel(controlPoint: ControlPoint): string {
    const typeDescriptions: Record<string, string> = {
      corner: 'Corner resize handle',
      edge: 'Edge resize handle',
      point: 'Point handle',
      center: 'Move handle',
    }

    const description = typeDescriptions[controlPoint.type] || 'Control point'

    return `${description}. Press arrow keys to adjust.`
  }

  /**
   * Get ARIA description for annotation type
   */
  getAnnotationTypeDescription(type: Annotation['type']): string {
    const descriptions: Record<Annotation['type'], string> = {
      text: 'Text annotation for adding notes',
      arrow: 'Arrow annotation for pointing to features',
      freehand: 'Freehand drawing annotation',
      rectangle: 'Rectangle annotation for highlighting areas',
      circle: 'Circle annotation for marking regions',
      polygon: 'Polygon annotation for complex shapes',
      measurement: 'Measurement annotation for distances',
      leader: 'Leader annotation with callout',
      clinical: 'Clinical annotation for medical findings',
    }

    return descriptions[type] || 'Annotation'
  }

  /**
   * Format annotation type for speech
   */
  private formatAnnotationType(type: Annotation['type']): string {
    return type.charAt(0).toUpperCase() + type.slice(1)
  }

  /**
   * Get keyboard shortcut description
   */
  getKeyboardShortcutDescription(): string {
    return 'Press Ctrl+? to view all keyboard shortcuts'
  }

  /**
   * Announce keyboard shortcut usage
   */
  announceKeyboardShortcut(shortcut: string, action: string): void {
    this.announce(`${shortcut}: ${action}`)
  }

  /**
   * Get ARIA role for canvas
   */
  getCanvasAriaRole(): string {
    return 'application'
  }

  /**
   * Get ARIA label for canvas
   */
  getCanvasAriaLabel(): string {
    return 'Medical image viewer with annotation tools. Use Tab to navigate annotations, arrow keys to move, and Enter to edit.'
  }

  /**
   * Set canvas ARIA attributes
   */
  setCanvasAriaAttributes(canvas: HTMLCanvasElement): void {
    canvas.setAttribute('role', this.getCanvasAriaRole())
    canvas.setAttribute('aria-label', this.getCanvasAriaLabel())
    canvas.setAttribute('tabindex', '0')
  }

  /**
   * Announce annotation count
   */
  announceAnnotationCount(count: number): void {
    if (count === 0) {
      this.announce('No annotations')
    } else if (count === 1) {
      this.announce('1 annotation')
    } else {
      this.announce(`${count} annotations`)
    }
  }

  /**
   * Announce filter/search results
   */
  announceSearchResults(count: number, total: number): void {
    if (count === 0) {
      this.announce('No annotations match your search')
    } else if (count === total) {
      this.announce(`Showing all ${total} annotations`)
    } else {
      this.announce(`Showing ${count} of ${total} annotations`)
    }
  }

  /**
   * Announce visibility toggle
   */
  announceVisibilityToggle(annotation: Annotation, visible: boolean): void {
    const type = this.formatAnnotationType(annotation.type)
    const name =
      annotation.metadata?.name ||
      annotation.text ||
      annotation.label ||
      'Unnamed'

    this.announce(`${type} ${name} is now ${visible ? 'visible' : 'hidden'}`)
  }

  /**
   * Announce export/import
   */
  announceExportImport(action: 'export' | 'import', count: number): void {
    const verb = action === 'export' ? 'Exported' : 'Imported'
    this.announce(`${verb} ${count} annotation${count !== 1 ? 's' : ''}`)
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    if (this.liveRegion && this.liveRegion.parentNode) {
      this.liveRegion.parentNode.removeChild(this.liveRegion)
      this.liveRegion = null
    }
    this.announcementQueue = []
    this.isAnnouncing = false
  }
}

// Singleton instance
export const accessibilityManager = new AccessibilityManager()
