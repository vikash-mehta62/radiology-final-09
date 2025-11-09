#!/bin/bash
# Tests for toggle-reporting.sh

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

# Setup
TEST_FLAGS_FILE="viewer/public/flags.test.json"
export FLAGS_FILE="$TEST_FLAGS_FILE"

echo "=========================================="
echo "Testing toggle-reporting.sh"
echo "=========================================="
echo ""

# Helper function
assert_equals() {
    local expected="$1"
    local actual="$2"
    local message="$3"
    
    if [ "$expected" = "$actual" ]; then
        echo -e "${GREEN}✓${NC} $message"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $message"
        echo "  Expected: $expected"
        echo "  Actual: $actual"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# Test 1: Initialize flags file
echo "Test 1: Initialize flags file"
echo '{}' > "$TEST_FLAGS_FILE"
assert_equals "true" "$([ -f "$TEST_FLAGS_FILE" ] && echo true || echo false)" "Flags file created"
echo ""

# Test 2: Set percent to 10
echo "Test 2: Set percent to 10"
bash scripts/flags/toggle-reporting.sh --percent 10 > /dev/null 2>&1
PERCENT=$(cat "$TEST_FLAGS_FILE" | jq -r '.REPORTING_UNIFIED_PERCENT // 0')
assert_equals "10" "$PERCENT" "Percent set to 10"
echo ""

# Test 3: Set percent to 50
echo "Test 3: Set percent to 50"
bash scripts/flags/toggle-reporting.sh --percent 50 > /dev/null 2>&1
PERCENT=$(cat "$TEST_FLAGS_FILE" | jq -r '.REPORTING_UNIFIED_PERCENT // 0')
assert_equals "50" "$PERCENT" "Percent set to 50"
echo ""

# Test 4: Set unified-only to on
echo "Test 4: Set unified-only to on"
bash scripts/flags/toggle-reporting.sh --unified-only on > /dev/null 2>&1
UNIFIED_ONLY=$(cat "$TEST_FLAGS_FILE" | jq -r '.REPORTING_UNIFIED_ONLY // false')
assert_equals "true" "$UNIFIED_ONLY" "Unified-only set to true"
echo ""

# Test 5: Set unified-only to off
echo "Test 5: Set unified-only to off"
bash scripts/flags/toggle-reporting.sh --unified-only off > /dev/null 2>&1
UNIFIED_ONLY=$(cat "$TEST_FLAGS_FILE" | jq -r '.REPORTING_UNIFIED_ONLY // false')
assert_equals "false" "$UNIFIED_ONLY" "Unified-only set to false"
echo ""

# Test 6: Invalid percent value
echo "Test 6: Invalid percent value (should fail)"
if bash scripts/flags/toggle-reporting.sh --percent 75 > /dev/null 2>&1; then
    echo -e "${RED}✗${NC} Should reject invalid percent"
    TESTS_FAILED=$((TESTS_FAILED + 1))
else
    echo -e "${GREEN}✓${NC} Correctly rejected invalid percent"
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
echo ""

# Test 7: Status command
echo "Test 7: Status command"
OUTPUT=$(bash scripts/flags/toggle-reporting.sh --status 2>&1)
if echo "$OUTPUT" | grep -q "Current Feature Flags"; then
    echo -e "${GREEN}✓${NC} Status command works"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Status command failed"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Cleanup
rm -f "$TEST_FLAGS_FILE"

# Summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed${NC}"
    exit 1
fi
