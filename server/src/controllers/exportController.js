const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const Study = require('../models/Study');
const Patient = require('../models/Patient');
const Instance = require('../models/Instance');
const { getUnifiedOrthancService } = require('../services/unified-orthanc-service');

/**
 * Export patient data with all studies and DICOM files
 */
async function exportPatientData(req, res) {
  try {
    const { patientID } = req.params;
    const { includeImages = true, format = 'zip' } = req.query;

    console.log(`📦 Exporting data for patient: ${patientID}`);

    // Get patient data
    const patient = await Patient.findOne({ patientID }).lean();
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    // Get all studies for this patient
    const studies = await Study.find({ patientID }).lean();
    
    // Get all instances for these studies
    const studyUIDs = studies.map(s => s.studyInstanceUID);
    const instances = await Instance.find({ 
      studyInstanceUID: { $in: studyUIDs } 
    }).lean();

    // Create export package
    const exportData = {
      patient: {
        patientID: patient.patientID,
        patientName: patient.patientName,
        birthDate: patient.birthDate,
        sex: patient.sex,
        exportDate: new Date().toISOString(),
        studyCount: studies.length
      },
      studies: studies.map(study => ({
        studyInstanceUID: study.studyInstanceUID,
        studyDate: study.studyDate,
        studyTime: study.studyTime,
        modality: study.modality,
        studyDescription: study.studyDescription,
        numberOfSeries: study.numberOfSeries,
        numberOfInstances: study.numberOfInstances,
        aiAnalysis: study.aiAnalysis,
        aiAnalyzedAt: study.aiAnalyzedAt,
        aiModels: study.aiModels
      })),
      instances: instances.map(inst => ({
        sopInstanceUID: inst.sopInstanceUID,
        studyInstanceUID: inst.studyInstanceUID,
        seriesInstanceUID: inst.seriesInstanceUID,
        instanceNumber: inst.instanceNumber,
        numberOfFrames: inst.numberOfFrames,
        orthancInstanceId: inst.orthancInstanceId
      })),
      metadata: {
        exportedBy: req.user?.username || 'system',
        exportedAt: new Date().toISOString(),
        version: '1.0',
        includesImages: includeImages
      }
    };

    if (format === 'json') {
      // Return JSON only
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="patient_${patientID}_export.json"`);
      return res.json(exportData);
    }

    // Create ZIP archive with data and images
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="patient_${patientID}_export.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      res.status(500).json({ success: false, message: 'Export failed' });
    });

    archive.pipe(res);

    // Add JSON metadata
    archive.append(JSON.stringify(exportData, null, 2), { 
      name: 'patient_data.json' 
    });

    // Add DICOM images if requested
    if (includeImages && includeImages !== 'false') {
      const orthancService = getUnifiedOrthancService();
      
      for (const study of studies) {
        const studyFolder = `studies/${study.studyInstanceUID}`;
        
        // Try to get DICOM files from Orthanc
        try {
          const studyInstances = instances.filter(
            i => i.studyInstanceUID === study.studyInstanceUID
          );

          for (const instance of studyInstances) {
            if (instance.orthancInstanceId) {
              try {
                // Get DICOM file from Orthanc
                const dicomBuffer = await orthancService.getInstanceFile(
                  instance.orthancInstanceId
                );
                
                if (dicomBuffer) {
                  const filename = `${instance.instanceNumber || 'instance'}.dcm`;
                  archive.append(dicomBuffer, { 
                    name: `${studyFolder}/${filename}` 
                  });
                }
              } catch (err) {
                console.warn(`Failed to get DICOM for instance ${instance.orthancInstanceId}:`, err.message);
              }
            }
          }

          // Also try to get preview images from first instance
          if (studyInstances.length > 0 && studyInstances[0].orthancInstanceId) {
            try {
              const frameCount = await orthancService.getFrameCount(studyInstances[0].orthancInstanceId);
              for (let i = 0; i < frameCount; i++) {
                try {
                  const frameBuffer = await orthancService.getFrameAsPng(
                    studyInstances[0].orthancInstanceId, 
                    i
                  );
                  
                  if (frameBuffer) {
                    archive.append(frameBuffer, { 
                      name: `${studyFolder}/previews/frame_${i}.png` 
                    });
                  }
                } catch (err) {
                  console.warn(`Failed to get frame ${i}:`, err.message);
                }
              }
            } catch (err) {
              console.warn(`Failed to get frame count:`, err.message);
            }
          }
        } catch (err) {
          console.warn(`Failed to export images for study ${study.studyInstanceUID}:`, err.message);
        }
      }
    }

    // Finalize archive
    await archive.finalize();
    
    console.log(`✅ Export completed for patient: ${patientID}`);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Export failed' 
    });
  }
}

/**
 * Export study data with DICOM files
 */
async function exportStudyData(req, res) {
  try {
    const { studyUID } = req.params;
    const { includeImages = true, format = 'zip' } = req.query;

    console.log(`📦 Exporting study: ${studyUID}`);

    // Get study data
    const study = await Study.findOne({ studyInstanceUID: studyUID }).lean();
    if (!study) {
      return res.status(404).json({ success: false, message: 'Study not found' });
    }

    // Get patient data
    const patient = await Patient.findOne({ patientID: study.patientID }).lean();

    // Get instances
    const instances = await Instance.find({ studyInstanceUID: studyUID }).lean();

    const exportData = {
      study: {
        studyInstanceUID: study.studyInstanceUID,
        studyDate: study.studyDate,
        studyTime: study.studyTime,
        modality: study.modality,
        studyDescription: study.studyDescription,
        numberOfSeries: study.numberOfSeries,
        numberOfInstances: study.numberOfInstances,
        aiAnalysis: study.aiAnalysis,
        aiAnalyzedAt: study.aiAnalyzedAt,
        aiModels: study.aiModels
      },
      patient: patient ? {
        patientID: patient.patientID,
        patientName: patient.patientName,
        birthDate: patient.birthDate,
        sex: patient.sex
      } : null,
      instances: instances.map(inst => ({
        sopInstanceUID: inst.sopInstanceUID,
        seriesInstanceUID: inst.seriesInstanceUID,
        instanceNumber: inst.instanceNumber,
        numberOfFrames: inst.numberOfFrames,
        orthancInstanceId: inst.orthancInstanceId
      })),
      metadata: {
        exportedBy: req.user?.username || 'system',
        exportedAt: new Date().toISOString(),
        version: '1.0',
        includesImages: includeImages
      }
    };

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="study_${studyUID}_export.json"`);
      return res.json(exportData);
    }

    // Create ZIP archive
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="study_${studyUID}_export.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      res.status(500).json({ success: false, message: 'Export failed' });
    });

    archive.pipe(res);

    // Add JSON metadata
    archive.append(JSON.stringify(exportData, null, 2), { 
      name: 'study_data.json' 
    });

    // Add DICOM images if requested
    if (includeImages && includeImages !== 'false') {
      const orthancService = getUnifiedOrthancService();
      
      try {
        // Export DICOM files
        for (const instance of instances) {
          if (instance.orthancInstanceId) {
            try {
              const dicomBuffer = await orthancService.getInstanceFile(
                instance.orthancInstanceId
              );
              
              if (dicomBuffer) {
                const filename = `${instance.instanceNumber || 'instance'}.dcm`;
                archive.append(dicomBuffer, { 
                  name: `dicom/${filename}` 
                });
              }
            } catch (err) {
              console.warn(`Failed to get DICOM for instance ${instance.orthancInstanceId}:`, err.message);
            }
          }
        }

        // Export preview images from first instance
        if (instances.length > 0 && instances[0].orthancInstanceId) {
          try {
            const frameCount = await orthancService.getFrameCount(instances[0].orthancInstanceId);
            for (let i = 0; i < frameCount; i++) {
              try {
                const frameBuffer = await orthancService.getFrameAsPng(
                  instances[0].orthancInstanceId,
                  i
                );
                
                if (frameBuffer) {
                  archive.append(frameBuffer, { 
                    name: `previews/frame_${i}.png` 
                  });
                }
              } catch (err) {
                console.warn(`Failed to get frame ${i}:`, err.message);
              }
            }
          } catch (err) {
            console.warn(`Failed to get frame count:`, err.message);
          }
        }
      } catch (err) {
        console.warn('Failed to export images:', err.message);
      }
    }

    await archive.finalize();
    
    console.log(`✅ Export completed for study: ${studyUID}`);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Export failed' 
    });
  }
}

/**
 * Export all data (bulk export)
 */
async function exportAllData(req, res) {
  try {
    const { includeImages = false } = req.query;

    console.log('📦 Starting bulk export...');

    // Get all data
    const patients = await Patient.find({}).lean();
    const studies = await Study.find({}).lean();
    const instances = await Instance.find({}).lean();

    const exportData = {
      patients: patients.map(p => ({
        patientID: p.patientID,
        patientName: p.patientName,
        birthDate: p.birthDate,
        sex: p.sex,
        studyIds: p.studyIds
      })),
      studies: studies.map(s => ({
        studyInstanceUID: s.studyInstanceUID,
        studyDate: s.studyDate,
        studyTime: s.studyTime,
        patientID: s.patientID,
        modality: s.modality,
        studyDescription: s.studyDescription,
        numberOfSeries: s.numberOfSeries,
        numberOfInstances: s.numberOfInstances,
        aiAnalysis: s.aiAnalysis
      })),
      instances: instances.map(i => ({
        sopInstanceUID: i.sopInstanceUID,
        studyInstanceUID: i.studyInstanceUID,
        seriesInstanceUID: i.seriesInstanceUID,
        instanceNumber: i.instanceNumber,
        numberOfFrames: i.numberOfFrames,
        orthancInstanceId: i.orthancInstanceId
      })),
      metadata: {
        exportedBy: req.user?.username || 'system',
        exportedAt: new Date().toISOString(),
        version: '1.0',
        totalPatients: patients.length,
        totalStudies: studies.length,
        totalInstances: instances.length,
        includesImages: includeImages
      }
    };

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="complete_export.zip"');

    const archive = archiver('zip', { zlib: { level: 9 } });
    
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      res.status(500).json({ success: false, message: 'Export failed' });
    });

    archive.pipe(res);

    // Add JSON metadata
    archive.append(JSON.stringify(exportData, null, 2), { 
      name: 'complete_data.json' 
    });

    await archive.finalize();
    
    console.log('✅ Bulk export completed');
  } catch (error) {
    console.error('Bulk export error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Export failed' 
    });
  }
}

module.exports = {
  exportPatientData,
  exportStudyData,
  exportAllData
};
