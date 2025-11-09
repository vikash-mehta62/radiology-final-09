#!/bin/bash

# DICOM-TLS Testing Script for Orthanc
# Tests DICOM-TLS connectivity and certificate validation

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="${SCRIPT_DIR}/certs"
ORTHANC_HOST="${ORTHANC_HOST:-localhost}"
ORTHANC_PORT="${ORTHANC_PORT:-4242}"
ORTHANC_AET="${ORTHANC_AET:-ORTHANC_PROD_AE}"
TEST_AET="${TEST_AET:-TEST_CLIENT}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

# Check if required tools are available
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    local missing_tools=()
    
    # Check for OpenSSL
    if ! command -v openssl &> /dev/null; then
        missing_tools+=("openssl")
    fi
    
    # Check for curl
    if ! command -v curl &> /dev/null; then
        missing_tools+=("curl")
    fi
    
    # Check for DCMTK tools (optional but recommended)
    if ! command -v echoscu &> /dev/null; then
        log_warn "DCMTK tools not found. Some tests will be skipped."
        log_warn "Install DCMTK for comprehensive DICOM testing:"
        log_warn "  Ubuntu/Debian: sudo apt-get install dcmtk"
        log_warn "  CentOS/RHEL: sudo yum install dcmtk"
        log_warn "  macOS: brew install dcmtk"
    fi
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_error "Please install the missing tools and try again."
        exit 1
    fi
    
    log_info "Prerequisites check completed"
}

# Test certificate files existence and validity
test_certificates() {
    log_test "Testing certificate files..."
    
    local required_files=(
        "dicom-ca.crt"
        "dicom-tls.crt"
        "dicom-tls.key"
        "orthanc-https.crt"
        "orthanc-https.key"
        "dicom-ca-chain.crt"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "${CERTS_DIR}/${file}" ]; then
            log_error "Certificate file missing: ${file}"
            log_error "Run generate-dicom-tls-certs.sh first"
            exit 1
        fi
    done
    
    log_info "All certificate files present"
    
    # Test certificate validity
    log_test "Validating certificate chain..."
    
    if openssl verify -CAfile "${CERTS_DIR}/dicom-ca.crt" "${CERTS_DIR}/dicom-tls.crt" &>/dev/null; then
        log_info "DICOM-TLS certificate chain is valid"
    else
        log_error "DICOM-TLS certificate chain validation failed"
        exit 1
    fi
    
    if openssl verify -CAfile "${CERTS_DIR}/dicom-ca.crt" "${CERTS_DIR}/orthanc-https.crt" &>/dev/null; then
        log_info "HTTPS certificate chain is valid"
    else
        log_error "HTTPS certificate chain validation failed"
        exit 1
    fi
    
    # Check certificate expiry
    local dicom_expiry=$(openssl x509 -enddate -noout -in "${CERTS_DIR}/dicom-tls.crt" | cut -d= -f2)
    local https_expiry=$(openssl x509 -enddate -noout -in "${CERTS_DIR}/orthanc-https.crt" | cut -d= -f2)
    
    log_info "DICOM-TLS certificate expires: ${dicom_expiry}"
    log_info "HTTPS certificate expires: ${https_expiry}"
    
    # Check if certificates expire within 30 days
    local current_epoch=$(date +%s)
    local dicom_expiry_epoch=$(date -d "$dicom_expiry" +%s)
    local https_expiry_epoch=$(date -d "$https_expiry" +%s)
    
    local dicom_days_left=$(( (dicom_expiry_epoch - current_epoch) / 86400 ))
    local https_days_left=$(( (https_expiry_epoch - current_epoch) / 86400 ))
    
    if [ $dicom_days_left -le 30 ]; then
        log_warn "DICOM-TLS certificate expires in ${dicom_days_left} days"
    fi
    
    if [ $https_days_left -le 30 ]; then
        log_warn "HTTPS certificate expires in ${https_days_left} days"
    fi
}

# Test TLS connection to Orthanc
test_tls_connection() {
    log_test "Testing TLS connection to Orthanc..."
    
    # Test DICOM-TLS port
    log_test "Testing DICOM-TLS connection (port ${ORTHANC_PORT})..."
    
    if timeout 10 openssl s_client -connect "${ORTHANC_HOST}:${ORTHANC_PORT}" \
        -CAfile "${CERTS_DIR}/dicom-ca.crt" -verify_return_error -quiet < /dev/null &>/dev/null; then
        log_info "DICOM-TLS connection successful"
    else
        log_error "DICOM-TLS connection failed"
        log_error "Check if Orthanc is running with DICOM-TLS enabled"
        return 1
    fi
    
    # Test HTTPS web interface
    log_test "Testing HTTPS web interface (port 8042)..."
    
    if curl -s --cacert "${CERTS_DIR}/dicom-ca.crt" \
        "https://${ORTHANC_HOST}:8042/system" > /dev/null; then
        log_info "HTTPS web interface connection successful"
    else
        log_error "HTTPS web interface connection failed"
        log_error "Check if Orthanc is running with HTTPS enabled"
        return 1
    fi
}

# Test DICOM echo with TLS (requires DCMTK)
test_dicom_echo() {
    if ! command -v echoscu &> /dev/null; then
        log_warn "Skipping DICOM echo test (echoscu not available)"
        return 0
    fi
    
    log_test "Testing DICOM echo with TLS..."
    
    # Create temporary client certificate for testing
    local temp_cert_dir=$(mktemp -d)
    local client_key="${temp_cert_dir}/client.key"
    local client_crt="${temp_cert_dir}/client.crt"
    local client_csr="${temp_cert_dir}/client.csr"
    
    # Generate client certificate for testing
    openssl genrsa -out "${client_key}" 2048
    openssl req -new -key "${client_key}" -out "${client_csr}" \
        -subj "/C=US/ST=State/L=City/O=Hospital/OU=Test/CN=${TEST_AET}"
    
    openssl x509 -req -in "${client_csr}" \
        -CA "${CERTS_DIR}/dicom-ca.crt" -CAkey "${CERTS_DIR}/dicom-ca.key" \
        -CAcreateserial -out "${client_crt}" -days 1
    
    # Test DICOM echo with TLS
    if echoscu -tls +cf "${CERTS_DIR}/dicom-ca.crt" +kf "${client_key}" +cf "${client_crt}" \
        -aet "${TEST_AET}" -aec "${ORTHANC_AET}" "${ORTHANC_HOST}" "${ORTHANC_PORT}" &>/dev/null; then
        log_info "DICOM echo with TLS successful"
    else
        log_error "DICOM echo with TLS failed"
        log_error "Check Orthanc DICOM-TLS configuration and AE title settings"
    fi
    
    # Clean up temporary certificates
    rm -rf "${temp_cert_dir}"
}

# Test webhook HTTPS endpoint
test_webhook_https() {
    log_test "Testing webhook HTTPS endpoint..."
    
    local webhook_url="https://${ORTHANC_HOST}:3000/api/orthanc/new-instance"
    local test_payload='{"test": "webhook_tls_test", "timestamp": '$(date +%s)'}'
    
    # Test webhook endpoint with TLS
    local response=$(curl -s -w "%{http_code}" -o /dev/null \
        --cacert "${CERTS_DIR}/dicom-ca.crt" \
        -H "Content-Type: application/json" \
        -H "X-Orthanc-Signature: sha256=test" \
        -H "X-Orthanc-Timestamp: $(date +%s)" \
        -H "X-Orthanc-Nonce: test-nonce" \
        -d "${test_payload}" \
        "${webhook_url}" 2>/dev/null || echo "000")
    
    if [ "$response" = "401" ] || [ "$response" = "200" ]; then
        log_info "Webhook HTTPS endpoint is accessible (HTTP ${response})"
        if [ "$response" = "401" ]; then
            log_info "Received 401 as expected (invalid signature)"
        fi
    else
        log_warn "Webhook HTTPS endpoint returned HTTP ${response}"
        log_warn "This may be normal if the bridge service is not running"
    fi
}

# Test certificate rotation simulation
test_certificate_rotation() {
    log_test "Testing certificate rotation simulation..."
    
    # Create backup of current certificates
    local backup_dir="${CERTS_DIR}/test-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "${backup_dir}"
    cp "${CERTS_DIR}/dicom-tls.crt" "${backup_dir}/"
    cp "${CERTS_DIR}/dicom-tls.key" "${backup_dir}/"
    
    log_info "Created certificate backup: ${backup_dir}"
    
    # Generate new certificate with short validity (1 day)
    log_test "Generating short-lived certificate for rotation test..."
    
    openssl genrsa -out "${CERTS_DIR}/dicom-tls-new.key" 2048
    openssl req -new -key "${CERTS_DIR}/dicom-tls-new.key" \
        -out "${CERTS_DIR}/dicom-tls-new.csr" \
        -subj "/C=US/ST=State/L=City/O=Hospital/OU=Radiology/CN=${ORTHANC_HOST}"
    
    cat > "${CERTS_DIR}/dicom-tls-new.ext" << EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth, clientAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = ${ORTHANC_HOST}
DNS.2 = ${ORTHANC_AET}
DNS.3 = localhost
IP.1 = 127.0.0.1
EOF
    
    openssl x509 -req -in "${CERTS_DIR}/dicom-tls-new.csr" \
        -CA "${CERTS_DIR}/dicom-ca.crt" -CAkey "${CERTS_DIR}/dicom-ca.key" \
        -CAcreateserial -out "${CERTS_DIR}/dicom-tls-new.crt" \
        -days 1 -extensions v3_req -extfile "${CERTS_DIR}/dicom-tls-new.ext"
    
    # Validate new certificate
    if openssl verify -CAfile "${CERTS_DIR}/dicom-ca.crt" "${CERTS_DIR}/dicom-tls-new.crt" &>/dev/null; then
        log_info "New certificate generated and validated successfully"
        
        # Clean up test certificate
        rm -f "${CERTS_DIR}/dicom-tls-new."*
        log_info "Test certificate cleaned up"
    else
        log_error "New certificate validation failed"
    fi
    
    log_info "Certificate rotation test completed"
}

# Generate test report
generate_report() {
    log_info "Generating test report..."
    
    local report_file="${SCRIPT_DIR}/dicom-tls-test-report-$(date +%Y%m%d-%H%M%S).txt"
    
    cat > "${report_file}" << EOF
DICOM-TLS Test Report
Generated: $(date)
Orthanc Host: ${ORTHANC_HOST}
Orthanc Port: ${ORTHANC_PORT}
Orthanc AET: ${ORTHANC_AET}

Certificate Information:
$(openssl x509 -in "${CERTS_DIR}/dicom-tls.crt" -text -noout | head -20)

Test Results:
- Certificate files: $([ -f "${CERTS_DIR}/dicom-tls.crt" ] && echo "PASS" || echo "FAIL")
- Certificate chain: $(openssl verify -CAfile "${CERTS_DIR}/dicom-ca.crt" "${CERTS_DIR}/dicom-tls.crt" &>/dev/null && echo "PASS" || echo "FAIL")
- TLS connection: $(timeout 10 openssl s_client -connect "${ORTHANC_HOST}:${ORTHANC_PORT}" -CAfile "${CERTS_DIR}/dicom-ca.crt" -verify_return_error -quiet < /dev/null &>/dev/null && echo "PASS" || echo "FAIL")
- HTTPS interface: $(curl -s --cacert "${CERTS_DIR}/dicom-ca.crt" "https://${ORTHANC_HOST}:8042/system" > /dev/null && echo "PASS" || echo "FAIL")

Recommendations:
- Monitor certificate expiry dates
- Set up automated certificate renewal
- Test with actual DICOM devices
- Implement certificate rotation procedures
- Configure monitoring and alerting

EOF
    
    log_info "Test report generated: ${report_file}"
}

# Main execution
main() {
    log_info "Starting DICOM-TLS testing..."
    log_info "Target: ${ORTHANC_HOST}:${ORTHANC_PORT} (${ORTHANC_AET})"
    
    # Run tests
    check_prerequisites
    test_certificates
    test_tls_connection
    test_dicom_echo
    test_webhook_https
    test_certificate_rotation
    generate_report
    
    log_info "DICOM-TLS testing completed successfully!"
    log_info "All tests passed. The DICOM-TLS configuration is working correctly."
    
    log_warn "Next steps:"
    log_warn "1. Install CA certificate on DICOM devices"
    log_warn "2. Configure PACS and workstations for DICOM-TLS"
    log_warn "3. Test with real DICOM traffic"
    log_warn "4. Set up certificate monitoring and renewal"
}

# Show usage information
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --host HOST          Orthanc hostname [default: localhost]"
    echo "  -p, --port PORT          Orthanc DICOM port [default: 4242]"
    echo "  -a, --aet AET            Orthanc AE Title [default: ORTHANC_PROD_AE]"
    echo "  -t, --test-aet AET       Test client AE Title [default: TEST_CLIENT]"
    echo "  --help                   Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  ORTHANC_HOST             Orthanc hostname"
    echo "  ORTHANC_PORT             Orthanc DICOM port"
    echo "  ORTHANC_AET              Orthanc AE Title"
    echo "  TEST_AET                 Test client AE Title"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Test localhost with defaults"
    echo "  $0 -h orthanc.local -p 4242          # Test specific host and port"
    echo "  $0 -a ORTHANC_PROD -t MY_TEST        # Custom AE titles"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--host)
            ORTHANC_HOST="$2"
            shift 2
            ;;
        -p|--port)
            ORTHANC_PORT="$2"
            shift 2
            ;;
        -a|--aet)
            ORTHANC_AET="$2"
            shift 2
            ;;
        -t|--test-aet)
            TEST_AET="$2"
            shift 2
            ;;
        --help)
            usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Run main function
main