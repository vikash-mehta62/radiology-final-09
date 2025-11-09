require('dotenv').config();
const PACSBridgeAgent = require('./src/bridge-agent');

// Configuration from environment
const config = {
  hospitalId: process.env.HOSPITAL_ID || 'hospital-default',
  hospitalName: process.env.HOSPITAL_NAME || 'Default Hospital',
  awsApiUrl: process.env.AWS_API_URL || 'https://api.yourdomain.com',
  apiKey: process.env.API_KEY,
  orthancUrl: process.env.ORTHANC_URL || 'http://69.62.70.102:8042',
  orthancUsername: process.env.ORTHANC_USERNAME || 'orthanc',
  orthancPassword: process.env.ORTHANC_PASSWORD || 'orthanc',
  syncInterval: parseInt(process.env.SYNC_INTERVAL) || 60000,
  watchFolder: process.env.WATCH_FOLDER || null,
  webhookPort: parseInt(process.env.WEBHOOK_PORT) || 3001
};

// Validate required config
if (!config.apiKey) {
  console.error('❌ API_KEY is required! Set it in .env file');
  process.exit(1);
}

// Start agent
const agent = new PACSBridgeAgent(config);
agent.start().catch(error => {
  console.error('❌ Failed to start bridge agent:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down bridge agent...');
  await agent.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down bridge agent...');
  await agent.stop();
  process.exit(0);
});
