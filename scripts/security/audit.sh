#!/bin/bash
# Security Audit Script
# Runs dependency audit, license check, and CVE summary

set -e

echo "=========================================="
echo "Security Audit - Unified Reporting System"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Track failures
FAILURES=0

# 1. NPM Audit
echo "1. Running npm audit..."
echo "----------------------------------------"
if npm audit --audit-level=moderate --json > audit-report.json 2>&1; then
    echo -e "${GREEN}✓ No moderate or higher vulnerabilities found${NC}"
else
    AUDIT_EXIT=$?
    echo -e "${RED}✗ Vulnerabilities detected${NC}"
    
    # Parse and display summary
    if [ -f audit-report.json ]; then
        CRITICAL=$(cat audit-report.json | grep -o '"critical":[0-9]*' | grep -o '[0-9]*' || echo "0")
        HIGH=$(cat audit-report.json | grep -o '"high":[0-9]*' | grep -o '[0-9]*' || echo "0")
        MODERATE=$(cat audit-report.json | grep -o '"moderate":[0-9]*' | grep -o '[0-9]*' || echo "0")
        
        echo "  Critical: $CRITICAL"
        echo "  High: $HIGH"
        echo "  Moderate: $MODERATE"
        
        if [ "$CRITICAL" -gt 0 ] || [ "$HIGH" -gt 0 ]; then
            echo -e "${RED}FAIL: Critical or High vulnerabilities must be fixed${NC}"
            FAILURES=$((FAILURES + 1))
        fi
    fi
fi
echo ""

# 2. License Check
echo "2. Checking licenses..."
echo "----------------------------------------"
ALLOWED_LICENSES="MIT|Apache-2.0|BSD-2-Clause|BSD-3-Clause|ISC|0BSD|CC0-1.0"

if command -v license-checker &> /dev/null; then
    license-checker --summary --onlyAllow "$ALLOWED_LICENSES" > license-report.txt 2>&1 || {
        echo -e "${YELLOW}⚠ Non-standard licenses detected${NC}"
        cat license-report.txt
        echo -e "${YELLOW}Review required - may not be blocking${NC}"
    }
    echo -e "${GREEN}✓ License check complete${NC}"
else
    echo -e "${YELLOW}⚠ license-checker not installed, skipping${NC}"
    echo "  Install with: npm install -g license-checker"
fi
echo ""

# 3. Check for secrets patterns
echo "3. Scanning for secrets patterns..."
echo "----------------------------------------"
SECRETS_FOUND=0

# Common secret patterns
PATTERNS=(
    "AKIA[0-9A-Z]{16}"                    # AWS Access Key
    "-----BEGIN (RSA|DSA|EC) PRIVATE KEY" # Private keys
    "['\"]?password['\"]?\s*[:=]\s*['\"][^'\"]{8,}" # Passwords
    "['\"]?api[_-]?key['\"]?\s*[:=]\s*['\"][^'\"]{16,}" # API keys
    "['\"]?secret['\"]?\s*[:=]\s*['\"][^'\"]{16,}" # Secrets
    "mongodb(\+srv)?://[^:]+:[^@]+@"      # MongoDB connection strings
)

for pattern in "${PATTERNS[@]}"; do
    if grep -rE "$pattern" viewer/src/ --exclude-dir=node_modules --exclude-dir=dist --exclude="*.test.*" -n 2>/dev/null | grep -v "EXAMPLE\|PLACEHOLDER\|TODO"; then
        echo -e "${RED}✗ Potential secret found matching pattern: $pattern${NC}"
        SECRETS_FOUND=$((SECRETS_FOUND + 1))
    fi
done

if [ $SECRETS_FOUND -eq 0 ]; then
    echo -e "${GREEN}✓ No secrets patterns detected${NC}"
else
    echo -e "${RED}FAIL: $SECRETS_FOUND potential secrets found${NC}"
    FAILURES=$((FAILURES + 1))
fi
echo ""

# 4. CVE Summary
echo "4. CVE Summary..."
echo "----------------------------------------"
if [ -f audit-report.json ]; then
    echo "Generating CVE summary from audit report..."
    # Extract CVE IDs if present
    grep -o 'CVE-[0-9]\{4\}-[0-9]\+' audit-report.json | sort -u > cve-list.txt || true
    
    if [ -s cve-list.txt ]; then
        echo "CVEs found:"
        cat cve-list.txt
    else
        echo -e "${GREEN}No CVEs detected${NC}"
    fi
else
    echo "No audit report available"
fi
echo ""

# 5. Dependency Count
echo "5. Dependency Statistics..."
echo "----------------------------------------"
if [ -f viewer/package.json ]; then
    DEPS=$(cat viewer/package.json | grep -c '"' || echo "0")
    echo "Total dependencies declared: $DEPS"
    
    if [ -d viewer/node_modules ]; then
        INSTALLED=$(find viewer/node_modules -maxdepth 1 -type d | wc -l)
        echo "Total packages installed: $INSTALLED"
    fi
fi
echo ""

# Summary
echo "=========================================="
echo "Audit Summary"
echo "=========================================="
if [ $FAILURES -eq 0 ]; then
    echo -e "${GREEN}✓ All security checks passed${NC}"
    exit 0
else
    echo -e "${RED}✗ $FAILURES check(s) failed${NC}"
    echo "Review the output above and fix issues before proceeding"
    exit 1
fi
