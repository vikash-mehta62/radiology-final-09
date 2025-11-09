/**
 * Test Remote Orthanc Connection
 * Quick test to verify remote Orthanc is accessible
 */

const axios = require('axios');

const REMOTE_ORTHANC = {
  url: 'http://69.62.70.102:8042',
  username: 'orthanc',
  password: 'orthanc_secure_2024'
};

async function testConnection() {
  console.log('🔍 Testing Remote Orthanc Connection...');
  console.log(`📡 Server: ${REMOTE_ORTHANC.url}`);
  console.log('');

  try {
    // Test 1: System Info
    console.log('1️⃣ Testing system endpoint...');
    const systemResponse = await axios.get(`${REMOTE_ORTHANC.url}/system`, {
      auth: {
        username: REMOTE_ORTHANC.username,
        password: REMOTE_ORTHANC.password
      }
    });
    console.log('   ✅ System endpoint OK');
    console.log(`   Version: ${systemResponse.data.Version}`);
    console.log(`   Name: ${systemResponse.data.Name}`);
    console.log('');

    // Test 2: Get Studies
    console.log('2️⃣ Testing studies endpoint...');
    const studiesResponse = await axios.get(`${REMOTE_ORTHANC.url}/studies`, {
      auth: {
        username: REMOTE_ORTHANC.username,
        password: REMOTE_ORTHANC.password
      }
    });
    console.log('   ✅ Studies endpoint OK');
    console.log(`   Total Studies: ${studiesResponse.data.length}`);
    console.log('');

    // Test 3: Get Statistics
    console.log('3️⃣ Testing statistics endpoint...');
    const statsResponse = await axios.get(`${REMOTE_ORTHANC.url}/statistics`, {
      auth: {
        username: REMOTE_ORTHANC.username,
        password: REMOTE_ORTHANC.password
      }
    });
    console.log('   ✅ Statistics endpoint OK');
    console.log(`   Total Patients: ${statsResponse.data.CountPatients}`);
    console.log(`   Total Studies: ${statsResponse.data.CountStudies}`);
    console.log(`   Total Series: ${statsResponse.data.CountSeries}`);
    console.log(`   Total Instances: ${statsResponse.data.CountInstances}`);
    console.log(`   Disk Size: ${(statsResponse.data.TotalDiskSize / 1024 / 1024).toFixed(2)} MB`);
    console.log('');

    // Test 4: List first few studies
    if (studiesResponse.data.length > 0) {
      console.log('4️⃣ Sample studies:');
      const sampleStudies = studiesResponse.data.slice(0, 3);
      
      for (const studyId of sampleStudies) {
        try {
          const studyDetails = await axios.get(`${REMOTE_ORTHANC.url}/studies/${studyId}/simplified-tags`, {
            auth: {
              username: REMOTE_ORTHANC.username,
              password: REMOTE_ORTHANC.password
            }
          });
          
          console.log(`   📁 ${studyDetails.data.PatientName || 'Unknown'}`);
          console.log(`      Study UID: ${studyDetails.data.StudyInstanceUID}`);
          console.log(`      Date: ${studyDetails.data.StudyDate || 'N/A'}`);
          console.log(`      Modality: ${studyDetails.data.Modality || 'N/A'}`);
          console.log('');
        } catch (error) {
          console.log(`   ⚠️  Could not get details for study ${studyId}`);
        }
      }
    }

    console.log('✅ All tests passed!');
    console.log('');
    console.log('🎉 Remote Orthanc is accessible and ready to sync!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Run: npm run sync-remote');
    console.log('  2. Or watch: npm run watch-remote');

  } catch (error) {
    console.error('❌ Connection failed!');
    console.error('');
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Message: ${error.response.statusText}`);
      
      if (error.response.status === 401) {
        console.error('');
        console.error('⚠️  Authentication failed!');
        console.error('Check username and password in the script.');
      }
    } else if (error.code === 'ECONNREFUSED') {
      console.error('⚠️  Connection refused!');
      console.error('Make sure the remote Orthanc server is running.');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('⚠️  Connection timeout!');
      console.error('Check network connectivity and firewall settings.');
    } else {
      console.error(`Error: ${error.message}`);
    }
    
    process.exit(1);
  }
}

testConnection();
