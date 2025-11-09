const axios = require('axios');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const client = axios.create({
  baseURL: process.env.ORTHANC_URL || 'http://69.62.70.102:8042',
  auth: {
    username: process.env.ORTHANC_USERNAME || 'orthanc',
    password: process.env.ORTHANC_PASSWORD || 'orthanc'
  }
});

async function check() {
  try {
    // Get all instances directly
    const instances = (await client.get('/instances')).data;
    console.log(`\nFound ${instances.length} instances in Orthanc\n`);

    for (const instId of instances) {
      console.log(`Instance ID: ${instId}`);
      
      // Get instance info
      const info = (await client.get(`/instances/${instId}`)).data;
      console.log(`  Parent Study: ${info.ParentStudy}`);
      console.log(`  Parent Series: ${info.ParentSeries}`);
      
      // Get tags
      const tags = (await client.get(`/instances/${instId}/simplified-tags`)).data;
      console.log(`  Study UID: ${tags.StudyInstanceUID}`);
      console.log(`  Patient: ${tags.PatientName}`);
      console.log(`  Date: ${tags.StudyDate}`);
      console.log('');
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

check();
