import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Divider,
  Chip,
} from '@mui/material'
import { keyboardNavigationManager } from '../../services/keyboardNavigationManager'

interface KeyboardShortcutsDialogProps {
  open: boolean
  onClose: () => void
}

export const KeyboardShortcutsDialog: React.FC<KeyboardShortcutsDialogProps> = ({
  open,
  onClose,
}) => {
  const shortcutsByCategory = keyboardNavigationManager.getShortcutsByCategory()

  const formatKey = (key: string): string => {
    const keyMap: Record<string, string> = {
      ArrowUp: '↑',
      ArrowDown: '↓',
      ArrowLeft: '←',
      ArrowRight: '→',
      Enter: '⏎',
      Escape: 'Esc',
      Delete: 'Del',
      Backspace: '⌫',
    }
    return keyMap[key] || key
  }

  const renderShortcut = (shortcut: any) => {
    const keys: string[] = []

    if (shortcut.ctrl) keys.push('Ctrl')
    if (shortcut.shift) keys.push('Shift')
    if (shortcut.alt) keys.push('Alt')
    keys.push(formatKey(shortcut.key))

    return (
      <Box
        key={`${shortcut.key}-${shortcut.ctrl}-${shortcut.shift}`}
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          py: 1,
        }}
      >
        <Typography variant="body2">{shortcut.description}</Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {keys.map((key, index) => (
            <React.Fragment key={index}>
              {index > 0 && (
                <Typography variant="body2" sx={{ mx: 0.5, color: 'text.secondary' }}>
                  +
                </Typography>
              )}
              <Chip
                label={key}
                size="small"
                sx={{
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  minWidth: 40,
                  bgcolor: 'grey.200',
                  color: 'text.primary',
                }}
              />
            </React.Fragment>
          ))}
        </Box>
      </Box>
    )
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Typography variant="h5" component="div">
          Keyboard Shortcuts
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Use these shortcuts to navigate and edit annotations efficiently
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {Object.entries(shortcutsByCategory).map(([category, shortcuts]) => {
          if (shortcuts.length === 0) return null

          return (
            <Box key={category} sx={{ mb: 3 }}>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 'bold', mb: 1, color: 'primary.main' }}
              >
                {category}
              </Typography>
              <Box sx={{ pl: 2 }}>
                {shortcuts.map((shortcut) => renderShortcut(shortcut))}
              </Box>
              <Divider sx={{ mt: 2 }} />
            </Box>
          )
        })}

        <Box sx={{ mt: 3, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
            💡 Tips
          </Typography>
          <Typography variant="body2" component="ul" sx={{ pl: 2, m: 0 }}>
            <li>Use Tab to quickly cycle through annotations</li>
            <li>Hold Shift while pressing arrow keys to move 10px at a time</li>
            <li>Press Escape to deselect and exit editing mode</li>
            <li>Use Ctrl+Z/Y for undo and redo operations</li>
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Got it
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default KeyboardShortcutsDialog
