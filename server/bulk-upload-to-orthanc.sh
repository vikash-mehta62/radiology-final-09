#!/bin/bash
#
# Bulk Upload DICOM files to Orthanc
# This script finds all DICOM files and uploads them to Orthanc PACS
#

ORTHANC_URL="http://69.62.70.102:8042"
ORTHANC_USER="orthanc"
ORTHANC_PASS="orthanc_secure_2024"
DICOM_DIR="/app/server/backend/uploaded_studies"

echo "🔄 Starting bulk DICOM upload to Orthanc..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Find all DICOM files
DICOM_FILES=$(find "$DICOM_DIR" -name "*.dcm" -o -name "*.dicom")
TOTAL_FILES=$(echo "$DICOM_FILES" | wc -l)

echo "📊 Found $TOTAL_FILES DICOM files"
echo ""

SUCCESS=0
FAILED=0
DUPLICATE=0

# Upload each DICOM file
for DICOM_FILE in $DICOM_FILES; do
    FILENAME=$(basename "$DICOM_FILE")
    echo -n "📤 Uploading: $FILENAME ... "
    
    # Upload to Orthanc
    RESPONSE=$(curl -s -u "$ORTHANC_USER:$ORTHANC_PASS" \
        -X POST "$ORTHANC_URL/instances" \
        --data-binary "@$DICOM_FILE" \
        -w "\n%{http_code}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        ORTHANC_ID=$(echo "$RESPONSE" | head -n -1 | grep -o '"ID":"[^"]*"' | cut -d'"' -f4)
        echo "✅ Success (ID: ${ORTHANC_ID:0:12}...)"
        SUCCESS=$((SUCCESS + 1))
    elif [ "$HTTP_CODE" = "409" ]; then
        echo "⏭️  Already exists (duplicate)"
        DUPLICATE=$((DUPLICATE + 1))
    else
        echo "❌ Failed (HTTP $HTTP_CODE)"
        FAILED=$((FAILED + 1))
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏁 Upload Summary:"
echo "  ✅ Success: $SUCCESS"
echo "  ⏭️  Duplicates: $DUPLICATE"
echo "  ❌ Failed: $FAILED"
echo "  📊 Total: $TOTAL_FILES"
echo ""

# Show Orthanc statistics
echo "📊 Orthanc Statistics:"
STATS=$(curl -s -u "$ORTHANC_USER:$ORTHANC_PASS" "$ORTHANC_URL/statistics")
echo "$STATS" | grep -E 'TotalDiskSize|CountStudies|CountSeries|CountInstances' | \
    sed 's/[",]//g' | sed 's/^/  /'
echo ""

echo "✅ Bulk upload complete!"
echo ""
echo "Next step: Run sync script to update MongoDB"
echo "  cd /app/server && node sync-orthanc-to-mongodb.js"
