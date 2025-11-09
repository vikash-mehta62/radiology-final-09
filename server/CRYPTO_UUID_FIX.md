# crypto.randomUUID() Compatibility Fix

## Problem
When deploying to VPS with older Node.js versions, the application crashed with:
```
crypto.randomUUID is not a function
```

This is because `crypto.randomUUID()` was only added in Node.js v14.17.0.

## Solution
Replaced `crypto.randomUUID()` with the `uuid` library (already in dependencies).

## Changes Made

### 1. Updated `server/src/utils/crypto-polyfill.js`
- Now uses `uuid` library's `v4()` function
- Works on all Node.js versions (10+)
- Generates RFC 4122 compliant UUID v4

### 2. Updated Files Using UUID Generation
- `server/src/utils/audit-logger.js` - Uses `randomUUID()` from polyfill
- `server/src/middleware/webhookSecurity.js` - Uses `randomUUID()` from polyfill

### 3. Updated `server/package.json`
- Added `engines` field specifying Node.js >= 12.0.0

## Testing

Test the fix locally:
```bash
node -e "const { randomUUID } = require('./server/src/utils/crypto-polyfill'); console.log(randomUUID());"
```

Expected output: A valid UUID like `550e8400-e29b-41d4-a716-446655440000`

## Deployment

After deploying to your VPS:

1. Pull the latest code
2. Install dependencies: `npm install`
3. Restart the server: `pm2 restart server` or `systemctl restart your-service`

The application will now work on older Node.js versions without the `crypto.randomUUID is not a function` error.

## Dependencies
- `uuid` package (v13.0.0) - Already in package.json
- No additional installation required
