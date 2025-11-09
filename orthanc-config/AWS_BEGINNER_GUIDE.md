# AWS Orthanc CORS Fix - Complete Beginner's Guide

## Your Situation

- **Orthanc Server**: Running on AWS at `54.160.225.145:8042`
- **Problem**: OHIF can't connect because CORS headers are missing
- **Solution**: Add 5 lines to Orthanc config file on AWS server

---

## Method 1: Using AWS Console (Easiest - No SSH Key Needed)

### Step 1: Open AWS Console

1. Open your web browser
2. Go to: https://console.aws.amazon.com/
3. Sign in with your AWS account

### Step 2: Find Your EC2 Instance

1. In the search bar at top, type: **EC2**
2. Click on **EC2** (Virtual Servers in the Cloud)
3. In the left sidebar, click **Instances**
4. Look for an instance with IP: **54.160.225.145**
5. Click the checkbox next to it

### Step 3: Connect to Instance

1. Click the **Connect** button at the top
2. You'll see 4 tabs - choose **EC2 Instance Connect**
3. Click the orange **Connect** button
4. A new browser tab will open with a black terminal window

**You're now connected to your AWS server!** 🎉

### Step 4: Find Orthanc Config File

In the black terminal window, type this command and press Enter:

```bash
sudo find / -name "orthanc.json" 2>/dev/null
```

**Wait 10-30 seconds.** It will show you the path to the config file.

**Common paths you might see:**
- `/etc/orthanc/orthanc.json`
- `/usr/local/etc/orthanc/orthanc.json`
- `/home/ubuntu/orthanc/orthanc.json`

**Write down the path you see!**

### Step 5: Create a Backup

Replace `/etc/orthanc/orthanc.json` with YOUR path from Step 4:

```bash
sudo cp /etc/orthanc/orthanc.json /etc/orthanc/orthanc.json.backup
```

Press Enter. This creates a backup in case something goes wrong.

### Step 6: Edit the Config File

Replace `/etc/orthanc/orthanc.json` with YOUR path:

```bash
sudo nano /etc/orthanc/orthanc.json
```

Press Enter. You'll see the config file open in a text editor.

### Step 7: Find the Right Spot

1. Press `Ctrl + W` (this opens search)
2. Type: `HttpDescribeErrors`
3. Press Enter

You'll see a line like:
```json
"HttpDescribeErrors" : true,
```

### Step 8: Add CORS Headers

1. Use arrow keys to move cursor to the END of the line with `"HttpDescribeErrors" : true,`
2. Press `Enter` twice to create blank lines
3. Type EXACTLY this (or copy-paste):

```json
  "HttpHeaders": {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-Requested-With"
  },
```

**IMPORTANT:** 
- Make sure there's a comma after `true,`
- Make sure there's a comma after the closing `}`
- Spacing matters in JSON!

### Step 9: Save the File

1. Press `Ctrl + X` (to exit)
2. Press `Y` (to confirm save)
3. Press `Enter` (to confirm filename)

**File saved!** ✅

### Step 10: Restart Orthanc

Type this command and press Enter:

```bash
sudo systemctl restart orthanc
```

Wait 5 seconds, then check if it's running:

```bash
sudo systemctl status orthanc
```

You should see **"active (running)"** in green.

Press `Q` to exit the status view.

### Step 11: Test OHIF

1. Go back to your computer
2. Open OHIF: http://localhost:3001
3. Press `Ctrl + F5` (hard refresh)
4. **Studies should now load!** 🎉

---

## Method 2: Using SSH (If You Have a .pem Key File)

### Step 1: Find Your SSH Key

Do you have a file that ends with `.pem`? 

Common locations:
- Downloads folder
- Desktop
- Documents folder

**Example:** `my-aws-key.pem`

### Step 2: Open PowerShell

1. Press `Win + X`
2. Select **Windows PowerShell** or **Terminal**

### Step 3: Navigate to Key Location

If your key is in Downloads:
```powershell
cd Downloads
```

If it's on Desktop:
```powershell
cd Desktop
```

### Step 4: Connect to AWS

Replace `my-key.pem` with YOUR key filename:

```powershell
ssh -i my-key.pem ubuntu@54.160.225.145
```

**If you get an error about permissions:**
```powershell
icacls my-key.pem /inheritance:r
icacls my-key.pem /grant:r "$($env:USERNAME):(R)"
```

Then try the ssh command again.

**If it asks "Are you sure you want to continue connecting?"**
- Type: `yes`
- Press Enter

**You're now connected!** 🎉

### Step 5-11: Follow Same Steps as Method 1

Continue from Step 4 in Method 1 above.

---

## Method 3: Ask Your AWS Administrator

If you don't have access to AWS:

### What to Tell Them:

"Hi, I need to add CORS headers to the Orthanc configuration on the AWS server at 54.160.225.145.

Please add these lines to `/etc/orthanc/orthanc.json` right after the line with `"HttpDescribeErrors" : true,`:

```json
  "HttpHeaders": {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-Requested-With"
  },
```

Then restart Orthanc with: `sudo systemctl restart orthanc`

This is needed for OHIF viewer to connect to Orthanc."

---

## Troubleshooting

### "Permission denied" error
- Make sure you're using `sudo` before commands
- Example: `sudo nano /etc/orthanc/orthanc.json`

### "Command not found: nano"
- Try using `vi` instead:
  ```bash
  sudo vi /etc/orthanc/orthanc.json
  ```
- Press `i` to enter insert mode
- Make your changes
- Press `Esc`
- Type `:wq` and press Enter

### Orthanc won't start after changes
- You have a JSON syntax error
- Restore backup:
  ```bash
  sudo cp /etc/orthanc/orthanc.json.backup /etc/orthanc/orthanc.json
  sudo systemctl restart orthanc
  ```
- Try again more carefully

### Can't find orthanc.json
- Check if Orthanc is running in Docker:
  ```bash
  docker ps | grep orthanc
  ```
- If yes, you need to edit the Docker config instead

### Still stuck?
- Take a screenshot of the error
- Note which step you're on
- Ask for help with the specific error message

---

## Quick Reference Commands

```bash
# Find config file
sudo find / -name "orthanc.json" 2>/dev/null

# Edit config
sudo nano /etc/orthanc/orthanc.json

# Restart Orthanc
sudo systemctl restart orthanc

# Check if running
sudo systemctl status orthanc

# View logs
sudo journalctl -u orthanc -n 50

# Exit SSH
exit
```

---

## What Happens After You Fix This?

1. ✅ OHIF will connect to AWS Orthanc
2. ✅ Studies will load in OHIF
3. ✅ "OHIF Pro" button will work from your viewer
4. ✅ Complete integration achieved!

---

## Need Help?

**Tell me:**
1. Which method are you trying? (Console, SSH, or Administrator)
2. What step are you on?
3. What error message do you see (if any)?

I'll guide you through it!
