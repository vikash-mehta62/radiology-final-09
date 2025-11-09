import { useState, useEffect } from 'react'

export interface UserInfo {
  id: string
  name: string
  email: string
  role: 'admin' | 'radiologist' | 'technician' | 'viewer'
  department: string
  institution: string
  signature?: string
  credentials?: string
  licenseNumber?: string
  phone?: string
  avatar?: string
}

const defaultUser: UserInfo = {
  id: 'user-001',
  name: 'Dr. Medical Professional',
  email: 'doctor@medical.com',
  role: 'radiologist',
  department: 'Radiology Department',
  institution: 'Medical Imaging Center',
  credentials: 'MD, FRCR',
  licenseNumber: 'MED-12345'
}

export const useUserContext = () => {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)

  // Load user from localStorage or API
  useEffect(() => {
    try {
      // Try to get from localStorage first
      const savedUser = localStorage.getItem('currentUser')
      if (savedUser) {
        setUser(JSON.parse(savedUser))
      } else {
        // Use default user if not found
        setUser(defaultUser)
        localStorage.setItem('currentUser', JSON.stringify(defaultUser))
      }
    } catch (error) {
      console.error('Error loading user:', error)
      setUser(defaultUser)
    } finally {
      setLoading(false)
    }
  }, [])

  // Update user info
  const updateUser = (updates: Partial<UserInfo>) => {
    if (!user) return false
    
    try {
      const updated = { ...user, ...updates }
      setUser(updated)
      localStorage.setItem('currentUser', JSON.stringify(updated))
      return true
    } catch (error) {
      console.error('Error updating user:', error)
      return false
    }
  }

  // Get user display name
  const getDisplayName = () => {
    if (!user) return 'User'
    return user.name || user.email || 'User'
  }

  // Get user initials for avatar
  const getInitials = () => {
    if (!user || !user.name) return 'U'
    const names = user.name.split(' ')
    if (names.length >= 2) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
    }
    return user.name.substring(0, 2).toUpperCase()
  }

  // Check if user has permission
  const hasPermission = (permission: 'view' | 'edit' | 'delete' | 'admin') => {
    if (!user) return false
    
    switch (permission) {
      case 'admin':
        return user.role === 'admin'
      case 'delete':
        return user.role === 'admin' || user.role === 'radiologist'
      case 'edit':
        return user.role !== 'viewer'
      case 'view':
        return true
      default:
        return false
    }
  }

  return {
    user,
    loading,
    updateUser,
    getDisplayName,
    getInitials,
    hasPermission
  }
}

export default useUserContext
