import React from 'react'
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Chip,
  Paper,
  Divider,
  Avatar,
} from '@mui/material'
import {
  Image as ImageIcon,
  CheckCircle as CheckIcon,
  Folder as FolderIcon,
} from '@mui/icons-material'

interface Series {
  seriesInstanceUID: string
  seriesDescription?: string
  seriesNumber?: string
  modality?: string
  numberOfInstances?: number
  instances?: any[]
}

interface SeriesSelectorProps {
  series: Series[]
  selectedSeriesUID: string
  onSeriesSelect: (seriesUID: string) => void
}

export const SeriesSelector: React.FC<SeriesSelectorProps> = ({
  series,
  selectedSeriesUID,
  onSeriesSelect,
}) => {
  if (!series || series.length === 0) {
    return null
  }

  // Don't show selector if only one series
  if (series.length === 1) {
    return null
  }

  return (
    <Paper
      elevation={3}
      sx={{
        width: 280,
        height: '100%',
        overflow: 'auto',
        bgcolor: 'grey.900',
        borderRight: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box sx={{ p: 2, bgcolor: 'primary.main' }}>
        <Typography variant="h6" color="white" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ImageIcon />
          Series ({series.length})
        </Typography>
      </Box>

      <List sx={{ p: 0 }}>
        {series.map((seriesItem, index) => {
          const isSelected = seriesItem.seriesInstanceUID === selectedSeriesUID
          const instanceCount = seriesItem.numberOfInstances || seriesItem.instances?.length || 0

          return (
            <React.Fragment key={seriesItem.seriesInstanceUID || index}>
              <ListItem disablePadding>
                <ListItemButton
                  selected={isSelected}
                  onClick={() => onSeriesSelect(seriesItem.seriesInstanceUID)}
                  sx={{
                    py: 2,
                    px: 2,
                    bgcolor: isSelected ? 'primary.dark' : 'transparent',
                    '&:hover': {
                      bgcolor: isSelected ? 'primary.dark' : 'grey.800',
                    },
                    '&.Mui-selected': {
                      bgcolor: 'primary.dark',
                      '&:hover': {
                        bgcolor: 'primary.dark',
                      },
                    },
                  }}
                >
                  <Box
                    sx={{
                      mr: 2,
                      width: 64,
                      height: 64,
                      bgcolor: 'grey.800',
                      borderRadius: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: isSelected ? '2px solid' : '1px solid',
                      borderColor: isSelected ? 'primary.main' : 'grey.700',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    {/* Placeholder icon */}
                    <ImageIcon sx={{ fontSize: 32, color: 'grey.600' }} />
                    
                    {/* Series number badge */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        bgcolor: isSelected ? 'primary.main' : 'grey.700',
                        color: 'white',
                        borderRadius: '50%',
                        width: 20,
                        height: 20,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.7rem',
                        fontWeight: 'bold',
                      }}
                    >
                      {seriesItem.seriesNumber || index + 1}
                    </Box>
                  </Box>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="subtitle1" color="white" fontWeight={isSelected ? 600 : 400}>
                          Series {seriesItem.seriesNumber || index + 1}
                        </Typography>
                        {isSelected && <CheckIcon color="success" fontSize="small" />}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        <Typography variant="body2" color="grey.400" sx={{ mb: 0.5 }}>
                          {seriesItem.seriesDescription || 'No Description'}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {seriesItem.modality && (
                            <Chip
                              label={seriesItem.modality}
                              size="small"
                              sx={{
                                bgcolor: 'primary.main',
                                color: 'white',
                                fontSize: '0.7rem',
                                height: 20,
                              }}
                            />
                          )}
                          <Chip
                            label={`${instanceCount} images`}
                            size="small"
                            sx={{
                              bgcolor: 'grey.700',
                              color: 'white',
                              fontSize: '0.7rem',
                              height: 20,
                            }}
                          />
                        </Box>
                      </Box>
                    }
                  />
                </ListItemButton>
              </ListItem>
              {index < series.length - 1 && <Divider sx={{ bgcolor: 'grey.800' }} />}
            </React.Fragment>
          )
        })}
      </List>
    </Paper>
  )
}

export default SeriesSelector
