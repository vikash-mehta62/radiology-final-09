# Utility Scripts for DICOM Study Management

This directory contains utility scripts for diagnosing and fixing issues with DICOM studies.

## Quick Diagnosis

### Check a Specific Study
```bash
node check-study-status.js [studyUID]
```
Shows complete status of a study including:
- MongoDB Study record
- MongoDB Instance records
- Orthanc PACS status
- Recommended actions

**Example:**
```bash
node check-study-status.js 1.3.6.1.4.1.16568.1760629278470.775947117
```

### Audit All Studies
```bash
node audit-studies.js
```
Comprehensive audit of all studies showing:
- Total studies in MongoDB
- Studies in Orthanc PACS
- Studies missing instances
- Studies that need re-uploading

## Maintenance Scripts

### Clean Placeholder Cache
```bash
node clean-placeholder-cache.js
```
Removes cached placeholder images (4691 bytes) from the filesystem cache.
Safe to run - only removes placeholders, keeps valid frames.

### Migrate Legacy Studies
```bash
node migrate-legacy-studies.js
```
Creates MongoDB Instance records for legacy studies that have:
- Frames in filesystem cache
- Study record in MongoDB
- Study in Orthanc PACS

## Diagnostic Scripts

### List All Studies
```bash
node list-studies.js
```
Lists all studies in MongoDB with instance counts.

### Check Orthanc Study
```bash
node check-orthanc-study.js
```
Searches for a specific study in Orthanc PACS and shows details.
Edit the script to change the study UID.

### Check Instance Orthanc IDs
```bash
node check-instance-orthanc-id.js
```
Checks if Instance records have Orthanc IDs populated.
Edit the script to change the study UID.

### Test Frame Fix
```bash
node test-frame-fix.js
```
Tests the frame cache service fix for a specific study.
Edit the script to change the study UID and frame index.

## Common Issues and Solutions

### Issue: Checkered Pattern in Viewer
**Diagnosis:**
```bash
node check-study-status.js <studyUID>
```

**Solution:**
If status shows "NEEDS RE-UPLOAD":
1. Locate original DICOM file
2. Upload through web interface
3. System will automatically configure everything

### Issue: Study Works But Slow
**Diagnosis:**
Check if frames are cached:
```bash
ls backend/uploaded_frames_<studyUID>/
```

**Solution:**
Frames will be cached automatically on first view.
Subsequent views will be fast.

### Issue: Many Legacy Studies
**Diagnosis:**
```bash
node audit-studies.js
```

**Solution:**
For studies with frames in filesystem:
```bash
node migrate-legacy-studies.js
```

For studies without frames:
Re-upload the DICOM files.

## Script Details

### check-study-status.js
- **Purpose:** Quick health check for a single study
- **Usage:** `node check-study-status.js [studyUID]`
- **Output:** Status report with recommended actions
- **Safe:** Read-only, no modifications

### audit-studies.js
- **Purpose:** Comprehensive audit of all studies
- **Usage:** `node audit-studies.js`
- **Output:** Full report with statistics
- **Safe:** Read-only, no modifications

### clean-placeholder-cache.js
- **Purpose:** Remove cached placeholder images
- **Usage:** `node clean-placeholder-cache.js`
- **Output:** Count of deleted placeholders
- **Modifies:** Deletes files from backend/uploaded_frames_* directories
- **Safe:** Only deletes 4691-byte placeholder files

### migrate-legacy-studies.js
- **Purpose:** Create Instance records for legacy studies
- **Usage:** `node migrate-legacy-studies.js`
- **Output:** Migration report
- **Modifies:** Creates Instance records in MongoDB
- **Safe:** Uses upsert, won't duplicate records

### list-studies.js
- **Purpose:** List all studies with instance counts
- **Usage:** `node list-studies.js`
- **Output:** Study list
- **Safe:** Read-only, no modifications

### check-orthanc-study.js
- **Purpose:** Check if study exists in Orthanc
- **Usage:** Edit script to set studyUID, then `node check-orthanc-study.js`
- **Output:** Orthanc study details
- **Safe:** Read-only, no modifications

### check-instance-orthanc-id.js
- **Purpose:** Verify Instance records have Orthanc IDs
- **Usage:** Edit script to set studyUID, then `node check-instance-orthanc-id.js`
- **Output:** Instance details
- **Safe:** Read-only, no modifications

### test-frame-fix.js
- **Purpose:** Test frame cache service
- **Usage:** Edit script to set studyUID and frameIndex, then `node test-frame-fix.js`
- **Output:** Test results
- **Safe:** Read-only, no modifications

## Environment Requirements

All scripts require:
- Node.js installed
- `.env` file in server directory with:
  - `MONGODB_URI` - MongoDB connection string
  - `ORTHANC_URL` - Orthanc server URL
  - `ORTHANC_USERNAME` - Orthanc username
  - `ORTHANC_PASSWORD` - Orthanc password

## Troubleshooting

### MongoDB Connection Error
Check that MongoDB is running and `MONGODB_URI` in `.env` is correct.

### Orthanc Connection Error
Check that Orthanc is running and credentials in `.env` are correct.

### Permission Errors
Ensure the Node.js process has read/write access to the `backend/` directory.

## Best Practices

1. **Always run check-study-status.js first** to understand the issue
2. **Run audit-studies.js periodically** to identify problems early
3. **Clean placeholder cache after code fixes** to remove bad data
4. **Backup MongoDB before running migration scripts**
5. **Test with one study before bulk operations**

## Support

For issues or questions:
1. Check the logs in `server/logs/`
2. Run diagnostic scripts to gather information
3. Review `ISSUE-SUMMARY.md` for common problems
4. Check `FRAME-LOADING-FIX.md` for technical details
