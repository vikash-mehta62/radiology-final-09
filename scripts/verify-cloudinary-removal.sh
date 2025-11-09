#!/bin/bash

# Cloudinary Removal Verification Script
# Checks that Cloudinary has been completely removed from the application

echo "🔍 Verifying Cloudinary Removal..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Check 1: Cloudinary in package.json
echo "1️⃣  Checking package.json..."
if grep -q "cloudinary" server/package.json 2>/dev/null; then
    echo -e "${RED}❌ FAIL: Cloudinary found in server/package.json${NC}"
    ((ERRORS++))
else
    echo -e "${GREEN}✅ PASS: Cloudinary not in package.json${NC}"
fi
echo ""

# Check 2: Cloudinary config file
echo "2️⃣  Checking for cloudinary.js config file..."
if [ -f "server/src/config/cloudinary.js" ]; then
    echo -e "${RED}❌ FAIL: cloudinary.js config file still exists${NC}"
    ((ERRORS++))
else
    echo -e "${GREEN}✅ PASS: cloudinary.js config file removed${NC}"
fi
echo ""

# Check 3: Cloudinary imports in source code
echo "3️⃣  Checking for Cloudinary imports..."
CLOUDINARY_IMPORTS=$(grep -r "require.*cloudinary" server/src/ --exclude-dir=node_modules 2>/dev/null | grep -v "zip-dicom-service.js" | wc -l)
if [ "$CLOUDINARY_IMPORTS" -gt 0 ]; then
    echo -e "${RED}❌ FAIL: Found $CLOUDINARY_IMPORTS Cloudinary imports${NC}"
    grep -r "require.*cloudinary" server/src/ --exclude-dir=node_modules | grep -v "zip-dicom-service.js"
    ((ERRORS++))
else
    echo -e "${GREEN}✅ PASS: No Cloudinary imports found${NC}"
fi
echo ""

# Check 4: Cloudinary environment variables
echo "4️⃣  Checking .env.example..."
if grep -q "CLOUDINARY_CLOUD_NAME=" server/.env.example 2>/dev/null; then
    if grep -q "# Cloudinary removed" server/.env.example 2>/dev/null; then
        echo -e "${GREEN}✅ PASS: Cloudinary variables commented out${NC}"
    else
        echo -e "${YELLOW}⚠️  WARNING: Cloudinary variables still in .env.example${NC}"
        ((WARNINGS++))
    fi
else
    echo -e "${GREEN}✅ PASS: No Cloudinary variables in .env.example${NC}"
fi
echo ""

# Check 5: Cloudinary in node_modules
echo "5️⃣  Checking node_modules..."
if [ -d "server/node_modules/cloudinary" ]; then
    echo -e "${RED}❌ FAIL: Cloudinary still in node_modules${NC}"
    echo "   Run: cd server && npm uninstall cloudinary"
    ((ERRORS++))
else
    echo -e "${GREEN}✅ PASS: Cloudinary not in node_modules${NC}"
fi
echo ""

# Check 6: Cloudinary API calls
echo "6️⃣  Checking for Cloudinary API calls..."
CLOUDINARY_CALLS=$(grep -r "cloudinary\\.uploader" server/src/ --exclude-dir=node_modules 2>/dev/null | grep -v "zip-dicom-service.js" | wc -l)
if [ "$CLOUDINARY_CALLS" -gt 0 ]; then
    echo -e "${RED}❌ FAIL: Found $CLOUDINARY_CALLS Cloudinary API calls${NC}"
    grep -r "cloudinary\\.uploader" server/src/ --exclude-dir=node_modules | grep -v "zip-dicom-service.js"
    ((ERRORS++))
else
    echo -e "${GREEN}✅ PASS: No Cloudinary API calls found${NC}"
fi
echo ""

# Check 7: Filesystem directories exist
echo "7️⃣  Checking filesystem directories..."
if [ ! -d "server/backend" ]; then
    echo -e "${YELLOW}⚠️  WARNING: server/backend directory doesn't exist${NC}"
    echo "   Creating directory..."
    mkdir -p server/backend/signatures
    ((WARNINGS++))
else
    echo -e "${GREEN}✅ PASS: server/backend directory exists${NC}"
fi
echo ""

# Check 8: Deprecated services marked
echo "8️⃣  Checking deprecated services..."
if grep -q "DEPRECATED" server/src/services/zip-dicom-service.js 2>/dev/null; then
    echo -e "${GREEN}✅ PASS: zip-dicom-service.js marked as deprecated${NC}"
else
    echo -e "${YELLOW}⚠️  WARNING: zip-dicom-service.js not marked as deprecated${NC}"
    ((WARNINGS++))
fi
echo ""

# Check 9: Signature controller updated
echo "9️⃣  Checking signature controller..."
if grep -q "filesystem" server/src/controllers/signatureController.js 2>/dev/null; then
    echo -e "${GREEN}✅ PASS: Signature controller uses filesystem${NC}"
else
    echo -e "${RED}❌ FAIL: Signature controller not updated${NC}"
    ((ERRORS++))
fi
echo ""

# Check 10: Documentation updated
echo "🔟 Checking documentation..."
if [ -f "CLOUDINARY-REMOVAL-SUMMARY.md" ]; then
    echo -e "${GREEN}✅ PASS: Cloudinary removal documentation exists${NC}"
else
    echo -e "${YELLOW}⚠️  WARNING: Cloudinary removal documentation missing${NC}"
    ((WARNINGS++))
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Verification Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ ALL CHECKS PASSED!${NC}"
    echo ""
    echo "Cloudinary has been successfully removed from the application."
    echo ""
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  $WARNINGS WARNING(S)${NC}"
    echo ""
    echo "Cloudinary removal is mostly complete, but there are some warnings."
    echo "Review the warnings above and address them if needed."
    echo ""
    exit 0
else
    echo -e "${RED}❌ $ERRORS ERROR(S), $WARNINGS WARNING(S)${NC}"
    echo ""
    echo "Cloudinary removal is incomplete. Please fix the errors above."
    echo ""
    exit 1
fi
