import { useState, useEffect } from 'react'

export interface AppSettings {
  // User Preferences
  theme: 'light' | 'dark' | 'auto'
  language: string
  defaultLayout: string
  autoSave: boolean
  autoSaveInterval: number
  
  // Viewer Settings
  defaultWindowLevel: string
  measurementUnit: string
  annotationColor: string
  showAIOverlay: boolean
  enableGPU: boolean
  
  // Report Settings
  institutionName: string
  departmentName: string
  radiologistName: string
  defaultTemplate: string
  enableMacros: boolean
  
  // Export Settings
  defaultExportFormat: string
  includeImages: boolean
  includeSignature: boolean
  watermarkEnabled: boolean
  
  // System Settings
  backendURL: string
  pacsURL: string
  cacheSize: number
  enableLogging: boolean
  
  // Notification Settings
  emailNotifications: boolean
  criticalFindingsAlert: boolean
  reportStatusUpdates: boolean
  notificationEmail: string
}

const defaultSettings: AppSettings = {
  theme: 'dark',
  language: 'en',
  defaultLayout: 'single',
  autoSave: true,
  autoSaveInterval: 30,
  defaultWindowLevel: 'auto',
  measurementUnit: 'cm',
  annotationColor: '#ff0000',
  showAIOverlay: true,
  enableGPU: true,
  institutionName: 'Medical Imaging Center',
  departmentName: 'Radiology Department',
  radiologistName: 'Dr. Medical Professional',
  defaultTemplate: 'chest-xray',
  enableMacros: true,
  defaultExportFormat: 'pdf',
  includeImages: true,
  includeSignature: true,
  watermarkEnabled: true,
  backendURL: 'http://localhost:3000',
  pacsURL: '',
  cacheSize: 500,
  enableLogging: true,
  emailNotifications: true,
  criticalFindingsAlert: true,
  reportStatusUpdates: true,
  notificationEmail: ''
}

export const useSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [loading, setLoading] = useState(true)

  // Load settings from localStorage
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('appSettings')
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings)
        setSettings({ ...defaultSettings, ...parsed })
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Save settings to localStorage
  const saveSettings = (newSettings: Partial<AppSettings>) => {
    try {
      const updated = { ...settings, ...newSettings }
      setSettings(updated)
      localStorage.setItem('appSettings', JSON.stringify(updated))
      return true
    } catch (error) {
      console.error('Error saving settings:', error)
      return false
    }
  }

  // Reset to defaults
  const resetSettings = () => {
    try {
      setSettings(defaultSettings)
      localStorage.removeItem('appSettings')
      return true
    } catch (error) {
      console.error('Error resetting settings:', error)
      return false
    }
  }

  // Get specific setting
  const getSetting = <K extends keyof AppSettings>(key: K): AppSettings[K] => {
    return settings[key]
  }

  return {
    settings,
    loading,
    saveSettings,
    resetSettings,
    getSetting
  }
}

export default useSettings
