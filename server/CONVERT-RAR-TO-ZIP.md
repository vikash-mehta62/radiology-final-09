# How to Convert RAR to ZIP for DICOM Upload

## Issue

You're trying to upload a RAR file, but the system only accepts ZIP files.

**Error Message:**
```
RAR files are not supported. Please extract the RAR file and create a ZIP archive instead.
```

## Quick Solution

### Option 1: Using Windows (WinRAR or 7-Zip)

#### Method A: WinRAR
1. Right-click the RAR file
2. Select **"Extract Here"** or **"Extract to [folder name]"**
3. Wait for extraction to complete
4. Select all extracted DICOM files
5. Right-click → **"Send to"** → **"Compressed (zipped) folder"**
6. Upload the new ZIP file

#### Method B: 7-Zip (Free)
1. Download 7-Zip from https://www.7-zip.org/ (if not installed)
2. Right-click the RAR file
3. Select **"7-Zip"** → **"Extract Here"**
4. Select all extracted files
5. Right-click → **"7-Zip"** → **"Add to archive..."**
6. Set **Archive format** to **"zip"**
7. Click **OK**
8. Upload the new ZIP file

### Option 2: Using macOS

#### Method A: The Unarchiver (Free)
1. Download The Unarchiver from App Store (if not installed)
2. Double-click the RAR file to extract
3. Select all extracted DICOM files
4. Right-click → **"Compress [number] items"**
5. Upload the new ZIP file

#### Method B: Command Line
```bash
# Install unrar (if not installed)
brew install unrar

# Extract RAR file
unrar x your-file.rar

# Create ZIP file
zip -r dicom-study.zip extracted-folder/
```

### Option 3: Using Linux

```bash
# Install unrar (if not installed)
sudo apt-get install unrar  # Ubuntu/Debian
sudo yum install unrar      # CentOS/RHEL

# Extract RAR file
unrar x your-file.rar

# Create ZIP file
zip -r dicom-study.zip extracted-folder/
```

### Option 4: Online Converter (Not Recommended for Medical Data)

⚠️ **Warning:** Do not use online converters for medical/patient data due to privacy concerns!

If you must use an online converter for non-sensitive data:
1. Search for "RAR to ZIP converter"
2. Upload your RAR file
3. Download the converted ZIP file
4. Upload to the system

**Note:** This violates HIPAA and data privacy regulations for medical data!

## Why ZIP Only?

The system uses ZIP format because:
- ✅ Native support in Node.js (no external dependencies)
- ✅ Universal compatibility across all platforms
- ✅ Reliable extraction without licensing issues
- ✅ Better error handling and validation
- ✅ Smaller attack surface for security

## Supported Formats

| Format | Supported | Notes |
|--------|-----------|-------|
| ZIP (.zip) | ✅ Yes | Recommended format |
| RAR (.rar) | ❌ No | Convert to ZIP |
| 7z (.7z) | ❌ No | Convert to ZIP |
| TAR (.tar) | ❌ No | Convert to ZIP |
| GZIP (.gz) | ❌ No | Convert to ZIP |

## Best Practices

### 1. Organize DICOM Files

Before creating ZIP:
```
dicom-study/
├── series-1/
│   ├── image001.dcm
│   ├── image002.dcm
│   └── ...
├── series-2/
│   ├── image001.dcm
│   └── ...
└── ...
```

### 2. Create ZIP Archive

**Windows:**
- Select all DICOM files/folders
- Right-click → "Send to" → "Compressed (zipped) folder"

**macOS:**
- Select all DICOM files/folders
- Right-click → "Compress [items]"

**Linux:**
```bash
zip -r dicom-study.zip dicom-files/
```

### 3. Verify ZIP Contents

Before uploading, verify:
- ✅ ZIP file opens without errors
- ✅ Contains .dcm files
- ✅ File size is reasonable (< 2GB)
- ✅ No nested ZIP files

### 4. Upload

```bash
curl -X POST http://localhost:8001/api/dicom/upload/zip \
  -F "file=@dicom-study.zip"
```

## Troubleshooting

### Issue: "Invalid ZIP signature"

**Cause:** File is not actually a ZIP file

**Solution:**
1. Check file extension (should be .zip)
2. Try opening with a ZIP tool to verify
3. Re-create the ZIP file using methods above

### Issue: "No DICOM files found"

**Cause:** ZIP doesn't contain .dcm files

**Solution:**
1. Extract ZIP and verify contents
2. Ensure DICOM files have .dcm, .dicom, or .dic extension
3. Re-create ZIP with correct files

### Issue: "File too large"

**Cause:** ZIP exceeds 2GB limit

**Solution:**
1. Split into multiple ZIP files
2. Upload separately
3. Or reduce image quality/resolution

## Command Line Examples

### Extract RAR and Create ZIP (Windows PowerShell)

```powershell
# Extract RAR
& "C:\Program Files\WinRAR\UnRAR.exe" x your-file.rar

# Create ZIP
Compress-Archive -Path extracted-folder\* -DestinationPath dicom-study.zip
```

### Extract RAR and Create ZIP (Linux/macOS)

```bash
# Extract RAR
unrar x your-file.rar -d extracted-folder

# Create ZIP
cd extracted-folder
zip -r ../dicom-study.zip .
cd ..
```

### Batch Convert Multiple RAR Files

```bash
#!/bin/bash
# Convert all RAR files in current directory to ZIP

for rar_file in *.rar; do
    # Get filename without extension
    base_name="${rar_file%.rar}"
    
    # Create extraction directory
    mkdir -p "$base_name"
    
    # Extract RAR
    unrar x "$rar_file" "$base_name/"
    
    # Create ZIP
    cd "$base_name"
    zip -r "../${base_name}.zip" .
    cd ..
    
    echo "Converted: $rar_file -> ${base_name}.zip"
done
```

## Verification Script

Test if your ZIP is valid:

```bash
# Test ZIP integrity
unzip -t dicom-study.zip

# List contents
unzip -l dicom-study.zip

# Count DICOM files
unzip -l dicom-study.zip | grep -i "\.dcm" | wc -l
```

## Need Help?

If you're still having issues:

1. **Check file format:**
   ```bash
   file your-file.zip
   # Should show: "Zip archive data"
   ```

2. **Verify ZIP signature:**
   ```bash
   xxd -l 4 your-file.zip
   # Should show: 504b 0304 (PK..)
   ```

3. **Test extraction:**
   ```bash
   unzip -t your-file.zip
   ```

4. **Check server logs** for detailed error messages

## Security Note

⚠️ **Important:** When handling medical imaging data:
- Never use online converters
- Keep data on secure, local systems
- Use encrypted storage
- Follow HIPAA/data privacy regulations
- Delete temporary extracted files after creating ZIP

---

**Quick Reference:**

```bash
# Extract RAR
unrar x file.rar

# Create ZIP
zip -r output.zip extracted-folder/

# Upload
curl -X POST http://localhost:8001/api/dicom/upload/zip -F "file=@output.zip"
```
