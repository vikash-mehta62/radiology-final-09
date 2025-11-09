# Annotation Manager Panel Integration Guide

## Overview

The `AnnotationManagerPanel` component provides a comprehensive interface for managing annotations in the medical image viewer. It includes features for searching, filtering, sorting, visibility toggling, renaming, deleting, and importing/exporting annotations.

## Features Implemented

### 1. Annotation List Display
- Shows all annotations with type icons, names/labels, and timestamps
- Visual indication of annotation type with color-coded chips
- Relative timestamps (e.g., "5m ago", "2h ago", "3d ago")
- Selection highlighting for currently selected annotation

### 2. Search and Filter
- **Search**: Full-text search across annotation names, text, labels, and types
- **Filter by Type**: Filter annotations by specific types (text, arrow, freehand, rectangle, circle, polygon, measurement, leader, clinical)
- **Sort Options**: Sort by created date, updated date, or name

### 3. Visibility Toggle
- Individual visibility toggle for each annotation (eye icon)
- Bulk "Show All" / "Hide All" button
- Visual opacity indication for hidden annotations
- Invisible annotations are automatically filtered out during rendering

### 4. Rename Functionality
- Inline editing of annotation names
- Click the edit icon to start editing
- Press Enter to save, Escape to cancel
- Updates the `metadata.name` property

### 5. Delete Functionality
- Delete button for each annotation
- Confirmation dialog before deletion
- Removes annotation from Redux state
- Clears selection if deleted annotation was selected

### 6. Export/Import
- **Export**: Download all annotations as JSON file
- **Import**: Upload JSON file to restore annotations
- Validation of imported data structure
- Success/error toast notifications
- Automatic ID generation for imported annotations to avoid conflicts

## Usage

### Basic Integration

```tsx
import { AnnotationManagerPanel } from './components/viewer'

function MyViewer() {
  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {/* Main viewer area */}
      <Box sx={{ flex: 1 }}>
        {/* Your viewer component */}
      </Box>
      
      {/* Annotation Manager Panel */}
      <Box sx={{ width: 350, borderLeft: 1, borderColor: 'divider' }}>
        <AnnotationManagerPanel />
      </Box>
    </Box>
  )
}
```

### Integration with MedicalImageViewer

Add the following to your `MedicalImageViewer.tsx`:

```tsx
// 1. Import the component
import AnnotationManagerPanel from './AnnotationManagerPanel'

// 2. Add state for panel visibility
const [isAnnotationManagerOpen, setIsAnnotationManagerOpen] = useState(false)

// 3. Add toggle button in your toolbar
<Tooltip title="Annotation Manager">
  <IconButton onClick={() => setIsAnnotationManagerOpen(!isAnnotationManagerOpen)}>
    <ListIcon />
  </IconButton>
</Tooltip>

// 4. Render the panel (similar to AnalysisPanel)
{isAnnotationManagerOpen && (
  <Box
    sx={{
      position: 'fixed',
      right: 0,
      top: 64,
      bottom: 0,
      width: 350,
      bgcolor: 'background.paper',
      borderLeft: 1,
      borderColor: 'divider',
      zIndex: 1200,
      overflow: 'hidden',
    }}
  >
    <AnnotationManagerPanel />
  </Box>
)}
```

### Custom Export/Import Handlers

If you need custom export/import logic:

```tsx
<AnnotationManagerPanel
  onExport={() => {
    // Custom export logic
    const annotations = useAppSelector(selectAnnotations)
    // ... your custom export code
  }}
  onImport={() => {
    // Custom import logic
    // ... your custom import code
  }}
/>
```

## Data Structure

### Annotation Export Format

```json
{
  "version": "1.0",
  "exportDate": "2025-10-10T12:00:00.000Z",
  "annotationCount": 5,
  "annotations": [
    {
      "id": "annotation-123",
      "type": "arrow",
      "points": [
        { "x": 0.5, "y": 0.5 },
        { "x": 0.6, "y": 0.6 }
      ],
      "text": "Important finding",
      "label": "Finding 1",
      "style": {
        "strokeColor": "#00ff41",
        "fillColor": "#00ff4120",
        "strokeWidth": 2,
        "fontSize": 14,
        "opacity": 1
      },
      "transform": {
        "position": { "x": 0, "y": 0 },
        "scale": { "x": 1, "y": 1 },
        "rotation": 0
      },
      "metadata": {
        "name": "Critical Finding",
        "visible": true,
        "locked": false,
        "zIndex": 0
      },
      "frameIndex": 0,
      "normalized": true,
      "createdAt": "2025-10-10T11:00:00.000Z",
      "updatedAt": "2025-10-10T11:30:00.000Z"
    }
  ]
}
```

## Redux Integration

The component uses the following Redux actions:

- `selectAnnotations` - Get all annotations
- `selectSelectedAnnotationId` - Get currently selected annotation
- `updateAnnotation` - Update annotation properties
- `removeAnnotation` - Delete annotation
- `selectAnnotation` - Select/deselect annotation
- `addAnnotation` - Add new annotation (for import)

## Styling

The component uses Material-UI theming and can be customized via the `sx` prop:

```tsx
<Box sx={{ width: 400, height: '100%' }}>
  <AnnotationManagerPanel />
</Box>
```

## Keyboard Shortcuts

When editing annotation names:
- **Enter**: Save changes
- **Escape**: Cancel editing

## Requirements Satisfied

This implementation satisfies the following requirements from the spec:

- **6.1**: List all annotations with type, name/label, and timestamp
- **6.2**: Toggle visibility of individual annotations and bulk show/hide all
- **6.3**: Rename annotations with inline editing
- **6.4**: Delete annotations with confirmation dialog
- **6.5**: Export annotations to JSON format
- **6.6**: Import annotations from JSON with validation

## Future Enhancements

Potential improvements for future iterations:

1. Drag-and-drop reordering of annotations
2. Bulk selection and operations
3. Annotation grouping/folders
4. Advanced filtering (by date range, by frame, by author)
5. Annotation templates
6. Collaborative annotations with user attribution
7. Annotation history/versioning
8. Export to other formats (CSV, PDF report)
