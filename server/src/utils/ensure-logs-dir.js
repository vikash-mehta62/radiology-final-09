const fs = require('fs');
const path = require('path');

/**
 * Ensure logs directory exists
 */
function ensureLogsDirectory() {
  const logsDir = path.join(process.cwd(), 'logs');
  
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    console.log('Created logs directory:', logsDir);
  }
}

module.exports = { ensureLogsDirectory };