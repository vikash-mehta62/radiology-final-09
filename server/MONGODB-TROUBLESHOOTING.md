# MongoDB Connection Troubleshooting Guide

## Issue: ZIP Upload Returns 500 Error

If you're getting a 500 Internal Server Error when uploading ZIP files, it's likely due to MongoDB connection issues.

## Quick Fix

### 1. Check Your .env File

Open `node-server/.env` and verify your MongoDB URI:

```env
MONGODB_URI=mongodb+srv://mahitechnocrats:qNfbRMgnCthyu59@cluster1.xqa5iyj.mongodb.net/radiology-final
```

### 2. Verify MongoDB Atlas Settings

#### A. Check Cluster Status
1. Log in to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Navigate to your cluster: `cluster1.xqa5iyj.mongodb.net`
3. Ensure the cluster is **running** (not paused)

#### B. Check Network Access
1. In MongoDB Atlas, go to **Network Access**
2. Ensure your IP address is whitelisted
3. Options:
   - Add your current IP address
   - Or allow access from anywhere: `0.0.0.0/0` (not recommended for production)

#### C. Verify Database User
1. Go to **Database Access** in MongoDB Atlas
2. Verify user `mahitechnocrats` exists
3. Ensure the user has **Read and Write** permissions
4. Check the password is correct: `qNfbRMgnCthyu59`

### 3. Test MongoDB Connection

Run this command to test the connection:

```bash
cd node-server
node -e "const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://mahitechnocrats:qNfbRMgnCthyu59@cluster1.xqa5iyj.mongodb.net/radiology-final').then(() => { console.log('✅ Connected!'); process.exit(0); }).catch(err => { console.error('❌ Failed:', err.message); process.exit(1); });"
```

### 4. Restart the Server

After fixing the connection:

```bash
# Stop the server (Ctrl+C)
# Start it again
npm start
```

## Common Error Messages

### Error: "ENOTFOUND"
**Cause:** DNS lookup failed - MongoDB host not found

**Solution:**
- Check your internet connection
- Verify the MongoDB URI is correct
- Ensure no typos in the cluster address

### Error: "ETIMEDOUT"
**Cause:** Connection timed out

**Solution:**
- Check your firewall settings
- Verify network access in MongoDB Atlas
- Ensure your IP is whitelisted

### Error: "Authentication failed" or "bad auth"
**Cause:** Invalid credentials

**Solution:**
- Verify username and password in MONGODB_URI
- Check Database Access settings in MongoDB Atlas
- Ensure the user has proper permissions

### Error: "MongoServerSelectionError"
**Cause:** Cannot connect to MongoDB cluster

**Solution:**
- Verify cluster is running (not paused)
- Check network access settings
- Ensure correct connection string format

## Server Behavior Without MongoDB

The server is designed to work without MongoDB:

✅ **What Still Works:**
- ZIP file upload and extraction
- DICOM file parsing
- Frame generation
- Files saved to filesystem
- Viewing uploaded studies via filesystem

❌ **What Doesn't Work:**
- Database queries for studies
- Study metadata search
- Patient records
- Series information queries

## Viewing Uploaded Files Without MongoDB

Even without MongoDB, you can still access uploaded files:

### Study Files Location
```
node-server/backend/uploaded_studies/{StudyInstanceUID}/
```

### Frame Images Location
```
node-server/backend/uploaded_frames_{StudyInstanceUID}/
```

### Access Frames via API
```
GET /api/dicom/studies/{StudyInstanceUID}/frames/{frameIndex}
```

This endpoint reads directly from the filesystem and doesn't require MongoDB.

## Checking MongoDB Connection Status

### In Server Logs

Look for these messages when starting the server:

**✅ Success:**
```
MongoDB connection attempt 1/3...
✅ MongoDB connected successfully
   Database: radiology-final
   Host: cluster1-shard-00-00.xqa5iyj.mongodb.net
```

**❌ Failure:**
```
❌ MongoDB connection attempt 1/3 failed: ...
   → [Helpful error message]
   Retrying in 2 seconds...
```

### Programmatically

```javascript
const mongoose = require('mongoose');

// Check connection state
const states = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting'
};

console.log('MongoDB state:', states[mongoose.connection.readyState]);
```

## Production Recommendations

### 1. Use Environment Variables
Never hardcode credentials in code. Always use `.env` file:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
```

### 2. Secure Network Access
- Don't use `0.0.0.0/0` in production
- Whitelist specific IP addresses
- Use VPC peering for AWS/GCP deployments

### 3. Enable Monitoring
- Set up MongoDB Atlas alerts
- Monitor connection pool metrics
- Track slow queries

### 4. Implement Retry Logic
The server already implements retry logic with exponential backoff:
- Attempt 1: Immediate
- Attempt 2: After 2 seconds
- Attempt 3: After 4 seconds

### 5. Graceful Degradation
The server continues to work without MongoDB:
- Files are saved to filesystem
- Frames can be accessed
- Error messages guide users

## Testing MongoDB Connection

### Test Script

Create `test-mongo.js`:

```javascript
require('dotenv').config();
const mongoose = require('mongoose');

async function testConnection() {
  try {
    console.log('Testing MongoDB connection...');
    console.log('URI:', process.env.MONGODB_URI.replace(/:([^:@]+)@/, ':****@'));
    
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    
    console.log('✅ Connected successfully!');
    console.log('Database:', mongoose.connection.name);
    console.log('Host:', mongoose.connection.host);
    
    // Test a simple query
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name).join(', '));
    
    await mongoose.disconnect();
    console.log('✅ Test complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
```

Run it:
```bash
node test-mongo.js
```

## Getting Help

If you're still having issues:

1. **Check Server Logs**
   - Look for detailed error messages
   - Note the connection state

2. **Verify MongoDB Atlas**
   - Cluster status
   - Network access
   - Database user permissions

3. **Test Connection**
   - Use the test script above
   - Try connecting with MongoDB Compass

4. **Contact Support**
   - MongoDB Atlas support
   - Check MongoDB community forums

## Additional Resources

- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [Mongoose Connection Guide](https://mongoosejs.com/docs/connections.html)
- [MongoDB Connection String Format](https://docs.mongodb.com/manual/reference/connection-string/)
- [Network Access Configuration](https://docs.atlas.mongodb.com/security/ip-access-list/)

---

**Last Updated:** 2025-10-13
