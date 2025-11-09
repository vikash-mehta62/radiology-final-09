#!/bin/bash

# Certificate Generation Script for Orthanc Bridge TLS
# Supports both Let's Encrypt and self-signed certificates

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="${SCRIPT_DIR}/certs"
DOMAIN_ORTHANC="${DOMAIN_ORTHANC:-orthanc.local}"
DOMAIN_BRIDGE="${DOMAIN_BRIDGE:-bridge.local}"
CERT_TYPE="${CERT_TYPE:-self-signed}"  # Options: letsencrypt, self-signed
EMAIL="${EMAIL:-admin@example.com}"

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

# Generate DH parameters for enhanced security
generate_dhparam() {
    log_info "Generating DH parameters (this may take a while)..."
    if [ ! -f "${SCRIPT_DIR}/dhparam.pem" ]; then
        openssl dhparam -out "${SCRIPT_DIR}/dhparam.pem" 2048
        log_info "DH parameters generated successfully"
    else
        log_info "DH parameters already exist, skipping..."
    fi
}

# Generate self-signed certificates
generate_self_signed() {
    log_info "Generating self-signed certificates..."
    
    # Create CA key and certificate
    if [ ! -f "${CERTS_DIR}/ca.key" ]; then
        log_info "Creating Certificate Authority..."
        openssl genrsa -out "${CERTS_DIR}/ca.key" 4096
        openssl req -new -x509 -days 3650 -key "${CERTS_DIR}/ca.key" -out "${CERTS_DIR}/ca.crt" \
            -subj "/C=US/ST=State/L=City/O=Organization/OU=IT Department/CN=Orthanc Bridge CA"
    fi
    
    # Generate certificate for Orthanc
    log_info "Generating certificate for Orthanc (${DOMAIN_ORTHANC})..."
    openssl genrsa -out "${CERTS_DIR}/orthanc.key" 2048
    openssl req -new -key "${CERTS_DIR}/orthanc.key" -out "${CERTS_DIR}/orthanc.csr" \
        -subj "/C=US/ST=State/L=City/O=Organization/OU=IT Department/CN=${DOMAIN_ORTHANC}"
    
    # Create extensions file for SAN
    cat > "${CERTS_DIR}/orthanc.ext" << EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = ${DOMAIN_ORTHANC}
DNS.2 = localhost
IP.1 = 127.0.0.1
EOF
    
    openssl x509 -req -in "${CERTS_DIR}/orthanc.csr" -CA "${CERTS_DIR}/ca.crt" -CAkey "${CERTS_DIR}/ca.key" \
        -CAcreateserial -out "${CERTS_DIR}/orthanc.crt" -days 365 -extensions v3_req -extfile "${CERTS_DIR}/orthanc.ext"
    
    # Generate certificate for Bridge
    log_info "Generating certificate for Bridge (${DOMAIN_BRIDGE})..."
    openssl genrsa -out "${CERTS_DIR}/bridge.key" 2048
    openssl req -new -key "${CERTS_DIR}/bridge.key" -out "${CERTS_DIR}/bridge.csr" \
        -subj "/C=US/ST=State/L=City/O=Organization/OU=IT Department/CN=${DOMAIN_BRIDGE}"
    
    # Create extensions file for Bridge SAN
    cat > "${CERTS_DIR}/bridge.ext" << EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = ${DOMAIN_BRIDGE}
DNS.2 = localhost
IP.1 = 127.0.0.1
EOF
    
    openssl x509 -req -in "${CERTS_DIR}/bridge.csr" -CA "${CERTS_DIR}/ca.crt" -CAkey "${CERTS_DIR}/ca.key" \
        -CAcreateserial -out "${CERTS_DIR}/bridge.crt" -days 365 -extensions v3_req -extfile "${CERTS_DIR}/bridge.ext"
    
    # Create CA chain file
    cp "${CERTS_DIR}/ca.crt" "${CERTS_DIR}/ca-chain.crt"
    
    # Set proper permissions
    chmod 600 "${CERTS_DIR}"/*.key
    chmod 644 "${CERTS_DIR}"/*.crt
    
    # Clean up CSR and extension files
    rm -f "${CERTS_DIR}"/*.csr "${CERTS_DIR}"/*.ext
    
    log_info "Self-signed certificates generated successfully!"
    log_warn "Remember to add the CA certificate (${CERTS_DIR}/ca.crt) to your trusted certificate store"
}

# Generate Let's Encrypt certificates using certbot
generate_letsencrypt() {
    log_info "Generating Let's Encrypt certificates..."
    
    # Check if certbot is installed
    if ! command -v certbot &> /dev/null; then
        log_error "certbot is not installed. Please install it first:"
        log_error "  Ubuntu/Debian: sudo apt-get install certbot"
        log_error "  CentOS/RHEL: sudo yum install certbot"
        log_error "  macOS: brew install certbot"
        exit 1
    fi
    
    # Generate certificate for Orthanc
    log_info "Requesting certificate for ${DOMAIN_ORTHANC}..."
    certbot certonly --standalone --non-interactive --agree-tos --email "${EMAIL}" \
        -d "${DOMAIN_ORTHANC}" --cert-path "${CERTS_DIR}/orthanc.crt" \
        --key-path "${CERTS_DIR}/orthanc.key" --chain-path "${CERTS_DIR}/ca-chain.crt"
    
    # Generate certificate for Bridge
    log_info "Requesting certificate for ${DOMAIN_BRIDGE}..."
    certbot certonly --standalone --non-interactive --agree-tos --email "${EMAIL}" \
        -d "${DOMAIN_BRIDGE}" --cert-path "${CERTS_DIR}/bridge.crt" \
        --key-path "${CERTS_DIR}/bridge.key"
    
    log_info "Let's Encrypt certificates generated successfully!"
    log_info "Certificates will auto-renew. Set up a cron job to restart Nginx after renewal."
}

# Validate certificates
validate_certificates() {
    log_info "Validating certificates..."
    
    for domain in orthanc bridge; do
        if [ -f "${CERTS_DIR}/${domain}.crt" ] && [ -f "${CERTS_DIR}/${domain}.key" ]; then
            # Check certificate validity
            if openssl x509 -in "${CERTS_DIR}/${domain}.crt" -noout -checkend 86400; then
                log_info "${domain} certificate is valid and not expiring within 24 hours"
            else
                log_warn "${domain} certificate is expiring soon or invalid"
            fi
            
            # Check if private key matches certificate
            cert_hash=$(openssl x509 -noout -modulus -in "${CERTS_DIR}/${domain}.crt" | openssl md5)
            key_hash=$(openssl rsa -noout -modulus -in "${CERTS_DIR}/${domain}.key" | openssl md5)
            
            if [ "$cert_hash" = "$key_hash" ]; then
                log_info "${domain} certificate and private key match"
            else
                log_error "${domain} certificate and private key do not match!"
                exit 1
            fi
        else
            log_error "Missing certificate files for ${domain}"
            exit 1
        fi
    done
}

# Main execution
main() {
    log_info "Starting certificate generation for Orthanc Bridge TLS..."
    log_info "Certificate type: ${CERT_TYPE}"
    log_info "Orthanc domain: ${DOMAIN_ORTHANC}"
    log_info "Bridge domain: ${DOMAIN_BRIDGE}"
    
    # Generate DH parameters
    generate_dhparam
    
    # Generate certificates based on type
    case "${CERT_TYPE}" in
        "letsencrypt")
            generate_letsencrypt
            ;;
        "self-signed")
            generate_self_signed
            ;;
        *)
            log_error "Invalid certificate type: ${CERT_TYPE}"
            log_error "Valid options: letsencrypt, self-signed"
            exit 1
            ;;
    esac
    
    # Validate generated certificates
    validate_certificates
    
    log_info "Certificate generation completed successfully!"
    log_info "Certificates are stored in: ${CERTS_DIR}"
    
    if [ "${CERT_TYPE}" = "self-signed" ]; then
        log_warn "For self-signed certificates, add the CA certificate to your browser's trusted store:"
        log_warn "  CA Certificate: ${CERTS_DIR}/ca.crt"
    fi
    
    log_info "You can now start the Nginx proxy with:"
    log_info "  docker-compose -f docker-compose.yml -f nginx-config/docker-compose.nginx.yml up -d"
}

# Show usage information
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -t, --type TYPE          Certificate type (letsencrypt|self-signed) [default: self-signed]"
    echo "  -o, --orthanc DOMAIN     Orthanc domain name [default: orthanc.local]"
    echo "  -b, --bridge DOMAIN      Bridge domain name [default: bridge.local]"
    echo "  -e, --email EMAIL        Email for Let's Encrypt [default: admin@example.com]"
    echo "  -h, --help               Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  CERT_TYPE                Certificate type"
    echo "  DOMAIN_ORTHANC           Orthanc domain name"
    echo "  DOMAIN_BRIDGE            Bridge domain name"
    echo "  EMAIL                    Email for Let's Encrypt"
    echo ""
    echo "Examples:"
    echo "  $0                                           # Generate self-signed certificates"
    echo "  $0 -t letsencrypt -o orthanc.example.com    # Generate Let's Encrypt certificates"
    echo "  CERT_TYPE=letsencrypt $0                     # Use environment variables"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            CERT_TYPE="$2"
            shift 2
            ;;
        -o|--orthanc)
            DOMAIN_ORTHANC="$2"
            shift 2
            ;;
        -b|--bridge)
            DOMAIN_BRIDGE="$2"
            shift 2
            ;;
        -e|--email)
            EMAIL="$2"
            shift 2
            ;;
        -h|--help)
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