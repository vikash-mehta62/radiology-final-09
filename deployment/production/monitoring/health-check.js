// Health Check Script for Production Monitoring
// This script checks the health of all PACS services

const http = require('http');
const https = require('https');

// Configuration
const services = [
  {
    name: 'Frontend',
    url: process.env.FRONTEND_URL || 'http://localhost:3000/health',
    critical: true
  },
  {
    name: 'Backend API',
    url: process.env.API_URL || 'http://localhost:5000/health',
    critical: true
  },
  {
    name: 'MongoDB',
    url: 'http://localhost:27017',
    critical: true,
    checkType: 'tcp'
  },
  {
    name: 'Redis',
    url: 'http://localhost:6379',
    critical: true,
    checkType: 'tcp'
  },
  {
    name: 'Orthanc',
    url: process.env.ORTHANC_URL || 'http://localhost:8042/system',
    critical: true
  },
  {
    name: 'Prometheus',
    url: 'http://localhost:9090/-/healthy',
    critical: false
  },
  {
    name: 'Grafana',
    url: 'http://localhost:3001/api/health',
    critical: false
  }
];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

// Check HTTP/HTTPS endpoint
function checkHttpEndpoint(url, timeout = 5000) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const startTime = Date.now();
    
    const req = protocol.get(url, { timeout }, (res) => {
      const responseTime = Date.now() - startTime;
      const healthy = res.statusCode >= 200 && res.statusCode < 400;
      
      resolve({
        healthy,
        statusCode: res.statusCode,
        responseTime,
        error: null
      });
    });
    
    req.on('error', (error) => {
      resolve({
        healthy: false,
        statusCode: null,
        responseTime: Date.now() - startTime,
        error: error.message
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({
        healthy: false,
        statusCode: null,
        responseTime: timeout,
        error: 'Request timeout'
      });
    });
  });
}

// Check TCP port
function checkTcpPort(url) {
  const net = require('net');
  const urlObj = new URL(url);
  const port = parseInt(urlObj.port) || 80;
  const host = urlObj.hostname;
  
  return new Promise((resolve) => {
    const startTime = Date.now();
    const socket = new net.Socket();
    
    socket.setTimeout(5000);
    
    socket.on('connect', () => {
      socket.destroy();
      resolve({
        healthy: true,
        statusCode: null,
        responseTime: Date.now() - startTime,
        error: null
      });
    });
    
    socket.on('error', (error) => {
      resolve({
        healthy: false,
        statusCode: null,
        responseTime: Date.now() - startTime,
        error: error.message
      });
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve({
        healthy: false,
        statusCode: null,
        responseTime: 5000,
        error: 'Connection timeout'
      });
    });
    
    socket.connect(port, host);
  });
}

// Check service health
async function checkService(service) {
  const check = service.checkType === 'tcp' 
    ? await checkTcpPort(service.url)
    : await checkHttpEndpoint(service.url);
  
  return {
    ...service,
    ...check,
    timestamp: new Date().toISOString()
  };
}

// Format health check result
function formatResult(result) {
  const status = result.healthy 
    ? `${colors.green}✓ HEALTHY${colors.reset}`
    : `${colors.red}✗ UNHEALTHY${colors.reset}`;
  
  const critical = result.critical 
    ? `${colors.red}[CRITICAL]${colors.reset}`
    : `${colors.yellow}[NON-CRITICAL]${colors.reset}`;
  
  let output = `${status} ${critical} ${result.name}`;
  
  if (result.responseTime) {
    output += ` (${result.responseTime}ms)`;
  }
  
  if (result.statusCode) {
    output += ` [HTTP ${result.statusCode}]`;
  }
  
  if (result.error) {
    output += `\n  ${colors.red}Error: ${result.error}${colors.reset}`;
  }
  
  return output;
}

// Main health check function
async function runHealthCheck() {
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}PACS System Health Check${colors.reset}`);
  console.log(`${colors.blue}Time: ${new Date().toISOString()}${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}\n`);
  
  const results = await Promise.all(
    services.map(service => checkService(service))
  );
  
  // Display results
  results.forEach(result => {
    console.log(formatResult(result));
  });
  
  // Summary
  const totalServices = results.length;
  const healthyServices = results.filter(r => r.healthy).length;
  const unhealthyServices = totalServices - healthyServices;
  const criticalUnhealthy = results.filter(r => !r.healthy && r.critical).length;
  
  console.log(`\n${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}Summary${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log(`Total Services: ${totalServices}`);
  console.log(`${colors.green}Healthy: ${healthyServices}${colors.reset}`);
  console.log(`${colors.red}Unhealthy: ${unhealthyServices}${colors.reset}`);
  
  if (criticalUnhealthy > 0) {
    console.log(`${colors.red}Critical Services Down: ${criticalUnhealthy}${colors.reset}`);
  }
  
  // Exit code
  const exitCode = criticalUnhealthy > 0 ? 1 : 0;
  
  if (exitCode === 0) {
    console.log(`\n${colors.green}✓ All critical services are healthy${colors.reset}`);
  } else {
    console.log(`\n${colors.red}✗ Critical services are down!${colors.reset}`);
  }
  
  // Output JSON for monitoring tools
  if (process.argv.includes('--json')) {
    console.log('\nJSON Output:');
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      healthy: exitCode === 0,
      summary: {
        total: totalServices,
        healthy: healthyServices,
        unhealthy: unhealthyServices,
        criticalUnhealthy
      },
      services: results
    }, null, 2));
  }
  
  process.exit(exitCode);
}

// Run health check
if (require.main === module) {
  runHealthCheck().catch(error => {
    console.error(`${colors.red}Health check failed: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}

module.exports = { runHealthCheck, checkService };
