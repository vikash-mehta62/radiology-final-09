// Keyboard Shortcuts Help Dialog
import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Grid,
  Chip,
  Divider
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

interface KeyboardShortcutsHelpProps {
  open: boolean
  onClose: () => void
}

interface Shortcut {
  key: string
  description: string
  category: string
}

const shortcuts: Shortcut[] = [
  // Navigation
  { key: '← →', description: 'Previous/Next frame', category: 'Navigation' },
  { key: '↑ ↓', description: 'Previous/Next series', category: 'Navigation' },
  { key: 'Home', description: 'First frame', category: 'Navigation' },
  { key: 'End', description: 'Last frame', category: 'Navigation' },
  { key: 'Space', description: 'Play/Pause cine', category: 'Navigation' },
  
  // Tools
  { key: 'W', description: 'Window/Level tool', category: 'Tools' },
  { key: 'Z', description: 'Zoom tool', category: 'Tools' },
  { key: 'P', description: 'Pan tool', category: 'Tools' },
  { key: 'L', description: 'Length measurement', category: 'Tools' },
  { key: 'A', description: 'Angle measurement', category: 'Tools' },
  { key: 'T', description: 'Text annotation', category: 'Tools' },
  { key: 'R', description: 'Reset view', category: 'Tools' },
  
  // Window Presets
  { key: '1', description: 'Lung preset', category: 'Presets' },
  { key: '2', description: 'Bone preset', category: 'Presets' },
  { key: '3', description: 'Soft tissue preset', category: 'Presets' },
  { key: '4', description: 'Brain preset', category: 'Presets' },
  
  // View
  { key: 'F', description: 'Toggle fullscreen', category: 'View' },
  { key: 'I', description: 'Toggle info overlay', category: 'View' },
  { key: 'M', description: 'Toggle measurements', category: 'View' },
  
  // Other
  { key: 'Esc', description: 'Cancel current action', category: 'Other' },
  { key: '?', description: 'Show this help', category: 'Other' },
  { key: 'Ctrl+S', description: 'Save annotations', category: 'Other' },
]

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  open,
  onClose
}) => {
  const categories = Array.from(new Set(shortcuts.map(s => s.category)))

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Keyboard Shortcuts</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        {categories.map((category, idx) => (
          <Box key={category} mb={3}>
            <Typography variant="subtitle1" color="primary" gutterBottom fontWeight="bold">
              {category}
            </Typography>
            <Grid container spacing={2}>
              {shortcuts
                .filter(s => s.category === category)
                .map((shortcut, i) => (
                  <Grid item xs={12} sm={6} key={i}>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Chip 
                        label={shortcut.key} 
                        size="small" 
                        sx={{ 
                          minWidth: 60,
                          fontFamily: 'monospace',
                          fontWeight: 'bold'
                        }}
                      />
                      <Typography variant="body2" color="text.secondary">
                        {shortcut.description}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
            </Grid>
            {idx < categories.length - 1 && <Divider sx={{ mt: 2 }} />}
          </Box>
        ))}
        
        <Box mt={3} p={2} bgcolor="info.light" borderRadius={1}>
          <Typography variant="caption" color="info.dark">
            💡 Tip: Press '?' at any time to show this help dialog
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  )
}

export default KeyboardShortcutsHelp
