import React, { useEffect, useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Tooltip,
  CircularProgress,
  Alert,
  Button
} from '@mui/material'
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  HourglassEmpty as PendingIcon
} from '@mui/icons-material'
import { useExport } from '../../hooks/useExport'

export interface ExportHistoryProps {
  reportId?: string
  userId?: string
  maxItems?: number
  showAuditInfo?: boolean
}

export interface ExportSession {
  id: string
  reportId: string
  userId: string
  userName?: string
  format: 'pdf' | 'dicom-sr' | 'fhir' | 'txt'
  status: 'initiated' | 'processing' | 'completed' | 'failed'
  progress: number
  fileUrl?: string
  fileSize?: number
  error?: string
  metadata?: {
    recipient?: string
    purpose?: string
    ipAddress?: string
  }
  createdAt: string
  completedAt?: string
}

export const ExportHistory: React.FC<ExportHistoryProps> = ({
  reportId,
  userId,
  maxItems = 10,
  showAuditInfo = false
}) => {
  const [exports, setExports] = useState<ExportSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { getExportHistory, downloadExport } = useExport()

  const loadHistory = async () => {
    setLoading(true)
    setError(null)

    try {
      const history = await getExportHistory(reportId, userId, maxItems)
      setExports(history)
    } catch (err: any) {
      setError(err.message || 'Failed to load export history')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [reportId, userId, maxItems])

  const handleDownload = async (exportId: string) => {
    try {
      await downloadExport(exportId)
    } catch (err: any) {
      setError(err.message || 'Failed to download export')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckIcon sx={{ color: '#4CAF50', fontSize: 20 }} />
      case 'failed':
        return <ErrorIcon sx={{ color: '#f44336', fontSize: 20 }} />
      case 'processing':
      case 'initiated':
        return <PendingIcon sx={{ color: '#FF9800', fontSize: 20 }} />
      default:
        return null
    }
  }

  const getStatusColor = (status: string): 'success' | 'error' | 'warning' | 'default' => {
    switch (status) {
      case 'completed':
        return 'success'
      case 'failed':
        return 'error'
      case 'processing':
      case 'initiated':
        return 'warning'
      default:
        return 'default'
    }
  }

  const getFormatLabel = (format: string): string => {
    switch (format) {
      case 'pdf':
        return 'PDF'
      case 'dicom-sr':
        return 'DICOM SR'
      case 'fhir':
        return 'FHIR'
      case 'txt':
        return 'Text'
      default:
        return format.toUpperCase()
    }
  }

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'N/A'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  const calculateDuration = (createdAt: string, completedAt?: string): string => {
    if (!completedAt) return 'N/A'
    const start = new Date(createdAt).getTime()
    const end = new Date(completedAt).getTime()
    const durationMs = end - start
    const seconds = Math.floor(durationMs / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Alert
        severity="error"
        sx={{ mb: 2 }}
        action={
          <Button color="inherit" size="small" onClick={loadHistory}>
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    )
  }

  if (exports.length === 0) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        No export history available. Export a report to see it here.
      </Alert>
    )
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ color: '#fff' }}>
          Export History
        </Typography>
        <Tooltip title="Refresh">
          <IconButton onClick={loadHistory} size="small" sx={{ color: '#aaa' }}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <TableContainer
        component={Paper}
        sx={{
          bgcolor: '#2a2a2a',
          border: '1px solid #444'
        }}
      >
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#1a1a1a' }}>
              <TableCell sx={{ color: '#aaa', fontWeight: 'bold' }}>Status</TableCell>
              <TableCell sx={{ color: '#aaa', fontWeight: 'bold' }}>Format</TableCell>
              <TableCell sx={{ color: '#aaa', fontWeight: 'bold' }}>Date</TableCell>
              <TableCell sx={{ color: '#aaa', fontWeight: 'bold' }}>Duration</TableCell>
              <TableCell sx={{ color: '#aaa', fontWeight: 'bold' }}>Size</TableCell>
              {showAuditInfo && (
                <TableCell sx={{ color: '#aaa', fontWeight: 'bold' }}>User</TableCell>
              )}
              <TableCell sx={{ color: '#aaa', fontWeight: 'bold' }} align="right">
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {exports.map((exportSession) => (
              <TableRow
                key={exportSession.id}
                sx={{
                  '&:hover': { bgcolor: '#333' },
                  borderBottom: '1px solid #444'
                }}
              >
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {getStatusIcon(exportSession.status)}
                    <Chip
                      label={exportSession.status.toUpperCase()}
                      size="small"
                      color={getStatusColor(exportSession.status)}
                      sx={{ minWidth: 90 }}
                    />
                  </Box>
                </TableCell>

                <TableCell sx={{ color: '#fff' }}>
                  <Chip
                    label={getFormatLabel(exportSession.format)}
                    size="small"
                    variant="outlined"
                    sx={{ borderColor: '#666', color: '#fff' }}
                  />
                </TableCell>

                <TableCell sx={{ color: '#aaa', fontSize: '0.875rem' }}>
                  {formatDate(exportSession.createdAt)}
                </TableCell>

                <TableCell sx={{ color: '#aaa', fontSize: '0.875rem' }}>
                  {calculateDuration(exportSession.createdAt, exportSession.completedAt)}
                </TableCell>

                <TableCell sx={{ color: '#aaa', fontSize: '0.875rem' }}>
                  {formatFileSize(exportSession.fileSize)}
                </TableCell>

                {showAuditInfo && (
                  <TableCell sx={{ color: '#aaa', fontSize: '0.875rem' }}>
                    {exportSession.userName || exportSession.userId}
                  </TableCell>
                )}

                <TableCell align="right">
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                    {exportSession.status === 'completed' && (
                      <Tooltip title="Download">
                        <IconButton
                          size="small"
                          onClick={() => handleDownload(exportSession.id)}
                          sx={{ color: '#4CAF50' }}
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}

                    {showAuditInfo && exportSession.metadata && (
                      <Tooltip
                        title={
                          <Box>
                            {exportSession.metadata.purpose && (
                              <Typography variant="caption">
                                Purpose: {exportSession.metadata.purpose}
                              </Typography>
                            )}
                            {exportSession.metadata.recipient && (
                              <Typography variant="caption" display="block">
                                Recipient: {exportSession.metadata.recipient}
                              </Typography>
                            )}
                            {exportSession.metadata.ipAddress && (
                              <Typography variant="caption" display="block">
                                IP: {exportSession.metadata.ipAddress}
                              </Typography>
                            )}
                          </Box>
                        }
                      >
                        <IconButton size="small" sx={{ color: '#2196F3' }}>
                          <InfoIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}

                    {exportSession.status === 'failed' && exportSession.error && (
                      <Tooltip title={exportSession.error}>
                        <IconButton size="small" sx={{ color: '#f44336' }}>
                          <InfoIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
