import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface UIState {
  sidebarOpen: boolean
  sidebarWidth: number
  theme: 'light' | 'dark' | 'auto'
  notifications: Notification[]
  loading: {
    [key: string]: boolean
  }
  modals: {
    [key: string]: boolean
  }
  snackbar: {
    open: boolean
    message: string
    severity: 'success' | 'error' | 'warning' | 'info'
  }
  isOffline: boolean
}

export interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  timestamp: number
  read: boolean
  actions?: Array<{
    label: string
    action: string
  }>
}

const initialState: UIState = {
  sidebarOpen: true,
  sidebarWidth: 280,
  theme: 'dark',
  notifications: [],
  loading: {},
  modals: {},
  snackbar: {
    open: false,
    message: '',
    severity: 'info',
  },
  isOffline: false,
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload
    },
    setSidebarWidth: (state, action: PayloadAction<number>) => {
      state.sidebarWidth = Math.max(200, Math.min(400, action.payload))
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'auto'>) => {
      state.theme = action.payload
    },
    addNotification: (state, action: PayloadAction<Omit<Notification, 'id' | 'timestamp' | 'read'>>) => {
      const notification: Notification = {
        ...action.payload,
        id: `notification-${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        read: false,
      }
      state.notifications.unshift(notification)
      
      // Keep only the last 50 notifications
      if (state.notifications.length > 50) {
        state.notifications = state.notifications.slice(0, 50)
      }
    },
    markNotificationRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload)
      if (notification) {
        notification.read = true
      }
    },
    markAllNotificationsRead: (state) => {
      state.notifications.forEach(notification => {
        notification.read = true
      })
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(n => n.id !== action.payload)
    },
    clearNotifications: (state) => {
      state.notifications = []
    },
    setLoading: (state, action: PayloadAction<{ key: string; loading: boolean }>) => {
      const { key, loading } = action.payload
      if (loading) {
        state.loading[key] = true
      } else {
        delete state.loading[key]
      }
    },
    setModal: (state, action: PayloadAction<{ key: string; open: boolean }>) => {
      const { key, open } = action.payload
      state.modals[key] = open
    },
    showSnackbar: (state, action: PayloadAction<{
      message: string
      severity?: 'success' | 'error' | 'warning' | 'info'
    }>) => {
      state.snackbar = {
        open: true,
        message: action.payload.message,
        severity: action.payload.severity || 'info',
      }
    },
    hideSnackbar: (state) => {
      state.snackbar.open = false
    },
    setOfflineMode: (state, action: PayloadAction<boolean>) => {
      state.isOffline = action.payload
    },
  },
})

export const {
  toggleSidebar,
  setSidebarOpen,
  setSidebarWidth,
  setTheme,
  addNotification,
  markNotificationRead,
  markAllNotificationsRead,
  removeNotification,
  clearNotifications,
  setLoading,
  setModal,
  showSnackbar,
  hideSnackbar,
  setOfflineMode,
} = uiSlice.actions

export default uiSlice.reducer

// Selectors
export const selectUI = (state: { ui: UIState }) => state.ui
export const selectSidebarOpen = (state: { ui: UIState }) => state.ui.sidebarOpen
export const selectSidebarWidth = (state: { ui: UIState }) => state.ui.sidebarWidth
export const selectTheme = (state: { ui: UIState }) => state.ui.theme
export const selectIsOffline = (state: { ui: UIState }) => state.ui.isOffline
export const selectNotifications = (state: { ui: UIState }) => state.ui.notifications
export const selectUnreadNotifications = (state: { ui: UIState }) => 
  state.ui.notifications.filter(n => !n.read)
export const selectLoading = (state: { ui: UIState }) => (key: string) => 
  state.ui.loading[key] || false
export const selectModal = (state: { ui: UIState }) => (key: string) => 
  state.ui.modals[key] || false
export const selectSnackbar = (state: { ui: UIState }) => state.ui.snackbar