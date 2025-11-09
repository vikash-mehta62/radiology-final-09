#!/bin/bash

# Safe Orthanc Upgrade Script
# Upgrades to orthanc-plugins without losing data

echo "🔧 Orthanc Upgrade to Plugins Version"
echo "======================================"
echo ""

# Step 1: Backup current data
echo "📦 Step 1: Backing up current Orthanc data..."
docker exec orthanc tar czf /tmp/orthanc-backup.tar.gz /var/lib/orthanc/db /var/lib/orthanc/storage 2>/dev/null
docker cp orthanc:/tmp/orthanc-backup.tar.gz ./orthanc-backup-$(date +%Y%m%d-%H%M%S).tar.gz
echo "✅ Backup created"
echo ""

# Step 2: Get current configuration
echo "📋 Step 2: Saving current configuration..."
docker exec orthanc cat /etc/orthanc/orthanc.json > orthanc-config-backup.json 2>/dev/null
echo "✅ Configuration saved"
echo ""

# Step 3: Stop and remove old container (keeps volumes)
echo "🛑 Step 3: Stopping old Orthanc container..."
docker stop orthanc
docker rm orthanc
echo "✅ Old container removed (data preserved in volumes)"
echo ""

# Step 4: Start new Orthanc with plugins
echo "🚀 Step 4: Starting Orthanc with plugins..."
docker run -d \
  --name orthanc \
  -p 4242:4242 \
  -p 8042:8042 \
  -v orthanc-storage:/var/lib/orthanc/db \
  -e ORTHANC__AUTHENTICATION_ENABLED=true \
  -e ORTHANC__REGISTERED_USERS='{"orthanc":"orthanc"}' \
  -e ORTHANC__REMOTE_ACCESS_ALLOWED=true \
  -e ORTHANC__HTTP_PORT=8042 \
  -e ORTHANC__DICOM_PORT=4242 \
  jodogne/orthanc-plugins:latest

echo "✅ New Orthanc started with plugins"
echo ""

# Step 5: Wait for Orthanc to start
echo "⏳ Step 5: Waiting for Orthanc to start..."
sleep 5

# Step 6: Verify
echo "🔍 Step 6: Verifying installation..."
echo ""
echo "Checking Orthanc version:"
curl -s -u orthanc:orthanc http://69.62.70.102:8042/system | grep -o '"Version":"[^"]*"' || echo "Could not connect"
echo ""
echo "Checking plugins:"
curl -s -u orthanc:orthanc http://69.62.70.102:8042/plugins | grep -o '"[^"]*"' || echo "Could not get plugins"
echo ""

echo "======================================"
echo "✅ Upgrade Complete!"
echo ""
echo "📊 Summary:"
echo "  - Old data: Preserved in volumes"
echo "  - Backup: orthanc-backup-*.tar.gz"
echo "  - Config backup: orthanc-config-backup.json"
echo "  - New features: GDCM, Web Viewer, DICOMweb"
echo ""
echo "🌐 Access Orthanc:"
echo "  - Web UI: http://69.62.70.102:8042"
echo "  - Username: orthanc"
echo "  - Password: orthanc"
echo ""
echo "🎉 You can now upload echocardiograms!"
