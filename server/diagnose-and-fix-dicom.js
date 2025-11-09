/**
 * Diagnose and Fix DICOM ZIP Upload
 * This script will:
 * 1. Extract the ZIP
 * 2. Validate each DICOM file
 * 3. Group by series
 * 4. Upload properly
 */

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const dicomParser = require('dicom-parser');
const axios = require('axios');
const FormData = require('form-data');

const ZIP_FILE_DEFAULT = path.join(__dirname, '..', 'DICOM.zip');
const PATIENT_ID = '68dec98fd2f2b2311acc61c8';
const API_URL = 'http://localhost:8001/api/dicom/upload/zip';

console.log('');
console.log('========================================');
console.log('  DICOM ZIP Diagnosis and Fix');
console.log('========================================');
console.log('');

async function main() {
  // Get ZIP file or folder from command line
  const inputPath = process.argv[2] || ZIP_FILE_DEFAULT;
  const isDirectory = fs.existsSync(inputPath) && fs.statSync(inputPath).isDirectory();
  
  // Step 1: Check if input exists
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ ${inputPath} not found`);
    process.exit(1);
  }
  
  let dicomFiles = [];
  let invalidFiles = [];
  
  if (isDirectory) {
    // Process directory
    console.log(`✅ Found directory: ${inputPath}`);
    console.log('');
    console.log('Step 1: Scanning directory for DICOM files...');
    
    function scanDir(dir) {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (stat.isFile()) {
          const data = fs.readFileSync(fullPath);
          processFile(entry, data);
        }
      }
    }
    
    function processFile(filename, data) {
      if (data.length < 132) {
        invalidFiles.push({ filename, reason: 'Too small' });
        return;
      }

      // Check DICOM signature
      const signature = data.toString('ascii', 128, 132);
      if (signature !== 'DICM') {
        const ext = path.extname(filename).toLowerCase();
        if (!['.dcm', '.dicom', '.dic'].includes(ext)) {
          invalidFiles.push({ filename, reason: 'Not DICOM' });
          return;
        }
      }

      // Try to parse
      try {
        const dataSet = dicomParser.parseDicom(data);
        
        const readStr = (tag, def = '') => {
          try { return dataSet.string(tag) || def; } catch { return def; }
        };
        
        const readInt = (tag, def = 0) => {
          try { return dataSet.intString(tag) ?? def; } catch { return def; }
        };

        const rows = readInt('x00280010', 0);
        const cols = readInt('x00280011', 0);
        const studyUID = readStr('x0020000d');
        const seriesUID = readStr('x0020000e');
        const sopUID = readStr('x00080018');
        const instanceNumber = readInt('x00200013', 0);

        if (!rows || !cols) {
          invalidFiles.push({ filename, reason: 'Missing dimensions' });
          return;
        }

        if (!studyUID || !seriesUID || !sopUID) {
          invalidFiles.push({ filename, reason: 'Missing UIDs' });
          return;
        }

        dicomFiles.push({
          filename,
          data,
          metadata: {
            studyUID,
            seriesUID,
            sopUID,
            instanceNumber,
            rows,
            cols,
            patientName: readStr('x00100010', 'Unknown'),
            patientID: readStr('x00100020', 'Unknown'),
            modality: readStr('x00080060', 'OT'),
            seriesDescription: readStr('x0008103e', ''),
          }
        });

      } catch (error) {
        invalidFiles.push({ filename, reason: `Parse error: ${error.message}` });
      }
    }
    
    scanDir(inputPath);
    
    console.log(`✅ Scanned directory`);
    console.log(`✅ Valid DICOM files: ${dicomFiles.length}`);
    console.log(`⚠️  Invalid files: ${invalidFiles.length}`);
    console.log('');
    
  } else {
    // Process ZIP file
    const ZIP_FILE = inputPath;

    console.log(`✅ Found ${ZIP_FILE}`);
    const stats = fs.statSync(ZIP_FILE);
    console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log('');

    // Step 2: Extract ZIP
    console.log('Step 1: Extracting ZIP...');
    let zip;
    try {
      zip = new AdmZip(ZIP_FILE);
    } catch (error) {
      console.error('❌ Failed to open ZIP:', error.message);
      console.log('');
      console.log('This might be a RAR file. Checking...');
      
      const buffer = fs.readFileSync(ZIP_FILE);
      const signature = buffer.toString('hex', 0, 4);
      
      if (signature === '52617221') {
        console.log('✅ Confirmed: This is a RAR file, not ZIP');
        console.log('');
        console.log('Please extract manually:');
        console.log('1. Run: .\\extract-dicom.ps1');
        console.log('2. Or extract DICOM.zip to folder "DICOM_extracted"');
        console.log('3. Then run: node diagnose-and-fix-dicom.js ../DICOM_extracted');
        process.exit(1);
      }
      throw error;
    }

    const entries = zip.getEntries();
    console.log(`✅ Found ${entries.length} entries in ZIP`);
    console.log('');

    // Step 3: Find and validate DICOM files
    console.log('Step 2: Validating DICOM files...');

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      
      const filename = entry.entryName;
      const data = entry.getData();
      
      if (data.length < 132) {
        invalidFiles.push({ filename, reason: 'Too small' });
        continue;
      }

      // Check DICOM signature
      const signature = data.toString('ascii', 128, 132);
      if (signature !== 'DICM') {
        // Check if it's a DICOM file without preamble
        const ext = path.extname(filename).toLowerCase();
        if (!['.dcm', '.dicom', '.dic'].includes(ext)) {
          invalidFiles.push({ filename, reason: 'Not DICOM' });
          continue;
        }
      }

      // Try to parse
      try {
        const dataSet = dicomParser.parseDicom(data);
        
        const readStr = (tag, def = '') => {
          try { return dataSet.string(tag) || def; } catch { return def; }
        };
        
        const readInt = (tag, def = 0) => {
          try { return dataSet.intString(tag) ?? def; } catch { return def; }
        };

        const rows = readInt('x00280010', 0);
        const cols = readInt('x00280011', 0);
        const studyUID = readStr('x0020000d');
        const seriesUID = readStr('x0020000e');
        const sopUID = readStr('x00080018');
        const instanceNumber = readInt('x00200013', 0);

        if (!rows || !cols) {
          invalidFiles.push({ filename, reason: 'Missing dimensions' });
          continue;
        }

        if (!studyUID || !seriesUID || !sopUID) {
          invalidFiles.push({ filename, reason: 'Missing UIDs' });
          continue;
        }

        dicomFiles.push({
          filename,
          data,
          metadata: {
            studyUID,
            seriesUID,
            sopUID,
            instanceNumber,
            rows,
            cols,
            patientName: readStr('x00100010', 'Unknown'),
            patientID: readStr('x00100020', 'Unknown'),
            modality: readStr('x00080060', 'OT'),
            seriesDescription: readStr('x0008103e', ''),
          }
        });

      } catch (error) {
        invalidFiles.push({ filename, reason: `Parse error: ${error.message}` });
      }
    }

    console.log(`✅ Valid DICOM files: ${dicomFiles.length}`);
    console.log(`⚠️  Invalid files: ${invalidFiles.length}`);
    
    if (invalidFiles.length > 0 && invalidFiles.length < 10) {
      console.log('');
      console.log('Invalid files:');
      invalidFiles.forEach(f => {
        console.log(`  - ${f.filename}: ${f.reason}`);
      });
    }
    
    console.log('');
  }

  if (dicomFiles.length === 0) {
    console.error('❌ No valid DICOM files found!');
    process.exit(1);
  }

  // Step 4: Group by series
  console.log('Step 3: Grouping by series...');
  const seriesMap = new Map();

  for (const file of dicomFiles) {
    const seriesUID = file.metadata.seriesUID;
    if (!seriesMap.has(seriesUID)) {
      seriesMap.set(seriesUID, {
        seriesUID,
        seriesDescription: file.metadata.seriesDescription,
        modality: file.metadata.modality,
        files: []
      });
    }
    seriesMap.get(seriesUID).files.push(file);
  }

  console.log(`✅ Found ${seriesMap.size} series:`);
  for (const [uid, series] of seriesMap) {
    console.log(`   - ${series.seriesDescription || 'Unnamed'} (${series.modality}): ${series.files.length} files`);
  }
  console.log('');

  // Step 5: Sort instances within each series
  console.log('Step 4: Sorting instances...');
  for (const series of seriesMap.values()) {
    series.files.sort((a, b) => a.metadata.instanceNumber - b.metadata.instanceNumber);
  }
  console.log('✅ Instances sorted by InstanceNumber');
  console.log('');

  // Step 6: Create clean ZIP
  console.log('Step 5: Creating clean ZIP...');
  const cleanZip = new AdmZip();
  
  let fileIndex = 0;
  for (const series of seriesMap.values()) {
    for (const file of series.files) {
      const newName = `dicom_${String(fileIndex).padStart(4, '0')}.dcm`;
      cleanZip.addFile(newName, file.data);
      fileIndex++;
    }
  }

  const cleanZipPath = `DICOM_clean_${Date.now()}.zip`;
  cleanZip.writeZip(cleanZipPath);
  
  console.log(`✅ Created clean ZIP: ${cleanZipPath}`);
  console.log(`   Files: ${fileIndex}`);
  console.log(`   Size: ${(fs.statSync(cleanZipPath).size / 1024 / 1024).toFixed(2)} MB`);
  console.log('');

  // Step 7: Upload
  console.log('Step 6: Uploading to server...');
  console.log(`   URL: ${API_URL}`);
  console.log(`   Patient ID: ${PATIENT_ID}`);
  console.log('');

  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(cleanZipPath));
    form.append('patientID', PATIENT_ID);
    form.append('forceUnifiedStudy', 'true');

    const response = await axios.post(API_URL, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 300000, // 5 minutes
      onUploadProgress: (progressEvent) => {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        process.stdout.write(`\r   Upload progress: ${percent}%`);
      }
    });

    console.log('\n');
    
    if (response.data.success) {
      console.log('✅ Upload successful!');
      console.log('');
      console.log('Study Details:');
      console.log(`   Study UID: ${response.data.data.studyInstanceUID}`);
      console.log(`   Total Series: ${response.data.data.totalSeries}`);
      console.log(`   Total Instances: ${response.data.data.totalInstances}`);
      console.log(`   Total Frames: ${response.data.data.totalFrames}`);
      console.log('');
      console.log('✅ Ready for viewing!');
      console.log('   Open: http://localhost:3000');
    } else {
      console.error('❌ Upload failed:', response.data.message);
    }

  } catch (error) {
    console.error('\n❌ Upload error:', error.message);
    if (error.response) {
      console.error('   Server response:', error.response.data);
    }
  }

  console.log('');
  console.log('========================================');
  console.log('');
  console.log(`Clean ZIP saved as: ${cleanZipPath}`);
  console.log('You can use this file for future uploads');
  console.log('');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
