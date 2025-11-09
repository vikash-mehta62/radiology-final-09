# OHIF Viewer Setup

OHIF (Open Health Imaging Foundation) Viewer is a zero-footprint medical image viewer for DICOM images.

## Quick Start (Docker - RECOMMENDED)

### 1. Pull OHIF Image
```bash
docker pull ohif/viewer:latest
```

### 2. Start OHIF with Docker Compose
```bash
cd ohif-viewer
docker-compose up -d
```

### 3. Access OHIF
Open your browser: http://localhost:3001

## Alternative: Install from Source

### 1. Create OHIF App
```bash
cd ohif-viewer
npx create-ohif-app@latest
```

### 2. Start Development Server
```bash
npm run dev -- --port 3001
```

## Configuration

The OHIF viewer is configured to connect to your Orthanc PACS server at `http://localhost:8042`.

Configuration file: `public/config/default.js`

### Key Settings:
- **Port**: 3001 (to avoid conflicts with your main app on 3000)
- **Orthanc Connection**: localhost:8042
- **DICOMweb endpoints**: Configured for Orthanc
- **Study List**: Enabled

## Verify Setup

1. **Check OHIF is running**: http://localhost:3001
2. **Check Orthanc is running**: http://localhost:8042
3. **Upload a DICOM study** to Orthanc
4. **View in OHIF**: Click on study in OHIF study list

## Troubleshooting

### OHIF can't connect to Orthanc
- Ensure Orthanc is running on port 8042
- Check CORS settings in Orthanc configuration
- Verify DICOMweb plugin is enabled in Orthanc

### No studies showing
- Upload DICOM files to Orthanc first
- Check Orthanc has studies: http://localhost:8042/app/explorer.html
- Refresh OHIF study list

### Port 3001 already in use
Edit `docker-compose.yml` and change port mapping:
```yaml
ports:
  - "3002:80"  # Change 3001 to 3002
```

## Integration with Your App

To integrate OHIF into your existing viewer app:

1. **Embed as iframe**:
```tsx
<iframe 
  src="http://localhost:3001/viewer?StudyInstanceUIDs=1.2.3.4.5"
  width="100%"
  height="800px"
/>
```

2. **Link from your app**:
```tsx
<a href={`http://localhost:3001/viewer?StudyInstanceUIDs=${studyUID}`}>
  Open in OHIF Viewer
</a>
```

## Features

- Multi-planar reconstruction (MPR)
- 3D volume rendering
- Measurement tools
- Annotations
- Hanging protocols
- Keyboard shortcuts
- DICOM SR support
- PDF export

## Keyboard Shortcuts

- **Arrow Keys**: Navigate images/viewports
- **+/-**: Zoom in/out
- **R/L**: Rotate right/left
- **H/V**: Flip horizontal/vertical
- **I**: Invert colors
- **Space**: Reset viewport
- **=**: Fit to window

## Next Steps

1. Test with sample DICOM files
2. Configure hanging protocols for different modalities
3. Customize UI theme and branding
4. Set up user authentication if needed
5. Configure advanced features (MPR, 3D rendering)

## Resources

- OHIF Documentation: https://docs.ohif.org/
- OHIF GitHub: https://github.com/OHIF/Viewers
- Orthanc DICOMweb: https://book.orthanc-server.com/plugins/dicomweb.html
