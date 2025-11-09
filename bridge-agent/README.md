# PACS Bridge Agent

Bridge agent for syncing DICOM studies from hospital PACS to AWS central system.

## Features

- ✅ Automatic periodic sync of new studies
- ✅ Real-time folder watching for new DICOM files
- ✅ Orthanc webhook integration
- ✅ Automatic retry on failures
- ✅ Comprehensive logging
- ✅ Hospital registration with AWS

## Installation

```bash
npm install
```

## Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your settings:
   ```bash
   HOSPITAL_ID=hospital-a
   HOSPITAL_NAME=Hospital A Main Campus
   AWS_API_URL=https://api.yourdomain.com
   API_KEY=your-api-key
   ORTHANC_URL=http://69.62.70.102:8042
   ```

3. Get API key from AWS admin

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### With PM2
```bash
npm run pm2
pm2 save
pm2 startup
```

## How It Works

1. **Registration**: Agent registers hospital with AWS on startup
2. **Periodic Sync**: Checks for new studies every minute (configurable)
3. **Folder Watch**: Monitors folder for new DICOM files (optional)
4. **Webhooks**: Listens for Orthanc events (optional)
5. **Upload**: Sends studies to AWS central system

## Orthanc Configuration

Add webhook to Orthanc config (`orthanc.json`):

```json
{
  "Plugins": ["libOrthancWebhook.so"],
  "Webhook": {
    "Url": "http://localhost:3001/orthanc-webhook",
    "Events": ["StableStudy"]
  }
}
```

## Monitoring

Check logs:
```bash
pm2 logs pacs-bridge
```

Check status:
```bash
pm2 status
```

## Troubleshooting

### Connection Issues
- Verify AWS_API_URL is correct
- Check API_KEY is valid
- Ensure network connectivity

### Orthanc Issues
- Verify ORTHANC_URL is accessible
- Check credentials
- Test: `curl http://69.62.70.102:8042/system`

### Upload Failures
- Check AWS API logs
- Verify hospital is registered
- Check disk space

## Support

Contact your system administrator for API keys and configuration.
