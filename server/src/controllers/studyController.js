const fs = require('fs');
const path = require('path');
const Study = require('../models/Study');
const Instance = require('../models/Instance');
const { getOrthancStudyService } = require('../services/orthanc-study-service');

const BACKEND_DIR = path.resolve(__dirname, '../../backend');
const UPLOADED_STUDIES_DIR = path.join(BACKEND_DIR, 'uploaded_studies');

function countFrames(studyInstanceUID) {
  try {
    const framesDir = path.join(BACKEND_DIR, `uploaded_frames_${studyInstanceUID}`);
    const files = fs.existsSync(framesDir) ? fs.readdirSync(framesDir) : [];
    // Count PNG frames only
    return files.filter(f => f.toLowerCase().endsWith('.png')).length;
  } catch (e) {
    return 0;
  }
}

function listUploadedStudies() {
  try {
    if (!fs.existsSync(UPLOADED_STUDIES_DIR)) return [];
    const studyDirs = fs.readdirSync(UPLOADED_STUDIES_DIR).filter(name => !name.startsWith('.'));
    return studyDirs.map(uid => ({
      studyInstanceUID: uid,
      patientName: 'Rubo DEMO',
      modality: 'XA',
      numberOfSeries: 1,
      numberOfInstances: countFrames(uid)
    }));
  } catch (e) {
    return [];
  }
}

async function countFramesFromOrthanc(inst) {
  try {
    // If instance has Orthanc ID, get frame count from Orthanc
    if (inst.orthancInstanceId) {
      const { getUnifiedOrthancService } = require('../services/unified-orthanc-service');
      const orthancService = getUnifiedOrthancService();
      const frameCount = await orthancService.getFrameCount(inst.orthancInstanceId);
      return frameCount;
    }
    
    // Fallback to stored numberOfFrames
    return inst.numberOfFrames || 1;
  } catch (e) {
    console.warn('Failed to count frames from Orthanc:', e.message);
    return inst.numberOfFrames || 1;
  }
}

async function getStudies(req, res) {
  try {
    console.log(req.user,"USER")

    const mongoose = require('mongoose');
    const { getFilesystemStudyLoader } = require('../services/filesystem-study-loader');
    
    // Check MongoDB connection
    const isMongoConnected = mongoose.connection.readyState === 1;
    
    if (!isMongoConnected) {
      console.warn('⚠️  MongoDB not connected, using filesystem fallback');
      const fsLoader = getFilesystemStudyLoader();
      const fsStudies = fsLoader.getAllStudies();
      return res.json({ 
        success: true, 
        data: fsStudies,
        source: 'filesystem',
        warning: 'MongoDB not connected, showing studies from filesystem only'
      });
    }
    
    // Build query based on user's hospital
    const query = {};
    
    // Check if user is authenticated
    if (!req.user) {
      console.warn('⚠️  No user in request - authentication may have failed');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Check if user is super admin
    const isSuperAdmin = req.user.roles && (
      req.user.roles.includes('system:admin') || 
      req.user.roles.includes('super_admin')
    );
    console.log(req.user,"USER")
    
    // Filter by hospital for non-super-admin users
    if (!isSuperAdmin && req.user.hospitalId) {
      query.hospitalId = req.user.hospitalId;
      console.log(`🔒 Filtering studies by hospitalId: ${req.user.hospitalId} for user: ${req.user.username}`);
    } else if (!isSuperAdmin && !req.user.hospitalId) {
      console.warn(`⚠️  User ${req.user.username} has no hospitalId - showing all studies`);
    } else {
      console.log(`👑 Super admin ${req.user.username} - showing all studies`);
    }
    
    // Check if PACS integration is enabled
    const enablePacsIntegration = process.env.ENABLE_PACS_INTEGRATION !== 'false';
    
    if (enablePacsIntegration) {
      // Use unified studies from both database and PACS
      console.log('Fetching unified studies from database and PACS...');
      const orthancStudyService = getOrthancStudyService();
      let unifiedStudies = await orthancStudyService.getUnifiedStudies();
      
      // Filter by hospital if needed
      if (query.hospitalId) {
        unifiedStudies = unifiedStudies.filter(s => s.hospitalId === query.hospitalId);
      }
      
      res.json({ success: true, data: unifiedStudies });
    } else {
      // Fallback to database-only with improved frame counting
      console.log('PACS integration disabled, using database only...');
      
      const dbStudies = await Study.find(query, {
        studyInstanceUID: 1,
        patientName: 1,
        modality: 1,
        numberOfSeries: 1,
        numberOfInstances: 1,
        hospitalId: 1
      }).lean();

      // Get accurate frame counts for each study (same logic as getStudy)
      const studiesWithFrameCounts = await Promise.all(
        dbStudies.map(async (study) => {
          let numberOfInstances = study.numberOfInstances || 1;
          
          // Try to get accurate frame count from Orthanc
          try {
            const inst = await Instance.findOne({ studyInstanceUID: study.studyInstanceUID }).lean();
            if (inst) {
              numberOfInstances = await countFramesFromOrthanc(inst);
            }
          } catch (error) {
            console.warn(`Failed to get frame count for study ${study.studyInstanceUID}:`, error.message);
            // Fall back to stored value
            numberOfInstances = study.numberOfInstances || 1;
          }

          return {
            studyInstanceUID: study.studyInstanceUID,
            patientName: study.patientName || 'Unknown',
            modality: study.modality || 'OT',
            numberOfSeries: study.numberOfSeries || 1,
            numberOfInstances: numberOfInstances,
            hospitalId: study.hospitalId
          };
        })
      );

      res.json({ success: true, data: studiesWithFrameCounts });
    }
  } catch (e) {
    console.error('getStudies error:', e);
    
    // Final fallback to filesystem
    try {
      console.warn('⚠️  Database error, falling back to filesystem');
      const { getFilesystemStudyLoader } = require('../services/filesystem-study-loader');
      const fsLoader = getFilesystemStudyLoader();
      const fsStudies = fsLoader.getAllStudies();
      return res.json({ 
        success: true, 
        data: fsStudies,
        source: 'filesystem',
        warning: 'Database error, showing studies from filesystem only'
      });
    } catch (fsError) {
      console.error('Filesystem fallback also failed:', fsError);
      res.status(500).json({ success: false, message: e.message });
    }
  }
}

async function getStudy(req, res) {
  try {
    const { studyUid } = req.params;
    
    // Check authentication
    // if (!req.user) {
    //   return res.status(401).json({
    //     success: false,
    //     message: 'Authentication required'
    //   });
    // }
    
    // // Check if user is super admin
    // const isSuperAdmin = req.user.roles && (
    //   req.user.roles.includes('system:admin') || 
    //   req.user.roles.includes('super_admin')
    // );
    
    // First try to find in database
    let study = await Study.findOne({ studyInstanceUID: studyUid }).lean();
    
    // If not found in database and PACS integration is enabled, try PACS
    if (!study && process.env.ENABLE_PACS_INTEGRATION !== 'false') {
      console.log(`Study ${studyUid} not found in database, checking PACS...`);
      const orthancStudyService = getOrthancStudyService();
      const pacsStudy = await orthancStudyService.getStudyFromPacs(studyUid);
      
      if (pacsStudy) {
        console.log(`Found study ${studyUid} in PACS`);
        study = pacsStudy;
      }
    }
    
    if (!study) {
      return res.status(404).json({ success: false, message: 'Study not found' });
    }
    
    // Check hospital access - non-super-admin users can only access their hospital's studies
    // if (!isSuperAdmin && req.user.hospitalId && study.hospitalId !== req.user.hospitalId) {
    //   console.warn(`🚫 Access denied: User ${req.user.username} (${req.user.hospitalId}) tried to access study from ${study.hospitalId}`);
    //   return res.status(403).json({ 
    //     success: false, 
    //     message: 'Access denied - you can only view studies from your hospital' 
    //   });
    // }

    // Get accurate frame count
    let numberOfInstances = study.numberOfInstances || 1;
    
    // Try to get frame count from instance data
    const inst = await Instance.findOne({ studyInstanceUID: studyUid }).lean();
    if (inst) {
      numberOfInstances = await countFramesFromOrthanc(inst);
    }

    res.json({ success: true, data: { ...study, numberOfInstances } });
  } catch (e) {
    console.error('getStudy error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
}

async function getStudyMetadata(req, res) {
  try {
    const { studyUid } = req.params;
    
    // Check authentication
    // if (!req.user) {
    //   return res.status(401).json({
    //     success: false,
    //     message: 'Authentication required'
    //   });
    // }
    
    let study = await Study.findOne({ studyInstanceUID: studyUid }).lean();
    if (!study) return res.status(404).json({ success: false, message: 'Study not found' });
    
    // Check hospital access
    // const isSuperAdmin = req.user.roles && (
    //   req.user.roles.includes('system:admin') || 
    //   req.user.roles.includes('super_admin')
    // );
    
    // if (!isSuperAdmin && req.user.hospitalId && study.hospitalId !== req.user.hospitalId) {
    //   console.warn(`🚫 Access denied: User ${req.user.username} tried to access metadata for study from different hospital`);
    //   return res.status(403).json({ 
    //     success: false, 
    //     message: 'Access denied - you can only view studies from your hospital' 
    //   });
    // }

    // Get series data from database instances
    let seriesData = [];
    let totalFrames = 0;
    
    try {
      // Get all instances for this study grouped by series
      const instances = await Instance.find({ studyInstanceUID: studyUid })
        .sort({ seriesInstanceUID: 1, instanceNumber: 1 })
        .lean();
      
      if (instances && instances.length > 0) {
        // Group instances by series
        const seriesMap = new Map();
        
        for (const inst of instances) {
          const seriesUID = inst.seriesInstanceUID || `${studyUid}.1`;
          
          if (!seriesMap.has(seriesUID)) {
            seriesMap.set(seriesUID, {
              seriesInstanceUID: seriesUID,
              seriesNumber: '',
              seriesDescription: '',
              modality: inst.modality || study.modality || 'OT',
              numberOfInstances: 0,
              instances: [],
              orthancSeriesId: inst.orthancSeriesId
            });
          }
          
          const series = seriesMap.get(seriesUID);
          series.numberOfInstances++;
          series.instances.push({
            sopInstanceUID: inst.sopInstanceUID,
            instanceNumber: inst.instanceNumber,
            orthancInstanceId: inst.orthancInstanceId
          });
        }
        
        // Convert map to array
        seriesData = Array.from(seriesMap.values());
        
        // Try to get series metadata from Orthanc for descriptions
        if (instances[0].orthancStudyId) {
          try {
            const orthancViewerService = require('../services/orthanc-viewer-service');
            const orthancStudy = await orthancViewerService.getStudyComplete(instances[0].orthancStudyId);
            
            if (orthancStudy && orthancStudy.seriesDetails) {
              // Match and update series descriptions
              for (const series of seriesData) {
                const orthancSeries = orthancStudy.seriesDetails.find(
                  s => s.seriesInstanceUID === series.seriesInstanceUID || s.id === series.orthancSeriesId
                );
                if (orthancSeries) {
                  series.seriesNumber = orthancSeries.seriesNumber || series.seriesNumber;
                  series.seriesDescription = orthancSeries.seriesDescription || series.seriesDescription;
                }
              }
            }
          } catch (orthancError) {
            console.warn('⚠️ Could not fetch series descriptions from Orthanc:', orthancError.message);
          }
        }
        
        // Set default series numbers if not set
        seriesData.forEach((series, index) => {
          if (!series.seriesNumber) {
            series.seriesNumber = (index + 1).toString();
          }
          if (!series.seriesDescription) {
            series.seriesDescription = `Series ${series.seriesNumber}`;
          }
        });
        
        // Calculate total frames
        totalFrames = seriesData.reduce((sum, s) => sum + s.numberOfInstances, 0);
        
        console.log(`✅ Loaded ${seriesData.length} series with ${totalFrames} total instances for study ${studyUid}`);
      }
    } catch (dbError) {
      console.error('❌ Error fetching series from database:', dbError.message);
    }

    // Fallback to single series if no data found
    if (seriesData.length === 0) {
      totalFrames = study.numberOfInstances || 1;
      seriesData = [
        {
          seriesInstanceUID: `${studyUid}.1`,
          seriesNumber: '1',
          seriesDescription: study.studyDescription || 'Default Series',
          modality: study.modality || 'OT',
          numberOfInstances: totalFrames,
          instances: Array.from({ length: totalFrames }, (_, i) => ({
            sopInstanceUID: `${studyUid}.1.${i + 1}`,
            instanceNumber: i + 1
          }))
        }
      ];
      console.log(`⚠️ Using fallback single series with ${totalFrames} instances`);
    }

    const metadata = {
      studyInstanceUID: studyUid,
      patientName: study.patientName || 'Unknown',
      patientID: study.patientID || 'Unknown',
      studyDate: study.studyDate || '',
      studyTime: study.studyTime || '',
      studyDescription: study.studyDescription || '',
      modality: study.modality || 'OT',
      numberOfSeries: seriesData.length,
      numberOfInstances: totalFrames,
      series: seriesData
    };

    res.json({ success: true, data: metadata });
  } catch (e) {
    console.error('❌ Error in getStudyMetadata:', e);
    res.status(500).json({ success: false, message: e.message });
  }
}

module.exports = { getStudies, getStudy, getStudyMetadata, countFramesFromOrthanc };