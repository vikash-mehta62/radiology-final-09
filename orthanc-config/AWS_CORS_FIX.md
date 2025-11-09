# AWS Orthanc CORS Fix

## Summary

Your Orthanc is running on AWS at: `http://54.160.225.145:8042`

I've updated OHIF to point to this AWS server, but you need to add CORS headers to the AWS Orthanc configuration.

## What You Need to Do on AWS

### Step 1: Connect to AWS Server

**Option A - SSH:**
```bash
ssh -i your-key.pem ubuntu@54.160.225.145
```

**Option B - AWS Console:**
1. Go to AWS EC2 Console
2. Find your instance
3. Click "Connect"
4. Use "Session Manager" or "EC2 Instance Connect"

### Step 2: Find Orthanc Configuration

Once connected to the server, find the Orthanc config file:

```bash
# Common locations:
sudo find / -name "orthanc.json" 2>/dev/null

# Or check these specific paths:
ls /etc/orthanc/
ls /usr/local/etc/orthanc/
ls ~/orthanc/
```

### Step 3: Edit Configuration

```bash
# Edit the config file (use the path you found above)
sudo nano /etc/orthanc/orthanc.json

# Or use vim:
sudo vim /etc/orthanc/orthanc.json
```

### Step 4: Add CORS Headers

Find the line with `"HttpDescribeErrors"` and add this right after it:

```json
  "HttpDescribeErrors" : true,
  
  "HttpHeaders": {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-Requested-With"
  },
```

**IMPORTANT:** Make sure to include the comma after `true,` and after the closing `}`

### Step 5: Save the File

**If using nano:**
- Press `Ctrl + X`
- Press `Y` to confirm
- Press `Enter`

**If using vim:**
- Press `Esc`
- Type `:wq`
- Press `Enter`

### Step 6: Restart Orthanc

```bash
# If Orthanc is running as a service:
sudo systemctl restart orthanc

# Or:
sudo service orthanc restart

# If Orthanc is running in Docker:
docker restart orthanc

# Or find the container name:
docker ps | grep orthanc
docker restart <container-name>
```

### Step 7: Verify CORS Headers

From your local machine, test if CORS is working:

```powershell
# In PowerShell on your local machine:
$cred = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("orthanc:orthanc_secure_2024"))
$response = Invoke-WebRequest -Uri "http://54.160.225.145:8042/dicom-web/studies" -Headers @{Authorization="Basic $cred"} -Method GET -UseBasicParsing
$response.Headers['Access-Control-Allow-Origin']
```

Should output: `*`

### Step 8: Test OHIF

1. Refresh OHIF: http://localhost:3001
2. Press `Ctrl + F5` (hard refresh)
3. Studies should now load from AWS Orthanc!

## Alternative: Docker Compose Method

If Orthanc is running via Docker Compose:

### Step 1: Find docker-compose.yml

```bash
find / -name "docker-compose.yml" 2>/dev/null | grep orthanc
```

### Step 2: Check for Volume Mount

Look for a line like:
```yaml
volumes:
  - ./orthanc.json:/etc/orthanc/orthanc.json
```

### Step 3: Edit the Mounted Config

```bash
# Edit the config file on the host
sudo nano ./orthanc.json
```

Add CORS headers as described above.

### Step 4: Restart Container

```bash
docker-compose restart orthanc
```

## Troubleshooting

### If you can't find orthanc.json:

Check if Orthanc is using environment variables:

```bash
docker inspect orthanc | grep -i config
```

Or check the Orthanc logs:

```bash
docker logs orthanc | grep -i config
```

### If Orthanc won't start after changes:

You have a JSON syntax error. Restore the backup:

```bash
sudo cp /etc/orthanc/orthanc.json.backup /etc/orthanc/orthanc.json
sudo systemctl restart orthanc
```

### If CORS still doesn't work:

Check AWS Security Group:
1. Go to AWS EC2 Console
2. Select your instance
3. Click "Security" tab
4. Check "Security groups"
5. Ensure port 8042 is open for inbound traffic

## Quick Test Commands

```bash
# Check if Orthanc is running
sudo systemctl status orthanc

# Check Orthanc logs
sudo journalctl -u orthanc -f

# Or for Docker:
docker logs -f orthanc

# Test Orthanc is accessible
curl http://localhost:8042/system
```

## What I've Already Done Locally

✅ Updated OHIF config to point to: `http://54.160.225.145:8042`
✅ Added authentication: `orthanc:orthanc_secure_2024`
✅ OHIF is ready to connect

## What You Need to Do

❌ Add CORS headers to AWS Orthanc config
❌ Restart Orthanc on AWS
❌ Test OHIF

Once you add CORS headers on AWS and restart Orthanc, OHIF will work immediately!
