export interface User {
  id: string
  username: string
  email: string
  firstName: string
  lastName: string
  roles: string[]
  permissions: string[]
  hospitalId?: string
  isActive: boolean
  isVerified: boolean
  mfaEnabled: boolean
  lastLogin?: string
  createdAt: string
  updatedAt: string
}

export interface LoginCredentials {
  username: string
  password: string
  mfaToken?: string
  rememberMe?: boolean
}

export interface LoginResponse {
  success: boolean
  accessToken: string
  refreshToken: string
  user: User
  role: string // Primary role for routing: 'superadmin' | 'admin' | 'radiologist' | 'staff' | 'user'
  hospitalId?: string
  mfaSetupRequired?: boolean
}

export interface RefreshTokenResponse {
  success: boolean
  accessToken: string
  refreshToken: string
  user: User
}

export interface AuthError {
  code: string
  message: string
  details?: any
}