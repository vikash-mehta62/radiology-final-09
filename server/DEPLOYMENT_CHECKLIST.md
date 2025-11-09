# VPS Deployment Checklist

## Pre-Deployment

- [x] Fixed `crypto.randomUUID is not a function` error
- [x] Using `uuid` library for cross-version compatibility
- [x] Tested locally - all UUID generation works

## Deploy to VPS

### 1. Upload Code
```bash
# On your local machine
git add .
git commit -m "Fix crypto.randomUUID compatibility for older Node.js"
git push origin main

# On VPS
cd /path/to/your/app
git pull origin main
```

### 2. Install Dependencies
```bash
cd server
npm install
```

### 3. Verify UUID Package
```bash
npm list uuid
# Should show: uuid@13.0.0
```

### 4. Test the Fix
```bash
node -e "const { randomUUID } = require('./src/utils/crypto-polyfill'); console.log('UUID:', randomUUID());"
# Should output a valid UUID
```

### 5. Restart Server
```bash
# If using PM2
pm2 restart server

# If using systemd
sudo systemctl restart your-service-name

# If running manually
# Stop the old process and start again
node src/index.js
```

### 6. Verify Server is Running
```bash
# Check if server is listening
curl http://localhost:3000/health
# or whatever your health check endpoint is

# Check logs
pm2 logs server
# or
tail -f logs/server.log
```

### 7. Test Login
Try logging in at: http://69.62.70.102:your-port

If you see the login page and can authenticate, the fix is working!

## Troubleshooting

### Still getting crypto.randomUUID error?
1. Make sure you pulled the latest code
2. Run `npm install` to ensure uuid package is installed
3. Check Node.js version: `node --version`
4. Restart the server completely

### UUID package not found?
```bash
npm install uuid@13.0.0
```

### Server won't start?
Check logs for other errors:
```bash
pm2 logs server --lines 50
```

## Environment Variables

Make sure these are set in your `.env` file:
- `ORTHANC_URL=http://69.62.70.102:8042`
- `ORTHANC_USERNAME=orthanc`
- `ORTHANC_PASSWORD=orthanc_secure_2024`
- `WEBHOOK_SECRET=your_webhook_secret`
- Other required variables...

## Success Indicators

✅ Server starts without errors
✅ Login page loads
✅ Can authenticate successfully
✅ No "crypto.randomUUID is not a function" in logs
✅ Orthanc connection works
