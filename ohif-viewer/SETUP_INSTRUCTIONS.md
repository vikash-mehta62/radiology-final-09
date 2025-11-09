# OHIF Viewer Setup Instructions

## Current Status
✅ OHIF source code downloaded
🔄 Installing dependencies (in progress)

## Quick Start

### Step 1: Wait for Installation to Complete
The installation is currently running in the background. This may take 5-10 minutes.

### Step 2: Start OHIF Server
Once installation completes, run:

**Windows (PowerShell):**
```powershell
.\start-ohif-dev.ps1
```

**Windows (Command Prompt):**
```cmd
start-ohif-dev.bat
```

### Step 3: Verify OHIF is Running
Open your browser to: **http://localhost:3001**

You should see the OHIF viewer interface.

### Step 4: Test Integration
1. Go to your main viewer app
2. Open any study
3. Click the "OHIF Pro" button
4. The study should open in OHIF in a new tab

## How It Works

### Architecture
```
Your Viewer App (port 3000)
    ↓
    Opens study in OHIF (port 3001)
    ↓
    OHIF queries Orthanc (port 8042)
    ↓
    Displays DICOM images
```

### URL Format
When you click "OHIF Pro", it opens:
```
http://localhost:3001/viewer?StudyInstanceUIDs=<study-uid>
```

OHIF receives the StudyInstanceUID and automatically loads that study from Orthanc.

## Configuration

### OHIF Config File
Location: `ohif-app/platform/app/public/config/local_orthanc.js`

This file tells OHIF how to connect to your Orthanc server:
```javascript
servers: {
  dicomWeb: [{
    name: 'Orthanc',
    wadoUriRoot: 'http://localhost:8042/wado',
    qidoRoot: 'http://localhost:8042/dicom-web',
    wadoRoot: 'http://localhost:8042/dicom-web',
    // ... other settings
  }]
}
```

### Your Viewer Integration
Location: `viewer/src/pages/viewer/ViewerPage.tsx`

The integration code:
```tsx
const openInOHIF = () => {
  const ohifUrl = `http://localhost:3001/viewer?StudyInstanceUIDs=${studyInstanceUID}`
  window.open(ohifUrl, '_blank')
}
```

## Troubleshooting

### OHIF Won't Start
**Error:** "Cannot find module..."
**Solution:** Run `yarn install` again in the `ohif-app` directory

### OHIF Can't Connect to Orthanc
**Check:**
1. Is Orthanc running? Visit http://localhost:8042
2. Does Orthanc have DICOMweb enabled?
3. Check browser console for CORS errors

**Fix CORS Issues:**
Add to Orthanc configuration:
```json
{
  "RemoteAccessAllowed": true,
  "HttpHeaders": {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  }
}
```

### No Studies Showing in OHIF
1. Upload DICOM files to Orthanc first
2. Check Orthanc has studies: http://localhost:8042/app/explorer.html
3. Refresh OHIF study list

### Port 3001 Already in Use
Edit the start scripts and change PORT to another value (e.g., 3002)

## Development vs Production

### Current Setup (Development)
- OHIF runs with webpack dev server
- Hot reload enabled
- Slower startup but easier to debug

### For Production
Consider using Docker (see original README.md) or build static files:
```bash
cd ohif-app
yarn build
# Serve the dist folder with nginx or similar
```

## Next Steps

1. ✅ Wait for installation to complete
2. ⏳ Start OHIF dev server
3. ⏳ Test opening a study from your viewer
4. ⏳ Verify study loads correctly in OHIF
5. ⏳ Test OHIF features (zoom, pan, measurements, etc.)

## Support

- OHIF Documentation: https://docs.ohif.org/
- OHIF GitHub: https://github.com/OHIF/Viewers
- Orthanc DICOMweb: https://book.orthanc-server.com/plugins/dicomweb.html
