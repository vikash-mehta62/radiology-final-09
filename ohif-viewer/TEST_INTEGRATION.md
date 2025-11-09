# OHIF Integration Test

## ✅ Current Status

### OHIF Server
- **Status**: ✅ RUNNING
- **Port**: 3001
- **URL**: http://localhost:3001
- **Response**: 200 OK

### Your Viewer App
- **Status**: ✅ RUNNING (assumed on port 3000)
- **Integration**: ✅ Code updated with error handling

## 🧪 Test Steps

### Test 1: OHIF Standalone
1. Open browser: http://localhost:3001
2. **Expected**: OHIF study list interface loads
3. **If Orthanc has studies**: They should appear in the list

### Test 2: Integration from Your Viewer
1. Open your viewer: http://localhost:3000
2. Navigate to any study (e.g., `/viewer/1.2.840.113619...`)
3. Look for the **"OHIF Pro"** button in the toolbar
4. Click the button
5. **Expected**: New tab opens with OHIF showing the same study

### Test 3: Study Loading in OHIF
1. After clicking "OHIF Pro"
2. **Expected URL**: `http://localhost:3001/viewer?StudyInstanceUIDs=<study-uid>`
3. **Expected**: OHIF loads and queries Orthanc for the study
4. **Expected**: Study images appear in OHIF viewer

## 🔍 Troubleshooting

### If OHIF page doesn't load:

**Check 1: Is OHIF running?**
```powershell
Test-NetConnection localhost -Port 3001
# Should return: True
```

**Check 2: Can you access OHIF directly?**
```powershell
curl http://localhost:3001 -UseBasicParsing
# Should return: StatusCode 200
```

**Check 3: Is Orthanc running?**
```powershell
Test-NetConnection localhost -Port 8042
# Should return: True
```

### If study doesn't load in OHIF:

**Check 1: Is StudyInstanceUID correct?**
- Open browser console (F12)
- Check the URL: `http://localhost:3001/viewer?StudyInstanceUIDs=...`
- Verify the UID matches the study in your viewer

**Check 2: Can OHIF connect to Orthanc?**
- Open OHIF: http://localhost:3001
- Open browser console (F12)
- Look for network errors or CORS errors
- Check if studies from Orthanc appear in the list

**Check 3: Does Orthanc have the study?**
- Open Orthanc: http://localhost:8042/app/explorer.html
- Check if the study exists
- Verify the StudyInstanceUID matches

### If you get CORS errors:

Update Orthanc configuration:
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

## 📊 Expected Flow

```
User Action: Click "OHIF Pro" button
     ↓
ViewerPage.tsx: openInOHIF() function runs
     ↓
Opens: http://localhost:3001/viewer?StudyInstanceUIDs=X
     ↓
OHIF receives request
     ↓
OHIF queries: http://localhost:8042/dicom-web/studies?StudyInstanceUID=X
     ↓
Orthanc returns study metadata
     ↓
OHIF displays study with images
```

## 🎯 Success Criteria

- [ ] OHIF accessible at http://localhost:3001
- [ ] "OHIF Pro" button visible in your viewer
- [ ] Clicking button opens new tab
- [ ] New tab URL contains correct StudyInstanceUID
- [ ] OHIF loads without errors
- [ ] Study images appear in OHIF
- [ ] Can use OHIF tools (zoom, pan, measure)

## 🐛 Common Issues

### Issue: "Connection Refused"
**Cause**: OHIF not running
**Fix**: Run `.\start-ohif-dev.ps1` in ohif-viewer folder

### Issue: "Study not found"
**Cause**: Study doesn't exist in Orthanc or wrong UID
**Fix**: Verify study exists in Orthanc and UID is correct

### Issue: CORS errors in console
**Cause**: Orthanc not allowing OHIF origin
**Fix**: Update Orthanc config with CORS headers

### Issue: Blank page in OHIF
**Cause**: JavaScript error or config issue
**Fix**: Check browser console (F12) for errors

## 📝 Quick Commands

```powershell
# Check if OHIF is running
Test-NetConnection localhost -Port 3001

# Check if Orthanc is running
Test-NetConnection localhost -Port 8042

# Start OHIF (if not running)
cd ohif-viewer
.\start-ohif-dev.ps1

# Check OHIF logs
# Look at the terminal where OHIF is running

# Test OHIF directly
Start-Process "http://localhost:3001"

# Test with specific study
Start-Process "http://localhost:3001/viewer?StudyInstanceUIDs=1.2.3.4.5"
```

## ✨ What to Test in OHIF

Once the study loads:

1. **Navigation**: Use arrow keys to scroll through images
2. **Zoom**: Use mouse wheel or +/- keys
3. **Pan**: Click and drag
4. **Window/Level**: Right-click and drag
5. **Measurements**: Click measurement tools in toolbar
6. **Annotations**: Add text annotations
7. **Layout**: Try different viewport layouts
8. **Series**: Switch between different series
9. **MPR**: Try multi-planar reconstruction (if CT/MRI)
10. **3D**: Try 3D volume rendering (if available)

## 🎉 Success!

If all tests pass, you have successfully integrated OHIF with your radiology viewer!

Users can now:
- View studies in your custom viewer
- Click "OHIF Pro" for advanced features
- Use professional DICOM tools
- Seamlessly switch between viewers
