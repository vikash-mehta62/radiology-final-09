// Selection style constants for Canvas and Analysis Panel

export const SELECTION_STYLES = {
  selected: {
    strokeColor: '#00ff41',
    strokeWidth: 3,
    glowColor: 'rgba(0, 255, 65, 0.3)',
    glowBlur: 10,
  },
  hovered: {
    strokeColor: '#ffff00',
    strokeWidth: 2,
    glowColor: 'rgba(255, 255, 0, 0.2)',
    glowBlur: 5,
  },
  normal: {
    strokeColor: '#ffffff',
    strokeWidth: 1,
    glowColor: 'transparent',
    glowBlur: 0,
  },
}

export const ANALYSIS_PANEL_STYLES = {
  selected: {
    backgroundColor: 'rgba(0, 255, 65, 0.2)',
    borderLeft: '4px solid #00ff41',
  },
  hovered: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  normal: {
    backgroundColor: 'transparent',
  },
}

// Transition durations
export const TRANSITION_DURATION = {
  short: 250, // ms
  medium: 350, // ms
  long: 500, // ms
}

// Animation easing
export const EASING = {
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
}
