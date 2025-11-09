/**
 * K6 Load Test for Unified Reporting System
 * Tests autosave, finalize, sign, and export under load
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const autosaveSuccessRate = new Rate('autosave_success');
const autosaveLatency = new Trend('autosave_latency');
const finalizeLatency = new Trend('finalize_latency');
const signLatency = new Trend('sign_latency');
const exportLatency = new Trend('export_latency');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 50 },    // Ramp up to 50 users
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '3m', target: 200 },   // Ramp up to 200 users
    { duration: '2m', target: 500 },   // Spike to 500 users
    { duration: '1m', target: 100 },   // Scale down
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    'http_req_failed': ['rate<0.01'],           // <1% errors
    'http_req_duration': ['p(95)<1200'],        // 95% under 1.2s
    'http_req_duration{tag:save}': ['p(95)<800'], // Autosave p95 < 800ms
    'http_req_duration{tag:finalize}': ['p(95)<1500'], // Finalize p95 < 1.5s
    'http_req_duration{tag:sign}': ['p(95)<1500'],     // Sign p95 < 1.5s
    'http_req_duration{tag:export}': ['p(95)<3000'],   // Export p95 < 3s
    'autosave_success': ['rate>0.995'],         // >99.5% success
  },
};

// Base URL from environment or default
const BASE_URL = __ENV.BASE_URL || 'http://localhost:5173';
const API_URL = __ENV.API_URL || 'http://3.144.196.75:8001';

// Mock auth token
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-token-12345';

// Request headers
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`,
};

/**
 * Setup function - runs once per VU
 */
export function setup() {
  console.log('Starting load test...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`API URL: ${API_URL}`);
  
  return {
    baseUrl: BASE_URL,
    apiUrl: API_URL,
  };
}

/**
 * Main test scenario
 */
export default function(data) {
  const reportId = `report-${__VU}-${__ITER}`;
  
  // 1. Create draft report
  const createPayload = {
    studyInstanceUID: `study-${__VU}-${__ITER}`,
    patientID: `patient-${__VU}`,
    templateId: 'template-xray-chest',
    reportStatus: 'draft',
    content: {
      indication: 'Test indication',
      technique: 'Standard technique',
      findings: [],
      impression: '',
    },
  };

  const createRes = http.post(
    `${data.apiUrl}/api/reports`,
    JSON.stringify(createPayload),
    { headers, tags: { name: 'create' } }
  );

  check(createRes, {
    'create report success': (r) => r.status === 201 || r.status === 200,
  });

  if (createRes.status !== 201 && createRes.status !== 200) {
    console.error(`Failed to create report: ${createRes.status}`);
    return;
  }

  const report = createRes.json();
  const actualReportId = report._id || report.reportId || reportId;

  sleep(1);

  // 2. Autosave (simulate typing)
  for (let i = 0; i < 3; i++) {
    const savePayload = {
      ...report,
      content: {
        ...report.content,
        indication: `Updated indication ${i}`,
        findings: [
          { id: `finding-${i}`, description: `Finding ${i}`, severity: 'mild' },
        ],
      },
      version: (report.version || 1) + i,
    };

    const saveStart = Date.now();
    const saveRes = http.put(
      `${data.apiUrl}/api/reports/${actualReportId}`,
      JSON.stringify(savePayload),
      { headers, tags: { name: 'save' } }
    );

    const saveLatency = Date.now() - saveStart;
    autosaveLatency.add(saveLatency);

    const saveSuccess = check(saveRes, {
      'autosave success': (r) => r.status === 200,
      'autosave latency ok': () => saveLatency < 1000,
    });

    autosaveSuccessRate.add(saveSuccess);

    sleep(2); // Simulate typing delay
  }

  // 3. Finalize report
  const finalizeStart = Date.now();
  const finalizeRes = http.put(
    `${data.apiUrl}/api/reports/${actualReportId}/finalize`,
    JSON.stringify({ version: report.version || 1 }),
    { headers, tags: { name: 'finalize' } }
  );

  finalizeLatency.add(Date.now() - finalizeStart);

  check(finalizeRes, {
    'finalize success': (r) => r.status === 200,
  });

  sleep(1);

  // 4. Sign report (50% of users)
  if (Math.random() < 0.5) {
    const signPayload = {
      signatureText: 'Dr. Test Radiologist',
      signatureHash: 'hash-12345',
      meaning: 'Approved',
    };

    const signStart = Date.now();
    const signRes = http.post(
      `${data.apiUrl}/api/reports/${actualReportId}/sign`,
      JSON.stringify(signPayload),
      { headers, tags: { name: 'sign' } }
    );

    signLatency.add(Date.now() - signStart);

    check(signRes, {
      'sign success': (r) => r.status === 200,
    });

    sleep(1);
  }

  // 5. Export report (30% of users)
  if (Math.random() < 0.3) {
    const format = Math.random() < 0.5 ? 'pdf' : 'docx';
    
    const exportStart = Date.now();
    const exportRes = http.get(
      `${data.apiUrl}/api/reports/${actualReportId}/export?format=${format}`,
      { headers, tags: { name: 'export' } }
    );

    exportLatency.add(Date.now() - exportStart);

    check(exportRes, {
      'export success': (r) => r.status === 200,
    });
  }

  sleep(1);
}

/**
 * Teardown function
 */
export function teardown(data) {
  console.log('Load test completed');
}

/**
 * Handle summary
 */
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'load-test-results.json': JSON.stringify(data),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;
  
  let summary = '\n';
  summary += `${indent}Load Test Summary\n`;
  summary += `${indent}${'='.repeat(50)}\n\n`;
  
  // Requests
  summary += `${indent}Requests:\n`;
  summary += `${indent}  Total: ${data.metrics.http_reqs.values.count}\n`;
  summary += `${indent}  Failed: ${data.metrics.http_req_failed.values.rate * 100}%\n`;
  summary += `${indent}  Duration (p95): ${data.metrics.http_req_duration.values['p(95)']}ms\n\n`;
  
  // Autosave
  if (data.metrics.autosave_success) {
    summary += `${indent}Autosave:\n`;
    summary += `${indent}  Success Rate: ${data.metrics.autosave_success.values.rate * 100}%\n`;
    summary += `${indent}  Latency (p95): ${data.metrics.autosave_latency.values['p(95)']}ms\n\n`;
  }
  
  // VUs
  summary += `${indent}Virtual Users:\n`;
  summary += `${indent}  Max: ${data.metrics.vus_max.values.max}\n`;
  summary += `${indent}  Iterations: ${data.metrics.iterations.values.count}\n\n`;
  
  return summary;
}
