import React, { useState, useMemo, useRef, memo } from 'react'
import {
  Box,
  Paper,
  Typography,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Tooltip,
  InputAdornment,
  Divider,
  Snackbar,
  Alert,
} from '@mui/material'
import {
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  FileDownload as ExportIcon,
  FileUpload as ImportIcon,
  VisibilityOff as HideAllIcon,
  Visibility as ShowAllIcon,
  TextFields as TextIcon,
  NearMe as ArrowIcon,
  Brush as FreehandIcon,
  CropDin as RectangleIcon,
  RadioButtonUnchecked as CircleIcon,
  Timeline as PolygonIcon,
  Straighten as MeasurementIcon,
  BookmarkBorder as LeaderIcon,
  MedicalServices as ClinicalIcon,
} from '@mui/icons-material'
import { useAppSelector, useAppDispatch } from '../../store/hooks'
import { 
  selectAnnotations,
  updateAnnotation,
  removeAnnotation,
  selectAnnotation,
  selectSelectedAnnotationId,
  addAnnotation,
} from '../../store/slices/viewerSlice'
import type { Annotation } from '../../types/viewer'
import { 
  downloadAnnotations, 
  importAnnotations, 
  readFileAsText 
} from '../../utils/annotationExportImport'
import { debounce } from '../../utils/performanceUtils'

interface AnnotationManagerPanelProps {
  // Optional callbacks for custom export/import handling
  onExport?: () => void
  onImport?: () => void
}

// Get icon for annotation type
const getAnnotationIcon = (type: Annotation['type']) => {
  switch (type) {
    case 'text':
      return <TextIcon fontSize="small" />
    case 'arrow':
      return <ArrowIcon fontSize="small" />
    case 'freehand':
      return <FreehandIcon fontSize="small" />
    case 'rectangle':
      return <RectangleIcon fontSize="small" />
    case 'circle':
      return <CircleIcon fontSize="small" />
    case 'polygon':
      return <PolygonIcon fontSize="small" />
    case 'measurement':
      return <MeasurementIcon fontSize="small" />
    case 'leader':
      return <LeaderIcon fontSize="small" />
    case 'clinical':
      return <ClinicalIcon fontSize="small" />
    default:
      return <TextIcon fontSize="small" />
  }
}

// Format annotation type for display
const formatAnnotationType = (type: Annotation['type']): string => {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

// Format timestamp for display
const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString()
}

// Memoized annotation list item component
interface AnnotationListItemProps {
  annotation: Annotation
  isSelected: boolean
  isEditing: boolean
  editingValue: string
  onSelect: (id: string) => void
  onToggleVisibility: (annotation: Annotation, event: React.MouseEvent) => void
  onStartEdit: (annotation: Annotation, event: React.MouseEvent) => void
  onSaveEdit: (annotation: Annotation) => void
  onCancelEdit: () => void
  onEditValueChange: (value: string) => void
  onDelete: (id: string, event: React.MouseEvent) => void
  getDisplayName: (annotation: Annotation) => string
}

const AnnotationListItem = memo<AnnotationListItemProps>(
  ({
    annotation,
    isSelected,
    isEditing,
    editingValue,
    onSelect,
    onToggleVisibility,
    onStartEdit,
    onSaveEdit,
    onCancelEdit,
    onEditValueChange,
    onDelete,
    getDisplayName,
  }) => {
    return (
      <>
        <Divider />
        <ListItem
          button
          selected={isSelected}
          onClick={() => onSelect(annotation.id)}
          sx={{
            opacity: annotation.metadata.visible ? 1 : 0.5,
            '&.Mui-selected': {
              backgroundColor: 'primary.light',
              '&:hover': {
                backgroundColor: 'primary.light',
              },
            },
          }}
        >
          <Box
            sx={{
              mr: 1,
              display: 'flex',
              alignItems: 'center',
              color: 'text.secondary',
            }}
          >
            {getAnnotationIcon(annotation.type)}
          </Box>

          <ListItemText
            primary={
              isEditing ? (
                <TextField
                  size="small"
                  value={editingValue}
                  onChange={(e) => onEditValueChange(e.target.value)}
                  onBlur={() => onSaveEdit(annotation)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onSaveEdit(annotation)
                    } else if (e.key === 'Escape') {
                      onCancelEdit()
                    }
                  }}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  sx={{ width: '100%' }}
                />
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" noWrap>
                    {getDisplayName(annotation)}
                  </Typography>
                  <Chip
                    label={formatAnnotationType(annotation.type)}
                    size="small"
                    sx={{ height: 20, fontSize: '0.7rem' }}
                  />
                </Box>
              )
            }
            secondary={formatTimestamp(annotation.createdAt)}
          />

          <ListItemSecondaryAction>
            <Tooltip title={annotation.metadata.visible ? 'Hide' : 'Show'}>
              <IconButton
                edge="end"
                size="small"
                onClick={(e) => onToggleVisibility(annotation, e)}
              >
                {annotation.metadata.visible ? (
                  <VisibilityIcon fontSize="small" />
                ) : (
                  <VisibilityOffIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>

            <Tooltip title="Rename">
              <IconButton
                edge="end"
                size="small"
                onClick={(e) => onStartEdit(annotation, e)}
                sx={{ ml: 0.5 }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip title="Delete">
              <IconButton
                edge="end"
                size="small"
                onClick={(e) => onDelete(annotation.id, e)}
                sx={{ ml: 0.5 }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </ListItemSecondaryAction>
        </ListItem>
      </>
    )
  },
  // Custom comparison function for memo
  (prevProps, nextProps) => {
    return (
      prevProps.annotation.id === nextProps.annotation.id &&
      prevProps.annotation.metadata.visible ===
        nextProps.annotation.metadata.visible &&
      prevProps.annotation.metadata.name === nextProps.annotation.metadata.name &&
      prevProps.annotation.updatedAt === nextProps.annotation.updatedAt &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.isEditing === nextProps.isEditing &&
      prevProps.editingValue === nextProps.editingValue
    )
  }
)

export const AnnotationManagerPanel: React.FC<AnnotationManagerPanelProps> = ({
  onExport,
  onImport,
}) => {
  const dispatch = useAppDispatch()
  const annotations = useAppSelector(selectAnnotations)
  const selectedAnnotationId = useAppSelector(selectSelectedAnnotationId)
  
  // Local state
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | Annotation['type']>('all')
  const [sortBy, setSortBy] = useState<'created' | 'updated' | 'name'>('created')
  const [editingNameId, setEditingNameId] = useState<string | null>(null)
  const [editingNameValue, setEditingNameValue] = useState('')
  const [toastOpen, setToastOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastSeverity, setToastSeverity] = useState<'success' | 'error'>('success')

  // Ref for file input
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Debounced search handler
  const debouncedSetSearch = useMemo(
    () => debounce((query: string) => setDebouncedSearchQuery(query), 300),
    []
  )

  // Handle search input change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    debouncedSetSearch(value)
  }

  // Filter and sort annotations
  const filteredAndSortedAnnotations = useMemo(() => {
    let filtered = [...annotations]

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter((a) => a.type === filterType)
    }

    // Apply search filter (using debounced query)
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase()
      filtered = filtered.filter((a) => {
        const name = a.metadata?.name?.toLowerCase() || ''
        const text = a.text?.toLowerCase() || ''
        const label = a.label?.toLowerCase() || ''
        const type = a.type.toLowerCase()

        return (
          name.includes(query) ||
          text.includes(query) ||
          label.includes(query) ||
          type.includes(query)
        )
      })
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          const nameA = a.metadata?.name || a.text || a.label || a.type
          const nameB = b.metadata?.name || b.text || b.label || b.type
          return nameA.localeCompare(nameB)
        case 'updated':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        case 'created':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
    })


    return filtered
  }, [annotations, filterType, debouncedSearchQuery, sortBy])

  // Handle annotation selection
  const handleSelectAnnotation = (annotationId: string) => {
    if (selectedAnnotationId === annotationId) {
      dispatch(selectAnnotation(null))
    } else {
      dispatch(selectAnnotation(annotationId))
    }
  }

  // Handle visibility toggle
  const handleToggleVisibility = (annotation: Annotation, event: React.MouseEvent) => {
    event.stopPropagation()
    
    const updatedAnnotation: Annotation = {
      ...annotation,
      metadata: {
        ...annotation.metadata,
        visible: !annotation.metadata.visible,
      },
      updatedAt: new Date().toISOString(),
    }
    
    dispatch(updateAnnotation(updatedAnnotation))
  }

  // Handle delete
  const handleDelete = (annotationId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    
    // TODO: Show confirmation dialog
    if (window.confirm('Are you sure you want to delete this annotation?')) {
      dispatch(removeAnnotation(annotationId))
    }
  }

  // Handle start editing name
  const handleStartEditName = (annotation: Annotation, event: React.MouseEvent) => {
    event.stopPropagation()
    setEditingNameId(annotation.id)
    setEditingNameValue(annotation.metadata?.name || annotation.text || annotation.label || '')
  }

  // Handle save name
  const handleSaveName = (annotation: Annotation) => {
    if (editingNameValue.trim()) {
      const updatedAnnotation: Annotation = {
        ...annotation,
        metadata: {
          ...annotation.metadata,
          name: editingNameValue.trim(),
        },
        updatedAt: new Date().toISOString(),
      }
      
      dispatch(updateAnnotation(updatedAnnotation))
    }
    
    setEditingNameId(null)
    setEditingNameValue('')
  }

  // Handle cancel editing name
  const handleCancelEditName = () => {
    setEditingNameId(null)
    setEditingNameValue('')
  }

  // Handle show/hide all
  const handleToggleAllVisibility = () => {
    const allVisible = annotations.every(a => a.metadata.visible)
    const newVisibility = !allVisible
    
    annotations.forEach(annotation => {
      const updatedAnnotation: Annotation = {
        ...annotation,
        metadata: {
          ...annotation.metadata,
          visible: newVisibility,
        },
        updatedAt: new Date().toISOString(),
      }
      dispatch(updateAnnotation(updatedAnnotation))
    })
  }

  // Get display name for annotation
  const getDisplayName = (annotation: Annotation): string => {
    return annotation.metadata?.name || 
           annotation.text || 
           annotation.label || 
           `${formatAnnotationType(annotation.type)} ${annotation.id.slice(0, 8)}`
  }

  // Check if all annotations are visible
  const allVisible = annotations.length > 0 && annotations.every(a => a.metadata.visible)

  // Handle export
  const handleExport = () => {
    if (onExport) {
      onExport()
    } else {
      try {
        downloadAnnotations(annotations)
        showToast('Annotations exported successfully', 'success')
      } catch (error) {
        showToast('Failed to export annotations', 'error')
        console.error('Export error:', error)
      }
    }
  }

  // Handle import
  const handleImport = () => {
    if (onImport) {
      onImport()
    } else {
      fileInputRef.current?.click()
    }
  }

  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const jsonString = await readFileAsText(file)
      const result = importAnnotations(jsonString)

      if (result.success && result.annotations) {
        // Add all imported annotations to Redux
        result.annotations.forEach(annotation => {
          dispatch(addAnnotation(annotation))
        })
        showToast(`Successfully imported ${result.annotations.length} annotations`, 'success')
      } else {
        showToast(result.error || 'Failed to import annotations', 'error')
      }
    } catch (error) {
      showToast('Failed to read file', 'error')
      console.error('Import error:', error)
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Show toast notification
  const showToast = (message: string, severity: 'success' | 'error') => {
    setToastMessage(message)
    setToastSeverity(severity)
    setToastOpen(true)
  }

  // Close toast
  const handleCloseToast = () => {
    setToastOpen(false)
  }

  return (
    <Paper 
      elevation={2} 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">
            Annotations ({annotations.length})
          </Typography>
          <Box>
            <Tooltip title={allVisible ? "Hide All" : "Show All"}>
              <IconButton 
                size="small" 
                onClick={handleToggleAllVisibility}
                disabled={annotations.length === 0}
              >
                {allVisible ? <HideAllIcon fontSize="small" /> : <ShowAllIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Import Annotations">
              <IconButton size="small" onClick={handleImport}>
                <ImportIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export Annotations">
              <IconButton 
                size="small" 
                onClick={handleExport}
                disabled={annotations.length === 0}
              >
                <ExportIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Search */}
        <TextField
          fullWidth
          size="small"
          placeholder="Search annotations..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />

        {/* Filters and Sort */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <FormControl size="small" sx={{ flex: 1 }}>
            <InputLabel>Filter</InputLabel>
            <Select
              value={filterType}
              label="Filter"
              onChange={(e) => setFilterType(e.target.value as typeof filterType)}
            >
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="text">Text</MenuItem>
              <MenuItem value="arrow">Arrow</MenuItem>
              <MenuItem value="freehand">Freehand</MenuItem>
              <MenuItem value="rectangle">Rectangle</MenuItem>
              <MenuItem value="circle">Circle</MenuItem>
              <MenuItem value="polygon">Polygon</MenuItem>
              <MenuItem value="measurement">Measurement</MenuItem>
              <MenuItem value="leader">Leader</MenuItem>
              <MenuItem value="clinical">Clinical</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ flex: 1 }}>
            <InputLabel>Sort By</InputLabel>
            <Select
              value={sortBy}
              label="Sort By"
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            >
              <MenuItem value="created">Created Date</MenuItem>
              <MenuItem value="updated">Updated Date</MenuItem>
              <MenuItem value="name">Name</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* Annotation List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {filteredAndSortedAnnotations.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {debouncedSearchQuery || filterType !== 'all'
                ? 'No annotations match your filters'
                : 'No annotations yet'}
            </Typography>
          </Box>
        ) : (
          <List dense>
            {filteredAndSortedAnnotations.map((annotation) => (
              <AnnotationListItem
                key={annotation.id}
                annotation={annotation}
                isSelected={selectedAnnotationId === annotation.id}
                isEditing={editingNameId === annotation.id}
                editingValue={editingNameValue}
                onSelect={handleSelectAnnotation}
                onToggleVisibility={handleToggleVisibility}
                onStartEdit={handleStartEditName}
                onSaveEdit={handleSaveName}
                onCancelEdit={handleCancelEditName}
                onEditValueChange={setEditingNameValue}
                onDelete={handleDelete}
                getDisplayName={getDisplayName}
              />
            ))}
          </List>
        )}
      </Box>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* Toast notification */}
      <Snackbar
        open={toastOpen}
        autoHideDuration={4000}
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseToast} severity={toastSeverity} sx={{ width: '100%' }}>
          {toastMessage}
        </Alert>
      </Snackbar>
    </Paper>
  )
}

export default AnnotationManagerPanel
