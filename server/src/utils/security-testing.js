/**
 * Security Testing Utilities
 * Tools for testing security vulnerabilities
 */

const axios = require('axios');

/**
 * Test for NoSQL injection vulnerabilities
 * @param {string} baseUrl - Base URL of the API
 * @param {string} endpoint - Endpoint to test
 * @param {Object} authHeaders - Authentication headers
 */
async function testNoSQLInjection(baseUrl, endpoint, authHeaders = {}) {
  console.log(`\n🔍 Testing NoSQL Injection: ${endpoint}`);
  
  const injectionPayloads = [
    { username: { $ne: null }, password: { $ne: null } },
    { username: { $gt: '' }, password: { $gt: '' } },
    { username: { $regex: '.*' }, password: { $regex: '.*' } },
    { $where: 'this.username == this.password' },
    { username: 'admin\'; return true; //' }
  ];

  const results = [];
  
  for (const payload of injectionPayloads) {
    try {
      const response = await axios.post(
        `${baseUrl}${endpoint}`,
        payload,
        { headers: authHeaders, validateStatus: () => true }
      );
      
      const vulnerable = response.status === 200 && response.data.success;
      
      results.push({
        payload: JSON.stringify(payload),
        status: response.status,
        vulnerable,
        message: vulnerable ? '❌ VULNERABLE' : '✅ Protected'
      });
      
      if (vulnerable) {
        console.error(`  ❌ VULNERABLE to payload: ${JSON.stringify(payload)}`);
      }
    } catch (error) {
      results.push({
        payload: JSON.stringify(payload),
        error: error.message,
        vulnerable: false,
        message: '✅ Protected (error thrown)'
      });
    }
  }
  
  const vulnerableCount = results.filter(r => r.vulnerable).length;
  console.log(`  Result: ${vulnerableCount === 0 ? '✅ PASS' : '❌ FAIL'} (${vulnerableCount}/${results.length} vulnerable)`);
  
  return {
    endpoint,
    type: 'NoSQL Injection',
    passed: vulnerableCount === 0,
    results
  };
}

/**
 * Test for XSS vulnerabilities
 * @param {string} baseUrl - Base URL of the API
 * @param {string} endpoint - Endpoint to test
 * @param {Object} authHeaders - Authentication headers
 */
async function testXSS(baseUrl, endpoint, authHeaders = {}) {
  console.log(`\n🔍 Testing XSS: ${endpoint}`);
  
  const xssPayloads = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert("XSS")>',
    '<svg onload=alert("XSS")>',
    'javascript:alert("XSS")',
    '<iframe src="javascript:alert(\'XSS\')">',
    '<body onload=alert("XSS")>',
    '"><script>alert(String.fromCharCode(88,83,83))</script>',
    '<scr<script>ipt>alert("XSS")</scr</script>ipt>'
  ];

  const results = [];
  
  for (const payload of xssPayloads) {
    try {
      const response = await axios.post(
        `${baseUrl}${endpoint}`,
        { content: payload, description: payload },
        { headers: authHeaders, validateStatus: () => true }
      );
      
      // Check if payload is reflected in response without sanitization
      const responseText = JSON.stringify(response.data);
      const vulnerable = responseText.includes('<script>') || 
                        responseText.includes('onerror=') ||
                        responseText.includes('onload=');
      
      results.push({
        payload: payload.substring(0, 50) + '...',
        status: response.status,
        vulnerable,
        message: vulnerable ? '❌ VULNERABLE' : '✅ Protected'
      });
      
      if (vulnerable) {
        console.error(`  ❌ VULNERABLE to payload: ${payload.substring(0, 50)}...`);
      }
    } catch (error) {
      results.push({
        payload: payload.substring(0, 50) + '...',
        error: error.message,
        vulnerable: false,
        message: '✅ Protected (error thrown)'
      });
    }
  }
  
  const vulnerableCount = results.filter(r => r.vulnerable).length;
  console.log(`  Result: ${vulnerableCount === 0 ? '✅ PASS' : '❌ FAIL'} (${vulnerableCount}/${results.length} vulnerable)`);
  
  return {
    endpoint,
    type: 'XSS',
    passed: vulnerableCount === 0,
    results
  };
}

/**
 * Test for CSRF vulnerabilities
 * @param {string} baseUrl - Base URL of the API
 * @param {string} endpoint - Endpoint to test
 * @param {Object} authHeaders - Authentication headers
 */
async function testCSRF(baseUrl, endpoint, authHeaders = {}) {
  console.log(`\n🔍 Testing CSRF: ${endpoint}`);
  
  const results = [];
  
  // Test 1: Request without CSRF token
  try {
    const response = await axios.post(
      `${baseUrl}${endpoint}`,
      { test: 'data' },
      { 
        headers: authHeaders,
        validateStatus: () => true
      }
    );
    
    const vulnerable = response.status === 200;
    
    results.push({
      test: 'No CSRF token',
      status: response.status,
      vulnerable,
      message: vulnerable ? '❌ VULNERABLE (accepts requests without token)' : '✅ Protected'
    });
    
    if (vulnerable) {
      console.error(`  ❌ VULNERABLE: Accepts requests without CSRF token`);
    }
  } catch (error) {
    results.push({
      test: 'No CSRF token',
      error: error.message,
      vulnerable: false,
      message: '✅ Protected (error thrown)'
    });
  }
  
  // Test 2: Request with invalid CSRF token
  try {
    const response = await axios.post(
      `${baseUrl}${endpoint}`,
      { test: 'data' },
      { 
        headers: {
          ...authHeaders,
          'X-XSRF-TOKEN': 'invalid-token-12345'
        },
        validateStatus: () => true
      }
    );
    
    const vulnerable = response.status === 200;
    
    results.push({
      test: 'Invalid CSRF token',
      status: response.status,
      vulnerable,
      message: vulnerable ? '❌ VULNERABLE (accepts invalid token)' : '✅ Protected'
    });
    
    if (vulnerable) {
      console.error(`  ❌ VULNERABLE: Accepts invalid CSRF token`);
    }
  } catch (error) {
    results.push({
      test: 'Invalid CSRF token',
      error: error.message,
      vulnerable: false,
      message: '✅ Protected (error thrown)'
    });
  }
  
  const vulnerableCount = results.filter(r => r.vulnerable).length;
  console.log(`  Result: ${vulnerableCount === 0 ? '✅ PASS' : '❌ FAIL'} (${vulnerableCount}/${results.length} vulnerable)`);
  
  return {
    endpoint,
    type: 'CSRF',
    passed: vulnerableCount === 0,
    results
  };
}

/**
 * Test authentication and authorization
 * @param {string} baseUrl - Base URL of the API
 * @param {string} endpoint - Endpoint to test
 */
async function testAuthenticationAuthorization(baseUrl, endpoint) {
  console.log(`\n🔍 Testing Authentication/Authorization: ${endpoint}`);
  
  const results = [];
  
  // Test 1: Request without authentication
  try {
    const response = await axios.get(
      `${baseUrl}${endpoint}`,
      { validateStatus: () => true }
    );
    
    const vulnerable = response.status === 200;
    
    results.push({
      test: 'No authentication',
      status: response.status,
      vulnerable,
      message: vulnerable ? '❌ VULNERABLE (allows unauthenticated access)' : '✅ Protected'
    });
    
    if (vulnerable) {
      console.error(`  ❌ VULNERABLE: Allows unauthenticated access`);
    }
  } catch (error) {
    results.push({
      test: 'No authentication',
      error: error.message,
      vulnerable: false,
      message: '✅ Protected (error thrown)'
    });
  }
  
  // Test 2: Request with invalid token
  try {
    const response = await axios.get(
      `${baseUrl}${endpoint}`,
      { 
        headers: { Authorization: 'Bearer invalid-token-12345' },
        validateStatus: () => true
      }
    );
    
    const vulnerable = response.status === 200;
    
    results.push({
      test: 'Invalid token',
      status: response.status,
      vulnerable,
      message: vulnerable ? '❌ VULNERABLE (accepts invalid token)' : '✅ Protected'
    });
    
    if (vulnerable) {
      console.error(`  ❌ VULNERABLE: Accepts invalid authentication token`);
    }
  } catch (error) {
    results.push({
      test: 'Invalid token',
      error: error.message,
      vulnerable: false,
      message: '✅ Protected (error thrown)'
    });
  }
  
  const vulnerableCount = results.filter(r => r.vulnerable).length;
  console.log(`  Result: ${vulnerableCount === 0 ? '✅ PASS' : '❌ FAIL'} (${vulnerableCount}/${results.length} vulnerable)`);
  
  return {
    endpoint,
    type: 'Authentication/Authorization',
    passed: vulnerableCount === 0,
    results
  };
}

/**
 * Run comprehensive security audit
 * @param {string} baseUrl - Base URL of the API
 * @param {Object} config - Test configuration
 */
async function runSecurityAudit(baseUrl, config = {}) {
  const {
    endpoints = [
      '/api/auth/login',
      '/api/users',
      '/api/reports',
      '/api/patients'
    ],
    authHeaders = {}
  } = config;

  console.log('🔒 Starting Security Audit...');
  console.log(`   Base URL: ${baseUrl}`);
  console.log(`   Endpoints: ${endpoints.length}`);
  console.log('');

  const results = {
    timestamp: new Date().toISOString(),
    baseUrl,
    tests: []
  };

  // Test each endpoint
  for (const endpoint of endpoints) {
    // NoSQL Injection tests
    const noSQLResult = await testNoSQLInjection(baseUrl, endpoint, authHeaders);
    results.tests.push(noSQLResult);

    // XSS tests
    const xssResult = await testXSS(baseUrl, endpoint, authHeaders);
    results.tests.push(xssResult);

    // CSRF tests (skip for GET endpoints)
    if (!endpoint.includes('login')) {
      const csrfResult = await testCSRF(baseUrl, endpoint, authHeaders);
      results.tests.push(csrfResult);
    }

    // Authentication/Authorization tests
    const authResult = await testAuthenticationAuthorization(baseUrl, endpoint);
    results.tests.push(authResult);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Security Audit Summary');
  console.log('='.repeat(60));
  
  const totalTests = results.tests.length;
  const passedTests = results.tests.filter(t => t.passed).length;
  const failedTests = totalTests - passedTests;
  
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests} ✅`);
  console.log(`Failed: ${failedTests} ❌`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (failedTests > 0) {
    console.log('\n⚠️  SECURITY VULNERABILITIES DETECTED!');
    console.log('Please review the failed tests above and fix the vulnerabilities.');
  } else {
    console.log('\n✅ All security tests passed!');
  }
  
  console.log('='.repeat(60));

  return results;
}

/**
 * Generate security audit report
 * @param {Object} results - Audit results
 * @returns {string} Markdown report
 */
function generateSecurityReport(results) {
  let report = '# Security Audit Report\n\n';
  report += `**Date:** ${results.timestamp}\n`;
  report += `**Base URL:** ${results.baseUrl}\n\n`;
  
  report += '## Summary\n\n';
  const totalTests = results.tests.length;
  const passedTests = results.tests.filter(t => t.passed).length;
  const failedTests = totalTests - passedTests;
  
  report += `- **Total Tests:** ${totalTests}\n`;
  report += `- **Passed:** ${passedTests} ✅\n`;
  report += `- **Failed:** ${failedTests} ❌\n`;
  report += `- **Success Rate:** ${((passedTests / totalTests) * 100).toFixed(1)}%\n\n`;
  
  report += '## Test Results\n\n';
  
  for (const test of results.tests) {
    report += `### ${test.type} - ${test.endpoint}\n\n`;
    report += `**Status:** ${test.passed ? '✅ PASS' : '❌ FAIL'}\n\n`;
    
    if (test.results && test.results.length > 0) {
      report += '| Test | Status | Message |\n';
      report += '|------|--------|----------|\n';
      
      for (const result of test.results) {
        const testName = result.payload || result.test || 'Test';
        const status = result.status || 'N/A';
        const message = result.message || 'N/A';
        report += `| ${testName} | ${status} | ${message} |\n`;
      }
      
      report += '\n';
    }
  }
  
  report += '## Recommendations\n\n';
  
  if (failedTests > 0) {
    report += '⚠️ **Security vulnerabilities detected!** Please address the following:\n\n';
    
    const failedByType = {};
    for (const test of results.tests.filter(t => !t.passed)) {
      if (!failedByType[test.type]) {
        failedByType[test.type] = [];
      }
      failedByType[test.type].push(test.endpoint);
    }
    
    for (const [type, endpoints] of Object.entries(failedByType)) {
      report += `### ${type}\n\n`;
      report += 'Vulnerable endpoints:\n';
      for (const endpoint of endpoints) {
        report += `- ${endpoint}\n`;
      }
      report += '\n';
    }
  } else {
    report += '✅ All security tests passed. Continue monitoring and testing regularly.\n\n';
  }
  
  return report;
}

module.exports = {
  testNoSQLInjection,
  testXSS,
  testCSRF,
  testAuthenticationAuthorization,
  runSecurityAudit,
  generateSecurityReport
};
