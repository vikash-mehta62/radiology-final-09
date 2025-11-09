/**
 * Manually regenerate frames for a study
 * Usage: node regenerate-frames-manual.js <studyUID>
 */

const fs = require('fs');
const path = require('path');
const dicomParser = require('dicom-parser');
const { PNG } = require('pngjs');

const studyUID = process.argv[2] || '1.3.6.1.4.1.16568.1760448504515.305098384';
const BACKEND_DIR = path.resolve(__dirname, 'backend');
const studyDir = path.join(BACKEND_DIR, 'uploaded_studies', studyUID);
const framesDir = path.join(BACKEND_DIR, `uploaded_frames_${studyUID}`);

console.log('🔧 Manual Frame Regeneration');
console.log('═══════════════════════════════════════');
console.log(`Study UID: ${studyUID}`);
console.log(`Study Dir: ${studyDir}`);
console.log(`Frames Dir: ${framesDir}`);
console.log('');

// Ensure frames directory exists
if (!fs.existsSync(framesDir)) {
  fs.mkdirSync(framesDir, { recursive: true });
  console.log('✓ Created frames directory');
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
console.log(`✓ Found ${dicomFiles.Count} DICOM files`);
console.log('');

// Parse and sort files
const parsedFiles = [];

for (const filePath of dicomFiles) {
  try {
    const buffer = fs.readFileSync(filePath);
    const dataSet = dicomParser.parseDicom(buffer);
    
    const instanceNumber = parseInt(dataSet.string('x00200013') || '0', 10);
    const rows = dataSet.uint16('x00280010') || 512;
    const columns = dataSet.uint16('x00280011') || 512;
    const bitsAllocated = dataSet.uint16('x00280100') || 8;
    const samplesPerPixel = dataSet.uint16('x00280002') || 1;
    const photometricInterpretation = dataSet.string('x00280004') || 'MONOCHROME2';
    
    parsedFiles.push({
      filePath,
      instanceNumber,
      dataSet,
      buffer,
      rows,
      columns,
      bitsAllocated,
      samplesPerPixel,
      photometricInterpretation
    });
    
  } catch (error) {
    console.warn(`⚠️  Failed to parse ${path.basename(filePath)}:`, error.message);
  }
}

// Sort by instance number
parsedFiles.sort((a, b) => a.instanceNumber - b.instanceNumber);

console.log(`✓ Parsed and sorted ${parsedFiles.length} files`);
console.log('');

// Generate frames
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
    const byteArray = file.dataSet.byteArray;
    const frameBytes = file.rows * file.columns * file.samplesPerPixel * (file.bitsAllocated / 8);
    const pixelData = byteArray.slice(pixelDataOffset, pixelDataOffset + frameBytes);
    
    // Convert to grayscale
    let grayscale;
    if (file.bitsAllocated === 16) {
      const view = new Uint16Array(pixelData.buffer, pixelData.byteOffset, pixelData.length / 2);
      let min = 65535, max = 0;
      for (let j = 0; j < view.length; j++) {
        const v = view[j];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      
      grayscale = Buffer.alloc(file.rows * file.columns);
      const range = max - min || 1;
      for (let j = 0; j < view.length; j++) {
        grayscale[j] = Math.round(((view[j] - min) / range) * 255);
      }
    } else {
      grayscale = Buffer.from(new Uint8Array(pixelData.buffer, pixelData.byteOffset, pixelData.length));
    }
    
    // Create PNG
    const png = new PNG({ width: file.columns, height: file.rows });
    for (let y = 0; y < file.rows; y++) {
      for (let x = 0; x < file.columns; x++) {
        const idx = y * file.columns + x;
        const g = grayscale[idx] || 0;
        const pngIdx = (file.columns * y + x) << 2;
        
        const finalValue = file.photometricInterpretation === 'MONOCHROME1' ? 255 - g : g;
        
        png.data[pngIdx] = finalValue;
        png.data[pngIdx + 1] = finalValue;
        png.data[pngIdx + 2] = finalValue;
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
console.log('═══════════════════════════════════════');
console.log(`✅ Generated ${generatedFrames} frames out of ${parsedFiles.length} total`);
console.log('');
console.log('Test frame URL:');
console.log(`http://3.144.196.75:8001/api/dicom/studies/${studyUID}/frames/0`);
console.log('');
