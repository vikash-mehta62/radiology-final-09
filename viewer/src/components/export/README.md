# Export UI Components

This directory contains the export functionality components for the medical imaging reporting system. These components provide a complete export workflow with progress tracking, history, and multiple format support.

## Components

### ExportMenu

A dropdown menu component that allows users to select and initiate report exports in various formats.

**Features:**
- Multiple export formats (PDF, DICOM SR, FHIR, Plain Text)
- Format descriptions and icons
- Status-based warnings (draft/preliminary reports)
- Integrated progress tracking
- Error handling

**Usage:**
```tsx
import { ExportMenu } from '@/components/export'

<ExportMenu
  reportId="study-123"
  reportStatus="final"
  disabled={false}
  onExportComplete={(exportId, format) => {
    console.log(`Export ${exportId} completed in ${format} format`)
  }}
  onExportError={(error) => {
    console.error('Export failed:', error)
  }}
/>
```

**Props:**
- `reportId` (string, required): The ID of the report to export
- `reportStatus` ('draft' | 'preliminary' | 'final', optional): Current report status
- `disabled` (boolean, optional): Whether the export button is disabled
- `onExportComplete` (function, optional): Callback when export completes
- `onExportError` (function, optional): Callback when export fails

### ExportProgress

A dialog component that displays real-time export progress with status updates and automatic download.

**Features:**
- Real-time progress tracking with percentage
- Estimated time remaining
- Automatic file download on completion
- Cancel export functionality
- Retry download option
- Status indicators (processing, completed, failed)

**Usage:**
```tsx
import { ExportProgress } from '@/components/export'

<ExportProgress
  exportId="export-456"
  format="pdf"
  onComplete={(exportId) => {
    console.log('Export completed:', exportId)
  }}
  onCancel={() => {
    console.log('Export cancelled')
  }}
  onError={(error) => {
    console.error('Export error:', error)
  }}
/>
```

**Props:**
- `exportId` (string, required): The ID of the export session
- `format` (string, required): The export format being processed
- `onComplete` (function, required): Callback when export completes
- `onCancel` (function, required): Callback when user cancels
- `onError` (function, optional): Callback when export fails

### ExportHistory

A table component that displays past export operations with download and audit capabilities.

**Features:**
- Sortable export history table
- Status indicators with icons
- File size and duration display
- Re-download capability
- Audit information (user, IP, purpose)
- Refresh functionality
- Filtering by report or user

**Usage:**
```tsx
import { ExportHistory } from '@/components/export'

<ExportHistory
  reportId="study-123"
  userId="user-456"
  maxItems={20}
  showAuditInfo={true}
/>
```

**Props:**
- `reportId` (string, optional): Filter by specific report
- `userId` (string, optional): Filter by specific user
- `maxItems` (number, optional): Maximum number of items to display (default: 10)
- `showAuditInfo` (boolean, optional): Show audit information columns (default: false)

## Hooks

### useExport

A custom hook that provides export functionality with state management.

**Features:**
- Initiate exports in multiple formats
- Poll export status
- Download completed exports
- Cancel in-progress exports
- Retrieve export history
- Error handling and loading states

**Usage:**
```tsx
import { useExport } from '@/hooks/useExport'

function MyComponent() {
  const {
    exportSession,
    loading,
    error,
    initiateExport,
    getExportStatus,
    downloadExport,
    cancelExport,
    getExportHistory,
    clearError
  } = useExport()

  const handleExport = async () => {
    try {
      const session = await initiateExport('report-123', 'pdf')
      console.log('Export initiated:', session)
    } catch (err) {
      console.error('Export failed:', err)
    }
  }

  return (
    <button onClick={handleExport} disabled={loading}>
      {loading ? 'Exporting...' : 'Export Report'}
    </button>
  )
}
```

**Return Values:**
- `exportSession`: Current export session object
- `loading`: Boolean indicating loading state
- `error`: Error message string or null
- `initiateExport(reportId, format, metadata?)`: Function to start export
- `getExportStatus(exportId)`: Function to check export status
- `downloadExport(exportId)`: Function to download completed export
- `cancelExport(exportId)`: Function to cancel in-progress export
- `getExportHistory(reportId?, userId?, limit?)`: Function to get export history
- `clearError()`: Function to clear error state

## Services

### exportService

A service class that handles API communication for export operations.

**Usage:**
```tsx
import { exportService } from '@/services/exportService'

// Initiate export
const session = await exportService.initiateExport('report-123', 'pdf', {
  recipient: 'Dr. Smith',
  purpose: 'Patient consultation'
})

// Check status
const status = await exportService.getExportStatus(session.id)

// Download
await exportService.downloadExport(session.id)

// Get history
const history = await exportService.getExportHistory('report-123')
```

## Export Formats

### PDF
- Professional formatted report with images
- Hospital branding and logos
- Digital signature visualization
- Watermarks for non-final reports
- Page numbers and metadata

### DICOM SR (Structured Report)
- DICOM Part 3 compliant
- Structured findings with coded terminology
- Measurements with units
- Study and patient metadata
- SOP Instance UID generation

### HL7 FHIR
- FHIR R4 DiagnosticReport resource
- Patient and practitioner references
- Coded observations
- Report status and conclusion
- FHIR Bundle support

### Plain Text
- Simple text format
- Patient and study information
- All report sections
- Measurements table
- Findings list

## API Endpoints

The export components interact with the following backend endpoints:

- `POST /api/reports/:id/export/pdf` - Initiate PDF export
- `POST /api/reports/:id/export/dicom-sr` - Initiate DICOM SR export
- `POST /api/reports/:id/export/fhir` - Initiate FHIR export
- `POST /api/reports/:id/export/txt` - Initiate text export
- `GET /api/reports/export/status/:exportId` - Get export status
- `GET /api/reports/export/download/:exportId` - Download export file
- `POST /api/reports/export/cancel/:exportId` - Cancel export
- `GET /api/reports/export/history` - Get export history

## Workflow

1. **Initiate Export**
   - User clicks export button in ExportMenu
   - Selects desired format from dropdown
   - Export request sent to backend
   - ExportProgress dialog opens

2. **Progress Tracking**
   - Component polls export status every second
   - Progress bar updates with percentage
   - Estimated time remaining calculated
   - User can cancel at any time

3. **Completion**
   - File automatically downloads when ready
   - Success message displayed
   - Export logged in history
   - User can download again if needed

4. **History**
   - All exports tracked in database
   - Audit information recorded
   - Users can view past exports
   - Re-download capability available

## Compliance

The export system is designed to meet:

- **FDA 21 CFR Part 11**: Digital signature support in exports
- **HIPAA**: PHI encryption and audit logging
- **DICOM**: Standard compliance for medical imaging
- **HL7 FHIR**: Modern healthcare interoperability

## Error Handling

All components include comprehensive error handling:

- Network errors with retry capability
- Validation errors with clear messages
- Timeout handling for long exports
- User-friendly error displays
- Automatic error logging

## Performance

- Asynchronous export processing
- Progress polling with 1-second intervals
- Automatic cleanup of completed exports
- Efficient file download handling
- Optimized for large reports with images

## Testing

To test the export components:

1. **Unit Tests**: Test individual component logic
2. **Integration Tests**: Test export workflow end-to-end
3. **API Tests**: Test backend endpoint responses
4. **UI Tests**: Test user interactions and error states

## Future Enhancements

Potential improvements for future versions:

- Batch export multiple reports
- Custom export templates
- Email delivery option
- Cloud storage integration
- Export scheduling
- Advanced filtering in history
- Export analytics dashboard
