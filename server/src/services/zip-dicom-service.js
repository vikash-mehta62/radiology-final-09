const AdmZip = require('adm-zip');
const dicomParser = require('dicom-parser');
const { generateUID } = require('../utils/uid');
const Study = require('../models/Study');
const Series = require('../models/Series');
const Instance = require('../models/Instance');
const Patient = require('../models/Patient');
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

/**
 * ⚠️ DEPRECATED: This service uses Cloudinary which has been removed.
 * Use PACS upload service instead: server/src/services/pacs-upload-service.js
 * This file is kept for reference only and should not be used in production.
 */

/**
 * ZIP DICOM Service (DEPRECATED - DO NOT USE) - Handles ZIP files containing DICOM studies
 * Groups all DICOM files in ZIP under a single StudyInstanceUID for proper 3D reconstruction
 */
class ZipDicomService {
  constructor(config = {}) {
    this.config = {
      backendDir: config.backendDir || path.resolve(__dirname, '../../backend'),
      generateUnifiedStudyUID: config.generateUnifiedStudyUID !== false,
      ...config
    };

    console.log('ZIP DICOM Service initialized');
  }

  /**
   * Process ZIP file containing DICOM study
   * @param {Buffer} zipBuffer - ZIP file buffer
   * @param {string} zipFilename - Original ZIP filename
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing result
   */
  async processZipStudy(zipBuffer, zipFilename, options = {}) {
    try {
      console.log(`Processing ZIP file: ${zipFilename} (${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

      // Step 1: Extract ZIP and find all DICOM files
      const extractedFiles = await this.extractDicomFromZip(zipBuffer, zipFilename);
      
      if (extractedFiles.length === 0) {
        throw new Error('No DICOM files found in ZIP archive');
      }

      console.log(`Found ${extractedFiles.length} DICOM files in ZIP`);

      // Step 2: Parse all DICOM files and extract metadata
      const parsedFiles = await this.parseAllDicomFiles(extractedFiles);

      // Step 3: Group by series and create unified study structure
      const studyStructure = await this.createUnifiedStudyStructure(parsedFiles, zipFilename, options);

      // Step 4: Upload DICOM files to Cloudinary
      console.log('Uploading DICOM files to Cloudinary...');
      const cloudinaryResult = await this.uploadToCloudinary(studyStructure, extractedFiles);
      console.log(`✓ Uploaded ${cloudinaryResult.uploadedCount} files to Cloudinary`);

      // Step 5: Save to filesystem and database (with Cloudinary URLs)
      const saveResult = await this.saveStudyData(studyStructure, parsedFiles, cloudinaryResult.cloudinaryFiles);

      // Step 6: Generate preview frames from Cloudinary URLs
      const frameResult = await this.generatePreviewFramesFromCloudinary(studyStructure, cloudinaryResult.cloudinaryFiles);
      console.log(`✓ Generated ${frameResult.generatedFrames} preview frames`);

      return {
        success: true,
        studyInstanceUID: studyStructure.studyInstanceUID,
        studyDescription: studyStructure.studyDescription,
        totalSeries: studyStructure.series.length,
        totalInstances: parsedFiles.length,
        totalFrames: frameResult.totalFrames,
        cloudinaryUrls: cloudinaryResult.cloudinaryFiles.map(f => f.cloudinaryUrl),
        frameUrls: frameResult.frameUrls,
        series: studyStructure.series.map(s => ({
          seriesInstanceUID: s.seriesInstanceUID,
          seriesDescription: s.seriesDescription,
          modality: s.modality,
          instanceCount: s.instances.length
        })),
        readyForViewing: true,
        message: `Successfully processed ZIP with ${parsedFiles.length} DICOM files. All files uploaded to Cloudinary.`
      };

    } catch (error) {
      console.error(`Failed to process ZIP file ${zipFilename}:`, error);
      throw error;
    }
  }

  /**
   * Extract DICOM files from ZIP archive
   * @private
   */
  async extractDicomFromZip(zipBuffer, zipFilename) {
    try {
      // Validate buffer
      if (!zipBuffer || !Buffer.isBuffer(zipBuffer)) {
        throw new Error('Invalid buffer provided');
      }

      console.log(`Extracting ZIP: ${zipFilename}, size: ${zipBuffer.length} bytes`);

      // Check file signature
      if (zipBuffer.length < 4) {
        throw new Error('File too small to be a valid archive');
      }

      const signature = zipBuffer.toString('hex', 0, 4);
      
      // Check for RAR signature
      if (signature === '52617221') {
        throw new Error(
          'RAR files are not supported. Please extract the RAR file and create a ZIP archive instead. ' +
          'RAR signature detected: Rar! (0x52617221). ' +
          'To fix: Extract the RAR file using WinRAR/7-Zip, then create a new ZIP file.'
        );
      }
      
      // Check for 7z signature
      if (signature === '377abcaf') {
        throw new Error(
          '7z files are not supported. Please extract the 7z file and create a ZIP archive instead. ' +
          'To fix: Extract the 7z file using 7-Zip, then create a new ZIP file.'
        );
      }
      
      // Check for TAR/GZ signature
      if (signature === '1f8b0808' || signature.startsWith('1f8b')) {
        throw new Error(
          'GZIP/TAR files are not supported. Please extract and create a ZIP archive instead. ' +
          'To fix: Extract the archive, then create a new ZIP file.'
        );
      }
      
      // Check for valid ZIP signature (PK\x03\x04 or PK\x05\x06)
      if (signature !== '504b0304' && signature !== '504b0506') {
        throw new Error(
          `Invalid file format. Expected ZIP file but got signature: ${signature}. ` +
          'Only ZIP files are supported. Please ensure you are uploading a .zip file, not .rar, .7z, or other formats.'
        );
      }

      // Try to create ZIP object
      let zip;
      try {
        zip = new AdmZip(zipBuffer);
      } catch (admZipError) {
        console.error('AdmZip error:', admZipError);
        throw new Error(`ADM-ZIP: ${admZipError.message}`);
      }

      const zipEntries = zip.getEntries();
      console.log(`Found ${zipEntries.length} entries in ZIP`);
      
      if (zipEntries.length === 0) {
        throw new Error('ZIP file is empty');
      }

      const dicomFiles = [];

      for (const entry of zipEntries) {
        // Skip directories
        if (entry.isDirectory) {
          console.log(`Skipping directory: ${entry.entryName}`);
          continue;
        }
        
        const filename = entry.entryName.toLowerCase();
        
        // Check if it's a DICOM file by extension
        const isDicomByExtension = filename.endsWith('.dcm') || 
                                   filename.endsWith('.dicom') || 
                                   filename.endsWith('.dic') ||
                                   filename.includes('dicom');

        // Get file data
        let fileData;
        try {
          fileData = entry.getData();
        } catch (dataError) {
          console.warn(`Failed to extract ${entry.entryName}:`, dataError.message);
          continue;
        }

        // Skip very small files (likely not DICOM)
        if (fileData.length < 132) {
          console.log(`Skipping small file: ${entry.entryName} (${fileData.length} bytes)`);
          continue;
        }

        // Check if it's DICOM by magic bytes
        const isDicomByMagic = this.isProbablyDicom(fileData);
        
        // Also check for files with no extension (common for raw DICOM)
        const hasNoExtension = !filename.includes('.') || filename.split('.').pop().length > 4;
        
        // Accept if: has DICOM extension, has DICOM magic bytes, or has no extension and is large enough
        const shouldInclude = isDicomByExtension || isDicomByMagic || (hasNoExtension && fileData.length > 1000);

        if (shouldInclude) {
          const detectionMethod = isDicomByExtension ? 'extension' : 
                                 isDicomByMagic ? 'magic bytes' : 
                                 'no extension (raw)';
          console.log(`✅ Found DICOM file: ${entry.entryName} (${fileData.length} bytes) - detected by ${detectionMethod}`);
          dicomFiles.push({
            filename: entry.entryName,
            buffer: fileData,
            detectionMethod: detectionMethod
          });
        } else {
          console.log(`⏭️  Skipping: ${entry.entryName} (not DICOM)`);
        }
      }

      console.log(`Extracted ${dicomFiles.length} DICOM files from ZIP`);
      return dicomFiles;
      
    } catch (error) {
      console.error('ZIP extraction error:', error);
      throw new Error(`Failed to extract ZIP: ${error.message}`);
    }
  }

  /**
   * Check if buffer is likely a DICOM file by looking for DICOM magic bytes
   * @private
   */
  isProbablyDicom(buffer) {
    if (buffer.length < 132) return false;
    
    // Check for DICOM magic bytes "DICM" at offset 128
    const magic = buffer.toString('ascii', 128, 132);
    return magic === 'DICM';
  }

  /**
   * Parse all DICOM files and extract metadata
   * @private
   */
  async parseAllDicomFiles(extractedFiles) {
    const parsedFiles = [];

    for (const file of extractedFiles) {
      try {
        const metadata = this.parseDicomMetadata(file.buffer);
        parsedFiles.push({
          filename: file.filename,
          buffer: file.buffer,
          metadata: metadata
        });
      } catch (error) {
        console.warn(`Failed to parse ${file.filename}, skipping:`, error.message);
      }
    }

    return parsedFiles;
  }

  /**
   * Parse DICOM metadata from buffer
   * @private
   */
  parseDicomMetadata(buffer) {
    try {
      const dataSet = dicomParser.parseDicom(buffer);
      
      const readStr = (tag, defVal = '') => {
        try { return dataSet.string(tag) || defVal; } catch { return defVal; }
      };
      
      const readInt = (tag, defVal = 0) => {
        try { return dataSet.intString(tag) ?? defVal; } catch { return defVal; }
      };

      const readFloat = (tag, defVal = []) => {
        try {
          const str = dataSet.string(tag);
          if (!str) return defVal;
          return str.split('\\').map(v => parseFloat(v));
        } catch { return defVal; }
      };

      return {
        studyInstanceUID: readStr('x0020000d'),
        seriesInstanceUID: readStr('x0020000e'),
        sopInstanceUID: readStr('x00080018'),
        instanceNumber: readInt('x00200013', 1),
        
        // Patient info
        patientName: readStr('x00100010', 'Unknown'),
        patientID: readStr('x00100020', 'Unknown'),
        patientBirthDate: readStr('x00100030', ''),
        patientSex: readStr('x00100040', ''),
        
        // Study info
        studyDate: readStr('x00080020', ''),
        studyTime: readStr('x00080030', ''),
        studyDescription: readStr('x00081030', ''),
        
        // Series info
        seriesNumber: readInt('x00200011', 1),
        seriesDescription: readStr('x0008103e', ''),
        modality: readStr('x00080060', 'OT'),
        
        // Image info
        rows: readInt('x00280010', 0),
        columns: readInt('x00280011', 0),
        numberOfFrames: readInt('x00280008', 1),
        imagePositionPatient: readFloat('x00200032', [0, 0, 0]),
        imageOrientationPatient: readFloat('x00200037', [1, 0, 0, 0, 1, 0]),
        pixelSpacing: readFloat('x00280030', [1, 1]),
        sliceThickness: parseFloat(readStr('x00180050', '1')),
        sliceLocation: parseFloat(readStr('x00201041', '0')),
        
        // Technical info
        samplesPerPixel: readInt('x00280002', 1),
        bitsAllocated: readInt('x00280100', 8),
        bitsStored: readInt('x00280101', 8),
        photometricInterpretation: readStr('x00280004', 'MONOCHROME2'),
        windowCenter: readFloat('x00281050', [128]),
        windowWidth: readFloat('x00281051', [256]),
        
        dataSet: dataSet
      };
    } catch (error) {
      throw new Error(`DICOM parsing failed: ${error.message}`);
    }
  }

  /**
   * Create unified study structure grouping all files under one study
   * @private
   */
  async createUnifiedStudyStructure(parsedFiles, zipFilename, options = {}) {
    // Determine unified StudyInstanceUID
    let unifiedStudyUID;
    
    if (this.config.generateUnifiedStudyUID || options.forceUnifiedStudy) {
      // Generate new unified study UID for the entire ZIP
      unifiedStudyUID = generateUID();
      console.log(`Generated unified StudyInstanceUID: ${unifiedStudyUID}`);
    } else {
      // Use StudyInstanceUID from first file (if all same) or generate new
      const studyUIDs = [...new Set(parsedFiles.map(f => f.metadata.studyInstanceUID).filter(Boolean))];
      
      if (studyUIDs.length === 1) {
        unifiedStudyUID = studyUIDs[0];
        console.log(`Using existing StudyInstanceUID: ${unifiedStudyUID}`);
      } else {
        unifiedStudyUID = generateUID();
        console.log(`Multiple study UIDs found, generated unified: ${unifiedStudyUID}`);
      }
    }

    // Group files by SeriesInstanceUID
    const seriesMap = new Map();
    
    for (const file of parsedFiles) {
      const seriesUID = file.metadata.seriesInstanceUID || generateUID();
      
      if (!seriesMap.has(seriesUID)) {
        seriesMap.set(seriesUID, {
          seriesInstanceUID: seriesUID,
          seriesNumber: file.metadata.seriesNumber,
          seriesDescription: file.metadata.seriesDescription || `Series ${seriesMap.size + 1}`,
          modality: file.metadata.modality,
          instances: []
        });
      }
      
      seriesMap.get(seriesUID).instances.push(file);
    }

    // Sort instances within each series by InstanceNumber and ImagePositionPatient
    for (const series of seriesMap.values()) {
      series.instances.sort((a, b) => {
        // Primary sort by InstanceNumber
        const instDiff = a.metadata.instanceNumber - b.metadata.instanceNumber;
        if (instDiff !== 0) return instDiff;
        
        // Secondary sort by slice location (Z position)
        const aZ = a.metadata.imagePositionPatient[2] || 0;
        const bZ = b.metadata.imagePositionPatient[2] || 0;
        return aZ - bZ;
      });
    }

    // Get patient info from first file
    const firstFile = parsedFiles[0];
    
    return {
      studyInstanceUID: unifiedStudyUID,
      studyDescription: firstFile.metadata.studyDescription || `3D Study from ${zipFilename}`,
      studyDate: firstFile.metadata.studyDate,
      studyTime: firstFile.metadata.studyTime,
      patientName: firstFile.metadata.patientName,
      patientID: firstFile.metadata.patientID,
      patientBirthDate: firstFile.metadata.patientBirthDate,
      patientSex: firstFile.metadata.patientSex,
      modality: firstFile.metadata.modality,
      series: Array.from(seriesMap.values()),
      zipFilename: zipFilename
    };
  }

  /**
   * Save study data to filesystem and database
   * @private
   */
  async saveStudyData(studyStructure, parsedFiles) {
    const { studyInstanceUID } = studyStructure;

    // Create directories
    const studyDir = path.join(this.config.backendDir, 'uploaded_studies', studyInstanceUID);
    const framesDir = path.join(this.config.backendDir, `uploaded_frames_${studyInstanceUID}`);
    
    fs.mkdirSync(studyDir, { recursive: true });
    fs.mkdirSync(framesDir, { recursive: true });

    // Save DICOM files to filesystem
    console.log(`Saving DICOM files to: ${studyDir}`);
    for (const series of studyStructure.series) {
      const seriesDir = path.join(studyDir, series.seriesInstanceUID);
      fs.mkdirSync(seriesDir, { recursive: true });

      for (const instance of series.instances) {
        const filename = `${instance.metadata.sopInstanceUID}.dcm`;
        const filepath = path.join(seriesDir, filename);
        fs.writeFileSync(filepath, instance.buffer);
      }
    }
    console.log(`✅ Saved ${parsedFiles.length} DICOM files to filesystem`);

    // Save to database with error handling
    let dbSaveSuccess = false;
    try {
      console.log(`Saving study to database: ${studyInstanceUID}`);
      
      // Check if mongoose is connected
      const mongoose = require('mongoose');
      const connectionStates = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
      };
      const currentState = connectionStates[mongoose.connection.readyState] || 'unknown';
      
      if (mongoose.connection.readyState !== 1) {
        console.warn('⚠️  MongoDB not connected (state: ' + currentState + '), skipping database save');
        console.warn('   Files are saved to filesystem and can be accessed');
        console.warn('   Study UID: ' + studyInstanceUID);
        console.warn('   Frames directory: ' + framesDir);
        console.warn('');
        console.warn('   To fix MongoDB connection:');
        console.warn('   1. Check MONGODB_URI in node-server/.env');
        console.warn('   2. Restart the server');
        console.warn('   3. Check MongoDB Atlas network access settings');
        
        return {
          studyDir,
          framesDir,
          seriesCount: studyStructure.series.length,
          instanceCount: parsedFiles.length,
          dbSaved: false,
          filesystemSaved: true,
          warning: 'MongoDB not connected - data saved to filesystem only'
        };
      }

      // Create/update study
      await Study.findOneAndUpdate(
        { studyInstanceUID },
        {
          studyInstanceUID,
          patientName: studyStructure.patientName,
          patientID: studyStructure.patientID,
          patientBirthDate: studyStructure.patientBirthDate,
          patientSex: studyStructure.patientSex,
          studyDate: studyStructure.studyDate,
          studyTime: studyStructure.studyTime,
          studyDescription: studyStructure.studyDescription,
          modality: studyStructure.modality,
          numberOfSeries: studyStructure.series.length,
          numberOfInstances: parsedFiles.length,
          zipSource: studyStructure.zipFilename
        },
        { upsert: true, new: true }
      );

      // Create series records
      for (const series of studyStructure.series) {
        await Series.findOneAndUpdate(
          { studyInstanceUID, seriesInstanceUID: series.seriesInstanceUID },
          {
            studyInstanceUID,
            seriesInstanceUID: series.seriesInstanceUID,
            seriesNumber: series.seriesNumber,
            modality: series.modality,
            description: series.seriesDescription,
            numberOfInstances: series.instances.length
          },
          { upsert: true, new: true }
        );
      }

      // Create instance records
      let globalInstanceNumber = 0;
      for (const series of studyStructure.series) {
        for (const instance of series.instances) {
          await Instance.findOneAndUpdate(
            { studyInstanceUID, sopInstanceUID: instance.metadata.sopInstanceUID },
            {
              studyInstanceUID,
              seriesInstanceUID: series.seriesInstanceUID,
              sopInstanceUID: instance.metadata.sopInstanceUID,
              instanceNumber: globalInstanceNumber++,
              modality: series.modality,
              imagePositionPatient: instance.metadata.imagePositionPatient,
              imageOrientationPatient: instance.metadata.imageOrientationPatient,
              pixelSpacing: instance.metadata.pixelSpacing,
              sliceThickness: instance.metadata.sliceThickness,
              sliceLocation: instance.metadata.sliceLocation,
              rows: instance.metadata.rows,
              columns: instance.metadata.columns
            },
            { upsert: true, new: true }
          );
        }
      }

      // Link to patient
      const patient = await Patient.findOneAndUpdate(
        { patientID: studyStructure.patientID },
        {
          patientID: studyStructure.patientID,
          patientName: studyStructure.patientName,
          $addToSet: { studyIds: studyInstanceUID }
        },
        { upsert: true, new: true }
      );

      // ✅ WORKLIST EMPTY FIX: Auto-create worklist item when study is uploaded
      try {
        const WorklistItem = require('../models/WorklistItem');
        
        // Get hospitalId from patient or use null (will be fixed by sync)
        const hospitalId = patient.hospitalId || null;
        
        // ✅ FIX: Parse DICOM date format (YYYYMMDD) to proper Date
        let scheduledDate = new Date();
        if (studyStructure.studyDate && studyStructure.studyDate.length === 8) {
          // DICOM format: YYYYMMDD
          const year = studyStructure.studyDate.substring(0, 4);
          const month = studyStructure.studyDate.substring(4, 6);
          const day = studyStructure.studyDate.substring(6, 8);
          scheduledDate = new Date(`${year}-${month}-${day}`);
          
          // Validate the date
          if (isNaN(scheduledDate.getTime())) {
            scheduledDate = new Date(); // Fallback to current date
          }
        }
        
        const worklistItem = await WorklistItem.findOneAndUpdate(
          { studyInstanceUID },
          {
            $set: {
              studyInstanceUID,
              patientID: studyStructure.patientID,
              hospitalId: hospitalId
            },
            $setOnInsert: {
              status: 'pending',
              priority: 'routine',
              reportStatus: 'none',
              scheduledFor: scheduledDate
            }
          },
          { upsert: true, new: true }
        );
        
        console.log(`✅ Worklist item created/updated for study: ${studyInstanceUID}, hospitalId: ${hospitalId}`);
        console.log(`   Worklist item details:`, {
          _id: worklistItem._id,
          studyInstanceUID: worklistItem.studyInstanceUID,
          hospitalId: worklistItem.hospitalId,
          status: worklistItem.status,
          scheduledFor: worklistItem.scheduledFor
        });
      } catch (worklistError) {
        console.error(`⚠️ Failed to create worklist item:`, worklistError.message);
        console.error(`   Error stack:`, worklistError.stack);
        // Don't fail the upload if worklist creation fails
      }

      console.log(`✅ Saved study data to database: ${studyStructure.series.length} series, ${parsedFiles.length} instances`);
      dbSaveSuccess = true;

    } catch (dbError) {
      console.error('❌ Failed to save to database:', dbError.message);
      console.warn('⚠️  Study files are saved to filesystem but not in database');
      console.warn('   You can still access frames via filesystem');
      // Don't throw - allow process to continue
    }

    return {
      studyDir,
      framesDir,
      seriesCount: studyStructure.series.length,
      instanceCount: parsedFiles.length,
      dbSaved: dbSaveSuccess,
      filesystemSaved: true
    };
  }

  /**
   * Generate preview frames for viewing
   * @private
   */
  async generatePreviewFrames(studyStructure, parsedFiles) {
    const { studyInstanceUID } = studyStructure;
    const framesDir = path.join(this.config.backendDir, `uploaded_frames_${studyInstanceUID}`);

    // Ensure frames directory exists
    if (!fs.existsSync(framesDir)) {
      fs.mkdirSync(framesDir, { recursive: true });
      console.log(`Created frames directory: ${framesDir}`);
    }

    let frameIndex = 0;
    let generatedFrames = 0;

    // Generate frames in order (sorted by series and instance)
    for (const series of studyStructure.series) {
      for (const instance of series.instances) {
        try {
          // instance is the full file object with metadata property
          const metadata = instance.metadata || instance;
          
          // Re-read DICOM file to get fresh dataSet (important!)
          // The dataSet from parsing may have been garbage collected
          let freshDataSet = null;
          if (instance.filePath && fs.existsSync(instance.filePath)) {
            try {
              const buffer = fs.readFileSync(instance.filePath);
              freshDataSet = dicomParser.parseDicom(buffer);
            } catch (err) {
              console.warn(`  Frame ${frameIndex}: Failed to re-read DICOM file`);
            }
          }
          
          // Use fresh dataSet if available
          const metadataWithDataSet = {
            ...metadata,
            dataSet: freshDataSet || metadata.dataSet
          };
          
          const success = this.generateFrameImage(
            metadataWithDataSet,
            framesDir,
            frameIndex
          );
          
          if (success) {
            generatedFrames++;
            if (frameIndex % 50 === 0) {
              console.log(`  Generated ${frameIndex + 1} frames...`);
            }
          } else {
            console.warn(`  Failed to generate frame ${frameIndex} - creating placeholder`);
            this.generatePlaceholderFrame(framesDir, frameIndex);
          }
          
          frameIndex++;
        } catch (error) {
          console.error(`  Error generating frame ${frameIndex}:`, error.message);
          // Create placeholder
          this.generatePlaceholderFrame(framesDir, frameIndex);
          frameIndex++;
        }
      }
    }

    console.log(`Generated ${generatedFrames} preview frames out of ${frameIndex} total`);

    return {
      totalFrames: frameIndex,
      generatedFrames: generatedFrames
    };
  }

  /**
   * Generate single frame image from DICOM
   * @private
   */
  generateFrameImage(metadata, framesDir, frameIndex) {
    try {
      const { rows, columns, dataSet, bitsAllocated, samplesPerPixel, photometricInterpretation } = metadata;

      if (!rows || !columns) {
        console.warn(`Frame ${frameIndex}: Missing rows/columns`);
        return false;
      }

      if (!dataSet) {
        console.warn(`Frame ${frameIndex}: Missing dataSet`);
        return false;
      }

      const pixelDataElement = dataSet.elements && dataSet.elements.x7fe00010;
      if (!pixelDataElement) {
        console.warn(`Frame ${frameIndex}: No pixel data element found`);
        return false;
      }

      const pixelDataOffset = pixelDataElement.dataOffset;
      const byteArray = dataSet.byteArray;
      const frameBytes = rows * columns * samplesPerPixel * (bitsAllocated / 8);
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
        
        grayscale = Buffer.alloc(rows * columns);
        const range = max - min || 1;
        for (let i = 0; i < view.length; i++) {
          grayscale[i] = Math.round(((view[i] - min) / range) * 255);
        }
      } else {
        grayscale = Buffer.from(new Uint8Array(pixelData.buffer, pixelData.byteOffset, pixelData.length));
      }

      // Create PNG
      const png = new PNG({ width: columns, height: rows });
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < columns; x++) {
          const i = y * columns + x;
          const g = grayscale[i] || 0;
          const idx = (columns * y + x) << 2;
          
          // Handle MONOCHROME1 (inverted)
          const finalValue = photometricInterpretation === 'MONOCHROME1' ? 255 - g : g;
          
          png.data[idx] = finalValue;
          png.data[idx + 1] = finalValue;
          png.data[idx + 2] = finalValue;
          png.data[idx + 3] = 255;
        }
      }

      const framePath = path.join(framesDir, `frame_${String(frameIndex).padStart(3, '0')}.png`);
      fs.writeFileSync(framePath, PNG.sync.write(png));

      return true;
    } catch (error) {
      console.error(`Failed to generate frame image:`, error);
      return false;
    }
  }

  /**
   * Generate placeholder frame
   * @private
   */
  generatePlaceholderFrame(framesDir, frameIndex) {
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
    
    const framePath = path.join(framesDir, `frame_${String(frameIndex).padStart(3, '0')}.png`);
    fs.writeFileSync(framePath, PNG.sync.write(png));
  }

  /**
   * Upload DICOM files to Cloudinary
   * @private
   */
  async uploadToCloudinary(studyStructure, extractedFiles) {
    const cloudinaryFiles = [];
    let uploadedCount = 0;

    console.log(`Uploading ${extractedFiles.length} DICOM files to Cloudinary...`);

    for (let i = 0; i < extractedFiles.length; i++) {
      const filePath = extractedFiles[i];
      
      try {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
          console.warn(`  File not found: ${filePath}`);
          continue;
        }

        // Upload DICOM file to Cloudinary
        const result = await cloudinary.uploader.upload(filePath, {
          resource_type: 'raw',
          folder: `dicom/${studyStructure.studyInstanceUID}`,
          public_id: `frame_${String(i).padStart(3, '0')}`,
          overwrite: true
        });

        // Parse metadata for this file
        const buffer = fs.readFileSync(filePath);
        const dataSet = dicomParser.parseDicom(new Uint8Array(buffer));
        
        const getString = (tag, def = '') => {
          try { return dataSet.string(tag) || def; } catch { return def; }
        };
        const getUint16 = (tag, def = 0) => {
          try { return dataSet.uint16(tag) || def; } catch { return def; }
        };

        const metadata = {
          rows: getUint16('x00280010', 512),
          columns: getUint16('x00280011', 512),
          bitsAllocated: getUint16('x00280100', 16),
          bitsStored: getUint16('x00280101', 12),
          pixelRepresentation: getUint16('x00280103', 0),
          photometricInterpretation: getString('x00280004', 'MONOCHROME2'),
          rescaleSlope: parseFloat(getString('x00281053', '1')) || 1,
          rescaleIntercept: parseFloat(getString('x00281052', '0')) || 0,
          windowCenter: parseFloat(getString('x00281050', '2048').split('\\')[0]) || 2048,
          windowWidth: parseFloat(getString('x00281051', '4096').split('\\')[0]) || 4096
        };

        cloudinaryFiles.push({
          frameIndex: i,
          cloudinaryUrl: result.secure_url,
          cloudinaryPublicId: result.public_id,
          metadata
        });

        uploadedCount++;

        if (i % 50 === 0) {
          console.log(`  Uploaded ${i + 1}/${extractedFiles.length} files to Cloudinary...`);
        }

      } catch (error) {
        console.error(`  Failed to upload frame ${i} to Cloudinary:`, error.message);
      }
    }

    return {
      cloudinaryFiles,
      uploadedCount
    };
  }

  /**
   * Generate preview frames from Cloudinary URLs
   * @private
   */
  async generatePreviewFramesFromCloudinary(studyStructure, cloudinaryFiles) {
    const { studyInstanceUID } = studyStructure;
    const framesDir = path.join(this.config.backendDir, `uploaded_frames_${studyInstanceUID}`);

    // Ensure frames directory exists
    if (!fs.existsSync(framesDir)) {
      fs.mkdirSync(framesDir, { recursive: true });
    }

    const frameUrls = [];
    let generatedFrames = 0;

    console.log(`Generating ${cloudinaryFiles.length} preview frames from Cloudinary...`);

    for (const cloudinaryFile of cloudinaryFiles) {
      try {
        const { frameIndex, cloudinaryUrl, metadata } = cloudinaryFile;

        // Download DICOM from Cloudinary
        const axios = require('axios');
        const response = await axios.get(cloudinaryUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);

        // Parse DICOM
        const dataSet = dicomParser.parseDicom(new Uint8Array(buffer));

        // Generate frame image
        const success = this.generateFrameImageFromDataSet(
          dataSet,
          metadata,
          framesDir,
          frameIndex
        );

        if (success) {
          generatedFrames++;
          frameUrls.push(`/api/dicom/studies/${studyInstanceUID}/frames/${frameIndex}`);

          if (frameIndex % 50 === 0) {
            console.log(`  Generated ${frameIndex + 1} frames...`);
          }
        }

      } catch (error) {
        console.error(`  Failed to generate frame from Cloudinary:`, error.message);
      }
    }

    return {
      totalFrames: cloudinaryFiles.length,
      generatedFrames,
      frameUrls
    };
  }

  /**
   * Generate frame image from dataSet
   * @private
   */
  generateFrameImageFromDataSet(dataSet, metadata, framesDir, frameIndex) {
    try {
      const rows = metadata.rows || 512;
      const columns = metadata.columns || 512;
      const bitsAllocated = metadata.bitsAllocated || 16;
      const bitsStored = metadata.bitsStored || 12;
      const pixelRepresentation = metadata.pixelRepresentation || 0;
      const photometricInterpretation = metadata.photometricInterpretation || 'MONOCHROME2';
      const rescaleSlope = metadata.rescaleSlope || 1;
      const rescaleIntercept = metadata.rescaleIntercept || 0;
      const windowCenter = metadata.windowCenter || 2048;
      const windowWidth = metadata.windowWidth || 4096;

      const pixelDataElement = dataSet.elements && dataSet.elements.x7fe00010;
      if (!pixelDataElement) {
        return false;
      }

      const pixelDataOffset = pixelDataElement.dataOffset;
      const byteArray = dataSet.byteArray;
      const pixelDataLength = pixelDataElement.length;
      const pixelData = byteArray.slice(pixelDataOffset, pixelDataOffset + pixelDataLength);

      // Convert to array
      let pixelArray;
      if (bitsAllocated === 16) {
        pixelArray = new Uint16Array(pixelData.buffer, pixelData.byteOffset, pixelData.length / 2);
      } else {
        pixelArray = new Uint8Array(pixelData.buffer, pixelData.byteOffset, pixelData.length);
      }

      // Apply rescale
      const rescaledData = new Float32Array(pixelArray.length);
      for (let i = 0; i < pixelArray.length; i++) {
        let value = pixelArray[i];
        if (pixelRepresentation === 1 && bitsAllocated === 16) {
          if (value > 32767) value -= 65536;
        }
        rescaledData[i] = value * rescaleSlope + rescaleIntercept;
      }

      // Apply window/level
      const windowMin = windowCenter - windowWidth / 2;
      const windowMax = windowCenter + windowWidth / 2;

      // Create PNG
      const png = new PNG({ width: columns, height: rows });

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < columns; x++) {
          const idx = y * columns + x;
          const value = rescaledData[idx];

          let normalized = (value - windowMin) / (windowMax - windowMin);
          normalized = Math.max(0, Math.min(1, normalized));

          let gray = Math.round(normalized * 255);

          if (photometricInterpretation === 'MONOCHROME1') {
            gray = 255 - gray;
          }

          const pngIdx = (columns * y + x) << 2;
          png.data[pngIdx] = gray;
          png.data[pngIdx + 1] = gray;
          png.data[pngIdx + 2] = gray;
          png.data[pngIdx + 3] = 255;
        }
      }

      const framePath = path.join(framesDir, `frame_${String(frameIndex).padStart(3, '0')}.png`);
      fs.writeFileSync(framePath, PNG.sync.write(png));

      return true;
    } catch (error) {
      console.error(`Failed to generate frame image:`, error.message);
      return false;
    }
  }
}

// Singleton instance
let zipDicomServiceInstance = null;

function getZipDicomService(config = {}) {
  if (!zipDicomServiceInstance) {
    zipDicomServiceInstance = new ZipDicomService(config);
  }
  return zipDicomServiceInstance;
}

module.exports = { ZipDicomService, getZipDicomService };

module.exports = { ZipDicomService, getZipDicomService };
