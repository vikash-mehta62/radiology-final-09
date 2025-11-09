// Window/Level Presets Component
import React from 'react'
import { Box, Button, Typography } from '@mui/material'

export interface WindowLevelPreset {
  name: string
  windowWidth: number
  windowCenter: number
  description?: string
}

export const WINDOW_LEVEL_PRESETS: Record<string, WindowLevelPreset> = {
  lung: {
    name: 'Lung',
    windowWidth: 1500,
    windowCenter: -600,
    description: 'Optimal for lung parenchyma'
  },
  bone: {
    name: 'Bone',
    windowWidth: 2000,
    windowCenter: 300,
    description: 'Optimal for bone structures'
  },
  softTissue: {
    name: 'Soft Tissue',
    windowWidth: 400,
    windowCenter: 40,
    description: 'Optimal for soft tissue'
  },
  brain: {
    name: 'Brain',
    windowWidth: 80,
    windowCenter: 40,
    description: 'Optimal for brain tissue'
  },
  liver: {
    name: 'Liver',
    windowWidth: 150,
    windowCenter: 30,
    description: 'Optimal for liver'
  },
  mediastinum: {
    name: 'Mediastinum',
    windowWidth: 350,
    windowCenter: 50,
    description: 'Optimal for mediastinum'
  },
  abdomen: {
    name: 'Abdomen',
    windowWidth: 400,
    windowCenter: 50,
    description: 'Optimal for abdomen'
  },
  spine: {
    name: 'Spine',
    windowWidth: 1800,
    windowCenter: 400,
    description: 'Optimal for spine'
  }
}

interface WindowLevelPresetsProps {
  onPresetSelect: (preset: WindowLevelPreset) => void
  currentPreset?: string
}

export const WindowLevelPresets: React.FC<WindowLevelPresetsProps> = ({
  onPresetSelect,
  currentPreset
}) => {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" gutterBottom display="block">
        Window/Level Presets
      </Typography>
      <Box display="flex" flexWrap="wrap" gap={1}>
        {Object.entries(WINDOW_LEVEL_PRESETS).map(([key, preset]) => (
          <Button
            key={key}
            size="small"
            variant={currentPreset === key ? 'contained' : 'outlined'}
            onClick={() => onPresetSelect(preset)}
            sx={{ textTransform: 'none', minWidth: 'auto' }}
          >
            {preset.name}
          </Button>
        ))}
      </Box>
    </Box>
  )
}

export default WindowLevelPresets
