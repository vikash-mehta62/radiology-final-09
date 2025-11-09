import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface SettingsState {
  viewer: {
    defaultWindowLevel: {
      width: number
      center: number
    }
    defaultZoom: number
    smoothZoom: boolean
    invertMouseWheel: boolean
    showImageInfo: boolean
    showScaleBar: boolean
    showOrientation: boolean
    interpolation: 'nearest' | 'linear' | 'cubic'
    preloadImages: number
    cineFrameRate: number
  }
  display: {
    theme: 'light' | 'dark' | 'auto'
    fontSize: 'small' | 'medium' | 'large'
    highContrast: boolean
    reducedMotion: boolean
    showTooltips: boolean
    compactMode: boolean
  }
  keyboard: {
    shortcuts: {
      [key: string]: string
    }
    enableShortcuts: boolean
  }
  measurements: {
    defaultUnit: 'mm' | 'cm' | 'px'
    precision: number
    showLabels: boolean
    autoSave: boolean
  }
  ai: {
    showConfidenceScores: boolean
    confidenceThreshold: number
    autoLoadAiResults: boolean
    highlightCriticalFindings: boolean
  }
  privacy: {
    anonymizePatientInfo: boolean
    blurPatientInfo: boolean
    hidePatientBirthDate: boolean
  }
  performance: {
    enableGPUAcceleration: boolean
    maxCacheSize: number // MB
    preloadStrategy: 'none' | 'series' | 'study'
    compressionLevel: number
  }
}

const initialState: SettingsState = {
  viewer: {
    defaultWindowLevel: {
      width: 400,
      center: 40,
    },
    defaultZoom: 1.0,
    smoothZoom: true,
    invertMouseWheel: false,
    showImageInfo: true,
    showScaleBar: true,
    showOrientation: true,
    interpolation: 'linear',
    preloadImages: 5,
    cineFrameRate: 10,
  },
  display: {
    theme: 'dark',
    fontSize: 'medium',
    highContrast: false,
    reducedMotion: false,
    showTooltips: true,
    compactMode: false,
  },
  keyboard: {
    shortcuts: {
      'KeyW': 'windowLevel',
      'KeyZ': 'zoom',
      'KeyP': 'pan',
      'KeyM': 'length',
      'KeyA': 'angle',
      'KeyR': 'rectangle',
      'KeyE': 'ellipse',
      'KeyF': 'freehand',
      'KeyN': 'annotation',
      'KeyI': 'invert',
      'KeyH': 'flipHorizontal',
      'KeyV': 'flipVertical',
      'Space': 'cinePlay',
      'ArrowLeft': 'previousImage',
      'ArrowRight': 'nextImage',
      'ArrowUp': 'previousSeries',
      'ArrowDown': 'nextSeries',
    },
    enableShortcuts: true,
  },
  measurements: {
    defaultUnit: 'mm',
    precision: 2,
    showLabels: true,
    autoSave: true,
  },
  ai: {
    showConfidenceScores: true,
    confidenceThreshold: 0.7,
    autoLoadAiResults: true,
    highlightCriticalFindings: true,
  },
  privacy: {
    anonymizePatientInfo: false,
    blurPatientInfo: false,
    hidePatientBirthDate: false,
  },
  performance: {
    enableGPUAcceleration: true,
    maxCacheSize: 512, // 512 MB
    preloadStrategy: 'series',
    compressionLevel: 1,
  },
}

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    updateViewerSettings: (state, action: PayloadAction<Partial<SettingsState['viewer']>>) => {
      state.viewer = { ...state.viewer, ...action.payload }
    },
    updateDisplaySettings: (state, action: PayloadAction<Partial<SettingsState['display']>>) => {
      state.display = { ...state.display, ...action.payload }
    },
    updateKeyboardSettings: (state, action: PayloadAction<Partial<SettingsState['keyboard']>>) => {
      state.keyboard = { ...state.keyboard, ...action.payload }
    },
    updateKeyboardShortcut: (state, action: PayloadAction<{ key: string; action: string }>) => {
      state.keyboard.shortcuts[action.payload.key] = action.payload.action
    },
    removeKeyboardShortcut: (state, action: PayloadAction<string>) => {
      delete state.keyboard.shortcuts[action.payload]
    },
    updateMeasurementSettings: (state, action: PayloadAction<Partial<SettingsState['measurements']>>) => {
      state.measurements = { ...state.measurements, ...action.payload }
    },
    updateAiSettings: (state, action: PayloadAction<Partial<SettingsState['ai']>>) => {
      state.ai = { ...state.ai, ...action.payload }
    },
    updatePrivacySettings: (state, action: PayloadAction<Partial<SettingsState['privacy']>>) => {
      state.privacy = { ...state.privacy, ...action.payload }
    },
    updatePerformanceSettings: (state, action: PayloadAction<Partial<SettingsState['performance']>>) => {
      state.performance = { ...state.performance, ...action.payload }
    },
    resetSettings: (state) => {
      return initialState
    },
    resetViewerSettings: (state) => {
      state.viewer = initialState.viewer
    },
    resetDisplaySettings: (state) => {
      state.display = initialState.display
    },
    resetKeyboardSettings: (state) => {
      state.keyboard = initialState.keyboard
    },
    resetMeasurementSettings: (state) => {
      state.measurements = initialState.measurements
    },
    resetAiSettings: (state) => {
      state.ai = initialState.ai
    },
    resetPrivacySettings: (state) => {
      state.privacy = initialState.privacy
    },
    resetPerformanceSettings: (state) => {
      state.performance = initialState.performance
    },
  },
})

export const {
  updateViewerSettings,
  updateDisplaySettings,
  updateKeyboardSettings,
  updateKeyboardShortcut,
  removeKeyboardShortcut,
  updateMeasurementSettings,
  updateAiSettings,
  updatePrivacySettings,
  updatePerformanceSettings,
  resetSettings,
  resetViewerSettings,
  resetDisplaySettings,
  resetKeyboardSettings,
  resetMeasurementSettings,
  resetAiSettings,
  resetPrivacySettings,
  resetPerformanceSettings,
} = settingsSlice.actions

export default settingsSlice.reducer

// Selectors
export const selectSettings = (state: { settings: SettingsState }) => state.settings
export const selectViewerSettings = (state: { settings: SettingsState }) => state.settings.viewer
export const selectDisplaySettings = (state: { settings: SettingsState }) => state.settings.display
export const selectKeyboardSettings = (state: { settings: SettingsState }) => state.settings.keyboard
export const selectMeasurementSettings = (state: { settings: SettingsState }) => state.settings.measurements
export const selectAiSettings = (state: { settings: SettingsState }) => state.settings.ai
export const selectPrivacySettings = (state: { settings: SettingsState }) => state.settings.privacy
export const selectPerformanceSettings = (state: { settings: SettingsState }) => state.settings.performance