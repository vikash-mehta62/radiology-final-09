import React, { useState } from 'react'
import {
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Box,
  Typography,
  Divider
} from '@mui/material'
import {
  Download as DownloadIcon,
  PictureAsPdf as PdfIcon,
  MedicalServices as DicomIcon,
  Cloud as FhirIcon,
  Description as TextIcon
} from '@mui/icons-material'
import { useExport } from '../../hooks/useExport'
import { ExportProgress } from './ExportProgress'

export interface ExportMenuProps {
  reportId: string
  reportStatus?: 'draft' | 'preliminary' | 'final'
  disabled?: boolean
  onExportComplete?: (exportId: string, format: string) => void
  onExportError?: (error: string) => void
}

export const ExportMenu: React.FC<ExportMenuProps> = ({
  reportId,
  reportStatus = 'draft',
  disabled = false,
  onExportComplete,
  onExportError
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [showProgress, setShowProgress] = useState(false)
  const [currentExportId, setCurrentExportId] = useState<string | null>(null)
  const [currentFormat, setCurrentFormat] = useState<string>('')

  const {
    initiateExport,
    downloadExport,
    loading,
    error
  } = useExport()

  const open = Boolean(anchorEl)

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleExport = async (format: 'pdf' | 'dicom-sr' | 'fhir' | 'txt') => {
    handleClose()
    setCurrentFormat(format)
    setShowProgress(true)

    try {
      const exportSession = await initiateExport(reportId, format)
      setCurrentExportId(exportSession.id)

      // The ExportProgress component will handle polling and download
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to initiate export'
      if (onExportError) {
        onExportError(errorMessage)
      }
      setShowProgress(false)
      setCurrentExportId(null)
    }
  }

  const handleExportComplete = (exportId: string) => {
    setShowProgress(false)
    setCurrentExportId(null)
    if (onExportComplete) {
      onExportComplete(exportId, currentFormat)
    }
  }

  const handleExportCancel = () => {
    setShowProgress(false)
    setCurrentExportId(null)
  }

  const getFormatLabel = (format: string): string => {
    switch (format) {
      case 'pdf':
        return 'PDF Document'
      case 'dicom-sr':
        return 'DICOM Structured Report'
      case 'fhir':
        return 'HL7 FHIR Resource'
      case 'txt':
        return 'Plain Text'
      default:
        return format.toUpperCase()
    }
  }

  const getFormatDescription = (format: string): string => {
    switch (format) {
      case 'pdf':
        return 'Professional formatted report with images'
      case 'dicom-sr':
        return 'Standard DICOM format for PACS integration'
      case 'fhir':
        return 'Modern healthcare interoperability standard'
      case 'txt':
        return 'Simple text format for basic viewing'
      default:
        return ''
    }
  }

  return (
    <>
      <Button
        variant="outlined"
        startIcon={loading ? <CircularProgress size={20} /> : <DownloadIcon />}
        onClick={handleClick}
        disabled={disabled || loading}
        sx={{
          borderColor: '#4CAF50',
          color: '#4CAF50',
          '&:hover': {
            borderColor: '#45a049',
            backgroundColor: 'rgba(76, 175, 80, 0.08)'
          }
        }}
      >
        Export Report
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            minWidth: 320,
            bgcolor: '#2a2a2a',
            color: '#fff',
            border: '1px solid #444'
          }
        }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2" sx={{ color: '#aaa', fontSize: '0.75rem' }}>
            Select Export Format
          </Typography>
        </Box>
        <Divider sx={{ borderColor: '#444' }} />

        <MenuItem onClick={() => handleExport('pdf')}>
          <ListItemIcon>
            <PdfIcon sx={{ color: '#f44336' }} />
          </ListItemIcon>
          <ListItemText
            primary={getFormatLabel('pdf')}
            secondary={getFormatDescription('pdf')}
            primaryTypographyProps={{ sx: { color: '#fff' } }}
            secondaryTypographyProps={{ sx: { color: '#aaa', fontSize: '0.75rem' } }}
          />
        </MenuItem>

        <MenuItem onClick={() => handleExport('dicom-sr')}>
          <ListItemIcon>
            <DicomIcon sx={{ color: '#2196F3' }} />
          </ListItemIcon>
          <ListItemText
            primary={getFormatLabel('dicom-sr')}
            secondary={getFormatDescription('dicom-sr')}
            primaryTypographyProps={{ sx: { color: '#fff' } }}
            secondaryTypographyProps={{ sx: { color: '#aaa', fontSize: '0.75rem' } }}
          />
        </MenuItem>

        <MenuItem onClick={() => handleExport('fhir')}>
          <ListItemIcon>
            <FhirIcon sx={{ color: '#FF9800' }} />
          </ListItemIcon>
          <ListItemText
            primary={getFormatLabel('fhir')}
            secondary={getFormatDescription('fhir')}
            primaryTypographyProps={{ sx: { color: '#fff' } }}
            secondaryTypographyProps={{ sx: { color: '#aaa', fontSize: '0.75rem' } }}
          />
        </MenuItem>

        <MenuItem onClick={() => handleExport('txt')}>
          <ListItemIcon>
            <TextIcon sx={{ color: '#9E9E9E' }} />
          </ListItemIcon>
          <ListItemText
            primary={getFormatLabel('txt')}
            secondary={getFormatDescription('txt')}
            primaryTypographyProps={{ sx: { color: '#fff' } }}
            secondaryTypographyProps={{ sx: { color: '#aaa', fontSize: '0.75rem' } }}
          />
        </MenuItem>

        {reportStatus !== 'final' && (
          <>
            <Divider sx={{ borderColor: '#444', my: 1 }} />
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="caption" sx={{ color: '#ff9800', fontSize: '0.7rem' }}>
                ⚠ Report is {reportStatus.toUpperCase()} - exports will be watermarked
              </Typography>
            </Box>
          </>
        )}
      </Menu>

      {/* Export Progress Dialog */}
      {showProgress && currentExportId && (
        <ExportProgress
          exportId={currentExportId}
          format={currentFormat}
          onComplete={handleExportComplete}
          onCancel={handleExportCancel}
          onError={onExportError}
        />
      )}
    </>
  )
}
