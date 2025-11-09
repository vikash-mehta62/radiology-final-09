import React, { useEffect, useRef, useState } from 'react'
import { Box, TextField } from '@mui/material'
import type { Annotation } from '../../types/viewer'

interface InlineTextEditorProps {
  annotation: Annotation
  position: { x: number; y: number }
  initialText: string
  onSave: (text: string) => void
  onCancel: () => void
  onChange?: (text: string) => void
}

/**
 * InlineTextEditor - Inline text editing component for annotations
 * 
 * Features:
 * - Positioned at annotation location
 * - Auto-focus on mount
 * - Enter to save, Escape to cancel
 * - Styled to match annotation appearance
 */
export const InlineTextEditor: React.FC<InlineTextEditorProps> = ({
  annotation,
  position,
  initialText,
  onSave,
  onCancel,
  onChange,
}) => {
  const [text, setText] = useState(initialText)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select() // Select all text for easy replacement
    }
  }, [])

  // Handle text change
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newText = event.target.value
    setText(newText)
    onChange?.(newText)
  }

  // Handle key press
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      // Enter without Shift: Save
      event.preventDefault()
      onSave(text)
    } else if (event.key === 'Escape') {
      // Escape: Cancel
      event.preventDefault()
      onCancel()
    }
  }

  // Handle blur (clicking outside)
  const handleBlur = () => {
    // Save on blur
    onSave(text)
  }

  // Get font size from annotation style
  const fontSize = annotation.style?.fontSize || 14

  // Get color from annotation style
  const color = annotation.style?.strokeColor || '#00ff41'

  return (
    <Box
      sx={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        zIndex: 10000,
        pointerEvents: 'auto',
      }}
    >
      <TextField
        inputRef={inputRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        variant="outlined"
        size="small"
        multiline={false}
        sx={{
          '& .MuiOutlinedInput-root': {
            fontSize: `${fontSize}px`,
            color: color,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            '& fieldset': {
              borderColor: color,
              borderWidth: 2,
            },
            '&:hover fieldset': {
              borderColor: color,
            },
            '&.Mui-focused fieldset': {
              borderColor: color,
            },
          },
          '& .MuiInputBase-input': {
            padding: '4px 8px',
            minWidth: '100px',
          },
        }}
      />
    </Box>
  )
}

export default InlineTextEditor
