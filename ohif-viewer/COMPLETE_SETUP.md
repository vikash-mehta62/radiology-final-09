# OHIF Viewer - Complete Setup Guide

## ✅ What's Been Done

1. **Downloaded OHIF Source Code** - Latest version from GitHub
2. **Created Configuration** - Custom config for your Orthanc server
3. **Created Start Scripts** - Easy-to-use scripts to launch OHIF
4. **Updated Viewer Integration** - Improved error handling in your main app
5. **Started Installation** - Dependencies are being installed in background

## 📋 Current Status

Run this to check status:
```powershell
.\check-status.ps1
```

## 🚀 Complete Setup Steps

### Step 1: Wait for Installation (5-10 minutes)
The installation is running in the background. You can check progress:

```powershell
# Check if node_modules folder exists
Test-Path ohif-app/node_modules
```

### Step 2: Start OHIF Server

Once installation completes:

**Option A - PowerShell (Recommended):**
```powershell
.\start-ohif-dev.ps1
```

**Option B - Command Prompt:**
```cmd
start-ohif-dev.bat
```

**What happens:**
- OHIF dev server starts on port 3001
- Webpack compiles the application (takes 1-2 minutes first time)
- Browser opens automatically or visit: http://localhost:3001

### Step 3: Verify OHIF Works

1. Open http://localhost:3001
2. You should see OHIF study list interface
3. If Orthanc has studies, they'll appear in the list

### Step 4: Test Integration with Your Viewer

1. Start your main viewer app (port 3000)
2. Navigate to any study
3. Click the **"OHIF Pro"** button in the toolbar
4. Study should open in OHIF in a new tab

## 🔧 How It All Works Together

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Workflow                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User opens study in your viewer (localhost:3000)        │
│                          ↓                                   │
│  2. Clicks "OHIF Pro" button                                │
│                          ↓                                   │
│  3. Opens: http://localhost:3001/viewer?StudyInstanceUIDs=X │
│                          ↓                                   │
│  4. OHIF receives StudyInstanceUID                          │
│                          ↓                                   │
│  5. OHIF queries Orthanc (localhost:8042)                   │
│                          ↓                                   │
│  6. OHIF displays study with advanced tools                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 📁 File Structure

```
ohif-viewer/
├── ohif-app/                          # OHIF source code
│   ├── platform/app/
│   │   └── public/config/
│   │       └── local_orthanc.js      # ← Your Orthanc config
│   └── node_modules/                  # Dependencies (after install)
│
├── start-ohif-dev.ps1                # ← Start script (PowerShell)
├── start-ohif-dev.bat                # ← Start script (CMD)
├── check-status.ps1                  # ← Status checker
└── COMPLETE_SETUP.md                 # ← This file
```

## ⚙️ Configuration Details

### OHIF Configuration
**File:** `ohif-app/platform/app/public/config/local_orthanc.js`

Key settings:
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
**File:** `viewer/src/pages/viewer/ViewerPage.tsx`

The integration code now includes error handling:
```tsx
const openInOHIF = async () => {
  const ohifUrl = `http://localhost:3001/viewer?StudyInstanceUIDs=${studyInstanceUID}`
  // Opens OHIF with error handling if not running
  window.open(ohifUrl, '_blank')
}
```

## 🐛 Troubleshooting

### Installation Issues

**Problem:** Installation taking too long
```powershell
# Check if it's still running
Get-Process | Where-Object {$_.ProcessName -like "*node*"}

# If stuck, restart:
cd ohif-app
yarn install
```

**Problem:** Installation errors
```powershell
# Clear cache and retry
cd ohif-app
Remove-Item -Recurse -Force node_modules
yarn cache clean
yarn install
```

### OHIF Won't Start

**Problem:** Port 3001 already in use
```powershell
# Find what's using port 3001
netstat -ano | findstr :3001

# Kill the process (replace PID)
taskkill /PID <PID> /F

# Or change port in start scripts
```

**Problem:** Webpack errors
```powershell
# Clear webpack cache
cd ohif-app
Remove-Item -Recurse -Force .webpack
yarn run dev
```

### OHIF Can't Connect to Orthanc

**Problem:** CORS errors in browser console

**Solution:** Update Orthanc configuration file:
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

Then restart Orthanc.

**Problem:** DICOMweb not enabled

**Solution:** Ensure Orthanc has DICOMweb plugin:
```json
{
  "Plugins": ["OrthancDicomWeb"]
}
```

### No Studies Showing

**Check:**
1. Is Orthanc running? → http://localhost:8042
2. Does Orthanc have studies? → http://localhost:8042/app/explorer.html
3. Upload test DICOM files to Orthanc
4. Refresh OHIF study list

### Integration Not Working

**Problem:** "OHIF Pro" button does nothing

**Check browser console for errors:**
- F12 → Console tab
- Look for connection errors
- Verify OHIF is running on port 3001

**Problem:** Study doesn't load in OHIF

**Verify StudyInstanceUID:**
```tsx
// In browser console when viewing study
console.log(window.location.pathname)
// Should show: /viewer/1.2.3.4.5...
```

## 🎯 Testing Checklist

- [ ] OHIF installation completed
- [ ] OHIF starts without errors
- [ ] OHIF accessible at http://localhost:3001
- [ ] Orthanc running at http://localhost:8042
- [ ] Studies visible in OHIF study list
- [ ] "OHIF Pro" button visible in your viewer
- [ ] Clicking button opens OHIF in new tab
- [ ] Study loads correctly in OHIF
- [ ] Can use OHIF tools (zoom, pan, measure)

## 📚 Additional Resources

### OHIF Documentation
- Main Docs: https://docs.ohif.org/
- Configuration: https://docs.ohif.org/configuration/
- Extensions: https://docs.ohif.org/platform/extensions/

### Orthanc Documentation
- DICOMweb Plugin: https://book.orthanc-server.com/plugins/dicomweb.html
- Configuration: https://book.orthanc-server.com/users/configuration.html

### Keyboard Shortcuts in OHIF
- **Arrow Keys**: Navigate images/viewports
- **+/-**: Zoom in/out
- **R/L**: Rotate right/left
- **H/V**: Flip horizontal/vertical
- **I**: Invert colors
- **Space**: Reset viewport
- **=**: Fit to window

## 🚀 Next Steps

1. **Complete Installation** - Wait for yarn install to finish
2. **Start OHIF** - Run start-ohif-dev.ps1
3. **Test Basic Functionality** - Open http://localhost:3001
4. **Test Integration** - Click "OHIF Pro" from your viewer
5. **Explore Features** - Try measurements, annotations, MPR
6. **Customize** - Adjust config for your needs
7. **Production Setup** - Consider Docker for production deployment

## 💡 Tips

- **First startup is slow** - Webpack needs to compile everything (1-2 min)
- **Subsequent startups are faster** - Webpack caches compiled code
- **Keep terminal open** - You'll see logs and errors there
- **Hot reload works** - Changes to config reload automatically
- **Use Chrome DevTools** - F12 for debugging

## 🆘 Need Help?

If you encounter issues:

1. Check status: `.\check-status.ps1`
2. Check logs in the terminal where OHIF is running
3. Check browser console (F12)
4. Verify Orthanc is accessible
5. Try restarting both OHIF and Orthanc

## ✨ What You Get

With OHIF integrated, your users get:

- **Professional DICOM Viewer** - Industry-standard interface
- **Advanced Tools** - Measurements, annotations, ROI
- **Multi-planar Reconstruction (MPR)** - Axial, sagittal, coronal views
- **3D Volume Rendering** - For CT and MRI studies
- **Hanging Protocols** - Automatic layout based on modality
- **Keyboard Shortcuts** - Fast navigation and manipulation
- **DICOM SR Support** - Structured reporting
- **Export Capabilities** - Save measurements and annotations

All accessible with one click from your main viewer!
