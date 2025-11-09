#!/bin/bash

###############################################################################
# AW 4.6 DICOM File Watcher Setup Script
# 
# This script sets up automatic DICOM file monitoring on GE AW 4.6 server
# and sends files to remote Orthanc server
#
# Usage: sudo bash setup-aw-watcher.sh
###############################################################################

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏥 AW 4.6 DICOM Watcher Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root (sudo)"
    exit 1
fi

# Configuration
ORTHANC_URL="http://69.62.70.102:8042"
ORTHANC_USER="orthanc"
ORTHANC_PASS="orthanc_secure_2024"

# Prompt for DICOM directory
echo "📁 Enter the DICOM storage directory on this AW server:"
echo "   Common locations:"
echo "   - /data/dicom/studies"
echo "   - /opt/ge/aw/data"
echo "   - /var/ge/dicom"
echo ""
read -p "DICOM Directory: " WATCH_DIR

# Validate directory
if [ ! -d "$WATCH_DIR" ]; then
    echo "❌ Directory not found: $WATCH_DIR"
    exit 1
fi

echo ""
echo "✅ Using directory: $WATCH_DIR"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
if command -v yum &> /dev/null; then
    yum install -y inotify-tools curl
elif command -v apt-get &> /dev/null; then
    apt-get update
    apt-get install -y inotify-tools curl
else
    echo "❌ Package manager not found. Please install inotify-tools and curl manually."
    exit 1
fi

echo "✅ Dependencies installed"
echo ""

# Create directories
echo "📁 Creating directories..."
mkdir -p /opt/dicom-watcher
mkdir -p /var/log/dicom-watcher

# Create watcher script
echo "📝 Creating watcher script..."
cat > /opt/dicom-watcher/watch-and-send.sh << EOF
#!/bin/bash

###############################################################################
# DICOM File Watcher
# Monitors: $WATCH_DIR
# Sends to: $ORTHANC_URL
###############################################################################

WATCH_DIR="$WATCH_DIR"
ORTHANC_URL="$ORTHANC_URL"
ORTHANC_USER="$ORTHANC_USER"
ORTHANC_PASS="$ORTHANC_PASS"
PROCESSED_LOG="/var/log/dicom-watcher/processed.log"
ERROR_LOG="/var/log/dicom-watcher/errors.log"

# Create log files
touch "\$PROCESSED_LOG"
touch "\$ERROR_LOG"

echo "[$(date)] DICOM Watcher started - Monitoring: \$WATCH_DIR"

# Function to send DICOM file to Orthanc
send_to_orthanc() {
    local file="\$1"
    local filename=\$(basename "\$file")
    
    echo "[$(date)] 📤 Processing: \$filename"
    
    # Wait to ensure file is completely written
    sleep 2
    
    # Send to Orthanc
    http_code=\$(curl -s -u "\$ORTHANC_USER:\$ORTHANC_PASS" \\
        -X POST "\$ORTHANC_URL/instances" \\
        --data-binary "@\$file" \\
        -w "%{http_code}" \\
        -o /dev/null)
    
    if [ "\$http_code" = "200" ]; then
        echo "[$(date)] ✅ Sent: \$filename" >> "\$PROCESSED_LOG"
        echo "[$(date)] ✅ Success: \$filename"
    else
        echo "[$(date)] ❌ Failed: \$filename (HTTP \$http_code)" >> "\$ERROR_LOG"
        echo "[$(date)] ❌ Failed: \$filename (HTTP \$http_code)"
    fi
}

# Watch for new DICOM files
inotifywait -m -r -e close_write,moved_to --format '%w%f' "\$WATCH_DIR" | while read file
do
    # Check if it's a DICOM file (by extension or content)
    if [[ "\$file" == *.dcm ]] || [[ "\$file" == *.DCM ]] || file "\$file" | grep -q "DICOM"; then
        send_to_orthanc "\$file"
    fi
done
EOF

chmod +x /opt/dicom-watcher/watch-and-send.sh

echo "✅ Watcher script created"
echo ""

# Create systemd service
echo "📝 Creating systemd service..."
cat > /etc/systemd/system/dicom-watcher.service << EOF
[Unit]
Description=DICOM File Watcher for AW 4.6
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/dicom-watcher
ExecStart=/opt/dicom-watcher/watch-and-send.sh
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

echo "✅ Systemd service created"
echo ""

# Reload systemd
echo "🔄 Reloading systemd..."
systemctl daemon-reload

# Enable service
echo "✅ Enabling service..."
systemctl enable dicom-watcher

# Test Orthanc connection
echo ""
echo "🔍 Testing Orthanc connection..."
if curl -s -u "$ORTHANC_USER:$ORTHANC_PASS" "$ORTHANC_URL/system" > /dev/null; then
    echo "✅ Orthanc connection successful"
else
    echo "⚠️  Warning: Could not connect to Orthanc"
    echo "   Please check network connectivity and credentials"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Configuration:"
echo "   Watch Directory: $WATCH_DIR"
echo "   Orthanc URL: $ORTHANC_URL"
echo "   Service: dicom-watcher"
echo ""
echo "🚀 To start the watcher:"
echo "   systemctl start dicom-watcher"
echo ""
echo "📊 To check status:"
echo "   systemctl status dicom-watcher"
echo ""
echo "📝 To view logs:"
echo "   journalctl -u dicom-watcher -f"
echo "   tail -f /var/log/dicom-watcher/processed.log"
echo "   tail -f /var/log/dicom-watcher/errors.log"
echo ""
echo "🛑 To stop the watcher:"
echo "   systemctl stop dicom-watcher"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Ask if user wants to start now
read -p "Start the watcher now? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    systemctl start dicom-watcher
    echo ""
    echo "✅ Watcher started!"
    echo ""
    echo "📊 Checking status..."
    sleep 2
    systemctl status dicom-watcher --no-pager
    echo ""
    echo "📝 Live logs (Ctrl+C to exit):"
    echo ""
    journalctl -u dicom-watcher -f
fi
