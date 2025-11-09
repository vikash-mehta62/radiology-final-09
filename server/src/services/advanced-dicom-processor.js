/**
 * Advanced DICOM Processor
 * Handles extraction, validation, conversion, and organization of DICOM files
 * Optimized for 3D rendering with series-wise organization
 */

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const dicomParser = require('dicom-parser');
const { PNG } = require('pngjs');
const { v4: uuidv4 } = require('uuid');

class AdvancedDicomProcessor {
    constructor(config = {}) {
        this.config = {
            backendDir: config.backendDir || path.resolve(__dirname, '../../backend'),
            tempDir: config.tempDir || path.resolve(__dirname, '../../backend/temp'),
            maxFileSize: config.maxFileSize || 500 * 1024 * 1024, // 500MB
            supportedTransferSyntaxes: config.supportedTransferSyntaxes || [
                '1.2.840.10008.1.2', // Implicit VR Little Endian
                '1.2.840.10008.1.2.1', // Explicit VR Little Endian
                '1.2.840.10008.1.2.2', // Explicit VR Big Endian
            ],
            ...config
        };

        // Ensure directories exist
        this.ensureDirectories();
    }

    /**
     * Ensure required directories exist
     */
    ensureDirectories() {
        const dirs = [
            this.config.backendDir,
            this.config.tempDir,
            path.join(this.config.backendDir, 'uploaded_studies'),
        ];

        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    /**
     * Process uploaded ZIP file containing DICOM files
     * @param {Buffer} zipBuffer - ZIP file buffer
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} Processing result
     */
    async processZipFile(zipBuffer, options = {}) {
        const processingId = uuidv4();
        const tempExtractPath = path.join(this.config.tempDir, processingId);

        try {
            console.log(`📦 Processing ZIP file (ID: ${processingId})...`);

            // Extract ZIP
            const extractedFiles = await this.extractZip(zipBuffer, tempExtractPath);
            console.log(`  ✓ Extracted ${extractedFiles.length} files`);

            // Parse DICOM files
            const parsedFiles = await this.parseDicomFiles(extractedFiles);
            console.log(`  ✓ Parsed ${parsedFiles.length} DICOM files`);

            if (parsedFiles.length === 0) {
                throw new Error('No valid DICOM files found in ZIP');
            }

            // Organize by study and series
            const studyStructure = this.organizeByStudyAndSeries(parsedFiles, options);
            console.log(`  ✓ Organized into ${studyStructure.series.length} series`);

            // Save DICOM files
            await this.saveDicomFiles(studyStructure, parsedFiles);
            console.log(`  ✓ Saved DICOM files`);

            // Generate preview frames
            const frameResult = await this.generatePreviewFrames(studyStructure, parsedFiles);
            console.log(`  ✓ Generated ${frameResult.generatedFrames} preview frames`);

            // Cleanup temp directory
            this.cleanupTempDirectory(tempExtractPath);

            return {
                success: true,
                studyInstanceUID: studyStructure.studyInstanceUID,
                patientName: studyStructure.patientName,
                patientID: studyStructure.patientID,
                modality: studyStructure.modality,
                studyDate: studyStructure.studyDate,
                studyDescription: studyStructure.studyDescription,
                numberOfSeries: studyStructure.series.length,
                numberOfInstances: frameResult.totalFrames,
                series: studyStructure.series.map(s => ({
                    seriesInstanceUID: s.seriesInstanceUID,
                    seriesNumber: s.seriesNumber,
                    seriesDescription: s.seriesDescription,
                    modality: s.modality,
                    numberOfInstances: s.instances.length
                }))
            };

        } catch (error) {
            console.error('❌ Error processing ZIP file:', error);
            this.cleanupTempDirectory(tempExtractPath);
            throw error;
        }
    }

    /**
     * Extract ZIP file
     * @private
     */
    async extractZip(zipBuffer, extractPath) {
        return new Promise((resolve, reject) => {
            try {
                const zip = new AdmZip(zipBuffer);
                const zipEntries = zip.getEntries();

                // Filter out directories and hidden files
                const files = zipEntries.filter(entry =>
                    !entry.isDirectory &&
                    !entry.entryName.startsWith('__MACOSX') &&
                    !entry.entryName.includes('/.') &&
                    entry.entryName.toLowerCase().endsWith('.dcm') ||
                    !entry.entryName.includes('.')
                );

                if (files.length === 0) {
                    reject(new Error('No DICOM files found in ZIP'));
                    return;
                }

                // Extract files
                fs.mkdirSync(extractPath, { recursive: true });

                const extractedFiles = files.map(entry => {
                    const fileName = path.basename(entry.entryName);
                    const filePath = path.join(extractPath, fileName);
                    fs.writeFileSync(filePath, entry.getData());
                    return filePath;
                });

                resolve(extractedFiles);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Parse DICOM files
     * @private
     */
    async parseDicomFiles(filePaths) {
        const parsedFiles = [];

        for (const filePath of filePaths) {
            try {
                const buffer = fs.readFileSync(filePath);
                const dataSet = dicomParser.parseDicom(buffer);

                // Extract metadata
                const metadata = this.extractMetadata(dataSet, buffer);

                if (metadata.studyInstanceUID && metadata.seriesInstanceUID && metadata.sopInstanceUID) {
                    parsedFiles.push({
                        filePath,
                        buffer,
                        dataSet,
                        metadata
                    });
                } else {
                    console.warn(`  ⚠️  Skipping file with missing UIDs: ${path.basename(filePath)}`);
                }
            } catch (error) {
                console.warn(`  ⚠️  Failed to parse ${path.basename(filePath)}:`, error.message);
            }
        }

        return parsedFiles;
    }

    /**
     * Extract metadata from DICOM dataset
     * @private
     */
    extractMetadata(dataSet, buffer) {
        const getString = (tag, defaultValue = '') => {
            try {
                return dataSet.string(tag) || defaultValue;
            } catch {
                return defaultValue;
            }
        };

        const getInt = (tag, defaultValue = 0) => {
            try {
                return parseInt(dataSet.string(tag)) || defaultValue;
            } catch {
                return defaultValue;
            }
        };

        const getFloat = (tag, defaultValue = 0) => {
            try {
                return parseFloat(dataSet.string(tag)) || defaultValue;
            } catch {
                return defaultValue;
            }
        };

        // Get pixel data info
        const pixelDataElement = dataSet.elements.x7fe00010;
        const rows = getInt('x00280010', 512);
        const columns = getInt('x00280011', 512);
        const bitsAllocated = getInt('x00280100', 8);
        const samplesPerPixel = getInt('x00280002', 1);
        const photometricInterpretation = getString('x00280004', 'MONOCHROME2');

        return {
            // Patient Info
            patientName: getString('x00100010', 'Anonymous'),
            patientID: getString('x00100020', 'UNKNOWN'),
            patientBirthDate: getString('x00100030'),
            patientSex: getString('x00100040'),

            // Study Info
            studyInstanceUID: getString('x0020000d'),
            studyDate: getString('x00080020'),
            studyTime: getString('x00080030'),
            studyDescription: getString('x00081030'),
            accessionNumber: getString('x00080050'),

            // Series Info
            seriesInstanceUID: getString('x0020000e'),
            seriesNumber: getInt('x00200011', 1),
            seriesDescription: getString('x0008103e'),
            modality: getString('x00080060', 'OT'),

            // Instance Info
            sopInstanceUID: getString('x00080018'),
            instanceNumber: getInt('x00200013', 1),

            // Image Info
            rows,
            columns,
            bitsAllocated,
            samplesPerPixel,
            photometricInterpretation,
            pixelDataOffset: pixelDataElement ? pixelDataElement.dataOffset : null,

            // Technical
            transferSyntaxUID: getString('x00020010'),

            // Store dataset reference
            dataSet,
            buffer
        };
    }

    /**
     * Organize parsed files by study and series
     * @private
     */
    organizeByStudyAndSeries(parsedFiles, options = {}) {
        // Group by study
        const studyGroups = {};
        parsedFiles.forEach(file => {
            const studyUID = file.metadata.studyInstanceUID;
            if (!studyGroups[studyUID]) {
                studyGroups[studyUID] = [];
            }
            studyGroups[studyUID].push(file);
        });

        // Use first study or force unified study
        const studyUID = options.forceUnifiedStudy
            ? (options.studyInstanceUID || Object.keys(studyGroups)[0])
            : Object.keys(studyGroups)[0];

        const studyFiles = options.forceUnifiedStudy
            ? parsedFiles
            : studyGroups[studyUID];

        // Get study-level metadata from first file
        const firstFile = studyFiles[0].metadata;

        // Group by series
        const seriesGroups = {};
        studyFiles.forEach(file => {
            const seriesUID = file.metadata.seriesInstanceUID;
            if (!seriesGroups[seriesUID]) {
                seriesGroups[seriesUID] = [];
            }
            seriesGroups[seriesUID].push(file);
        });

        // Create series structure
        const series = Object.entries(seriesGroups).map(([seriesUID, files]) => {
            // Sort by instance number
            files.sort((a, b) => a.metadata.instanceNumber - b.metadata.instanceNumber);

            const firstSeriesFile = files[0].metadata;

            return {
                seriesInstanceUID: seriesUID,
                seriesNumber: firstSeriesFile.seriesNumber,
                seriesDescription: firstSeriesFile.seriesDescription,
                modality: firstSeriesFile.modality,
                instances: files.map(f => ({
                    sopInstanceUID: f.metadata.sopInstanceUID,
                    instanceNumber: f.metadata.instanceNumber,
                    filePath: f.filePath,
                    metadata: f.metadata
                }))
            };
        });

        // Sort series by series number
        series.sort((a, b) => a.seriesNumber - b.seriesNumber);

        return {
            studyInstanceUID: studyUID,
            patientName: options.patientName || firstFile.patientName,
            patientID: options.patientID || firstFile.patientID,
            studyDate: firstFile.studyDate,
            studyTime: firstFile.studyTime,
            studyDescription: firstFile.studyDescription,
            modality: firstFile.modality,
            series
        };
    }

    /**
     * Save DICOM files to organized structure
     * @private
     */
    async saveDicomFiles(studyStructure, parsedFiles) {
        const { studyInstanceUID } = studyStructure;

        for (const series of studyStructure.series) {
            const seriesDir = path.join(
                this.config.backendDir,
                'uploaded_studies',
                studyInstanceUID,
                series.seriesInstanceUID
            );

            fs.mkdirSync(seriesDir, { recursive: true });

            for (const instance of series.instances) {
                const file = parsedFiles.find(f => f.metadata.sopInstanceUID === instance.sopInstanceUID);
                if (file) {
                    const destPath = path.join(seriesDir, `${instance.sopInstanceUID}.dcm`);
                    fs.copyFileSync(file.filePath, destPath);
                }
            }
        }
    }

    /**
     * Generate preview frames for 3D rendering
     * @private
     */
    async generatePreviewFrames(studyStructure, parsedFiles) {
        const { studyInstanceUID } = studyStructure;
        const framesDir = path.join(this.config.backendDir, `uploaded_frames_${studyInstanceUID}`);

        fs.mkdirSync(framesDir, { recursive: true });

        let frameIndex = 0;
        let generatedFrames = 0;

        // Generate frames in order (sorted by series and instance)
        for (const series of studyStructure.series) {
            for (const instance of series.instances) {
                try {
                    const success = this.generateFrameImage(
                        instance.metadata,
                        framesDir,
                        frameIndex
                    );

                    if (success) {
                        generatedFrames++;
                    }

                    frameIndex++;
                } catch (error) {
                    console.warn(`  ⚠️  Failed to generate frame ${frameIndex}:`, error.message);
                    // Create placeholder
                    this.generatePlaceholderFrame(framesDir, frameIndex);
                    frameIndex++;
                }
            }
        }

        console.log(`  ℹ️  Generated ${generatedFrames} preview frames out of ${frameIndex} total`);

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

            if (!rows || !columns || !dataSet) {
                return false;
            }

            const pixelDataElement = dataSet.elements.x7fe00010;
            if (!pixelDataElement) {
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

            // Save PNG
            const framePath = path.join(framesDir, `frame_${String(frameIndex).padStart(3, '0')}.png`);
            const buffer = PNG.sync.write(png);
            fs.writeFileSync(framePath, buffer);

            return true;
        } catch (error) {
            console.error(`Error generating frame ${frameIndex}:`, error.message);
            return false;
        }
    }

    /**
     * Generate placeholder frame
     * @private
     */
    generatePlaceholderFrame(framesDir, frameIndex) {
        const png = new PNG({ width: 512, height: 512 });

        // Create checkerboard pattern
        for (let y = 0; y < 512; y++) {
            for (let x = 0; x < 512; x++) {
                const idx = (512 * y + x) << 2;
                const checker = ((x >> 4) + (y >> 4)) & 1;
                const value = checker ? 100 : 150;

                png.data[idx] = value;
                png.data[idx + 1] = value;
                png.data[idx + 2] = value;
                png.data[idx + 3] = 255;
            }
        }

        const framePath = path.join(framesDir, `frame_${String(frameIndex).padStart(3, '0')}.png`);
        const buffer = PNG.sync.write(png);
        fs.writeFileSync(framePath, buffer);
    }

    /**
     * Cleanup temporary directory
     * @private
     */
    cleanupTempDirectory(tempPath) {
        try {
            if (fs.existsSync(tempPath)) {
                fs.rmSync(tempPath, { recursive: true, force: true });
            }
        } catch (error) {
            console.warn(`  ⚠️  Failed to cleanup temp directory: ${error.message}`);
        }
    }

    /**
     * Validate DICOM file
     * @param {Buffer} buffer - DICOM file buffer
     * @returns {Object} Validation result
     */
    validateDicomFile(buffer) {
        try {
            const dataSet = dicomParser.parseDicom(buffer);

            const studyUID = dataSet.string('x0020000d');
            const seriesUID = dataSet.string('x0020000e');
            const sopUID = dataSet.string('x00080018');

            if (!studyUID || !seriesUID || !sopUID) {
                return {
                    valid: false,
                    error: 'Missing required DICOM UIDs'
                };
            }

            return {
                valid: true,
                studyInstanceUID: studyUID,
                seriesInstanceUID: seriesUID,
                sopInstanceUID: sopUID
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of AdvancedDicomProcessor
 */
function getAdvancedDicomProcessor(config) {
    if (!instance) {
        instance = new AdvancedDicomProcessor(config);
    }
    return instance;
}

module.exports = {
    AdvancedDicomProcessor,
    getAdvancedDicomProcessor
};
