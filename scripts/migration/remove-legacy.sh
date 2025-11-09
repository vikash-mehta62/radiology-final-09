#!/bin/bash
# Legacy Reporting Cleanup Script
# Identifies and optionally removes legacy reporting components

set -e

echo "=========================================="
echo "Legacy Reporting Cleanup"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Configuration
VIEWER_DIR="viewer/src"
LEGACY_PATTERNS=(
  "LegacyReportEditor"
  "OldReporting"
  "ReportingV1"
  "ClassicReport"
)

# Track findings
LEGACY_FOUND=0
DRY_RUN=true

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --execute)
      DRY_RUN=false
      shift
      ;;
    --help)
      echo "Usage: $0 [--execute]"
      echo ""
      echo "Options:"
      echo "  --execute    Actually remove legacy files (default: dry run)"
      echo "  --help       Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}Running in DRY RUN mode (no files will be deleted)${NC}"
  echo "Use --execute to actually remove files"
  echo ""
fi

# 1. Search for legacy component imports
echo "1. Searching for legacy component imports..."
echo "----------------------------------------"

for pattern in "${LEGACY_PATTERNS[@]}"; do
  echo "Searching for: $pattern"
  
  if grep -r "import.*$pattern" "$VIEWER_DIR" --exclude-dir=node_modules --exclude-dir=dist 2>/dev/null; then
    echo -e "${RED}✗ Found imports of $pattern${NC}"
    LEGACY_FOUND=$((LEGACY_FOUND + 1))
  else
    echo -e "${GREEN}✓ No imports of $pattern found${NC}"
  fi
done

echo ""

# 2. Search for legacy component files
echo "2. Searching for legacy component files..."
echo "----------------------------------------"

LEGACY_FILES=()

for pattern in "${LEGACY_PATTERNS[@]}"; do
  while IFS= read -r file; do
    if [ -n "$file" ]; then
      echo -e "${YELLOW}Found legacy file: $file${NC}"
      LEGACY_FILES+=("$file")
      LEGACY_FOUND=$((LEGACY_FOUND + 1))
    fi
  done < <(find "$VIEWER_DIR" -type f -name "*$pattern*" 2>/dev/null)
done

if [ ${#LEGACY_FILES[@]} -eq 0 ]; then
  echo -e "${GREEN}✓ No legacy files found${NC}"
fi

echo ""

# 3. Search for legacy routes
echo "3. Searching for legacy routes..."
echo "----------------------------------------"

if grep -r "path.*legacy\|route.*old" "$VIEWER_DIR" --exclude-dir=node_modules --exclude-dir=dist 2>/dev/null; then
  echo -e "${YELLOW}⚠ Found potential legacy routes${NC}"
  LEGACY_FOUND=$((LEGACY_FOUND + 1))
else
  echo -e "${GREEN}✓ No legacy routes found${NC}"
fi

echo ""

# 4. Check feature flags
echo "4. Checking feature flags..."
echo "----------------------------------------"

if grep -q "REPORTING_UNIFIED_ONLY.*true" "$VIEWER_DIR/config/flags.ts" 2>/dev/null; then
  echo -e "${GREEN}✓ REPORTING_UNIFIED_ONLY is enabled${NC}"
elif grep -q "REPORTING_LEGACY_KILL_DATE" "$VIEWER_DIR/config/flags.ts" 2>/dev/null; then
  KILL_DATE=$(grep "REPORTING_LEGACY_KILL_DATE" "$VIEWER_DIR/config/flags.ts" | grep -o "'[^']*'" | tr -d "'")
  if [ -n "$KILL_DATE" ]; then
    echo -e "${YELLOW}⚠ Legacy kill date set to: $KILL_DATE${NC}"
  else
    echo -e "${YELLOW}⚠ Legacy kill date not set${NC}"
  fi
else
  echo -e "${YELLOW}⚠ Legacy reporting may still be active${NC}"
fi

echo ""

# 5. Check for adapter/bridge code
echo "5. Checking for adapter/bridge code..."
echo "----------------------------------------"

if grep -r "LegacyAdapter\|ReportingBridge" "$VIEWER_DIR" --exclude-dir=node_modules --exclude-dir=dist 2>/dev/null; then
  echo -e "${YELLOW}⚠ Found adapter/bridge code (keep until kill date)${NC}"
else
  echo -e "${GREEN}✓ No adapter code found${NC}"
fi

echo ""

# 6. Summary
echo "=========================================="
echo "Summary"
echo "=========================================="

if [ $LEGACY_FOUND -eq 0 ]; then
  echo -e "${GREEN}✓ No legacy code found - migration complete!${NC}"
  exit 0
else
  echo -e "${YELLOW}Found $LEGACY_FOUND legacy references${NC}"
  echo ""
  
  if [ ${#LEGACY_FILES[@]} -gt 0 ]; then
    echo "Legacy files to remove:"
    for file in "${LEGACY_FILES[@]}"; do
      echo "  - $file"
    done
    echo ""
  fi
  
  if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}This was a dry run. Use --execute to remove files.${NC}"
    exit 1
  else
    echo -e "${RED}Removing legacy files...${NC}"
    
    for file in "${LEGACY_FILES[@]}"; do
      echo "Removing: $file"
      rm "$file"
    done
    
    echo -e "${GREEN}✓ Legacy files removed${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Run tests: npm run test"
    echo "2. Check for broken imports"
    echo "3. Update documentation"
    echo "4. Commit changes"
    
    exit 0
  fi
fi
