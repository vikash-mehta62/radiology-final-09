import React, { createContext, useContext, ReactNode } from 'react'
import { useSettings, AppSettings } from '../hooks/useSettings'
import { useUserContext, UserInfo } from '../hooks/useUserContext'

interface AppContextType {
  // Settings
  settings: AppSettings
  saveSettings: (newSettings: Partial<AppSettings>) => boolean
  resetSettings: () => boolean
  getSetting: <K extends keyof AppSettings>(key: K) => AppSettings[K]
  
  // User
  user: UserInfo | null
  updateUser: (updates: Partial<UserInfo>) => boolean
  getDisplayName: () => string
  getInitials: () => string
  hasPermission: (permission: 'view' | 'edit' | 'delete' | 'admin') => boolean
  
  // Combined helpers
  getInstitutionName: () => string
  getDepartmentName: () => string
  getRadiologistName: () => string
  getRadiologistSignature: () => string | undefined
  getUserEmail: () => string
  getUserRole: () => string
  
  // Loading states
  loading: boolean
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const settingsHook = useSettings()
  const userHook = useUserContext()

  // Combined helper functions
  const getInstitutionName = () => {
    // Priority: User institution > Settings institution > Default
    return userHook.user?.institution || settingsHook.settings.institutionName || 'Medical Imaging Center'
  }

  const getDepartmentName = () => {
    // Priority: User department > Settings department > Default
    return userHook.user?.department || settingsHook.settings.departmentName || 'Radiology Department'
  }

  const getRadiologistName = () => {
    // Priority: User name > Settings radiologist > Default
    return userHook.user?.name || settingsHook.settings.radiologistName || 'Dr. Medical Professional'
  }

  const getRadiologistSignature = () => {
    // Get from user profile
    return userHook.user?.signature
  }

  const getUserEmail = () => {
    return userHook.user?.email || settingsHook.settings.notificationEmail || ''
  }

  const getUserRole = () => {
    return userHook.user?.role || 'viewer'
  }

  const value: AppContextType = {
    // Settings
    settings: settingsHook.settings,
    saveSettings: settingsHook.saveSettings,
    resetSettings: settingsHook.resetSettings,
    getSetting: settingsHook.getSetting,
    
    // User
    user: userHook.user,
    updateUser: userHook.updateUser,
    getDisplayName: userHook.getDisplayName,
    getInitials: userHook.getInitials,
    hasPermission: userHook.hasPermission,
    
    // Combined helpers
    getInstitutionName,
    getDepartmentName,
    getRadiologistName,
    getRadiologistSignature,
    getUserEmail,
    getUserRole,
    
    // Loading
    loading: settingsHook.loading || userHook.loading
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useApp = () => {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}

export default AppContext
