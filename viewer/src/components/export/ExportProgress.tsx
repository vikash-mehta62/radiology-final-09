import React, { useEffect, useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  LinearProgress,
  Box,
  Typography,
  Alert,
  CircularProgress
} from '@mui/material'
import {
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Download as DownloadIcon
} from '@mui/icons-material'
import { useExport } from '../../hooks/useExport'

export interface ExportProgressProps {
  exportId: string
  format: string
  onComplete: (exportId: string) => void
  onCancel: () => void
  onError?: (error: string) => void
}

export const ExportProgress: React.FC<ExportProgressProps> = ({
  exportId,
  format,
  onComplete,
  onCancel,
  onError
}) => {
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<'processing' | 'completed' | 'failed'>('processing')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [estimatedTime, setEstimatedTime] = useState<number>(0)
  const [startTime] = useState(Date.now())

  const { getExportStatus, downloadExport, cancelExport } = useExport()

  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null
    let isMounted = true

    const pollStatus = async () => {
      try {
        const exportStatus = await getExportStatus(exportId)

        if (!isMounted) return

        setProgress(exportStatus.progress || 0)
        setStatus(exportStatus.status as 'processing' | 'completed' | 'failed')

        // Calculate estimated time remaining
        if (exportStatus.progress > 0 && exportStatus.progress < 100) {
          const elapsed = Date.now() - startTime
          const estimatedTotal = (elapsed / exportStatus.progress) * 100
          const remaining = Math.max(0, estimatedTotal - elapsed)
          setEstimatedTime(Math.ceil(remaining / 1000))
        }

        if (exportStatus.status === 'completed') {
          if (pollInterval) {
            clearInterval(pollInterval)
          }
          // Auto-download the file
          try {
            await downloadExport(exportId)
            setTimeout(() => {
              if (isMounted) {
                onComplete(exportId)
              }
            }, 1000)
          } catch (downloadError: any) {
            setStatus('failed')
            setErrorMessage(downloadError.message || 'Failed to download export')
            if (onError) {
              onError(downloadError.message)
            }
          }
        } else if (exportStatus.status === 'failed') {
          if (pollInterval) {
            clearInterval(pollInterval)
          }
          setErrorMessage(exportStatus.error || 'Export failed')
          if (onError) {
            onError(exportStatus.error || 'Export failed')
          }
        }
      } catch (error: any) {
        if (!isMounted) return
        
        console.error('Error polling export status:', error)
        setStatus('failed')
        setErrorMessage(error.message || 'Failed to check export status')
        if (pollInterval) {
          clearInterval(pollInterval)
        }
        if (onError) {
          onError(error.message)
        }
      }
    }

    // Initial poll
    pollStatus()

    // Poll every second
    pollInterval = setInterval(pollStatus, 1000)

    return () => {
      isMounted = false
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    }
  }, [exportId, getExportStatus, downloadExport, onComplete, onError, startTime])

  const handleCancel = async () => {
    try {
      await cancelExport(exportId)
    } catch (error) {
      console.error('Error canceling export:', error)
    }
    onCancel()
  }

  const handleRetryDownload = async () => {
    try {
      await downloadExport(exportId)
      onComplete(exportId)
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to download export')
      if (onError) {
        onError(error.message)
      }
    }
  }

  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`
    }
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  const getFormatLabel = (fmt: string): string => {
    switch (fmt) {
      case 'pdf':
        return 'PDF'
      case 'dicom-sr':
        return 'DICOM SR'
      case 'fhir':
        return 'FHIR'
      case 'txt':
        return 'Text'
      default:
        return fmt.toUpperCase()
    }
  }

  return (
    <Dialog
      open={true}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#2a2a2a',
          color: '#fff',
          border: '1px solid #444'
        }
      }}
    >
      <DialogTitle sx={{ borderBottom: '1px solid #444' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {status === 'processing' && <CircularProgress size={24} />}
          {status === 'completed' && <CheckIcon sx={{ color: '#4CAF50' }} />}
          {status === 'failed' && <ErrorIcon sx={{ color: '#f44336' }} />}
          <Typography variant="h6">
            {status === 'processing' && 'Exporting Report'}
            {status === 'completed' && 'Export Complete'}
            {status === 'failed' && 'Export Failed'}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ py: 3 }}>
        {status === 'processing' && (
          <>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ color: '#aaa', mb: 1 }}>
                Generating {getFormatLabel(format)} export...
              </Typography>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: '#444',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: '#4CAF50',
                    borderRadius: 4
                  }
                }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Typography variant="caption" sx={{ color: '#aaa' }}>
                  {Math.round(progress)}% complete
                </Typography>
                {estimatedTime > 0 && (
                  <Typography variant="caption" sx={{ color: '#aaa' }}>
                    ~{formatTime(estimatedTime)} remaining
                  </Typography>
                )}
              </Box>
            </Box>

            <Alert
              severity="info"
              sx={{
                bgcolor: 'rgba(33, 150, 243, 0.1)',
                color: '#90CAF9',
                '& .MuiAlert-icon': { color: '#90CAF9' }
              }}
            >
              Your export is being processed. The file will download automatically when ready.
            </Alert>
          </>
        )}

        {status === 'completed' && (
          <>
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <CheckIcon sx={{ fontSize: 64, color: '#4CAF50', mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>
                Export Successful!
              </Typography>
              <Typography variant="body2" sx={{ color: '#aaa' }}>
                Your {getFormatLabel(format)} report has been downloaded.
              </Typography>
            </Box>

            <Alert
              severity="success"
              sx={{
                bgcolor: 'rgba(76, 175, 80, 0.1)',
                color: '#A5D6A7',
                '& .MuiAlert-icon': { color: '#A5D6A7' }
              }}
            >
              The export has been saved to your downloads folder.
            </Alert>
          </>
        )}

        {status === 'failed' && (
          <>
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <ErrorIcon sx={{ fontSize: 64, color: '#f44336', mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>
                Export Failed
              </Typography>
              <Typography variant="body2" sx={{ color: '#aaa' }}>
                {errorMessage || 'An error occurred during export'}
              </Typography>
            </Box>

            <Alert
              severity="error"
              sx={{
                bgcolor: 'rgba(244, 67, 54, 0.1)',
                color: '#EF9A9A',
                '& .MuiAlert-icon': { color: '#EF9A9A' }
              }}
            >
              Please try again or contact support if the problem persists.
            </Alert>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ borderTop: '1px solid #444', px: 3, py: 2 }}>
        {status === 'processing' && (
          <Button onClick={handleCancel} sx={{ color: '#aaa' }}>
            Cancel
          </Button>
        )}

        {status === 'completed' && (
          <>
            <Button
              onClick={handleRetryDownload}
              startIcon={<DownloadIcon />}
              sx={{ color: '#4CAF50' }}
            >
              Download Again
            </Button>
            <Button
              onClick={() => onComplete(exportId)}
              variant="contained"
              sx={{
                bgcolor: '#4CAF50',
                '&:hover': { bgcolor: '#45a049' }
              }}
            >
              Close
            </Button>
          </>
        )}

        {status === 'failed' && (
          <Button
            onClick={onCancel}
            variant="contained"
            sx={{
              bgcolor: '#f44336',
              '&:hover': { bgcolor: '#d32f2f' }
            }}
          >
            Close
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
