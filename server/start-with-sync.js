/**
 * Start Server with Auto-Sync
 * 
 * This script starts both:
 * 1. Main API server (port 8001)
 * 2. Remote Orthanc sync watcher (background)
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting DICOM Server with Auto-Sync...');
console.log('');

// Start main server
console.log('1️⃣ Starting API Server (port 8001)...');
const server = spawn('node', ['src/index.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

// Wait 3 seconds for server to start
setTimeout(() => {
  console.log('');
  console.log('2️⃣ Starting Remote Orthanc Sync Watcher...');
  console.log('   📡 Remote: http://69.62.70.102:8042');
  console.log('   ⏱️  Checking every 60 seconds');
  console.log('');
  
  // Start sync watcher
  const watcher = spawn('node', ['sync-remote-orthanc.js', 'watch', '60'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true
  });

  watcher.on('error', (error) => {
    console.error('❌ Sync watcher failed:', error);
  });

  watcher.on('exit', (code) => {
    console.log(`Sync watcher exited with code ${code}`);
  });
}, 3000);

server.on('error', (error) => {
  console.error('❌ Server failed:', error);
  process.exit(1);
});

server.on('exit', (code) => {
  console.log(`Server exited with code ${code}`);
  process.exit(code);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('');
  console.log('👋 Shutting down...');
  server.kill();
  process.exit(0);
});
