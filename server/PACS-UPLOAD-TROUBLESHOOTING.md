# PACS Upload Troubleshooting Guide

## Quick Diagnostics

### 1. Check Environment Configuration
```bash
curl http://3.144.196.75:8001/api/pacs/upload/config-check
```

This will show you if all required environment variables are set.

### 2. Test PACS Connection
```bash
curl http://3.144.196.75:8001/api/pacs/upload/test
```

This will test if the server can connect to Orthanc PACS.

### 3. Check Orthanc Status
```bash
curl http://69.62.70.102:8042/system
```

This should return Orthanc system information if it's running.

## Common Issues and Solutions

### Issue 1: "ORTHANC_URL is not set"

**Problem**: Environment variable is missing

**Solution**:
1. Check your `.env` file in `node-server/` directory
2. Add or verify:
   ```env
   ORTHANC_URL=http://69.62.70.102:8042
   ORTHANC_USERNAME=orthanc
   ORTHANC_PASSWORD=orthanc
   ```
3. Restart the server

### Issue 2: "PACS Disconnected - Check Orthanc server"

**Problem**: Orthanc PACS server is not running or not accessible

**Solution**:
1. Start Orthanc server:
   ```bash
   docker-compose up orthanc
   ```
   
2. Verify Orthanc is running:
   ```bash
   curl http://69.62.70.102:8042/system
   ```

3. Check if port 8042 is accessible:
   ```bash
   netstat -an | grep 8042
   ```

### Issue 3: "Upload failed: Orthanc upload failed"

**Problem**: DICOM file upload to Orthanc failed

**Possible Causes**:
1. **Invalid DICOM file**: File is corrupted or not a valid DICOM
2. **Orthanc storage full**: Orthanc database or storage is full
3. **Authentication failed**: Wrong Orthanc credentials

**Solutions**:
1. Verify DICOM file is valid:
   ```bash
   # Check file header
   head -c 132 yourfile.dcm | tail -c 4
   # Should show "DICM"
   ```

2. Check Orthanc storage:
   ```bash
   curl http://69.62.70.102:8042/statistics
   ```

3. Verify credentials in `.env` match Orthanc configuration

### Issue 4: "Study uploaded but frames not showing"

**Problem**: Upload succeeded but viewer shows "Frame not available"

**Possible Causes**:
1. Database not updated with instance records
2. Orthanc instance ID not linked properly
3. Frame retrieval endpoint not working

**Solutions**:
1. Check if study exists in database:
   ```bash
   curl http://3.144.196.75:8001/api/dicom/studies
   ```

2. Check if instances were created:
   ```bash
   curl http://3.144.196.75:8001/api/pacs/debug/{studyUID}
   ```

3. Verify Orthanc has the instances:
   ```bash
   curl http://69.62.70.102:8042/studies
   ```

### Issue 5: "MongoDB connection error"

**Problem**: Cannot connect to MongoDB database

**Solution**:
1. Check `MONGODB_URI` in `.env` file
2. Verify MongoDB is running
3. Check network connectivity to MongoDB

### Issue 6: "Real-time viewing not working"

**Problem**: Files upload but don't appear immediately in viewer

**Possible Causes**:
1. Database sync delay
2. Cache issues
3. Frontend not refreshing

**Solutions**:
1. Refresh the studies list in viewer
2. Check browser console for errors
3. Verify study UID in upload response matches viewer URL

## Environment Variables Checklist

Required for PACS Upload:
- [ ] `ORTHANC_URL` - Orthanc PACS server URL
- [ ] `ORTHANC_USERNAME` - Orthanc username
- [ ] `ORTHANC_PASSWORD` - Orthanc password
- [ ] `MONGODB_URI` - MongoDB connection string
- [ ] `ENABLE_PACS_INTEGRATION=true` - Enable PACS features

Optional but recommended:
- [ ] `CLOUDINARY_CLOUD_NAME` - For legacy instances
- [ ] `CLOUDINARY_API_KEY` - For legacy instances
- [ ] `CLOUDINARY_API_SECRET` - For legacy instances

## Testing Upload Manually

### Using cURL:
```bash
curl -X POST http://3.144.196.75:8001/api/pacs/upload \
  -F "dicom=@/path/to/your/file.dcm" \
  -H "Content-Type: multipart/form-data"
```

### Expected Response:
```json
{
  "success": true,
  "message": "Successfully uploaded and processed file.dcm. Ready for immediate viewing.",
  "data": {
    "studyInstanceUID": "1.2.3.4.5...",
    "totalFrames": 96,
    "readyForViewing": true,
    "viewingInfo": {
      "studyUrl": "/api/dicom/studies/1.2.3.4.5...",
      "frameUrl": "/api/dicom/studies/1.2.3.4.5.../frames/{frameIndex}",
      "totalFrames": 96,
      "canViewImmediately": true
    }
  }
}
```

## Logs to Check

### Server Logs:
Look for these messages in console:
- `✅ Orthanc PACS connection successful` - Good!
- `⚠️  Orthanc PACS connection failed` - Problem!
- `Uploading {filename} to Orthanc PACS` - Upload started
- `Successfully uploaded to Orthanc` - Upload succeeded
- `Database updated: study and X instances created` - Database synced

### Orthanc Logs:
Check Orthanc container logs:
```bash
docker logs orthanc-dev
```

Look for:
- `POST /instances` - Upload received
- `200 OK` - Upload successful
- Any error messages

## Getting Help

If issues persist:

1. **Collect diagnostic information**:
   ```bash
   # Environment check
   curl http://3.144.196.75:8001/api/pacs/upload/config-check > config-check.json
   
   # Connection test
   curl http://3.144.196.75:8001/api/pacs/upload/test > connection-test.json
   
   # Orthanc status
   curl http://69.62.70.102:8042/system > orthanc-status.json
   ```

2. **Check server logs** for error messages

3. **Verify all services are running**:
   - Node server (port 8001)
   - Orthanc PACS (port 8042)
   - MongoDB
   - Redis (if used)

4. **Test with a known-good DICOM file** from a sample dataset

## Quick Fix Checklist

- [ ] Restart Node server
- [ ] Restart Orthanc server
- [ ] Check `.env` file exists and has correct values
- [ ] Verify Orthanc is accessible at configured URL
- [ ] Test with a small DICOM file first
- [ ] Check browser console for JavaScript errors
- [ ] Clear browser cache
- [ ] Try uploading via `/pacs-upload` web interface
- [ ] Check MongoDB connection
- [ ] Verify disk space is available

## Success Indicators

When everything is working correctly, you should see:

1. ✅ Green "PACS Connected" status on upload page
2. ✅ Upload completes with success message
3. ✅ Study appears in studies list immediately
4. ✅ Correct frame count displayed
5. ✅ Frames load and display in viewer
6. ✅ No errors in browser console
7. ✅ No errors in server logs

## Contact

For additional support, check:
- Server logs in console
- Browser developer console
- Orthanc logs
- MongoDB logs