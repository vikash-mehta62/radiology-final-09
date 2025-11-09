# Manual CORS Fix for Orthanc

## The Issue

OHIF cannot connect to Orthanc because Orthanc is not sending CORS (Cross-Origin Resource Sharing) headers. This prevents OHIF (running on port 3001) from accessing Orthanc (running on port 8042).

## The Solution

Add CORS headers to Orthanc's configuration file.

## Step-by-Step Instructions

### Step 1: Open Orthanc Configuration File

1. Open Notepad **as Administrator**:
   - Press `Win` key
   - Type: `notepad`
   - Right-click on "Notepad"
   - Select "Run as administrator"

2. In Notepad, click File → Open

3. Navigate to:
   ```
   C:\Program Files\Orthanc Server\Configuration\
   ```

4. Change file type filter from "Text Documents (*.txt)" to "All Files (*.*)"

5. Open the file: `orthanc.json`

### Step 2: Find the Right Location

1. Press `Ctrl + F` to open Find dialog

2. Search for: `HttpDescribeErrors`

3. You should find a line that looks like:
   ```json
   "HttpDescribeErrors" : true,
   ```

### Step 3: Add CORS Headers

1. **Right after** the line with `"HttpDescribeErrors" : true,`, add these lines:

```json
  
  "HttpHeaders": {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-Requested-With",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400"
  },
```

**IMPORTANT:** Make sure to include the comma after `true,` on the HttpDescribeErrors line!

### Step 4: Verify the Change

After adding, it should look like this:

```json
  "HttpThreadsCount" : 50,
  "HttpDescribeErrors" : true,
  
  "HttpHeaders": {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-Requested-With",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400"
  },
  
  "DicomTlsEnabled" : false,
```

### Step 5: Save the File

1. Click File → Save
2. Close Notepad

### Step 6: Restart Orthanc Service

**Method 1: Using Services Manager**
1. Press `Win + R`
2. Type: `services.msc`
3. Press Enter
4. Find "Orthanc" in the list
5. Right-click → **Restart**

**Method 2: Using Command Prompt (as Administrator)**
1. Open Command Prompt as Administrator
2. Run:
   ```cmd
   net stop Orthanc
   net start Orthanc
   ```

### Step 7: Test OHIF

1. Open browser
2. Go to: http://localhost:3001
3. Press `Ctrl + F5` (hard refresh)
4. **Expected:** Studies from Orthanc should now appear!

## Verification

To verify CORS is working, open PowerShell and run:

```powershell
$response = Invoke-WebRequest -Uri "http://localhost:8042/dicom-web/studies" -Method GET -UseBasicParsing
$response.Headers['Access-Control-Allow-Origin']
```

Should output: `*`

## Troubleshooting

### If OHIF still shows error:

1. **Clear browser cache:**
   - Press `Ctrl + Shift + Delete`
   - Select "Cached images and files"
   - Click "Clear data"

2. **Hard refresh OHIF:**
   - Press `Ctrl + F5` multiple times

3. **Check Orthanc is running:**
   - Open: http://localhost:8042
   - Should show Orthanc interface

4. **Verify config syntax:**
   - Make sure all commas are in place
   - Make sure all brackets match
   - JSON is very strict about syntax!

### If Orthanc won't start after changes:

1. You likely have a JSON syntax error
2. Restore the backup:
   - Go to: `C:\Program Files\Orthanc Server\Configuration\`
   - Find the backup file (ends with `.backup`)
   - Copy it and rename to `orthanc.json`
3. Try again, being very careful with commas and brackets

## Alternative: Copy-Paste Ready Config

If you want to be absolutely sure, here's the exact text to add after `"HttpDescribeErrors" : true,`:

```
  
  "HttpHeaders": {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-Requested-With",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400"
  },
```

**Copy this exactly** (including the blank line at the start and the comma at the end).

## After Success

Once CORS is working:
- ✅ OHIF will load studies from Orthanc
- ✅ You can click "OHIF Pro" from your viewer
- ✅ Studies will open in OHIF
- ✅ Full integration is complete!

## Need Help?

If you're still having issues:
1. Check the Orthanc logs in: `C:\Program Files\Orthanc Server\Logs\`
2. Check browser console (F12) for specific error messages
3. Verify the JSON syntax using an online JSON validator

---

**This is the final step to get OHIF working!**
