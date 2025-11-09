/**
 * Properly fix frames with better DICOM handling
 */

const fs = require('fs');
const path = require('path');
const dicomParser = require('dicom-parser');
const { PNG } = require('pngjs');

const studyUID = process.argv[2] || '1.3.6.1.4.1.16568.1760448504515.305098384';
const BACKEND_DIR = path.resolve(__dirname, 'backend');
const studyDir = path.join(BACKEND_DIR, 'uploaded_studies', studyUID);
const framesDir = path.join(BACKEND_DIR, `uploaded_frames_${studyUID}`);

console.log('🔧 Fixing Frames with Proper DICOM Handling');
console.log('═══════════════════════════════════════════════');
console.log(`Study: ${studyUID}`);
console.log('');

// Ensure frames directory exists
if (!fs.existsSync(framesDir)) {
  fs.mkdirSync(framesDir, { recursive: true });
}

// Find all DICOM files
function findDicomFiles(dir) {
  const files = [];
  function scan(currentDir) {
    const items = fs.readdirSync(currentDir);
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        scan(fullPath);
      } else if (item.endsWith('.dcm')) {
        files.push(fullPath);
      }
    }
  }
  scan(dir);
  return files;
}

const dicomFiles = findDicomFiles(studyDir);
console.log(`✓ Found ${dicomFiles.length} DICOM files`);

// Parse files
const parsedFiles = [];

for (const filePath of dicomFiles) {
  try {
    const buffer = fs.readFileSync(filePath);
    const byteArray = new Uint8Array(buffer);
    const dataSet = dicomParser.parseDicom(byteArray);
    
    // Helper functions
    const getString = (tag, def = '') => {
      try { return dataSet.string(tag) || def; } catch { return def; }
    };
    const getUint16 = (tag, def = 0) => {
      try { return dataSet.uint16(tag) || def; } catch { return def; }
    };
    
    const instanceNumber = parseInt(getString('x00200013', '0'), 10);
    const rows = getUint16('x00280010', 512);
    const columns = getUint16('x00280011', 512);
    const bitsAllocated = getUint16('x00280100', 16);
    const bitsStored = getUint16('x00280101', 12);
    const highBit = getUint16('x00280102', 11);
    const pixelRepresentation = getUint16('x00280103', 0); // 0=unsigned, 1=signed
    const samplesPerPixel = getUint16('x00280002', 1);
    const photometricInterpretation = getString('x00280004', 'MONOCHROME2');
    const rescaleSlope = parseFloat(getString('x00281053', '1')) || 1;
    const rescaleIntercept = parseFloat(getString('x00281052', '0')) || 0;
    
    // Window/Level
    const windowCenterStr = getString('x00281050', '2048');
    const windowWidthStr = getString('x00281051', '4096');
    const windowCenter = parseFloat(windowCenterStr.split('\\')[0]) || 2048;
    const windowWidth = parseFloat(windowWidthStr.split('\\')[0]) || 4096;
    
    parsedFiles.push({
      filePath,
      instanceNumber,
      dataSet,
      byteArray,
      rows,
      columns,
      bitsAllocated,
      bitsStored,
      highBit,
      pixelRepresentation,
      samplesPerPixel,
      photometricInterpretation,
      rescaleSlope,
      rescaleIntercept,
      windowCenter,
      windowWidth
    });
    
  } catch (error) {
    console.warn(`⚠️  Failed to parse ${path.basename(filePath)}:`, error.message);
  }
}

// Sort by instance number
parsedFiles.sort((a, b) => a.instanceNumber - b.instanceNumber);
console.log(`✓ Parsed ${parsedFiles.length} files`);
console.log('');

// Generate frames with proper handling
let generatedFrames = 0;

for (let i = 0; i < parsedFiles.length; i++) {
  const file = parsedFiles[i];
  
  try {
    const pixelDataElement = file.dataSet.elements.x7fe00010;
    if (!pixelDataElement) {
      console.warn(`  Frame ${i}: No pixel data`);
      continue;
    }
    
    const pixelDataOffset = pixelDataElement.dataOffset;
    const pixelDataLength = pixelDataElement.length;
    
    // Extract pixel data
    const pixelData = file.byteArray.slice(pixelDataOffset, pixelDataOffset + pixelDataLength);
    
    // Convert to 16-bit array
    let pixelArray;
    if (file.bitsAllocated === 16) {
      pixelArray = new Uint16Array(pixelData.buffer, pixelData.byteOffset, pixelData.length / 2);
    } else {
      pixelArray = new Uint8Array(pixelData.buffer, pixelData.byteOffset, pixelData.length);
    }
    
    // Apply rescale
    const rescaledData = new Float32Array(pixelArray.length);
    for (let j = 0; j < pixelArray.length; j++) {
      let value = pixelArray[j];
      
      // Handle signed data
      if (file.pixelRepresentation === 1 && file.bitsAllocated === 16) {
        if (value > 32767) value -= 65536;
      }
      
      rescaledData[j] = value * file.rescaleSlope + file.rescaleIntercept;
    }
    
    // Apply window/level
    const windowMin = file.windowCenter - file.windowWidth / 2;
    const windowMax = file.windowCenter + file.windowWidth / 2;
    
    // Create PNG
    const png = new PNG({ width: file.columns, height: file.rows });
    
    for (let y = 0; y < file.rows; y++) {
      for (let x = 0; x < file.columns; x++) {
        const idx = y * file.columns + x;
        const value = rescaledData[idx];
        
        // Apply window/level
        let normalized = (value - windowMin) / (windowMax - windowMin);
        normalized = Math.max(0, Math.min(1, normalized));
        
        let gray = Math.round(normalized * 255);
        
        // Handle MONOCHROME1 (inverted)
        if (file.photometricInterpretation === 'MONOCHROME1') {
          gray = 255 - gray;
        }
        
        const pngIdx = (file.columns * y + x) << 2;
        png.data[pngIdx] = gray;
        png.data[pngIdx + 1] = gray;
        png.data[pngIdx + 2] = gray;
        png.data[pngIdx + 3] = 255;
      }
    }
    
    const framePath = path.join(framesDir, `frame_${String(i).padStart(3, '0')}.png`);
    fs.writeFileSync(framePath, PNG.sync.write(png));
    
    generatedFrames++;
    
    if (i % 50 === 0 || i === parsedFiles.length - 1) {
      console.log(`  Generated ${i + 1}/${parsedFiles.length} frames...`);
    }
    
  } catch (error) {
    console.error(`  ✗ Frame ${i} failed:`, error.message);
  }
}

console.log('');
console.log('═══════════════════════════════════════════════');
console.log(`✅ Generated ${generatedFrames} frames`);
console.log('');
console.log('Test URLs:');
console.log(`Frame 0: http://localhost:8001/api/dicom/studies/${studyUID}/frames/0`);
console.log(`Frame 1: http://localhost:8001/api/dicom/studies/${studyUID}/frames/1`);
console.log(`Frame 2: http://localhost:8001/api/dicom/studies/${studyUID}/frames/2`);
console.log('');
