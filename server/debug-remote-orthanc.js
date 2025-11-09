/**
 * Debug Remote Orthanc
 * Check what's actually on the remote server
 */

const axios = require('axios');

const REMOTE_ORTHANC = {
  url: 'http://69.62.70.102:8042',
  username: 'orthanc',
  password: 'orthanc_secure_2024'
};

const orthancClient = axios.create({
  baseURL: REMOTE_ORTHANC.url,
  auth: {
    username: REMOTE_ORTHANC.username,
    password: REMOTE_ORTHANC.password
  },
  timeout: 30000
});

async function debugRemoteOrthanc() {
  console.log('🔍 Debugging Remote Orthanc...');
  console.log(`📡 Server: ${REMOTE_ORTHANC.url}`);
  console.log('');

  try {
    // Get all studies
    const studiesResponse = await orthancClient.get('/studies');
    const studyIds = studiesResponse.data;
    
    console.log(`📊 Found ${studyIds.length} studies`);
    console.log('');

    if (studyIds.length === 0) {
      console.log('⚠️  No studies found on remote Orthanc');
      console.log('');
      console.log('To upload a test study:');
      console.log(`curl -u ${REMOTE_ORTHANC.username}:${REMOTE_ORTHANC.password} \\`);
      console.log(`  -X POST ${REMOTE_ORTHANC.url}/instances \\`);
      console.log(`  --data-binary @your-file.dcm`);
      return;
    }

    // Check each study
    for (let i = 0; i < studyIds.length; i++) {
      const studyId = studyIds[i];
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Study ${i + 1}/${studyIds.length}: ${studyId}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      try {
        // Get study details
        const detailsResponse = await orthancClient.get(`/studies/${studyId}`);
        const details = detailsResponse.data;
        
        console.log('📋 Study Details:');
        console.log(`   ID: ${details.ID}`);
        console.log(`   Type: ${details.Type}`);
        console.log(`   Parent Patient: ${details.ParentPatient || 'N/A'}`);
        console.log(`   Series: ${details.Series?.length || 0}`);
        console.log(`   Instances: ${details.Instances?.length || 0}`);
        console.log('');

        // Try to get tags (multiple methods)
        let tags = null;
        
        // Method 1: simplified-tags
        try {
          const tagsResponse = await orthancClient.get(`/studies/${studyId}/simplified-tags`);
          tags = tagsResponse.data;
          console.log('✅ Got tags via simplified-tags');
        } catch (e) {
          console.log('⚠️  simplified-tags not available');
          
          // Method 2: regular tags
          try {
            const tagsResponse = await orthancClient.get(`/studies/${studyId}/tags`);
            const rawTags = tagsResponse.data;
            console.log('✅ Got tags via regular tags endpoint');
            
            // Convert to simplified format
            tags = {};
            for (const [key, value] of Object.entries(rawTags)) {
              if (value && value.Value) {
                const name = value.Name || key;
                tags[name] = Array.isArray(value.Value) ? value.Value[0] : value.Value;
              }
            }
          } catch (e2) {
            console.log('❌ Could not get tags at all');
          }
        }

        if (tags) {
          console.log('');
          console.log('🏷️  DICOM Tags:');
          console.log(`   StudyInstanceUID: ${tags.StudyInstanceUID || tags['0020,000d'] || 'N/A'}`);
          console.log(`   PatientName: ${tags.PatientName || tags['0010,0010'] || 'N/A'}`);
          console.log(`   PatientID: ${tags.PatientID || tags['0010,0020'] || 'N/A'}`);
          console.log(`   StudyDate: ${tags.StudyDate || tags['0008,0020'] || 'N/A'}`);
          console.log(`   StudyDescription: ${tags.StudyDescription || tags['0008,1030'] || 'N/A'}`);
          console.log(`   Modality: ${tags.Modality || tags['0008,0060'] || 'N/A'}`);
        }

        // Check instances
        if (details.Instances && details.Instances.length > 0) {
          console.log('');
          console.log(`📦 Instances (${details.Instances.length}):`);
          
          const firstInstance = details.Instances[0];
          try {
            const instResponse = await orthancClient.get(`/instances/${firstInstance}`);
            const instDetails = instResponse.data;
            console.log(`   First Instance ID: ${instDetails.ID}`);
            console.log(`   File Size: ${instDetails.FileSize} bytes`);
            
            // Try to get instance tags
            try {
              const instTagsResponse = await orthancClient.get(`/instances/${firstInstance}/simplified-tags`);
              const instTags = instTagsResponse.data;
              console.log(`   SOPInstanceUID: ${instTags.SOPInstanceUID || 'N/A'}`);
              console.log(`   NumberOfFrames: ${instTags.NumberOfFrames || 1}`);
            } catch (e) {
              console.log('   ⚠️  Could not get instance tags');
            }
          } catch (e) {
            console.log('   ❌ Could not get instance details');
          }
        } else {
          console.log('');
          console.log('⚠️  No instances in this study!');
        }

        console.log('');

      } catch (error) {
        console.log(`❌ Error processing study: ${error.message}`);
        console.log('');
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Debug complete!');

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data:`, error.response.data);
    }
  }
}

debugRemoteOrthanc();
