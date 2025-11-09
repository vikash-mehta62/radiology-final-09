/**
 * Regenerate frames for uploaded studies
 * Run with: node regenerate-frames.js <studyUID>
 */

const fs = require('fs');
const path = require('path');
const dicomParser = require('dicom-parser');
const { PNG } = require('pngjs');

const BACKEND_DIR = path.resolve(__dirname, 'backend');

function generateFrameImage(dicomBuffer, outputPath) {
  try {
    const dataSet = dicomParser.parseDicom(dicomBuffer);
    
    const readInt = (tag, defVal = 0) => {
      try { return dataSet.intString(tag) ?? defVal; } catch { return defVal; }
    };
    
    const readStr = (tag, defVal = '') => {
      try { return dataSet.string(tag) || defVal; } catch { return defVal; }
    };

    const rows = readInt('x00280010', 0);
    const cols = readInt('x00280011', 0);
    const bitsAllocated = readInt('x00280100', 8);
    const samplesPerPixel = readInt('x00280002', 1);
    const photometricInterpretation = readStr('x00280004', 'MONOCHROME2');

    if (!rows || !cols) {
      console.warn('  ⚠️  Invalid dimensions, creating placeholder');
      return createPlaceholder(outputPath);
    }

    const pixelDataElement = dataSet.elements.x7fe00010;
    if (!pixelDataElement) {
      console.warn('  ⚠️  No pixel data, creating placeholder');
      return createPlaceholder(outputPath);
    }

    const pixelDataOffset = pixelDataElement.dataOffset;
    const byteArray = dataSet.byteArray;
    const frameBytes = rows * cols * samplesPerPixel * (bitsAllocated / 8);
    const pixelData = byteArray.slice(pixelDataOffset, pixelDataOffset + frameBytes);

    // Convert to grayscale
    let grayscale;
    if (bitsAllocated === 16) {
      const view = new Uint16Array(pixelData.buffer, pixelData.byteOffset, pixelData.length / 2);
      let min = 65535, max = 0;
      for (let i = 0; i < view.length; i++) {
        const v = view[i];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      
      grayscale = Buffer.alloc(rows * cols);
      const range = max - min || 1;
      for (let i = 0; i < view.length; i++) {
        grayscale[i] = Math.round(((view[i] - min) / range) * 255);
      }
    } else {
      grayscale = Buffer.from(new Uint8Array(pixelData.buffer, pixelData.byteOffset, pixelData.length));
    }

    // Create PNG
    const png = new PNG({ width: cols, height: rows });
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const g = grayscale[i] || 0;
        const idx = (cols * y + x) << 2;
        
        // Handle MONOCHROME1 (inverted)
        const finalValue = photometricInterpretation === 'MONOCHROME1' ? 255 - g : g;
        
        png.data[idx] = finalValue;
        png.data[idx + 1] = finalValue;
        png.data[idx + 2] = finalValue;
        png.data[idx + 3] = 255;
      }
    }

    fs.writeFileSync(outputPath, PNG.sync.write(png));
    return true;
  } catch (error) {
    console.error('  ❌ Error generating frame:', error.message);
    return createPlaceholder(outputPath);
  }
}

function createPlaceholder(outputPath) {
  const png = new PNG({ width: 256, height: 256 });
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const idx = (png.width * y + x) << 2;
      const v = ((x ^ y) & 0xff);
      png.data[idx] = v;
      png.data[idx + 1] = v;
      png.data[idx + 2] = v;
      png.data[idx + 3] = 255;
    }
  }
  fs.writeFileSync(outputPath, PNG.sync.write(png));
  return false;
}

async function regenerateFrames(studyUID) {
  console.log('');
  console.log('========================================');
  console.log('  Regenerate Frames');
  console.log('========================================');
  console.log('');
  console.log(`Study UID: ${studyUID}`);
  console.log('');

  const studyDir = path.join(BACKEND_DIR, 'uploaded_studies', studyUID);
  const framesDir = path.join(BACKEND_DIR, `uploaded_frames_${studyUID}`);

  // Check if study exists
  if (!fs.existsSync(studyDir)) {
    console.error(`❌ Study directory not found: ${studyDir}`);
    process.exit(1);
  }

  // Create frames directory
  if (!fs.existsSync(framesDir)) {
    fs.mkdirSync(framesDir, { recursive: true });
  }

  // Get all DICOM files
  const dicomFiles = [];
  function scanDirectory(dir) {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.endsWith('.dcm')) {
        dicomFiles.push(fullPath);
      }
    }
  }

  scanDirectory(studyDir);
  console.log(`Found ${dicomFiles.length} DICOM files`);
  console.log('');

  // Sort files by path to maintain order
  dicomFiles.sort();

  // Generate frames
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < dicomFiles.length; i++) {
    const dcmFile = dicomFiles[i];
    const frameName = `frame_${String(i).padStart(3, '0')}.png`;
    const framePath = path.join(framesDir, frameName);

    process.stdout.write(`\r[${i + 1}/${dicomFiles.length}] Generating ${frameName}...`);

    try {
      const buffer = fs.readFileSync(dcmFile);
      const success = generateFrameImage(buffer, framePath);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    } catch (error) {
      console.error(`\n  ❌ Failed to process ${dcmFile}:`, error.message);
      createPlaceholder(framePath);
      failCount++;
    }
  }

  console.log('\n');
  console.log('========================================');
  console.log('  Results');
  console.log('========================================');
  console.log('');
  console.log(`✅ Successfully generated: ${successCount} frames`);
  console.log(`⚠️  Placeholders created: ${failCount} frames`);
  console.log(`📁 Output directory: ${framesDir}`);
  console.log('');
  console.log('Frames are now ready for viewing!');
  console.log('');
}

// Main
const studyUID = process.argv[2];
if (!studyUID) {
  console.error('Usage: node regenerate-frames.js <studyUID>');
  console.error('');
  console.error('Example:');
  console.error('  node regenerate-frames.js 1.3.6.1.4.1.16568.1760349235111.794273131');
  process.exit(1);
}

regenerateFrames(studyUID).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
