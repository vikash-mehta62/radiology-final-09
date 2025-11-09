const multer = require('multer');
const Study = require('../models/Study');
const Series = require('../models/Series');
const Instance = require('../models/Instance');
const { generateUID } = require('../utils/uid');
const dicomParser = require('dicom-parser');
const { getUnifiedOrthancService } = require('../services/unified-orthanc-service');

const upload = multer({ storage: multer.memoryStorage() });

function uploadMiddleware() {
  return upload.single('file');
}

function parseDicomMetadata(buffer) {
  try {
    const dataSet = dicomParser.parseDicom(buffer);
    const readStr = (tag, defVal = '') => {
      try { return dataSet.string(tag) || defVal; } catch { return defVal; }
    };
    const readInt = (tag, defVal = 0) => {
      try { return dataSet.intString(tag) ?? defVal; } catch { return defVal; }
    };

    const studyInstanceUID = readStr('x0020000D', generateUID());
    const seriesInstanceUID = readStr('x0020000E', generateUID());
    const sopInstanceUID = readStr('x00080018', generateUID());

    const patientName = readStr('x00100010', 'Unknown');
    const patientID = readStr('x00100020', 'Unknown');
    const patientBirthDate = readStr('x00100030', '');
    const patientSex = readStr('x00100040', '');
    const studyDate = readStr('x00080020', '');
    const studyTime = readStr('x00080030', '');
    const studyDescription = readStr('x00081030', '');
    const modality = readStr('x00080060', 'OT');

    const rows = readInt('x00280010', 0);
    const cols = readInt('x00280011', 0);
    const samplesPerPixel = readInt('x00280002', 1);
    const bitsAllocated = readInt('x00280100', 8);
    const numberOfFrames = readInt('x00280008', 1) || 1;
    const photometricInterpretation = readStr('x00280004', 'MONOCHROME2');

    const pixelDataElement = dataSet.elements.x7fe00010;
    const pixelDataOffset = pixelDataElement ? pixelDataElement.dataOffset : null;

    return {
      studyInstanceUID,
      seriesInstanceUID,
      sopInstanceUID,
      patientName,
      patientID,
      patientBirthDate,
      patientSex,
      studyDate,
      studyTime,
      studyDescription,
      modality,
      rows,
      cols,
      samplesPerPixel,
      bitsAllocated,
      numberOfFrames,
      photometricInterpretation,
      dataSet,
      pixelDataOffset
    };
  } catch (e) {
    // If parsing fails, return minimal metadata
    return {
      studyInstanceUID: generateUID(),
      seriesInstanceUID: generateUID(),
      sopInstanceUID: generateUID(),
      patientName: 'Unknown',
      patientID: 'Unknown',
      patientBirthDate: '',
      patientSex: '',
      studyDate: '',
      studyTime: '',
      studyDescription: '',
      modality: 'OT',
      rows: 0,
      cols: 0,
      samplesPerPixel: 1,
      bitsAllocated: 8,
      numberOfFrames: 1,
      photometricInterpretation: 'MONOCHROME2',
      dataSet: null,
      pixelDataOffset: null
    };
  }
}



async function handleUpload(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Check MongoDB connection
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      console.error('❌ MongoDB not connected! Connection state:', mongoose.connection.readyState);
      return res.status(500).json({
        success: false,
        message: 'Database not connected. Please check MongoDB connection.'
      });
    }

    const buffer = req.file.buffer;

    // Parse locally just as a fallback; final truth Orthanc se aayega
    const localMeta = parseDicomMetadata(buffer);

    // Allow overriding patient info from form-data fields (will apply later)
    const overridePatientID = (req.body && req.body.patientID) ? String(req.body.patientID) : null;
    const overridePatientName = (req.body && req.body.patientName) ? String(req.body.patientName) : null;

    console.log(`📤 Uploading DICOM to Orthanc...`);
    const orthancService = getUnifiedOrthancService();

    let orthancUploadResult;
    try {
      console.log(`   Buffer size: ${buffer.length} bytes`);
      console.log(`   File mimetype: ${req.file.mimetype}`);
      console.log(`   File name: ${req.file.originalname}`);
      orthancUploadResult = await orthancService.uploadDicomFile(buffer);
      console.log(`✅ Uploaded to Orthanc:`, orthancUploadResult);
    } catch (orthancError) {
      console.error('❌ Failed to upload to Orthanc:', orthancError.message);
      console.error('   Orthanc error details:', JSON.stringify(orthancError.response?.data || 'No details'));
      console.error('   Orthanc status:', orthancError.response?.status);
      console.error('   Orthanc headers:', JSON.stringify(orthancError.response?.headers || {}));
      return res.status(500).json({
        success: false,
        message: `Failed to upload to Orthanc PACS: ${orthancError.message}`,
        error: orthancError.message,
        details: orthancError.response?.data || null,
        orthancStatus: orthancError.response?.status
      });
    }

    // Orthanc internal IDs (DON'T confuse with DICOM UIDs)
    const orthancInstanceId = orthancUploadResult.ID;
    const orthancStudyId = orthancUploadResult.ParentStudy;
    const orthancSeriesId = orthancUploadResult.ParentSeries;
    const orthancPatientId = orthancUploadResult.ParentPatient;

    // ✅ Single source of truth for UIDs/tags: read back from Orthanc
    let tags;
    try {
      tags = await orthancService.getInstanceMetadata(orthancInstanceId);
    } catch (e) {
      // cleanup if tags fetch fails
      try { await orthancService.deleteInstance(orthancInstanceId); } catch { }
      return res.status(500).json({ success: false, message: `Failed to read instance tags from Orthanc: ${e.message}` });
    }

    // Use Orthanc tags first; fallback to local parse
    const studyInstanceUID = tags.StudyInstanceUID || localMeta.studyInstanceUID;
    const seriesInstanceUID = tags.SeriesInstanceUID || localMeta.seriesInstanceUID;
    const sopInstanceUID = tags.SOPInstanceUID || localMeta.sopInstanceUID;

    const patientID = (overridePatientID ?? tags.PatientID ?? localMeta.patientID) || 'Unknown';
    const patientName = (overridePatientName ?? tags.PatientName ?? localMeta.patientName) || 'Unknown';

    const studyDate = tags.StudyDate ?? localMeta.studyDate ?? '';
    const studyTime = tags.StudyTime ?? localMeta.studyTime ?? '';
    const studyDescription = tags.StudyDescription ?? localMeta.studyDescription ?? '';
    const modality = tags.Modality ?? localMeta.modality ?? 'OT';
    const rows = parseInt(tags.Rows ?? localMeta.rows ?? 0) || 0;
    const cols = parseInt(tags.Columns ?? localMeta.cols ?? 0) || 0;

    // Frames from Orthanc tags (fast) else helper
    const frameCount = parseInt(tags.NumberOfFrames) || await orthancService.getFrameCount(orthancInstanceId) || 1;
    console.log(`📊 StudyUID: ${studyInstanceUID}, Frames: ${frameCount}`);

    // ---------------- MongoDB UPSERTS (consistent UIDs) ----------------

    // Get hospitalId from authenticated user
    const hospitalId = req.user?.hospitalId || null;

    // Study
    await Study.updateOne(
      { studyInstanceUID },
      {
        $set: {
          studyInstanceUID,
          patientName,
          patientID,
          patientBirthDate: tags.PatientBirthDate ?? localMeta.patientBirthDate ?? '',
          patientSex: tags.PatientSex ?? localMeta.patientSex ?? '',
          studyDate,
          studyTime,
          modality,
          studyDescription,
          numberOfSeries: 1,
          numberOfInstances: frameCount,
          orthancStudyId,
          hospitalId
        }
      },
      { upsert: true }
    );

    // Series
    await Series.updateOne(
      { studyInstanceUID, seriesInstanceUID },
      {
        $set: {
          studyInstanceUID,
          seriesInstanceUID,
          modality,
          seriesNumber: parseInt(tags.SeriesNumber) || 1,
          description: tags.SeriesDescription ?? studyDescription ?? '',
          orthancSeriesId
        }
      },
      { upsert: true }
    );

    // Instances (one per frame if multi-frame). Use bulkWrite+upsert to avoid duplicate key aborts.
    const ops = [];
    for (let i = 0; i < frameCount; i++) {
      const instanceNumber = (frameCount > 1) ? i + 1 : (parseInt(tags.InstanceNumber) || 1);
      const sopForFrame = (frameCount > 1) ? `${sopInstanceUID}.frame${i}` : sopInstanceUID;

      ops.push({
        updateOne: {
          filter: { studyInstanceUID, seriesInstanceUID, sopInstanceUID: sopForFrame },
          update: {
            $set: {
              studyInstanceUID,
              seriesInstanceUID,
              sopInstanceUID: sopForFrame,
              instanceNumber,
              modality,
              rows,
              columns: cols,
              numberOfFrames: frameCount,
              orthancInstanceId,
              orthancUrl: `${process.env.ORTHANC_URL || 'http://69.62.70.102:8042'}/instances/${orthancInstanceId}`,
              orthancFrameIndex: i,
              orthancStudyId,
              orthancSeriesId,
              useOrthancPreview: true
            }
          },
          upsert: true
        }
      });
    }

    console.log(`💾 Upserting ${ops.length} instance records to MongoDB...`);
    try {
      await Instance.bulkWrite(ops, { ordered: false });
      console.log(`✅ Instances upserted`);
    } catch (err) {
      console.error('❌ bulkWrite failed:', err);
      // No cleanup of Orthanc data to avoid data loss; surface error
      return res.status(500).json({ success: false, message: `Failed to save instances: ${err.message}` });
    }

    const savedCount = await Instance.countDocuments({ studyInstanceUID });
    console.log(`✅ Verified: ${savedCount} instances in MongoDB for study ${studyInstanceUID}`);

    // Link Patient
    try {
      const Patient = require('../models/Patient');
      const existing = await Patient.findOne({ patientID }).lean();
      if (existing) {
        const update = { $addToSet: { studyIds: studyInstanceUID } };
        if (overridePatientName && overridePatientName.trim()) {
          update.$set = { patientName: overridePatientName.trim() };
        }
        // Add hospitalId if not set
        if (!existing.hospitalId && hospitalId) {
          if (!update.$set) update.$set = {};
          update.$set.hospitalId = hospitalId;
        }
        await Patient.updateOne({ patientID }, update, { upsert: true });
      } else {
        await Patient.updateOne(
          { patientID },
          {
            $set: {
              patientID,
              patientName,
              orthancPatientId,
              hospitalId
            },
            $addToSet: { studyIds: studyInstanceUID }
          },
          { upsert: true }
        );
      }
    } catch (patientErr) {
      console.warn('Patient linking skipped or failed:', patientErr?.message || patientErr);
    }

    // ✅ WORKLIST EMPTY FIX: Auto-create worklist item when study is uploaded
    try {
      const WorklistItem = require('../models/WorklistItem');
      
      // ✅ FIX: Parse DICOM date format (YYYYMMDD) to proper Date
      let scheduledDate = new Date();
      if (studyDate && studyDate.length === 8) {
        // DICOM format: YYYYMMDD
        const year = studyDate.substring(0, 4);
        const month = studyDate.substring(4, 6);
        const day = studyDate.substring(6, 8);
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
            patientID,
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

    return res.json({
      success: true,
      message: `Successfully uploaded DICOM with ${frameCount} frame(s)`,
      data: {
        studyInstanceUID,              // DICOM UID (use this for matching)
        seriesInstanceUID,
        sopInstanceUID,
        orthancInstanceId,             // Orthanc internal IDs (for API calls)
        orthancStudyId,
        orthancSeriesId,
        orthancPatientId,
        patientID,
        patientName,
        frameCount,
        instancesSaved: savedCount,
        storage: 'orthanc-pacs'
      }
    });
  } catch (e) {
    console.error('Upload failed:', e);
    return res.status(500).json({ success: false, message: e.message });
  }
}


module.exports = { uploadMiddleware, handleUpload };