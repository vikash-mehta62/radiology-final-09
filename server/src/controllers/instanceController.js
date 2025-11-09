const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { PNG } = require('pngjs');
const Instance = require('../models/Instance');
const dicomParser = require("dicom-parser");
const jpeg = require('jpeg-js');
const dicomRLE = require('dicom-rle');

// Generate a simple placeholder if DICOM or frame extraction fails
function generatePlaceholderPng(width = 256, height = 256) {
  const png = new PNG({ width, height });
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
  return PNG.sync.write(png);
}

// Helper: resolve DICOM URL for an instance (Orthanc only)
function resolveDicomUrl(inst) {
  if (!inst) return null;
  // Use Orthanc URL if available
  if (inst.orthancUrl) return inst.orthancUrl;
  return null;
}



// Helper: safely read string tag (may be undefined)
function dsString(dataSet, tag) {
  try { return dataSet.string(tag); } catch (e) { return undefined; }
}
function dsUint16(dataSet, tag) {
  try { return dataSet.uint16(tag); } catch (e) { return undefined; }
}

// Parse metadata required from buffer (returns dataSet too)
function parseMetaFromBuffer(buf) {
  const dataSet = dicomParser.parseDicom(buf);
  const rows = dsUint16(dataSet, 'x00280010') || 0;
  const cols = dsUint16(dataSet, 'x00280011') || 0;
  const samplesPerPixel = dsUint16(dataSet, 'x00280002') || 1;
  const bitsAllocated = dsUint16(dataSet, 'x00280100') || 8;
  const pixelRepresentation = dsUint16(dataSet, 'x00280103') || 0; // 0 unsigned, 1 signed
  const numberOfFrames = parseInt(dsString(dataSet, 'x00280008') || '1', 10) || 1;
  const photometricInterpretation = (dsString(dataSet, 'x00280004') || 'MONOCHROME2').toUpperCase();

  // NEW: transfer syntax & planar configuration
  const transferSyntaxUID = (dsString(dataSet, 'x00020010') || '').trim();
  const isBigEndian = transferSyntaxUID === '1.2.840.10008.1.2.2';
  const planarConfiguration = dsUint16(dataSet, 'x00280006') || 0; // 0: interleaved, 1: planar

  // rescale & VOI (strings may be multi-valued)
  const rescaleSlope = parseFloat(dsString(dataSet, 'x00281053') || '1.0') || 1.0;
  const rescaleIntercept = parseFloat(dsString(dataSet, 'x00281052') || '0.0') || 0.0;

  // Window Center / Width may be multi-valued or absent
  let windowCenter = NaN;
  let windowWidth = NaN;
  const wcRaw = dsString(dataSet, 'x00281050');
  const wwRaw = dsString(dataSet, 'x00281051');
  if (wcRaw) {
    if (wcRaw.includes('\\')) windowCenter = parseFloat(wcRaw.split('\\')[0]);
    else windowCenter = parseFloat(wcRaw);
  }
  if (wwRaw) {
    if (wwRaw.includes('\\')) windowWidth = parseFloat(wwRaw.split('\\')[0]);
    else windowWidth = parseFloat(wwRaw);
  }

  // PixelData element
  const pixelDataElement = dataSet.elements && dataSet.elements.x7fe00010 ? dataSet.elements.x7fe00010 : null;
  const pixelDataOffset = pixelDataElement ? pixelDataElement.dataOffset : null;
  const pixelDataLength = pixelDataElement ? pixelDataElement.length : 0;

  // instance number (for ordering)
  let instanceNumber = parseInt(dsString(dataSet, 'x00200013') || '0', 10);
  if (Number.isNaN(instanceNumber)) instanceNumber = 0;

  return {
    dataSet,
    rows,
    cols,
    samplesPerPixel,
    bitsAllocated,
    pixelRepresentation,
    numberOfFrames,
    photometricInterpretation,
    // NEW meta for multi-frame handling
    transferSyntaxUID,
    isBigEndian,
    planarConfiguration,
    rescaleSlope,
    rescaleIntercept,
    windowCenter: Number.isFinite(windowCenter) ? windowCenter : NaN,
    windowWidth: Number.isFinite(windowWidth) ? windowWidth : NaN,
    pixelDataElement,
    pixelDataOffset,
    pixelDataLength,
    instanceNumber,
  };
}

// Create typed array view for a given frame (handles bytesPerFrame using pixelDataLength if present)
function getFrameView(dataSet, meta, frameIndex) {
  const {
    pixelDataElement,
    pixelDataOffset,
    rows,
    cols,
    samplesPerPixel,
    bitsAllocated,
    pixelRepresentation,
    numberOfFrames,
    isBigEndian,
    planarConfiguration,
  } = meta;

  if (!pixelDataElement) throw new Error('No PixelData element');

  // NEW: handle encapsulated (compressed) pixel data using dicom-parser helpers
  if (pixelDataElement.fragments && pixelDataElement.fragments.length > 0) {
    let frameBytes;
    try {
      const bot = (pixelDataElement.basicOffsetTable && pixelDataElement.basicOffsetTable.length)
        ? undefined
        : dicomParser.createJPEGBasicOffsetTable(dataSet, pixelDataElement);
      frameBytes = dicomParser.readEncapsulatedImageFrame(dataSet, pixelDataElement, frameIndex, bot);
    } catch (e) {
      // fallback to reading fragments directly
      frameBytes = dicomParser.readEncapsulatedPixelDataFromFragments(dataSet, pixelDataElement, frameIndex);
    }

    // Decode JPEG bytes -> RGBA, then convert to RGB view
    const decoded = jpeg.decode(Buffer.from(frameBytes), { useTArray: true });
    const { data, width, height } = decoded; // RGBA
    const rgb = new Uint8Array(width * height * 3);
    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
      rgb[j] = data[i];
      rgb[j + 1] = data[i + 1];
      rgb[j + 2] = data[i + 2];
    }

    // Update meta to reflect decoded frame
    meta.samplesPerPixel = 3;
    meta.bitsAllocated = 8;
    meta.rows = height;
    meta.cols = width;

    return rgb;
  }

  // Calculate bytes per pixel and frame precisely
  const bytesPerPixel = bitsAllocated / 8;
  const bytesPerFrame = rows * cols * samplesPerPixel * bytesPerPixel;

  // Safety check: total frames
  if (frameIndex >= numberOfFrames) {
    throw new Error(`Requested frame ${frameIndex} but only ${numberOfFrames} frames available`);
  }

  // Compute exact frame byte offset
  const start = pixelDataOffset + frameIndex * bytesPerFrame;
  const end = start + bytesPerFrame;

  // Slice the pixel data safely
  const frameBytes = dataSet.byteArray.subarray(start, end);

  // Handle color images
  if (samplesPerPixel === 3) {
    const bpp = bytesPerPixel;
    if (bpp !== 1) {
      throw new Error(`Unsupported color bitsAllocated=${bitsAllocated}`);
    }
    if (planarConfiguration === 0) {
      // Interleaved RGB
      return new Uint8Array(frameBytes.buffer, frameBytes.byteOffset, frameBytes.length);
    } else {
      // Planar: R plane, then G, then B
      const planeSize = rows * cols;
      const out = new Uint8Array(planeSize * 3);
      const r = frameBytes.subarray(0, planeSize);
      const g = frameBytes.subarray(planeSize, planeSize * 2);
      const b = frameBytes.subarray(planeSize * 2, planeSize * 3);
      for (let i = 0; i < planeSize; i++) {
        const j = i * 3;
        out[j] = r[i];
        out[j + 1] = g[i];
        out[j + 2] = b[i];
      }
      return out;
    }
  }

  // Grayscale path
  if (bitsAllocated === 16) {
    // Fix endianness if Big Endian transfer syntax
    let bytes = frameBytes;
    if (isBigEndian) {
      const swapped = new Uint8Array(frameBytes.length);
      for (let i = 0; i < frameBytes.length; i += 2) {
        swapped[i] = frameBytes[i + 1];
        swapped[i + 1] = frameBytes[i];
      }
      bytes = swapped;
    }

    return pixelRepresentation === 1
      ? new Int16Array(bytes.buffer, bytes.byteOffset || 0, bytes.length / 2)
      : new Uint16Array(bytes.buffer, bytes.byteOffset || 0, bytes.length / 2);
  }

  // Default 8-bit grayscale
  return new Uint8Array(frameBytes.buffer, frameBytes.byteOffset, frameBytes.length);
}


// Build PNG from a grayscale/rgb typed view
function buildPngFromView(view, meta) {
  const { rows, cols, samplesPerPixel, bitsAllocated, pixelRepresentation, rescaleSlope, rescaleIntercept, photometricInterpretation, windowCenter, windowWidth } = meta;
  const png = new PNG({ width: cols, height: rows });

  if (samplesPerPixel === 3) {
    // view is Uint8Array length rows*cols*3
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const px = y * cols + x;
        const vi = px * 3;
        const pi = px * 4;
        png.data[pi] = view[vi];
        png.data[pi + 1] = view[vi + 1];
        png.data[pi + 2] = view[vi + 2];
        png.data[pi + 3] = 255;
      }
    }
    return PNG.sync.write(png);
  }

  // Grayscale path
  const total = rows * cols;
  // Create rescaled float buffer
  const rescaled = new Float32Array(total);

  // view may be Uint8Array, Uint16Array, or Int16Array — they are indexable
  for (let i = 0; i < total; i++) {
    // Using Number(view[i]) ensures signed values are interpreted as numbers
    rescaled[i] = Number(view[i]) * (rescaleSlope || 1.0) + (rescaleIntercept || 0.0);
  }

  // Determine window (use provided windowCenter/windowWidth if valid)
  let low, high;
  if (Number.isFinite(windowCenter) && Number.isFinite(windowWidth) && windowWidth > 0) {
    low = windowCenter - windowWidth / 2.0;
    high = windowCenter + windowWidth / 2.0;
  } else {
    // fallback to min/max of rescaled
    let min = rescaled[0], max = rescaled[0];
    for (let i = 1; i < rescaled.length; i++) {
      const v = rescaled[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    low = min;
    high = (max === min) ? (min + 1) : max;
  }

  const invert = (photometricInterpretation || '').toUpperCase() === 'MONOCHROME1';

  // Map to 0..255
  for (let i = 0; i < total; i++) {
    let norm = (rescaled[i] - low) / (high - low);
    norm = Math.max(0, Math.min(1, norm));
    let g = Math.round(norm * 255);
    if (invert) g = 255 - g;
    const p = i * 4;
    png.data[p] = g;
    png.data[p + 1] = g;
    png.data[p + 2] = g;
    png.data[p + 3] = 255;
  }

  return PNG.sync.write(png);
}

// Map a global frame index (0-based across study) to instance + local frame
async function mapGlobalIndexToInstance(instances, globalIndex) {
  // sort instances by instanceNumber field if present in DB, fallback to _id
  instances.sort((a, b) => {
    const ai = (a.instanceNumber !== undefined && a.instanceNumber !== null) ? a.instanceNumber : 0;
    const bi = (b.instanceNumber !== undefined && b.instanceNumber !== null) ? b.instanceNumber : 0;
    return ai - bi || (a._id.toString() < b._id.toString() ? -1 : 1);
  });

  let acc = 0;
  for (const inst of instances) {
    const url = resolveDicomUrl(inst);
    if (!url) {
      // assume 0 frames if no url
      continue;
    }
    try {
      // download minimal bytes — entire file for now (could optimize with range requests)
      const resp = await axios.get(url, { responseType: 'arraybuffer' });
      const buf = Buffer.from(resp.data);
      const meta = parseMetaFromBuffer(buf);
      const frames = meta.numberOfFrames || 1;
      if (globalIndex < acc + frames) {
        // return this instance, its parsed buffer, and local frame index
        return { inst, meta, buf, localFrameIndex: globalIndex - acc };
      }
      acc += frames;
    } catch (e) {
      console.warn('mapGlobalIndexToInstance: parse error for instance', inst._id?.toString?.(), e.message);
      continue; // skip bad instance
    }
  }
  return null;
}
function convertFrameToPNG(pixelArray, meta) {
  const { rows, cols, samplesPerPixel, bitsAllocated } = meta;

  const png = new PNG({
    width: cols,
    height: rows,
  });

  if (samplesPerPixel === 1) {
    // ✅ Grayscale normalization
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < pixelArray.length; i++) {
      const v = pixelArray[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }

    const range = max - min || 1; // prevent division by 0

    for (let i = 0; i < pixelArray.length; i++) {
      const normalized = ((pixelArray[i] - min) / range) * 255;
      const val = Math.min(255, Math.max(0, normalized));
      const idx = i * 4;
      png.data[idx] = val;
      png.data[idx + 1] = val;
      png.data[idx + 2] = val;
      png.data[idx + 3] = 255; // alpha
    }
  } else if (samplesPerPixel === 3) {
    // ✅ RGB — just copy raw bytes
    for (let i = 0, j = 0; i < pixelArray.length; i += 3, j += 4) {
      png.data[j] = pixelArray[i];
      png.data[j + 1] = pixelArray[i + 1];
      png.data[j + 2] = pixelArray[i + 2];
      png.data[j + 3] = 255;
    }
  } else {
    throw new Error(`Unsupported SamplesPerPixel: ${samplesPerPixel}`);
  }

  return PNG.sync.write(png);
}
// ---------- Single exported getFrame handler ----------
// Route: GET /api/frame/:studyUid/:frameIndex
async function getFrame(req, res) {
  try {
    const { studyUid, frameIndex } = req.params;
    const gIndex = Math.max(0, parseInt(frameIndex, 10) || 0);

    // Use frame cache service (handles filesystem cache + Orthanc fallback)
    const { getFrameCacheService } = require('../services/frame-cache-service');
    const frameCacheService = getFrameCacheService();

    console.log(`🔍 getFrame: Requesting frame ${gIndex} for study ${studyUid}`);

    const frameBuffer = await frameCacheService.getFrame(studyUid, gIndex);

    if (frameBuffer) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      res.setHeader('Access-Control-Allow-Origin', '*'); // Allow CORS
      res.setHeader('X-Frame-Source', 'cache'); // Indicate source
      return res.end(frameBuffer);
    }

    // Fallback to legacy code if frame cache service fails
    const BACKEND_DIR = path.resolve(__dirname, '../../backend');
    const framePath = path.join(BACKEND_DIR, `uploaded_frames_${studyUid}`, `frame_${String(gIndex).padStart(3, '0')}.png`);

    if (fs.existsSync(framePath)) {
      console.log(`✅ getFrame: serving from filesystem (legacy): ${framePath}`);
      const frameBuffer = fs.readFileSync(framePath);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('X-Frame-Source', 'filesystem-legacy');
      return res.end(frameBuffer);
    }

    // If not in filesystem and MongoDB not connected, return placeholder
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      console.warn(`getFrame: frame not in filesystem and MongoDB not connected for study ${studyUid}, frame ${gIndex}`);
      res.setHeader('Content-Type', 'image/png');
      return res.end(generatePlaceholderPng());
    }

    // 1) find all instances for study (MongoDB path)
    let instances;
    try {
      instances = await Instance.find({ studyInstanceUID: studyUid }).lean().maxTimeMS(5000);
    } catch (dbError) {
      console.error('getFrame: MongoDB query failed:', dbError.message);
      console.warn('getFrame: falling back to placeholder');
      res.setHeader('Content-Type', 'image/png');
      return res.end(generatePlaceholderPng());
    }

    if (!instances || instances.length === 0) {
      console.warn('getFrame: no instances found for study', studyUid);
      res.setHeader('Content-Type', 'image/png');
      return res.end(generatePlaceholderPng());
    }

    // 2) map global index to instance+frame
    const mapping = await mapGlobalIndexToInstance(instances, gIndex);
    if (!mapping) {
      console.warn('getFrame: mapping not found for globalIndex', gIndex, 'study', studyUid);
      res.setHeader('Content-Type', 'image/png');
      return res.end(generatePlaceholderPng());
    }

    const { inst, meta, buf, localFrameIndex } = mapping;

    console.log(`getFrame: study=${studyUid} globalIndex=${gIndex} -> instance=${inst._id} localFrame=${localFrameIndex}`);
    // ensure pixel data exists
    if (!meta.pixelDataElement) {
      console.error('getFrame: pixelData missing for instance', inst._id?.toString?.());
      res.setHeader('Content-Type', 'image/png');
      return res.end(generatePlaceholderPng());
    }

    // Re-parse dataset (we have buf; parseDicom again to get dataSet)
    let dataSet;
    try {
      dataSet = dicomParser.parseDicom(buf);
    } catch (e) {
      console.error('getFrame: parseDicom reparse failed', e.message);
      res.setHeader('Content-Type', 'image/png');
      return res.end(generatePlaceholderPng());
    }

    // 3) build typed array view for requested frame
    let view;
    try {
      view = getFrameView(dataSet, meta, localFrameIndex);
    } catch (e) {
      console.error('getFrame: getFrameView failed', e.message);
      res.setHeader('Content-Type', 'image/png');
      return res.end(generatePlaceholderPng());
    }

    // 4) ensure view length matches expected pixels (quick sanity check)
    const expectedSamples = meta.rows * meta.cols * (meta.samplesPerPixel || 1);
    if ((meta.samplesPerPixel === 3 && view.length !== expectedSamples * 3) ||
      (meta.samplesPerPixel !== 3 && (view.length !== expectedSamples && view.length !== expectedSamples * (meta.bitsAllocated / 8)))) {
      // Not always fatal (padding), but warn
      console.warn('getFrame: view length mismatch', {
        viewLength: view.length,
        expectedSamples,
        bitsAllocated: meta.bitsAllocated,
        samplesPerPixel: meta.samplesPerPixel,
      });
    }

    // 5) prepare meta passed to builder (include any window if available)
    const buildMeta = {
      rows: meta.rows,
      cols: meta.cols,
      samplesPerPixel: meta.samplesPerPixel,
      bitsAllocated: meta.bitsAllocated,
      pixelRepresentation: meta.pixelRepresentation,
      rescaleSlope: meta.rescaleSlope,
      rescaleIntercept: meta.rescaleIntercept,
      photometricInterpretation: meta.photometricInterpretation,
      windowCenter: meta.windowCenter,
      windowWidth: meta.windowWidth,
    };

    // 6) build PNG
    let pngBuffer;
    try {
      pngBuffer = buildPngFromView(view, buildMeta);
    } catch (e) {
      console.error('getFrame: buildPngFromView failed', e.message);
      res.setHeader('Content-Type', 'image/png');
      return res.end(generatePlaceholderPng());
    }

    res.setHeader('Content-Type', 'image/png');
    return res.end(pngBuffer);
  } catch (e) {
    console.error('getFrame fatal error', e);
    res.status(500).json({ success: false, message: e.message });
  }
}



// Removed: dicofixUrl function (was for Cloudinary URLs)

module.exports = { getFrame };