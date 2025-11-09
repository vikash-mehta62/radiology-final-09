/**
 * Comprehensive Security Audit Runner
 * Runs all security tests and generates a detailed report
 */

const { runSecurityAudit, generateSecurityReport } = require('./src/utils/security-testing');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  baseUrl: process.env.API_BASE_URL || 'http://3.144.196.75:8001',
  endpoints: [
    '/api/auth/login',
    '/api/auth/register',
    '/api/users',
    '/api/users/me',
    '/api/patients',
    '/api/reports',
    '/api/studies',
    '/api/signatures/sign',
    '/api/notifications/critical',
    '/api/reports/export/pdf'
  ],
  authHeaders: {}
};

async function runFullSecurityAudit() {
  console.log('🔒 Starting Comprehensive Security Audit');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Step 1: Login to get auth token
    console.log('Step 1: Authenticating...');
    const axios = require('axios');
    
    try {
      const loginResponse = await axios.post(`${config.baseUrl}/api/auth/login`, {
        username: process.env.TEST_USERNAME || 'admin',
        password: process.env.TEST_PASSWORD || 'admin123'
      });

      if (loginResponse.data.token) {
        config.authHeaders = {
          'Authorization': `Bearer ${loginResponse.data.token}`
        };
        console.log('✅ Authentication successful');
      } else {
        console.warn('⚠️  No token received, continuing without authentication');
      }
    } catch (error) {
      console.warn('⚠️  Authentication failed, continuing without auth token');
      console.warn('   Error:', error.message);
    }

    console.log('');

    // Step 2: Run security audit
    console.log('Step 2: Running security tests...');
    console.log('');

    const results = await runSecurityAudit(config.baseUrl, config);

    // Step 3: Generate report
    console.log('');
    console.log('Step 3: Generating security report...');

    const report = generateSecurityReport(results);

    // Step 4: Save report
    const reportDir = path.join(__dirname, 'security-reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportDir, `security-audit-${timestamp}.md`);

    fs.writeFileSync(reportPath, report);
    console.log(`✅ Report saved to: ${reportPath}`);

    // Step 5: Save JSON results
    const jsonPath = path.join(reportDir, `security-audit-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
    console.log(`✅ JSON results saved to: ${jsonPath}`);

    // Step 6: Generate summary
    console.log('');
    console.log('='.repeat(60));
    console.log('📊 Security Audit Complete');
    console.log('='.repeat(60));

    const totalTests = results.tests.length;
    const passedTests = results.tests.filter(t => t.passed).length;
    const failedTests = totalTests - passedTests;

    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    if (failedTests > 0) {
      console.log('');
      console.log('⚠️  SECURITY VULNERABILITIES DETECTED!');
      console.log('Please review the report and fix the vulnerabilities.');
      console.log('');

      // List failed tests
      console.log('Failed Tests:');
      results.tests.filter(t => !t.passed).forEach(test => {
        console.log(`  ❌ ${test.type} - ${test.endpoint}`);
      });

      process.exit(1);
    } else {
      console.log('');
      console.log('✅ All security tests passed!');
      console.log('');
      process.exit(0);
    }

  } catch (error) {
    console.error('');
    console.error('❌ Security audit failed:', error.message);
    console.error('');
    console.error(error.stack);
    process.exit(1);
  }
}

// Run audit
runFullSecurityAudit();
