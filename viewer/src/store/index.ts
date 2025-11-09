import { configureStore } from '@reduxjs/toolkit'
import { combineReducers } from '@reduxjs/toolkit'

import authReducer from './slices/authSlice'
import uiReducer from './slices/uiSlice'
import worklistReducer from './slices/worklistSlice'
import viewerReducer from './slices/viewerSlice'
import settingsReducer from './slices/settingsSlice'
import toastReducer from './slices/toastSlice'

// Root reducer
const rootReducer = combineReducers({
  auth: authReducer,
  ui: uiReducer,
  worklist: worklistReducer,
  viewer: viewerReducer,
  settings: settingsReducer,
  toast: toastReducer,
})

// Load preloaded auth state from storage
function loadAuthPreloadedState() {
  const accessToken = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')
  const refreshToken = localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken')
  const userStr = localStorage.getItem('user') || sessionStorage.getItem('user')
  const role = localStorage.getItem('role') || sessionStorage.getItem('role')
  const hospitalId = localStorage.getItem('hospitalId') || sessionStorage.getItem('hospitalId')
  let user = null
  try { if (userStr) user = JSON.parse(userStr) } catch {}
  if (accessToken && refreshToken && user) {
    return {
      auth: {
        user,
        accessToken,
        refreshToken,
        role,
        hospitalId,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        lastActivity: Date.now(),
      }
    }
  }
  return undefined
}

// Configure store (with preloaded state)
export const store = configureStore({
  reducer: rootReducer,
  preloadedState: loadAuthPreloadedState(),
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [],
      },
    }),
  devTools: true,
})

// Subscribe to store changes to sync auth state with localStorage
store.subscribe(() => {
  const state = store.getState()
  const { auth } = state
  
  // Sync auth state to storage
  if (auth.isAuthenticated && auth.accessToken && auth.refreshToken && auth.user) {
    // Determine which storage to use (prefer localStorage if it has data)
    const storage = localStorage.getItem('accessToken') ? localStorage : sessionStorage
    
    storage.setItem('accessToken', auth.accessToken)
    storage.setItem('refreshToken', auth.refreshToken)
    storage.setItem('user', JSON.stringify(auth.user))
    if (auth.role) storage.setItem('role', auth.role)
    if (auth.hospitalId) storage.setItem('hospitalId', auth.hospitalId)
  } else if (!auth.isAuthenticated) {
    // Clear storage on logout
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    localStorage.removeItem('role')
    localStorage.removeItem('hospitalId')
    sessionStorage.removeItem('accessToken')
    sessionStorage.removeItem('refreshToken')
    sessionStorage.removeItem('user')
    sessionStorage.removeItem('role')
    sessionStorage.removeItem('hospitalId')
  }
})

// Types
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

// Typed hooks
export { useAppDispatch, useAppSelector } from './hooks'