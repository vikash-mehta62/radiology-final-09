# Restart Orthanc to Apply CORS Configuration

## ✅ Configuration Updated

The Orthanc configuration file has been updated with CORS headers to allow OHIF to connect.

**File**: `orthanc-config/orthanc.json`

**Added**:
```json
"HttpHeaders": {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-Requested-With",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400"
}
```

## 🔄 Restart Orthanc

Orthanc is running as a Windows Service and needs to be restarted for changes to take effect.

### Option 1: Using Services Manager (Recommended)

1. Press `Win + R`
2. Type: `services.msc`
3. Press Enter
4. Find "Orthanc" in the list
5. Right-click → **Restart**

### Option 2: Using Command Prompt (As Administrator)

1. Open Command Prompt **as Administrator**
2. Run:
```cmd
net stop Orthanc
net start Orthanc
```

### Option 3: Using PowerShell (As Administrator)

1. Open PowerShell **as Administrator**
2. Run:
```powershell
Restart-Service Orthanc
```

### Option 4: Using Task Manager

1. Open Task Manager (Ctrl+Shift+Esc)
2. Go to "Services" tab
3. Find "Orthanc"
4. Right-click → **Restart**

## ✓ Verify Orthanc Restarted

After restarting, verify Orthanc is running:

```powershell
Test-NetConnection localhost -Port 8042
```

Should return: `True`

## 🧪 Test CORS Headers

After restart, test if CORS headers are present:

```powershell
$response = Invoke-WebRequest -Uri "http://localhost:8042/dicom-web/studies" -Method OPTIONS
$response.Headers['Access-Control-Allow-Origin']
```

Should return: `*`

## 🎯 Test OHIF Connection

1. Refresh OHIF in browser: http://localhost:3001
2. The error should be gone
3. Studies from Orthanc should appear in the list

## 🐛 If Still Not Working

### Check 1: Verify Config File Location
Make sure Orthanc is using the correct config file:
- Check Orthanc service properties
- Verify it points to: `G:\RADIOLOGY\redio-test - Copy\orthanc-config\orthanc.json`

### Check 2: Check Orthanc Logs
Look for errors in Orthanc logs (usually in the Orthanc installation directory)

### Check 3: Test Direct Access
```powershell
curl http://localhost:8042/dicom-web/studies -UseBasicParsing
```

Should return HTTP 200 with study data.

### Check 4: Browser Console
1. Open OHIF: http://localhost:3001
2. Press F12 (Developer Tools)
3. Go to Console tab
4. Look for CORS errors
5. If you see "Access-Control-Allow-Origin" errors, Orthanc hasn't restarted yet

## 📝 Alternative: Temporary CORS Workaround

If you can't restart Orthanc right now, you can test OHIF with a browser extension:

1. Install "CORS Unblock" or similar extension
2. Enable it
3. Refresh OHIF
4. This is **temporary** - you still need to restart Orthanc for permanent fix

## ✨ After Restart

Once Orthanc is restarted with CORS enabled:
- ✅ OHIF will connect to Orthanc
- ✅ Studies will appear in OHIF study list
- ✅ You can click "OHIF Pro" from your viewer
- ✅ Studies will load in OHIF

---

**Current Status:**
- ✅ OHIF running on port 3001
- ✅ Orthanc running on port 8042
- ✅ Configuration updated
- ⏳ **Waiting for Orthanc restart**
