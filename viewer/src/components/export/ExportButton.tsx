import React, { useState } from 'react'
import {
  Button,
  Menu,
  MenuItem,
  CircularProgress,
  ListItemIcon,
  ListItemText
} from '@mui/material'
import {
  Download as DownloadIcon,
  FolderZip as ZipIcon,
  Code as JsonIcon
} from '@mui/icons-material'

interface ExportButtonProps {
  type: 'patient' | 'study'
  id: string
  label?: string
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  type,
  id,
  label = 'Export'
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [exporting, setExporting] = useState(false)

  const handleExport = async (format: 'zip' | 'json') => {
    setExporting(true)
    setAnchorEl(null)

    try {
      const endpoint =
        type === 'patient'
          ? `/api/export/patient/${id}`
          : `/api/export/study/${id}`

      const response = await fetch(`${endpoint}?format=${format}&includeImages=true`, {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Export failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}-${id}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      alert('✅ Export completed successfully!')
    } catch (error: any) {
      alert(`❌ Export failed: ${error.message}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <Button
        startIcon={exporting ? <CircularProgress size={20} /> : <DownloadIcon />}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        disabled={exporting}
        variant="outlined"
        size="small"
      >
        {label}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => handleExport('zip')}>
          <ListItemIcon>
            <ZipIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>ZIP Archive (with DICOM)</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleExport('json')}>
          <ListItemIcon>
            <JsonIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>JSON Data Only</ListItemText>
        </MenuItem>
      </Menu>
    </>
  )
}
