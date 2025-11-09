import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface ToastState {
  open: boolean
  message: string
  severity: 'success' | 'error' | 'warning' | 'info'
  duration: number
}

const initialState: ToastState = {
  open: false,
  message: '',
  severity: 'info',
  duration: 5000,
}

const toastSlice = createSlice({
  name: 'toast',
  initialState,
  reducers: {
    showToast: (
      state,
      action: PayloadAction<{
        message: string
        severity?: 'success' | 'error' | 'warning' | 'info'
        duration?: number
      }>
    ) => {
      state.open = true
      state.message = action.payload.message
      state.severity = action.payload.severity || 'info'
      state.duration = action.payload.duration || 5000
    },
    hideToast: (state) => {
      state.open = false
    },
  },
})

export const { showToast, hideToast } = toastSlice.actions
export default toastSlice.reducer

// Selectors
export const selectToast = (state: { toast: ToastState }) => state.toast
