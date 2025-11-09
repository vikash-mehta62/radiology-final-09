import React, { useState } from 'react'
import {
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  CircularProgress,
  Alert,
  Box,
  Typography,
  Divider
} from '@mui/material'
import {
  Download as DownloadIcon,
  PictureAsPdf as PdfIcon,
  Description as DocIcon,
  Code as JsonIcon,
  LocalHospital as DicomIcon,
  Share as FhirIcon
} from '@mui/icons-material'

interface ReportExportMenuProps {
  reportId: string
  onExportComplete?: () => void
}

export const ReportExportMenu: React.FC<ReportExportMenuProps> = ({
  reportId,
  onExportComplete
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState<string>('')
  const [includeImages, setIncludeImages] = useState(true)
  const [includeSignatures, setIncludeSignatures] = useState(true)
  const [includeMetadata, setIncludeMetadata] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const exportFormats = [
    {
      id: 'pdf',
      label: 'PDF Report',
      icon: <PdfIcon />,
      description: 'Professional PDF with embedded images and signatures'
    },
    {
      id: 'docx',
      label: 'Word Document',
      icon: <DocIcon />,
      description: 'Editable Microsoft Word document'
    },
    {
      id: 'dicom-sr',
      label: 'DICOM SR',
      icon: <DicomIcon />,
      description: 'DICOM Structured Report for PACS integration'
    },
    {
      id: 'fhir',
      label: 'FHIR Report',
      icon: <FhirIcon />,
      description: 'HL7 FHIR DiagnosticReport resource'
    },
    {
      id: 'json',
      label: 'JSON Data',
      icon: <JsonIcon />,
      description: 'Raw report data in JSON format'
    }
  ]

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleFormatSelect = (format: string) => {
    setSelectedFormat(format)
    setDialogOpen(true)
    handleMenuClose()
  }

  const handleExport = async () => {
    setExporting(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        format: selectedFormat,
        includeImages: includeImages.toString(),
        includeSignatures: includeSignatures.toString(),
        includeMetadata: includeMetadata.toString()
      })

      const response = await fetch(`/api/report-export/${reportId}?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      })

      if (!response.ok) {
        throw new Error('Export failed')
      }

      // Handle different response types
      if (selectedFormat === 'json') {
        const data = await response.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        downloadBlob(blob, `report-${reportId}.json`)
      } else {
        const blob = await response.blob()
        const extension = getFileExtension(selectedFormat)
        downloadBlob(blob, `report-${reportId}.${extension}`)
      }

      setDialogOpen(false)
      onExportComplete?.()
    } catch (err: any) {
      setError(err.message || 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const getFileExtension = (format: string) => {
    switch (format) {
      case 'pdf': return 'pdf'
      case 'docx': return 'docx'
      case 'dicom-sr': return 'dcm'
      case 'fhir': return 'json'
      case 'json': return 'json'
      default: return 'txt'
    }
  }

  const selectedFormatInfo = exportFormats.find(f => f.id === selectedFormat)

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<DownloadIcon />}
        onClick={handleMenuClick}
        size="small"
      >
        Export Report
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: { minWidth: 280 }
        }}
      >
        {exportFormats.map((format) => (
          <MenuItem
            key={format.id}
            onClick={() => handleFormatSelect(format.id)}
            sx={{ py: 1.5 }}
          >
            <ListItemIcon>
              {format.icon}
            </ListItemIcon>
            <ListItemText
              primary={format.label}
              secondary={format.description}
              secondaryTypographyProps={{ variant: 'caption' }}
            />
          </MenuItem>
        ))}
      </Menu>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Export Report - {selectedFormatInfo?.label}
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Typography variant="body2" color="text.secondary" paragraph>
            {selectedFormatInfo?.description}
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" gutterBottom>
            Export Options
          </Typography>

          <Box sx={{ pl: 1 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={includeImages}
                  onChange={(e) => setIncludeImages(e.target.checked)}
                />
              }
              label="Include captured images"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={includeSignatures}
                  onChange={(e) => setIncludeSignatures(e.target.checked)}
                />
              }
              label="Include digital signatures"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={includeMetadata}
                  onChange={(e) => setIncludeMetadata(e.target.checked)}
                />
              }
              label="Include technical metadata"
            />
          </Box>

          {selectedFormat === 'pdf' && (
            <Alert severity="info" sx={{ mt: 2 }}>
              PDF exports include professional formatting, watermarks, and embedded signatures for compliance.
            </Alert>
          )}

          {selectedFormat === 'dicom-sr' && (
            <Alert severity="info" sx={{ mt: 2 }}>
              DICOM SR exports are compatible with PACS systems and include structured findings.
            </Alert>
          )}

          {selectedFormat === 'fhir' && (
            <Alert severity="info" sx={{ mt: 2 }}>
              FHIR exports follow HL7 standards and can be integrated with EHR systems.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDialogOpen(false)}
            disabled={exporting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            variant="contained"
            disabled={exporting}
            startIcon={exporting ? <CircularProgress size={20} /> : <DownloadIcon />}
          >
            {exporting ? 'Exporting...' : 'Export'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}