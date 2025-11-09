#!/usr/bin/env node

/**
 * Clear Frame Cache
 * Removes all cached frames to force regeneration with new settings
 */

const fs = require('fs');
const path = require('path');

const BACKEND_DIR = path.resolve(__dirname, '../server/backend');

console.log('🗑️  Clearing frame cache...');
console.log(`   Cache directory: ${BACKEND_DIR}`);

if (!fs.existsSync(BACKEND_DIR)) {
  console.log('✅ No cache directory found - nothing to clear');
  process.exit(0);
}

// Find all uploaded_frames_* directories
const entries = fs.readdirSync(BACKEND_DIR);
const frameDirs = entries.filter(entry => entry.startsWith('uploaded_frames_'));

if (frameDirs.length === 0) {
  console.log('✅ No cached frames found');
  process.exit(0);
}

console.log(`   Found ${frameDirs.length} study cache(s)`);

let totalCleared = 0;
frameDirs.forEach(dir => {
  const dirPath = path.join(BACKEND_DIR, dir);
  const files = fs.readdirSync(dirPath);
  
  console.log(`   Clearing ${dir} (${files.length} frames)...`);
  
  fs.rmSync(dirPath, { recursive: true, force: true });
  totalCleared += files.length;
});

console.log(`✅ Cleared ${totalCleared} cached frames from ${frameDirs.length} studies`);
console.log('   Frames will be regenerated at full resolution on next access');
