#!/bin/bash

# DICOM-TLS Certificate Generation Script for Orthanc
# Generates certificates for secure DICOM communication

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="${SCRIPT_DIR}/certs"
ORTHANC_AET="${ORTHANC_AET:-ORTHANC_PROD_AE}"
ORTHANC_HOST="${ORTHANC_HOST:-orthanc.hospital.local}"
VALIDITY_DAYS="${VALIDITY_DAYS:-365}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Create certificates directory
mkdir -p "${CERTS_DIR}"

# Generate DICOM-TLS CA certificate
generate_dicom_ca() {
    log_info "Generating DICOM-TLS Certificate Authority..."
    
    if [ ! -f "${CERTS_DIR}/dicom-ca.key" ]; then
        # Generate CA private key
        openssl genrsa -out "${CERTS_DIR}/dicom-ca.key" 4096
        
        # Generate CA certificate
        openssl req -new -x509 -days $((VALIDITY_DAYS * 3)) -key "${CERTS_DIR}/dicom-ca.key" \
            -out "${CERTS_DIR}/dicom-ca.crt" \
            -subj "/C=US/ST=State/L=City/O=Hospital/OU=Radiology/CN=DICOM-TLS CA"
        
        log_info "DICOM-TLS CA certificate generated"
    else
        log_info "DICOM-TLS CA certificate already exists"
    fi
}

# Generate DICOM-TLS server certificate for Orthanc
generate_orthanc_dicom_cert() {
    log_info "Generating DICOM-TLS server certificate for Orthanc..."
    
    # Generate server private key
    openssl genrsa -out "${CERTS_DIR}/dicom-tls.key" 2048
    
    # Generate certificate signing request
    openssl req -new -key "${CERTS_DIR}/dicom-tls.key" -out "${CERTS_DIR}/dicom-tls.csr" \
        -subj "/C=US/ST=State/L=City/O=Hospital/OU=Radiology/CN=${ORTHANC_HOST}"
    
    # Create extensions file for server certificate
    cat > "${CERTS_DIR}/dicom-server.ext" << EOF
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
    
    # Sign the server certificate
    openssl x509 -req -in "${CERTS_DIR}/dicom-tls.csr" \
        -CA "${CERTS_DIR}/dicom-ca.crt" -CAkey "${CERTS_DIR}/dicom-ca.key" \
        -CAcreateserial -out "${CERTS_DIR}/dicom-tls.crt" \
        -days ${VALIDITY_DAYS} -extensions v3_req -extfile "${CERTS_DIR}/dicom-server.ext"
    
    log_info "DICOM-TLS server certificate generated for ${ORTHANC_HOST}"
}

# Generate DICOM-TLS client certificates for modalities
generate_client_cert() {
    local client_aet="$1"
    local client_host="$2"
    
    log_info "Generating DICOM-TLS client certificate for ${client_aet}..."
    
    # Generate client private key
    openssl genrsa -out "${CERTS_DIR}/${client_aet,,}-client.key" 2048
    
    # Generate certificate signing request
    openssl req -new -key "${CERTS_DIR}/${client_aet,,}-client.key" \
        -out "${CERTS_DIR}/${client_aet,,}-client.csr" \
        -subj "/C=US/ST=State/L=City/O=Hospital/OU=Radiology/CN=${client_host}"
    
    # Create extensions file for client certificate
    cat > "${CERTS_DIR}/${client_aet,,}-client.ext" << EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = clientAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = ${client_host}
DNS.2 = ${client_aet}
EOF
    
    # Sign the client certificate
    openssl x509 -req -in "${CERTS_DIR}/${client_aet,,}-client.csr" \
        -CA "${CERTS_DIR}/dicom-ca.crt" -CAkey "${CERTS_DIR}/dicom-ca.key" \
        -CAcreateserial -out "${CERTS_DIR}/${client_aet,,}-client.crt" \
        -days ${VALIDITY_DAYS} -extensions v3_req -extfile "${CERTS_DIR}/${client_aet,,}-client.ext"
    
    log_info "DICOM-TLS client certificate generated for ${client_aet}"
}

# Create certificate chain file
create_cert_chain() {
    log_info "Creating certificate chain file..."
    
    # Create chain file with CA certificate
    cp "${CERTS_DIR}/dicom-ca.crt" "${CERTS_DIR}/dicom-ca-chain.crt"
    
    log_info "Certificate chain file created"
}

# Generate HTTPS certificates for Orthanc web interface
generate_https_cert() {
    log_info "Generating HTTPS certificate for Orthanc web interface..."
    
    # Generate HTTPS private key
    openssl genrsa -out "${CERTS_DIR}/orthanc-https.key" 2048
    
    # Generate certificate signing request
    openssl req -new -key "${CERTS_DIR}/orthanc-https.key" \
        -out "${CERTS_DIR}/orthanc-https.csr" \
        -subj "/C=US/ST=State/L=City/O=Hospital/OU=Radiology/CN=${ORTHANC_HOST}"
    
    # Create extensions file for HTTPS certificate
    cat > "${CERTS_DIR}/orthanc-https.ext" << EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = ${ORTHANC_HOST}
DNS.2 = localhost
IP.1 = 127.0.0.1
EOF
    
    # Sign the HTTPS certificate
    openssl x509 -req -in "${CERTS_DIR}/orthanc-https.csr" \
        -CA "${CERTS_DIR}/dicom-ca.crt" -CAkey "${CERTS_DIR}/dicom-ca.key" \
        -CAcreateserial -out "${CERTS_DIR}/orthanc-https.crt" \
        -days ${VALIDITY_DAYS} -extensions v3_req -extfile "${CERTS_DIR}/orthanc-https.ext"
    
    log_info "HTTPS certificate generated for Orthanc web interface"
}

# Set proper file permissions
set_permissions() {
    log_info "Setting proper file permissions..."
    
    # Private keys should be readable only by owner
    chmod 600 "${CERTS_DIR}"/*.key
    
    # Certificates can be readable by group
    chmod 644 "${CERTS_DIR}"/*.crt
    
    # CSR and extension files can be removed
    rm -f "${CERTS_DIR}"/*.csr "${CERTS_DIR}"/*.ext
    
    log_info "File permissions set correctly"
}

# Validate generated certificates
validate_certificates() {
    log_info "Validating generated certificates..."
    
    # Validate DICOM-TLS server certificate
    if openssl verify -CAfile "${CERTS_DIR}/dicom-ca.crt" "${CERTS_DIR}/dicom-tls.crt"; then
        log_info "DICOM-TLS server certificate is valid"
    else
        log_error "DICOM-TLS server certificate validation failed"
        exit 1
    fi
    
    # Validate HTTPS certificate
    if openssl verify -CAfile "${CERTS_DIR}/dicom-ca.crt" "${CERTS_DIR}/orthanc-https.crt"; then
        log_info "HTTPS certificate is valid"
    else
        log_error "HTTPS certificate validation failed"
        exit 1
    fi
    
    # Check certificate expiry
    local expiry_date=$(openssl x509 -enddate -noout -in "${CERTS_DIR}/dicom-tls.crt" | cut -d= -f2)
    log_info "DICOM-TLS certificate expires on: ${expiry_date}"
    
    local https_expiry=$(openssl x509 -enddate -noout -in "${CERTS_DIR}/orthanc-https.crt" | cut -d= -f2)
    log_info "HTTPS certificate expires on: ${https_expiry}"
}

# Create certificate installation instructions
create_instructions() {
    log_info "Creating certificate installation instructions..."
    
    cat > "${CERTS_DIR}/INSTALLATION.md" << EOF
# DICOM-TLS Certificate Installation Instructions

## Generated Certificates

### Certificate Authority
- \`dicom-ca.crt\` - Root CA certificate (install on all DICOM devices)
- \`dicom-ca.key\` - CA private key (keep secure)

### Orthanc Server Certificates
- \`dicom-tls.crt\` - DICOM-TLS server certificate
- \`dicom-tls.key\` - DICOM-TLS server private key
- \`orthanc-https.crt\` - HTTPS web interface certificate
- \`orthanc-https.key\` - HTTPS web interface private key

### Certificate Chain
- \`dicom-ca-chain.crt\` - Certificate chain for validation

## Installation Steps

### 1. Install CA Certificate on DICOM Devices

Copy \`dicom-ca.crt\` to all DICOM devices that will connect to Orthanc:
- PACS systems
- Workstations (AW, etc.)
- Other modalities

### 2. Configure Orthanc

The certificates are automatically configured in \`orthanc-tls.json\`:
- DICOM-TLS: \`/etc/orthanc/certs/dicom-tls.crt\` and \`/etc/orthanc/certs/dicom-tls.key\`
- HTTPS: \`/etc/orthanc/certs/orthanc-https.crt\` and \`/etc/orthanc/certs/orthanc-https.key\`
- CA Chain: \`/etc/orthanc/certs/dicom-ca-chain.crt\`

### 3. Update Docker Compose

Mount the certificates directory in your Docker Compose configuration:

\`\`\`yaml
services:
  orthanc:
    volumes:
      - ./orthanc-config/certs:/etc/orthanc/certs:ro
      - ./orthanc-config/orthanc-tls.json:/etc/orthanc/orthanc.json:ro
\`\`\`

### 4. Configure Remote DICOM Devices

Update your PACS and workstation configurations to:
- Enable DICOM-TLS
- Use port 4242 for secure DICOM communication
- Install the CA certificate (\`dicom-ca.crt\`)
- Configure mutual TLS authentication if required

### 5. Test Connectivity

Test DICOM-TLS connectivity:
\`\`\`bash
# Test DICOM echo with TLS
dcmtk-echoscu -tls +cf dicom-ca.crt ${ORTHANC_HOST} 4242

# Test HTTPS web interface
curl --cacert dicom-ca.crt https://${ORTHANC_HOST}:8042/system
\`\`\`

## Security Notes

- Keep the CA private key (\`dicom-ca.key\`) secure and backed up
- Regularly rotate certificates before expiry
- Monitor certificate expiry dates
- Use strong passwords for any encrypted private keys
- Implement proper access controls for certificate files

## Troubleshooting

### Common Issues

1. **Certificate Verification Failed**
   - Ensure CA certificate is installed on client devices
   - Check certificate chain configuration
   - Verify certificate dates and validity

2. **TLS Handshake Failed**
   - Check cipher suite compatibility
   - Verify certificate subject names match hostnames
   - Ensure proper certificate permissions

3. **Connection Refused**
   - Verify DICOM-TLS is enabled in Orthanc configuration
   - Check firewall rules for port 4242
   - Confirm Orthanc is listening on the correct interface

### Log Analysis

Check Orthanc logs for TLS-related errors:
\`\`\`bash
docker logs orthanc-container | grep -i tls
\`\`\`

### Certificate Validation

Validate certificates manually:
\`\`\`bash
# Check certificate details
openssl x509 -in dicom-tls.crt -text -noout

# Verify certificate chain
openssl verify -CAfile dicom-ca.crt dicom-tls.crt

# Test TLS connection
openssl s_client -connect ${ORTHANC_HOST}:4242 -CAfile dicom-ca.crt
\`\`\`
EOF
    
    log_info "Installation instructions created: ${CERTS_DIR}/INSTALLATION.md"
}

# Main execution
main() {
    log_info "Starting DICOM-TLS certificate generation..."
    log_info "Orthanc AET: ${ORTHANC_AET}"
    log_info "Orthanc Host: ${ORTHANC_HOST}"
    log_info "Certificate validity: ${VALIDITY_DAYS} days"
    
    # Generate certificates
    generate_dicom_ca
    generate_orthanc_dicom_cert
    generate_https_cert
    create_cert_chain
    
    # Generate client certificates for common modalities
    generate_client_cert "PACS_PRIMARY" "pacs.hospital.local"
    generate_client_cert "AW_WORKSTATION" "aw.radiology.local"
    
    # Set permissions and validate
    set_permissions
    validate_certificates
    create_instructions
    
    log_info "DICOM-TLS certificate generation completed successfully!"
    log_info "Certificates are stored in: ${CERTS_DIR}"
    log_info "Installation instructions: ${CERTS_DIR}/INSTALLATION.md"
    
    log_warn "Important: Install the CA certificate (${CERTS_DIR}/dicom-ca.crt) on all DICOM devices"
    log_warn "Update your Docker Compose configuration to mount the certificates directory"
}

# Show usage information
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -a, --aet AET            Orthanc AE Title [default: ORTHANC_PROD_AE]"
    echo "  -h, --host HOST          Orthanc hostname [default: orthanc.hospital.local]"
    echo "  -d, --days DAYS          Certificate validity in days [default: 365]"
    echo "  --help                   Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  ORTHANC_AET              Orthanc AE Title"
    echo "  ORTHANC_HOST             Orthanc hostname"
    echo "  VALIDITY_DAYS            Certificate validity in days"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Generate with defaults"
    echo "  $0 -a ORTHANC_PROD -h orthanc.local  # Custom AET and hostname"
    echo "  $0 -d 730                            # 2-year validity"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -a|--aet)
            ORTHANC_AET="$2"
            shift 2
            ;;
        -h|--host)
            ORTHANC_HOST="$2"
            shift 2
            ;;
        -d|--days)
            VALIDITY_DAYS="$2"
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