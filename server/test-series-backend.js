// Test script to verify backend series filtering
const axios = require('axios');

const BACKEND_URL = 'http://3.144.196.75:8001';
const STUDY_UID = '1.2.840.113619.2.482.3.2831195393.851.1709524269.885';

const SERIES = [
  { uid: '1.2.840.113619.2.482.3.2831195393.851.1709524269.888', name: 'SCOUT', expectedCount: 2 },
  { uid: '1.2.840.113619.2.482.3.2831195393.851.1709524269.893', name: 'Pre Contrast Chest', expectedCount: 132 },
  { uid: '1.2.840.113619.2.482.3.2831195393.851.1709524269.893.3', name: 'lung', expectedCount: 132 }
];

async function testBackend() {
  console.log('🧪 Testing Backend Series Filtering\n');
  console.log('═══════════════════════════════════════════════════════\n');

  // Test 1: Get study metadata
  console.log('📋 Test 1: Get Study Metadata');
  try {
    const response = await axios.get(`${BACKEND_URL}/api/dicom/studies/${STUDY_UID}/metadata`);
    const data = response.data;

    console.log('✅ Study metadata retrieved');
    console.log(`   Number of Series: ${data.data.numberOfSeries}`);
    console.log(`   Total Instances: ${data.data.numberOfInstances}`);

    if (data.data.series && data.data.series.length > 0) {
      console.log('✅ Series data present:');
      data.data.series.forEach((s, i) => {
        console.log(`   Series ${i + 1}: ${s.seriesDescription || 'No description'} (${s.numberOfInstances} instances)`);
      });
    } else {
      console.log('❌ No series data in response!');
    }
  } catch (error) {
    console.log('❌ Failed to get study metadata:', error.message);
  }

  console.log('\n═══════════════════════════════════════════════════════\n');

  // Test 2: Test each series frame endpoint
  for (const series of SERIES) {
    console.log(`📸 Test 2.${SERIES.indexOf(series) + 1}: Get Frame from ${series.name}`);
    console.log(`   Series UID: ${series.uid}`);

    try {
      const url = `${BACKEND_URL}/api/dicom/studies/${STUDY_UID}/series/${series.uid}/frames/0`;
      console.log(`   URL: ${url}`);

      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 5000
      });

      const contentType = response.headers['content-type'];
      const size = response.data.length;

      if (contentType && contentType.includes('image')) {
        console.log(`✅ Frame retrieved successfully`);
        console.log(`   Content-Type: ${contentType}`);
        console.log(`   Size: ${(size / 1024).toFixed(2)} KB`);
      } else {
        console.log(`⚠️ Response is not an image`);
        console.log(`   Content-Type: ${contentType}`);
      }
    } catch (error) {
      console.log(`❌ Failed to get frame:`, error.message);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Data:`, error.response.data.toString().substring(0, 200));
      }
    }

    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════\n');

  // Test 3: Compare frames from different series
  console.log('🔍 Test 3: Compare Frames from Different Series');

  const frames = [];
  for (const series of SERIES) {
    try {
      const url = `${BACKEND_URL}/api/dicom/studies/${STUDY_UID}/series/${series.uid}/frames/0`;
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 5000
      });

      frames.push({
        series: series.name,
        size: response.data.length,
        hash: Buffer.from(response.data).toString('base64').substring(0, 50)
      });
    } catch (error) {
      frames.push({
        series: series.name,
        size: 0,
        hash: 'ERROR',
        error: error.message
      });
    }
  }

  console.log('Frame Comparison:');
  frames.forEach((frame, i) => {
    console.log(`\n${i + 1}. ${frame.series}:`);
    console.log(`   Size: ${(frame.size / 1024).toFixed(2)} KB`);
    console.log(`   Hash: ${frame.hash}...`);
    if (frame.error) {
      console.log(`   Error: ${frame.error}`);
    }
  });

  // Check if all frames are different
  const uniqueHashes = new Set(frames.map(f => f.hash));
  console.log(`\n📊 Result:`);
  if (uniqueHashes.size === frames.length && !frames.some(f => f.hash === 'ERROR')) {
    console.log('✅ All series return DIFFERENT frames!');
  } else if (uniqueHashes.size === 1) {
    console.log('❌ All series return the SAME frame!');
    console.log('   Problem: Backend is not filtering by series');
  } else {
    console.log('⚠️ Mixed results - some frames are same, some different');
  }

  console.log('\n═══════════════════════════════════════════════════════\n');

  // Test 4: Test legacy endpoint (without series)
  console.log('📸 Test 4: Test Legacy Endpoint (without series)');
  try {
    const url = `${BACKEND_URL}/api/dicom/studies/${STUDY_UID}/frames/0`;
    console.log(`   URL: ${url}`);

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 5000
    });

    console.log(`✅ Legacy endpoint works`);
    console.log(`   Size: ${(response.data.length / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.log(`❌ Legacy endpoint failed:`, error.message);
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('\n✅ Backend testing complete!');
  console.log('\nNext Steps:');
  console.log('1. Check backend terminal for [SERIES IDENTIFIER - BACKEND] logs');
  console.log('2. If all frames are same, backend filtering is broken');
  console.log('3. If all frames are different, problem is in frontend');
}

testBackend().catch(console.error);
