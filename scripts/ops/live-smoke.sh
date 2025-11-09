#!/bin/bash
# Live Smoke Test Script
# Validates critical functionality in production

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
API_URL="${API_URL:-http://localhost:8001}"
TIMEOUT=10
FAILURES=0

echo "=========================================="
echo "Live Smoke Test - Unified Reporting"
echo "=========================================="
echo "API URL: $API_URL"
echo "Timeout: ${TIMEOUT}s"
echo ""

# Helper function to check response
check_response() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    local start_time=$(date +%s%3N)
    
    echo -n "Testing $name... "
    
    response=$(curl -s -w "\n%{http_code}" -m $TIMEOUT "$url" 2>&1 || echo "000")
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    local end_time=$(date +%s%3N)
    local duration=$((end_time - start_time))
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ OK${NC} (${duration}ms)"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (expected $expected_status, got $status_code)"
        echo "  Response: $body"
        FAILURES=$((FAILURES + 1))
        return 1
    fi
}

# Helper function for POST requests
check_post() {
    local name="$1"
    local url="$2"
    local data="$3"
    local expected_status="${4:-200}"
    local start_time=$(date +%s%3N)
    
    echo -n "Testing $name... "
    
    response=$(curl -s -w "\n%{http_code}" -m $TIMEOUT \
        -X POST \
        -H "Content-Type: application/json" \
        -d "$data" \
        "$url" 2>&1 || echo "000")
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    local end_time=$(date +%s%3N)
    local duration=$((end_time - start_time))
    
    if [ "$status_code" = "$expected_status" ] || [ "$status_code" = "201" ]; then
        echo -e "${GREEN}✓ OK${NC} (${duration}ms)"
        echo "$body"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (expected $expected_status, got $status_code)"
        echo "  Response: $body"
        FAILURES=$((FAILURES + 1))
        return 1
    fi
}

# 1. Health Check
echo "1. Health Checks"
echo "----------------------------------------"
check_response "API Health" "$API_URL/api/health" 200
check_response "Frontend Health" "${API_URL/8001/5173}/health.html" 200 || true
echo ""

# 2. Templates
echo "2. Template Service"
echo "----------------------------------------"
check_response "List Templates" "$API_URL/api/templates" 200
echo ""

# 3. Reports CRUD
echo "3. Reports Service"
echo "----------------------------------------"

# Create draft report
DRAFT_DATA='{
  "studyInstanceUID": "smoke-test-'$(date +%s)'",
  "patientID": "SMOKE-TEST",
  "templateId": "template-xray-chest",
  "reportStatus": "draft",
  "content": {
    "indication": "Smoke test",
    "technique": "Standard",
    "findings": [],
    "impression": "Test"
  }
}'

echo "Creating draft report..."
CREATE_RESPONSE=$(check_post "Create Draft" "$API_URL/api/reports" "$DRAFT_DATA" 201)

if [ $? -eq 0 ]; then
    # Extract report ID
    REPORT_ID=$(echo "$CREATE_RESPONSE" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ -n "$REPORT_ID" ]; then
        echo "  Report ID: $REPORT_ID"
        
        # Get report
        check_response "Get Report" "$API_URL/api/reports/$REPORT_ID" 200
        
        # Delete report (cleanup)
        echo -n "Cleaning up... "
        curl -s -X DELETE "$API_URL/api/reports/$REPORT_ID" > /dev/null 2>&1
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}⚠ Could not extract report ID${NC}"
    fi
fi

echo ""

# 4. Feature Flags
echo "4. Feature Flags"
echo "----------------------------------------"
if [ -f "viewer/public/flags.json" ]; then
    echo -n "Checking flags.json... "
    if jq empty viewer/public/flags.json 2>/dev/null; then
        echo -e "${GREEN}✓ Valid JSON${NC}"
        cat viewer/public/flags.json | jq '.'
    else
        echo -e "${RED}✗ Invalid JSON${NC}"
        FAILURES=$((FAILURES + 1))
    fi
else
    echo -e "${YELLOW}⚠ flags.json not found (using defaults)${NC}"
fi
echo ""

# 5. Summary
echo "=========================================="
echo "Summary"
echo "=========================================="

if [ $FAILURES -eq 0 ]; then
    echo -e "${GREEN}✓ All smoke tests passed${NC}"
    exit 0
else
    echo -e "${RED}✗ $FAILURES test(s) failed${NC}"
    exit 1
fi
