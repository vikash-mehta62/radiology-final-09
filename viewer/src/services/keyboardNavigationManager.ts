/**
 * Keyboard Navigation Manager
 * 
 * Manages keyboard shortcuts for annotation editing and navigation
 */

import type { Annotation, Point } from '../types/viewer'

export interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  description: string
  action: () => void
}

export interface KeyboardNavigationCallbacks {
  onSelectNext: () => void
  onSelectPrevious: () => void
  onMoveAnnotation: (delta: Point) => void
  onStartTextEdit: () => void
  onDeleteAnnotation: () => void
  onDeselectAll: () => void
  onUndo: () => void
  onRedo: () => void
  onCopy: () => void
  onPaste: () => void
  onDuplicate: () => void
  onShowHelp: () => void
}

class KeyboardNavigationManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map()
  private callbacks: Partial<KeyboardNavigationCallbacks> = {}
  private isEnabled = true
  private isTextInputFocused = false

  /**
   * Initialize keyboard navigation
   */
  initialize(callbacks: Partial<KeyboardNavigationCallbacks>): void {
    this.callbacks = callbacks
    this.registerDefaultShortcuts()
  }

  /**
   * Register default keyboard shortcuts
   */
  private registerDefaultShortcuts(): void {
    // Navigation
    this.registerShortcut({
      key: 'Tab',
      description: 'Select next annotation',
      action: () => this.callbacks.onSelectNext?.(),
    })

    this.registerShortcut({
      key: 'Tab',
      shift: true,
      description: 'Select previous annotation',
      action: () => this.callbacks.onSelectPrevious?.(),
    })

    // Movement (1px)
    this.registerShortcut({
      key: 'ArrowUp',
      description: 'Move annotation up (1px)',
      action: () => this.callbacks.onMoveAnnotation?.({ x: 0, y: -1 }),
    })

    this.registerShortcut({
      key: 'ArrowDown',
      description: 'Move annotation down (1px)',
      action: () => this.callbacks.onMoveAnnotation?.({ x: 0, y: 1 }),
    })

    this.registerShortcut({
      key: 'ArrowLeft',
      description: 'Move annotation left (1px)',
      action: () => this.callbacks.onMoveAnnotation?.({ x: -1, y: 0 }),
    })

    this.registerShortcut({
      key: 'ArrowRight',
      description: 'Move annotation right (1px)',
      action: () => this.callbacks.onMoveAnnotation?.({ x: 1, y: 0 }),
    })

    // Movement (10px with Shift)
    this.registerShortcut({
      key: 'ArrowUp',
      shift: true,
      description: 'Move annotation up (10px)',
      action: () => this.callbacks.onMoveAnnotation?.({ x: 0, y: -10 }),
    })

    this.registerShortcut({
      key: 'ArrowDown',
      shift: true,
      description: 'Move annotation down (10px)',
      action: () => this.callbacks.onMoveAnnotation?.({ x: 0, y: 10 }),
    })

    this.registerShortcut({
      key: 'ArrowLeft',
      shift: true,
      description: 'Move annotation left (10px)',
      action: () => this.callbacks.onMoveAnnotation?.({ x: -10, y: 0 }),
    })

    this.registerShortcut({
      key: 'ArrowRight',
      shift: true,
      description: 'Move annotation right (10px)',
      action: () => this.callbacks.onMoveAnnotation?.({ x: 10, y: 0 }),
    })

    // Editing
    this.registerShortcut({
      key: 'Enter',
      description: 'Start text edit',
      action: () => this.callbacks.onStartTextEdit?.(),
    })

    this.registerShortcut({
      key: 'Delete',
      description: 'Delete selected annotation',
      action: () => this.callbacks.onDeleteAnnotation?.(),
    })

    this.registerShortcut({
      key: 'Backspace',
      description: 'Delete selected annotation',
      action: () => this.callbacks.onDeleteAnnotation?.(),
    })

    this.registerShortcut({
      key: 'Escape',
      description: 'Deselect all',
      action: () => this.callbacks.onDeselectAll?.(),
    })

    // Undo/Redo
    this.registerShortcut({
      key: 'z',
      ctrl: true,
      description: 'Undo',
      action: () => this.callbacks.onUndo?.(),
    })

    this.registerShortcut({
      key: 'y',
      ctrl: true,
      description: 'Redo',
      action: () => this.callbacks.onRedo?.(),
    })

    this.registerShortcut({
      key: 'z',
      ctrl: true,
      shift: true,
      description: 'Redo',
      action: () => this.callbacks.onRedo?.(),
    })

    // Copy/Paste
    this.registerShortcut({
      key: 'c',
      ctrl: true,
      description: 'Copy annotation',
      action: () => this.callbacks.onCopy?.(),
    })

    this.registerShortcut({
      key: 'v',
      ctrl: true,
      description: 'Paste annotation',
      action: () => this.callbacks.onPaste?.(),
    })

    this.registerShortcut({
      key: 'd',
      ctrl: true,
      description: 'Duplicate annotation',
      action: () => this.callbacks.onDuplicate?.(),
    })

    // Help
    this.registerShortcut({
      key: '?',
      ctrl: true,
      description: 'Show keyboard shortcuts',
      action: () => this.callbacks.onShowHelp?.(),
    })
  }

  /**
   * Register a keyboard shortcut
   */
  registerShortcut(shortcut: KeyboardShortcut): void {
    const key = this.getShortcutKey(
      shortcut.key,
      shortcut.ctrl,
      shortcut.shift,
      shortcut.alt
    )
    this.shortcuts.set(key, shortcut)
  }

  /**
   * Unregister a keyboard shortcut
   */
  unregisterShortcut(
    key: string,
    ctrl?: boolean,
    shift?: boolean,
    alt?: boolean
  ): void {
    const shortcutKey = this.getShortcutKey(key, ctrl, shift, alt)
    this.shortcuts.delete(shortcutKey)
  }

  /**
   * Get shortcut key string
   */
  private getShortcutKey(
    key: string,
    ctrl?: boolean,
    shift?: boolean,
    alt?: boolean
  ): string {
    const parts: string[] = []
    if (ctrl) parts.push('Ctrl')
    if (shift) parts.push('Shift')
    if (alt) parts.push('Alt')
    parts.push(key)
    return parts.join('+')
  }

  /**
   * Handle keyboard event
   */
  handleKeyDown(event: KeyboardEvent): boolean {
    // Don't handle shortcuts when text input is focused
    if (this.isTextInputFocused) {
      // Only allow Escape to exit text editing
      if (event.key === 'Escape') {
        this.callbacks.onDeselectAll?.()
        return true
      }
      return false
    }

    if (!this.isEnabled) return false

    const key = this.getShortcutKey(
      event.key,
      event.ctrlKey || event.metaKey,
      event.shiftKey,
      event.altKey
    )

    const shortcut = this.shortcuts.get(key)

    if (shortcut) {
      event.preventDefault()
      event.stopPropagation()
      shortcut.action()
      return true
    }

    return false
  }

  /**
   * Get all registered shortcuts
   */
  getAllShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values())
  }

  /**
   * Get shortcuts grouped by category
   */
  getShortcutsByCategory(): Record<string, KeyboardShortcut[]> {
    const shortcuts = this.getAllShortcuts()

    return {
      Navigation: shortcuts.filter((s) =>
        ['Tab', 'Tab+Shift'].includes(
          this.getShortcutKey(s.key, s.ctrl, s.shift, s.alt)
        )
      ),
      Movement: shortcuts.filter((s) =>
        s.key.startsWith('Arrow')
      ),
      Editing: shortcuts.filter((s) =>
        ['Enter', 'Delete', 'Backspace', 'Escape'].includes(s.key)
      ),
      'Undo/Redo': shortcuts.filter((s) =>
        ['Ctrl+z', 'Ctrl+y', 'Ctrl+Shift+z'].includes(
          this.getShortcutKey(s.key, s.ctrl, s.shift, s.alt)
        )
      ),
      'Copy/Paste': shortcuts.filter((s) =>
        ['Ctrl+c', 'Ctrl+v', 'Ctrl+d'].includes(
          this.getShortcutKey(s.key, s.ctrl, s.shift, s.alt)
        )
      ),
      Help: shortcuts.filter((s) =>
        this.getShortcutKey(s.key, s.ctrl, s.shift, s.alt) === 'Ctrl+?'
      ),
    }
  }

  /**
   * Format shortcut for display
   */
  formatShortcut(shortcut: KeyboardShortcut): string {
    const parts: string[] = []

    if (shortcut.ctrl) parts.push('Ctrl')
    if (shortcut.shift) parts.push('Shift')
    if (shortcut.alt) parts.push('Alt')

    // Format key name
    let keyName = shortcut.key
    if (keyName.startsWith('Arrow')) {
      keyName = keyName.replace('Arrow', '↑↓←→'[
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(keyName)
      ] || keyName)
    }

    parts.push(keyName)

    return parts.join(' + ')
  }

  /**
   * Enable keyboard navigation
   */
  enable(): void {
    this.isEnabled = true
  }

  /**
   * Disable keyboard navigation
   */
  disable(): void {
    this.isEnabled = false
  }

  /**
   * Set text input focus state
   */
  setTextInputFocused(focused: boolean): void {
    this.isTextInputFocused = focused
  }

  /**
   * Check if keyboard navigation is enabled
   */
  isNavigationEnabled(): boolean {
    return this.isEnabled && !this.isTextInputFocused
  }
}

// Singleton instance
export const keyboardNavigationManager = new KeyboardNavigationManager()
