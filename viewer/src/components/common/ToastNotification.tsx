import React from 'react'
import { Snackbar, Alert } from '@mui/material'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { selectToast, hideToast } from '../../store/slices/toastSlice'

export const ToastNotification: React.FC = () => {
  const dispatch = useAppDispatch()
  const toast = useAppSelector(selectToast)

  const handleClose = () => {
    dispatch(hideToast())
  }

  return (
    <Snackbar
      open={toast.open}
      autoHideDuration={toast.duration}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert onClose={handleClose} severity={toast.severity} sx={{ width: '100%' }}>
        {toast.message}
      </Alert>
    </Snackbar>
  )
}

export default ToastNotification
