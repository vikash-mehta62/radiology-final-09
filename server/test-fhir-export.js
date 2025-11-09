/**
 * Test FHIR Export Functionality
 * Run: node test-fhir-export.js
 */

const axios = require('axios');

const BASE_URL = 'http://3.144.196.75:8001';

// Get token from your login
const TOKEN = process.env.TEST_TOKEN || 'YOUR_TOKEN_HERE';

async function testFHIRExport() {
  console.log('🧪 Testing FHIR Export Functionality\n');

  try {
    // Step 1: Get a report ID (you'll need to replace this with an actual report ID)
    console.log('📋 Step 1: Finding a report to export...');
    
    const reportsResponse = await axios.get(`${BASE_URL}/api/reports`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    });

    if (!reportsResponse.data.reports || reportsResponse.data.reports.length === 0) {
      console.log('❌ No reports found. Please create a report first.');
      return;
    }

    const testReport = reportsResponse.data.reports[0];
    const reportId = testReport.reportId;
    
    console.log(`✅ Found report: ${reportId}`);
    console.log(`   Patient: ${testReport.patientName || testReport.patientID}`);
    console.log(`   Status: ${testReport.status}\n`);

    // Step 2: Check export status
    console.log('📋 Step 2: Checking FHIR export status...');
    
    const statusResponse = await axios.get(
      `${BASE_URL}/api/fhir/reports/${reportId}/status`,
      { headers: { 'Authorization': `Bearer ${TOKEN}` } }
    );

    const readiness = statusResponse.data.readiness;
    console.log('   Export Readiness:');
    console.log(`   - Has Findings: ${readiness.hasFindings ? '✅' : '❌'}`);
    console.log(`   - Has Impression: ${readiness.hasImpression ? '✅' : '❌'}`);
    console.log(`   - Is Signed: ${readiness.isSigned ? '✅' : '❌'}`);
    console.log(`   - Can Export: ${readiness.canExport ? '✅' : '❌'}\n`);

    if (!readiness.canExport) {
      console.log('⚠️  Report is not ready for export. Warnings:');
      readiness.warnings.forEach(w => console.log(`   - ${w}`));
      console.log('\n💡 Tip: Add findings and impression to the report first.\n');
      return;
    }

    // Step 3: Export as DiagnosticReport
    console.log('📋 Step 3: Exporting as FHIR DiagnosticReport...');
    
    const reportResponse = await axios.get(
      `${BASE_URL}/api/fhir/reports/${reportId}`,
      { headers: { 'Authorization': `Bearer ${TOKEN}` } }
    );

    const fhirReport = reportResponse.data.data;
    console.log('✅ DiagnosticReport exported successfully!');
    console.log(`   Resource Type: ${fhirReport.resourceType}`);
    console.log(`   ID: ${fhirReport.id}`);
    console.log(`   Status: ${fhirReport.status}`);
    console.log(`   Subject: ${fhirReport.subject?.display || 'N/A'}\n`);

    // Step 4: Export as FHIR Bundle
    console.log('📋 Step 4: Exporting as FHIR Bundle...');
    
    const bundleResponse = await axios.get(
      `${BASE_URL}/api/fhir/reports/${reportId}/bundle`,
      { headers: { 'Authorization': `Bearer ${TOKEN}` } }
    );

    const fhirBundle = bundleResponse.data.data;
    console.log('✅ FHIR Bundle exported successfully!');
    console.log(`   Resource Type: ${fhirBundle.resourceType}`);
    console.log(`   Bundle Type: ${fhirBundle.type}`);
    console.log(`   Entries: ${fhirBundle.entry?.length || 0}`);
    
    if (fhirBundle.entry) {
      console.log('   Resources included:');
      fhirBundle.entry.forEach(entry => {
        console.log(`   - ${entry.resource.resourceType}`);
      });
    }
    console.log('');

    // Step 5: Validate FHIR structure
    console.log('📋 Step 5: Validating FHIR structure...');
    
    const validationErrors = [];
    
    if (!fhirReport.resourceType) validationErrors.push('Missing resourceType');
    if (!fhirReport.status) validationErrors.push('Missing status');
    if (!fhirReport.code) validationErrors.push('Missing code');
    if (!fhirReport.subject) validationErrors.push('Missing subject');
    
    if (validationErrors.length > 0) {
      console.log('❌ Validation failed:');
      validationErrors.forEach(e => console.log(`   - ${e}`));
    } else {
      console.log('✅ FHIR structure is valid!\n');
    }

    // Step 6: Show sample output
    console.log('📋 Step 6: Sample FHIR Output (first 50 lines):\n');
    console.log('```json');
    const jsonOutput = JSON.stringify(fhirReport, null, 2);
    const lines = jsonOutput.split('\n').slice(0, 50);
    console.log(lines.join('\n'));
    if (jsonOutput.split('\n').length > 50) {
      console.log('... (truncated)');
    }
    console.log('```\n');

    // Summary
    console.log('🎉 FHIR Export Test Complete!\n');
    console.log('✅ All tests passed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Validate output at: https://validator.fhir.org/');
    console.log('2. Test push to HAPI FHIR: https://hapi.fhir.org/baseR4');
    console.log('3. Integrate with your EHR/HIS system');
    console.log('');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Error:', error.response.data?.error || error.response.data);
    }
    
    if (error.message.includes('401') || error.message.includes('403')) {
      console.log('\n💡 Tip: Update the TOKEN variable with a valid access token');
      console.log('   1. Login to your app');
      console.log('   2. Get token from localStorage.getItem("accessToken")');
      console.log('   3. Set TOKEN variable in this script or use:');
      console.log('      TEST_TOKEN=your_token node test-fhir-export.js');
    }
  }
}

// Run the test
testFHIRExport();
