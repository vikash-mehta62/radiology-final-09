import React, { useCallback } from 'react'
import {
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Typography,
  Box,
  Chip,
  Paper,
} from '@mui/material'
import {
  Delete as DeleteIcon,
  Straighten as RulerIcon,
  Architecture as AngleIcon,
  CropFree as AreaIcon,
  Comment as CommentIcon,
  CheckCircle as SelectIcon,
  Cancel as DeselectIcon,
  RemoveCircle as RemoveIcon,
} from '@mui/icons-material'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import {
  selectSelectionHistory,
  selectMeasurements,
  selectAnnotations,
  selectMeasurement,
  selectAnnotation,
  removeMeasurementWithSync,
  removeAnnotationWithSync,
} from '../../store/slices/viewerSlice'
import selectionSyncService from '../../services/selectionSyncService'

// Selection history entry type
interface SelectionHistoryEntry {
  id: string
  type: 'measurement' | 'annotation'
  timestamp: number
  action: 'select' | 'deselect' | 'remove'
  metadata?: {
    measurementType?: string
    annotationType?: string
    value?: number
    label?: string
  }
}

interface HistoryItemProps {
  entry: SelectionHistoryEntry
  onClick: (entry: SelectionHistoryEntry) => void
  onRemove: (entry: SelectionHistoryEntry) => void
}

const HistoryItem: React.FC<HistoryItemProps> = ({ entry, onClick, onRemove }) => {
  const getIcon = () => {
    if (entry.action === 'remove') {
      return <RemoveIcon fontSize="small" color="error" />
    }
    if (entry.action === 'deselect') {
      return <DeselectIcon fontSize="small" color="disabled" />
    }
    
    // Select action - show type icon
    if (entry.type === 'measurement') {
      const measurementType = entry.metadata?.measurementType || 'length'
      switch (measurementType) {
        case 'angle':
          return <AngleIcon fontSize="small" color="primary" />
        case 'area':
          return <AreaIcon fontSize="small" color="primary" />
        default:
          return <RulerIcon fontSize="small" color="primary" />
      }
    } else {
      return <CommentIcon fontSize="small" color="primary" />
    }
  }

  const getActionColor = () => {
    switch (entry.action) {
      case 'select':
        return 'success'
      case 'deselect':
        return 'default'
      case 'remove':
        return 'error'
      default:
        return 'default'
    }
  }

  const getActionLabel = () => {
    return entry.action.charAt(0).toUpperCase() + entry.action.slice(1)
  }

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    
    if (diff < 60000) {
      return 'Just now'
    } else if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000)
      return `${minutes} min${minutes > 1 ? 's' : ''} ago`
    } else if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000)
      return `${hours} hour${hours > 1 ? 's' : ''} ago`
    } else {
      return new Date(timestamp).toLocaleString()
    }
  }

  const getDescription = () => {
    const typeLabel = entry.type === 'measurement' ? 'Measurement' : 'Annotation'
    
    if (entry.metadata?.label) {
      return entry.metadata.label
    }
    
    if (entry.metadata?.value !== undefined) {
      return `${typeLabel}: ${entry.metadata.value}`
    }
    
    if (entry.metadata?.measurementType) {
      return `${entry.metadata.measurementType} measurement`
    }
    
    if (entry.metadata?.annotationType) {
      return `${entry.metadata.annotationType} annotation`
    }
    
    return typeLabel
  }

  const canClick = entry.action !== 'remove'

  return (
    <ListItem
      sx={{
        cursor: canClick ? 'pointer' : 'default',
        '&:hover': canClick ? {
          bgcolor: 'action.hover',
        } : {},
        opacity: entry.action === 'remove' ? 0.6 : 1,
      }}
      onClick={() => canClick && onClick(entry)}
      secondaryAction={
        entry.action !== 'remove' && (
          <IconButton
            edge="end"
            size="small"
            onClick={(e) => {
              e.stopPropagation()
              onRemove(entry)
            }}
            sx={{ color: 'error.main' }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        )
      }
    >
      <ListItemIcon sx={{ minWidth: 40 }}>
        {getIcon()}
      </ListItemIcon>
      <ListItemText
        primary={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" noWrap sx={{ flex: 1 }}>
              {getDescription()}
            </Typography>
            <Chip
              label={getActionLabel()}
              size="small"
              color={getActionColor()}
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          </Box>
        }
        secondary={formatTimestamp(entry.timestamp)}
      />
    </ListItem>
  )
}

export const ToolsHistory: React.FC = () => {
  const dispatch = useAppDispatch()
  
  // Redux selectors
  const selectionHistory = useAppSelector(selectSelectionHistory)
  const measurements = useAppSelector(selectMeasurements)
  const annotations = useAppSelector(selectAnnotations)

  // History item click handler
  const handleHistoryItemClick = useCallback((entry: SelectionHistoryEntry) => {
    if (entry.action === 'remove') {
      // Can't select removed items
      return
    }

    if (entry.type === 'measurement') {
      dispatch(selectMeasurement(entry.id))
      // Sync to server
      selectionSyncService.syncSelection(entry.id, 'measurement', 'select').catch(err => {
        console.error('Failed to sync measurement selection from history:', err)
      })
    } else {
      dispatch(selectAnnotation(entry.id))
      // Sync to server
      selectionSyncService.syncSelection(entry.id, 'annotation', 'select').catch(err => {
        console.error('Failed to sync annotation selection from history:', err)
      })
    }
  }, [dispatch])

  // History item removal handler
  const handleHistoryItemRemove = useCallback((entry: SelectionHistoryEntry) => {
    if (entry.type === 'measurement') {
      const measurement = measurements.find(m => m.id === entry.id)
      dispatch(removeMeasurementWithSync(entry.id))
      // Sync to server
      selectionSyncService.syncRemoval(entry.id, 'measurement', measurement).catch(err => {
        console.error('Failed to sync measurement removal from history:', err)
      })
    } else {
      const annotation = annotations.find(a => a.id === entry.id)
      dispatch(removeAnnotationWithSync(entry.id))
      // Sync to server
      selectionSyncService.syncRemoval(entry.id, 'annotation', annotation).catch(err => {
        console.error('Failed to sync annotation removal from history:', err)
      })
    }
  }, [dispatch, measurements, annotations])

  // Reverse history to show most recent first
  const reversedHistory = [...selectionHistory].reverse()

  return (
    <Paper
      sx={{
        width: '100%',
        maxHeight: 400,
        overflow: 'auto',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'white' }}>
        <Typography variant="h6">Tools History</Typography>
        <Typography variant="caption">
          {selectionHistory.length} {selectionHistory.length === 1 ? 'action' : 'actions'}
        </Typography>
      </Box>

      {selectionHistory.length === 0 ? (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No history yet
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Selection actions will appear here
          </Typography>
        </Box>
      ) : (
        <List dense>
          {reversedHistory.map((entry, index) => (
            <HistoryItem
              key={`${entry.id}-${entry.timestamp}-${index}`}
              entry={entry}
              onClick={handleHistoryItemClick}
              onRemove={handleHistoryItemRemove}
            />
          ))}
        </List>
      )}
    </Paper>
  )
}

export default ToolsHistory
