#!/bin/bash

# Certificate Renewal Script for Orthanc Bridge TLS
# Handles both Let's Encrypt renewal and self-signed certificate regeneration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="${SCRIPT_DIR}/certs"
CERT_TYPE="${CERT_TYPE:-self-signed}"
NGINX_CONTAINER="${NGINX_CONTAINER:-nginx-tls-proxy}"

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

# Check certificate expiry
check_certificate_expiry() {
    local cert_file="$1"
    local cert_name="$2"
    local days_threshold="${3:-30}"
    
    if [ ! -f "$cert_file" ]; then
        log_error "Certificate file not found: $cert_file"
        return 1
    fi
    
    local expiry_date=$(openssl x509 -enddate -noout -in "$cert_file" | cut -d= -f2)
    local expiry_epoch=$(date -d "$expiry_date" +%s)
    local current_epoch=$(date +%s)
    local days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))
    
    log_info "$cert_name certificate expires in $days_until_expiry days"
    
    if [ $days_until_expiry -le $days_threshold ]; then
        log_warn "$cert_name certificate expires in $days_until_expiry days (threshold: $days_threshold)"
        return 0  # Needs renewal
    else
        log_info "$cert_name certificate is valid for $days_until_expiry more days"
        return 1  # No renewal needed
    fi
}

# Renew Let's Encrypt certificates
renew_letsencrypt() {
    log_info "Renewing Let's Encrypt certificates..."
    
    if ! command -v certbot &> /dev/null; then
        log_error "certbot is not installed"
        exit 1
    fi
    
    # Dry run first
    log_info "Performing dry run..."
    if certbot renew --dry-run; then
        log_info "Dry run successful, proceeding with actual renewal..."
        
        # Actual renewal
        if certbot renew --quiet; then
            log_info "Let's Encrypt certificates renewed successfully"
            return 0
        else
            log_error "Failed to renew Let's Encrypt certificates"
            return 1
        fi
    else
        log_error "Dry run failed, skipping renewal"
        return 1
    fi
}

# Regenerate self-signed certificates
renew_self_signed() {
    log_info "Regenerating self-signed certificates..."
    
    # Backup existing certificates
    local backup_dir="${CERTS_DIR}/backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup_dir"
    
    if [ -d "$CERTS_DIR" ]; then
        cp -r "$CERTS_DIR"/* "$backup_dir/" 2>/dev/null || true
        log_info "Existing certificates backed up to: $backup_dir"
    fi
    
    # Regenerate certificates using the main script
    if "${SCRIPT_DIR}/generate-certs.sh" -t self-signed; then
        log_info "Self-signed certificates regenerated successfully"
        return 0
    else
        log_error "Failed to regenerate self-signed certificates"
        # Restore backup
        if [ -d "$backup_dir" ]; then
            cp -r "$backup_dir"/* "$CERTS_DIR/"
            log_info "Restored certificates from backup"
        fi
        return 1
    fi
}

# Reload Nginx configuration
reload_nginx() {
    log_info "Reloading Nginx configuration..."
    
    # Check if running in Docker
    if command -v docker &> /dev/null && docker ps --format "table {{.Names}}" | grep -q "$NGINX_CONTAINER"; then
        log_info "Reloading Nginx in Docker container: $NGINX_CONTAINER"
        if docker exec "$NGINX_CONTAINER" nginx -t; then
            docker exec "$NGINX_CONTAINER" nginx -s reload
            log_info "Nginx reloaded successfully"
        else
            log_error "Nginx configuration test failed"
            return 1
        fi
    elif command -v systemctl &> /dev/null && systemctl is-active --quiet nginx; then
        log_info "Reloading system Nginx service"
        if nginx -t; then
            systemctl reload nginx
            log_info "Nginx reloaded successfully"
        else
            log_error "Nginx configuration test failed"
            return 1
        fi
    elif command -v service &> /dev/null; then
        log_info "Reloading Nginx using service command"
        if nginx -t; then
            service nginx reload
            log_info "Nginx reloaded successfully"
        else
            log_error "Nginx configuration test failed"
            return 1
        fi
    else
        log_warn "Could not determine how to reload Nginx. Please reload manually."
        return 1
    fi
}

# Send notification (placeholder for integration with monitoring systems)
send_notification() {
    local status="$1"
    local message="$2"
    
    log_info "Notification: [$status] $message"
    
    # Add integration with your monitoring/alerting system here
    # Examples:
    # - Slack webhook
    # - Email notification
    # - PagerDuty alert
    # - Custom monitoring system API
    
    # Example Slack notification (uncomment and configure):
    # if [ -n "$SLACK_WEBHOOK_URL" ]; then
    #     curl -X POST -H 'Content-type: application/json' \
    #         --data "{\"text\":\"Orthanc Bridge Certificate Renewal: [$status] $message\"}" \
    #         "$SLACK_WEBHOOK_URL"
    # fi
}

# Main renewal logic
main() {
    log_info "Starting certificate renewal check..."
    log_info "Certificate type: $CERT_TYPE"
    
    local renewal_needed=false
    local renewal_successful=false
    
    # Check if certificates need renewal
    if [ -f "${CERTS_DIR}/orthanc.crt" ]; then
        if check_certificate_expiry "${CERTS_DIR}/orthanc.crt" "Orthanc" 30; then
            renewal_needed=true
        fi
    else
        log_warn "Orthanc certificate not found, renewal needed"
        renewal_needed=true
    fi
    
    if [ -f "${CERTS_DIR}/bridge.crt" ]; then
        if check_certificate_expiry "${CERTS_DIR}/bridge.crt" "Bridge" 30; then
            renewal_needed=true
        fi
    else
        log_warn "Bridge certificate not found, renewal needed"
        renewal_needed=true
    fi
    
    # Perform renewal if needed
    if [ "$renewal_needed" = true ]; then
        log_info "Certificate renewal required"
        
        case "$CERT_TYPE" in
            "letsencrypt")
                if renew_letsencrypt; then
                    renewal_successful=true
                fi
                ;;
            "self-signed")
                if renew_self_signed; then
                    renewal_successful=true
                fi
                ;;
            *)
                log_error "Unknown certificate type: $CERT_TYPE"
                exit 1
                ;;
        esac
        
        # Reload Nginx if renewal was successful
        if [ "$renewal_successful" = true ]; then
            if reload_nginx; then
                send_notification "SUCCESS" "Certificates renewed and Nginx reloaded successfully"
                log_info "Certificate renewal completed successfully"
            else
                send_notification "WARNING" "Certificates renewed but Nginx reload failed"
                log_warn "Certificates renewed but Nginx reload failed"
                exit 1
            fi
        else
            send_notification "ERROR" "Certificate renewal failed"
            log_error "Certificate renewal failed"
            exit 1
        fi
    else
        log_info "No certificate renewal needed"
        send_notification "INFO" "Certificate renewal check completed - no renewal needed"
    fi
}

# Show usage information
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -t, --type TYPE          Certificate type (letsencrypt|self-signed) [default: self-signed]"
    echo "  -c, --container NAME     Nginx container name [default: nginx-tls-proxy]"
    echo "  -f, --force              Force renewal regardless of expiry date"
    echo "  -h, --help               Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  CERT_TYPE                Certificate type"
    echo "  NGINX_CONTAINER          Nginx container name"
    echo "  SLACK_WEBHOOK_URL        Slack webhook URL for notifications"
    echo ""
    echo "Examples:"
    echo "  $0                       # Check and renew if needed"
    echo "  $0 -f                    # Force renewal"
    echo "  $0 -t letsencrypt        # Renew Let's Encrypt certificates"
}

# Parse command line arguments
FORCE_RENEWAL=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            CERT_TYPE="$2"
            shift 2
            ;;
        -c|--container)
            NGINX_CONTAINER="$2"
            shift 2
            ;;
        -f|--force)
            FORCE_RENEWAL=true
            shift
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

# Force renewal if requested
if [ "$FORCE_RENEWAL" = true ]; then
    log_info "Force renewal requested"
    # Temporarily modify certificate files to trigger renewal
    if [ -f "${CERTS_DIR}/orthanc.crt" ]; then
        touch -d "1970-01-01" "${CERTS_DIR}/orthanc.crt"
    fi
    if [ -f "${CERTS_DIR}/bridge.crt" ]; then
        touch -d "1970-01-01" "${CERTS_DIR}/bridge.crt"
    fi
fi

# Run main function
main