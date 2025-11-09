#!/bin/bash
# Feature Flag Toggle Script for Unified Reporting
# Usage:
#   ./scripts/flags/toggle-reporting.sh --unified-only on|off
#   ./scripts/flags/toggle-reporting.sh --percent 0|10|25|50|100

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
FLAGS_FILE="viewer/public/flags.json"
BACKUP_DIR="viewer/public/.flags-backup"

# Ensure flags file exists
if [ ! -f "$FLAGS_FILE" ]; then
    mkdir -p "$(dirname "$FLAGS_FILE")"
    echo '{}' > "$FLAGS_FILE"
fi

# Backup current flags
mkdir -p "$BACKUP_DIR"
cp "$FLAGS_FILE" "$BACKUP_DIR/flags-$(date +%Y%m%d-%H%M%S).json"

# Parse arguments
ACTION=""
VALUE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --unified-only)
            ACTION="unified-only"
            VALUE="$2"
            shift 2
            ;;
        --percent)
            ACTION="percent"
            VALUE="$2"
            shift 2
            ;;
        --status)
            ACTION="status"
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --unified-only on|off    Enable/disable unified-only mode"
            echo "  --percent 0|10|25|50|100 Set rollout percentage"
            echo "  --status                 Show current flag status"
            echo "  --help                   Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Read current flags
CURRENT_FLAGS=$(cat "$FLAGS_FILE")

# Execute action
case $ACTION in
    unified-only)
        if [ "$VALUE" != "on" ] && [ "$VALUE" != "off" ]; then
            echo -e "${RED}Error: --unified-only requires 'on' or 'off'${NC}"
            exit 1
        fi
        
        ENABLED="false"
        if [ "$VALUE" = "on" ]; then
            ENABLED="true"
        fi
        
        echo -e "${YELLOW}Setting REPORTING_UNIFIED_ONLY to $ENABLED...${NC}"
        
        # Update flags file
        echo "$CURRENT_FLAGS" | jq ".REPORTING_UNIFIED_ONLY = $ENABLED" > "$FLAGS_FILE"
        
        echo -e "${GREEN}✓ Updated successfully${NC}"
        ;;
        
    percent)
        if ! [[ "$VALUE" =~ ^(0|10|25|50|100)$ ]]; then
            echo -e "${RED}Error: --percent requires 0, 10, 25, 50, or 100${NC}"
            exit 1
        fi
        
        echo -e "${YELLOW}Setting REPORTING_UNIFIED_PERCENT to $VALUE%...${NC}"
        
        # Update flags file
        echo "$CURRENT_FLAGS" | jq ".REPORTING_UNIFIED_PERCENT = $VALUE" > "$FLAGS_FILE"
        
        echo -e "${GREEN}✓ Updated successfully${NC}"
        ;;
        
    status|*)
        # Show current status (default action)
        ;;
esac

# Always show current status
echo ""
echo "=========================================="
echo "Current Feature Flags"
echo "=========================================="

if [ -f "$FLAGS_FILE" ]; then
    cat "$FLAGS_FILE" | jq '.'
    
    echo ""
    echo "Summary:"
    
    UNIFIED_ONLY=$(cat "$FLAGS_FILE" | jq -r '.REPORTING_UNIFIED_ONLY // false')
    PERCENT=$(cat "$FLAGS_FILE" | jq -r '.REPORTING_UNIFIED_PERCENT // 0')
    
    if [ "$UNIFIED_ONLY" = "true" ]; then
        echo -e "  Mode: ${GREEN}UNIFIED ONLY${NC} (legacy disabled)"
    else
        echo -e "  Mode: ${YELLOW}HYBRID${NC} (legacy available)"
    fi
    
    echo -e "  Rollout: ${GREEN}${PERCENT}%${NC} of users"
    
    if [ "$PERCENT" -eq 0 ]; then
        echo -e "  Status: ${RED}DISABLED${NC}"
    elif [ "$PERCENT" -eq 100 ]; then
        echo -e "  Status: ${GREEN}FULL ROLLOUT${NC}"
    else
        echo -e "  Status: ${YELLOW}CANARY (${PERCENT}%)${NC}"
    fi
else
    echo -e "${RED}No flags file found${NC}"
fi

echo ""
echo "Backup saved to: $BACKUP_DIR"
echo ""
