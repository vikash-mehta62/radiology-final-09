import React, { useState, useEffect } from 'react'
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  Divider,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Grid,
} from '@mui/material'
import {
  ViewModule as LayoutIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
} from '@mui/icons-material'

interface HangingProtocol {
  id: string
  name: string
  modality: string[]
  bodyPart?: string[]
  layout: {
    rows: number
    cols: number
  }
  viewports: ViewportConfig[]
}

interface ViewportConfig {
  position: number
  seriesDescription?: string
  seriesNumber?: number
  imageNumber?: number
  windowLevel?: { width: number; center: number }
}

interface HangingProtocolsProps {
  currentModality: string
  currentBodyPart?: string
  onProtocolApply: (protocol: HangingProtocol) => void
}

// Default hanging protocols
const DEFAULT_PROTOCOLS: HangingProtocol[] = [
  {
    id: 'chest-xray-2view',
    name: 'Chest X-Ray (2 View)',
    modality: ['CR', 'DX'],
    bodyPart: ['CHEST'],
    layout: { rows: 1, cols: 2 },
    viewports: [
      { position: 0, seriesDescription: 'PA' },
      { position: 1, seriesDescription: 'LAT' },
    ],
  },
  {
    id: 'ct-brain-standard',
    name: 'CT Brain (Standard)',
    modality: ['CT'],
    bodyPart: ['BRAIN', 'HEAD'],
    layout: { rows: 2, cols: 2 },
    viewports: [
      { position: 0, seriesDescription: 'AXIAL', windowLevel: { width: 80, center: 40 } },
      { position: 1, seriesDescription: 'AXIAL', windowLevel: { width: 2000, center: 300 } },
      { position: 2, seriesDescription: 'CORONAL' },
      { position: 3, seriesDescription: 'SAGITTAL' },
    ],
  },
  {
    id: 'ct-chest-standard',
    name: 'CT Chest (Standard)',
    modality: ['CT'],
    bodyPart: ['CHEST', 'THORAX'],
    layout: { rows: 1, cols: 3 },
    viewports: [
      { position: 0, seriesDescription: 'AXIAL', windowLevel: { width: 1500, center: -600 } },
      { position: 1, seriesDescription: 'AXIAL', windowLevel: { width: 350, center: 50 } },
      { position: 2, seriesDescription: 'CORONAL' },
    ],
  },
  {
    id: 'mri-brain-standard',
    name: 'MRI Brain (Standard)',
    modality: ['MR'],
    bodyPart: ['BRAIN', 'HEAD'],
    layout: { rows: 2, cols: 2 },
    viewports: [
      { position: 0, seriesDescription: 'T1' },
      { position: 1, seriesDescription: 'T2' },
      { position: 2, seriesDescription: 'FLAIR' },
      { position: 3, seriesDescription: 'DWI' },
    ],
  },
  {
    id: 'mammo-standard',
    name: 'Mammography (4 View)',
    modality: ['MG'],
    bodyPart: ['BREAST'],
    layout: { rows: 2, cols: 2 },
    viewports: [
      { position: 0, seriesDescription: 'CC.*L' },
      { position: 1, seriesDescription: 'CC.*R' },
      { position: 2, seriesDescription: 'MLO.*L' },
      { position: 3, seriesDescription: 'MLO.*R' },
    ],
  },
]

export const HangingProtocols: React.FC<HangingProtocolsProps> = ({
  currentModality,
  currentBodyPart,
  onProtocolApply,
}) => {
  const [protocols, setProtocols] = useState<HangingProtocol[]>(DEFAULT_PROTOCOLS)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedProtocol, setSelectedProtocol] = useState<HangingProtocol | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProtocol, setEditingProtocol] = useState<HangingProtocol | null>(null)

  // Load custom protocols from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('hangingProtocols')
    if (saved) {
      try {
        const custom = JSON.parse(saved)
        setProtocols([...DEFAULT_PROTOCOLS, ...custom])
      } catch (error) {
        console.error('Failed to load custom protocols:', error)
      }
    }
  }, [])

  // Get matching protocols for current study
  const matchingProtocols = protocols.filter(protocol => {
    const modalityMatch = protocol.modality.includes(currentModality)
    const bodyPartMatch = !protocol.bodyPart || 
      !currentBodyPart || 
      protocol.bodyPart.some(bp => currentBodyPart.toUpperCase().includes(bp))
    
    return modalityMatch && bodyPartMatch
  })

  // Auto-apply best matching protocol
  useEffect(() => {
    if (matchingProtocols.length > 0 && !selectedProtocol) {
      const bestMatch = matchingProtocols[0]
      setSelectedProtocol(bestMatch)
      onProtocolApply(bestMatch)
    }
  }, [currentModality, currentBodyPart])

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleProtocolSelect = (protocol: HangingProtocol) => {
    setSelectedProtocol(protocol)
    onProtocolApply(protocol)
    handleMenuClose()
  }

  const handleCreateNew = () => {
    setEditingProtocol({
      id: `custom-${Date.now()}`,
      name: 'New Protocol',
      modality: [currentModality],
      bodyPart: currentBodyPart ? [currentBodyPart] : [],
      layout: { rows: 2, cols: 2 },
      viewports: [],
    })
    setDialogOpen(true)
    handleMenuClose()
  }

  const handleSaveProtocol = () => {
    if (!editingProtocol) return

    const customProtocols = protocols.filter(p => p.id.startsWith('custom-'))
    const existingIndex = customProtocols.findIndex(p => p.id === editingProtocol.id)

    let updatedCustom
    if (existingIndex >= 0) {
      updatedCustom = [...customProtocols]
      updatedCustom[existingIndex] = editingProtocol
    } else {
      updatedCustom = [...customProtocols, editingProtocol]
    }

    localStorage.setItem('hangingProtocols', JSON.stringify(updatedCustom))
    setProtocols([...DEFAULT_PROTOCOLS, ...updatedCustom])
    setDialogOpen(false)
    setEditingProtocol(null)
  }

  return (
    <Box>
      <Tooltip title="Hanging Protocols">
        <IconButton onClick={handleMenuOpen} size="small">
          <LayoutIcon />
        </IconButton>
      </Tooltip>

      {selectedProtocol && (
        <Chip
          label={selectedProtocol.name}
          size="small"
          onDelete={() => setSelectedProtocol(null)}
          sx={{ ml: 1 }}
        />
      )}

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem disabled>
          <Typography variant="caption">
            {currentModality} Protocols
          </Typography>
        </MenuItem>
        <Divider />

        {matchingProtocols.length === 0 ? (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              No matching protocols
            </Typography>
          </MenuItem>
        ) : (
          matchingProtocols.map((protocol) => (
            <MenuItem
              key={protocol.id}
              onClick={() => handleProtocolSelect(protocol)}
              selected={selectedProtocol?.id === protocol.id}
            >
              <Box>
                <Typography variant="body2">{protocol.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {protocol.layout.rows}×{protocol.layout.cols} layout
                </Typography>
              </Box>
            </MenuItem>
          ))
        )}

        <Divider />
        <MenuItem onClick={handleCreateNew}>
          <AddIcon fontSize="small" sx={{ mr: 1 }} />
          Create Custom Protocol
        </MenuItem>
      </Menu>

      {/* Protocol Editor Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingProtocol?.id.startsWith('custom-') ? 'Edit' : 'Create'} Hanging Protocol
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Protocol Name"
                value={editingProtocol?.name || ''}
                onChange={(e) => setEditingProtocol(prev => 
                  prev ? { ...prev, name: e.target.value } : null
                )}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Rows"
                value={editingProtocol?.layout.rows || 2}
                onChange={(e) => setEditingProtocol(prev => 
                  prev ? { 
                    ...prev, 
                    layout: { ...prev.layout, rows: parseInt(e.target.value) || 2 }
                  } : null
                )}
                inputProps={{ min: 1, max: 4 }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Columns"
                value={editingProtocol?.layout.cols || 2}
                onChange={(e) => setEditingProtocol(prev => 
                  prev ? { 
                    ...prev, 
                    layout: { ...prev.layout, cols: parseInt(e.target.value) || 2 }
                  } : null
                )}
                inputProps={{ min: 1, max: 4 }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveProtocol} variant="contained" startIcon={<SaveIcon />}>
            Save Protocol
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default HangingProtocols
