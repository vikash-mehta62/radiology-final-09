/**
 * Role-based redirect utility
 * Determines which dashboard to redirect to based on user role
 */

export const getRoleBasedRedirect = (role: string | null, roles: string[] = []): string => {
  // Check primary role first
  if (role === 'superadmin') {
    return '/app/superadmin'
  }
  
  // Check roles array as fallback
  if (roles.includes('system:admin') || roles.includes('super_admin')) {
    return '/app/superadmin'
  }
  
  if (role === 'admin' || roles.includes('admin')) {
    return '/app/dashboard'
  }
  
  if (role === 'radiologist' || roles.includes('radiologist')) {
    return '/app/dashboard'
  }
  
  if (role === 'staff' || roles.includes('staff')) {
    return '/app/dashboard'
  }
  
  // Default redirect
  return '/app/dashboard'
}

export const getRoleName = (role: string | null): string => {
  switch (role) {
    case 'superadmin':
      return 'Super Administrator'
    case 'admin':
      return 'Administrator'
    case 'radiologist':
      return 'Radiologist'
    case 'staff':
      return 'Staff'
    default:
      return 'User'
  }
}
