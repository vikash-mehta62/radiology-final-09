# OHIF Viewer - Quick Start Guide

## 🚀 Start OHIF in 3 Steps

### Step 1: Start Docker Desktop
Make sure Docker Desktop is running on your Windows machine.

### Step 2: Run the Start Script
Double-click: `start-ohif.bat`

Or in PowerShell:
```powershell
.\start-ohif.ps1
```

### Step 3: Open OHIF
Open browser: **http://localhost:3001**

---

## ✅ Verify Setup

1. **OHIF Running**: http://localhost:3001 (should show OHIF interface)
2. **Orthanc Running**: http://localhost:8042 (should show Orthanc)
3. **Upload DICOM**: Upload study to Orthanc
4. **View in OHIF**: Study should appear in OHIF study list

---

## 🎯 What You Get

- **Professional DICOM Viewer**: Industry-standard medical image viewer
- **Advanced Tools**: Measurements, annotations, MPR, 3D rendering
- **Connected to Orthanc**: Automatically shows all studies from your PACS
- **Zero Configuration**: Works out of the box

---

## 🔧 Common Commands

```bash
# Start OHIF
docker-compose up -d

# Stop OHIF
docker-compose down

# View logs
docker-compose logs -f

# Restart OHIF
docker-compose restart
```

---

## 🔗 Integration with Your App

Add this to your viewer app to open studies in OHIF:

```tsx
// In your StudyViewer component
const openInOHIF = (studyUID: string) => {
  window.open(
    `http://localhost:3001/viewer?StudyInstanceUIDs=${studyUID}`,
    '_blank'
  );
};

// Add button
<button onClick={() => openInOHIF(study.studyInstanceUID)}>
  Open in OHIF Viewer
</button>
```

---

## 📝 Next Steps

1. ✅ Start OHIF (you're here!)
2. Upload test DICOM files to Orthanc
3. View studies in OHIF
4. Explore measurement and annotation tools
5. Integrate OHIF link into your main app

---

## 🆘 Troubleshooting

**OHIF won't start?**
- Check Docker Desktop is running
- Check port 3001 is not in use
- Run: `docker-compose logs` to see errors

**No studies showing?**
- Ensure Orthanc is running (port 8042)
- Upload DICOM files to Orthanc first
- Check Orthanc has studies: http://localhost:8042/app/explorer.html

**Can't connect to Orthanc?**
- Verify Orthanc DICOMweb plugin is enabled
- Check CORS settings in Orthanc config
- Restart both Orthanc and OHIF

---

## 📚 Resources

- Configuration: `public/config/default.js`
- Full README: `README.md`
- OHIF Docs: https://docs.ohif.org/
