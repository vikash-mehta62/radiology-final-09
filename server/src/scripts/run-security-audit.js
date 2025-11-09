/**
 * Security Audit Script
 * Run comprehensive security tests on the API
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { runSecurityAudit, generateSecurityReport } = require('../utils/security-testing');

async function main() {
  const baseUrl = process.env.API_BASE_URL || 'http://3.144.196.75:8001';
  
  console.log('🔒 Medical Imaging System - Security Audit');
  console.log('==========================================\n');

  // Define endpoints to test
  const endpoints = [
    '/api/auth/login',
    '/api/users',
    '/api/patients',
    '/api/studies',
    '/api/reports',
    '/api/signatures/sign',
    '/api/notifications/critical',
    '/api/reports/export/pdf'
  ];

  // Run security audit
  const results = await runSecurityAudit(baseUrl, {
    endpoints,
    authHeaders: {
      // Add authentication headers if needed for testing
      // 'Authorization': 'Bearer test-token'
    }
  });

  // Generate report
  const report = generateSecurityReport(results);
  
  // Save report to file
  const reportsDir = path.join(__dirname, '../../security-reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportsDir, `security-audit-${timestamp}.md`);
  
  fs.writeFileSync(reportPath, report);
  console.log(`\n📄 Report saved to: ${reportPath}`);
  
  // Save JSON results
  const jsonPath = path.join(reportsDir, `security-audit-${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  console.log(`📄 JSON results saved to: ${jsonPath}`);
  
  // Exit with error code if tests failed
  const failedTests = results.tests.filter(t => !t.passed).length;
  process.exit(failedTests > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Security audit failed:', error);
  process.exit(1);
});
