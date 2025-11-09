# Nginx TLS Configuration for Orthanc Bridge

This directory contains the Nginx reverse proxy configuration with TLS termination for the Orthanc Bridge system. The configuration provides enterprise-grade security with SSL/TLS best practices, security headers, and rate limiting.

## Features

- **TLS Termination**: Handles SSL/TLS encryption for both Orthanc and Bridge services
- **Security Headers**: Implements comprehensive security headers (HSTS, CSP, X-Frame-Options, etc.)
- **Rate Limiting**: Protects against abuse with configurable rate limits
- **Health Checks**: Dedicated endpoints for monitoring and health checks
- **Certificate Management**: Automated certificate generation and renewal
- **Production Ready**: Optimized for production deployment with proper logging and monitoring

## Quick Start

### 1. Generate Certificates

For development/testing (self-signed):
```bash
cd nginx-config
./generate-certs.sh
```

For production (Let's Encrypt):
```bash
cd nginx-config
./generate-certs.sh -t letsencrypt -o orthanc.yourdomain.com -b bridge.yourdomain.com -e admin@yourdomain.com
```

### 2. Start with TLS

```bash
# Start the full stack with Nginx TLS proxy
docker-compose -f docker-compose.yml -f nginx-config/docker-compose.nginx.yml up -d

# Check status
docker-compose -f docker-compose.yml -f nginx-config/docker-compose.nginx.yml ps
```

### 3. Verify TLS Configuration

```bash
# Test Orthanc HTTPS endpoint
curl -k https://orthanc.local/system

# Test Bridge HTTPS endpoint  
curl -k https://bridge.local/health

# Check certificate details
openssl s_client -connect orthanc.local:443 -servername orthanc.local
```

## Configuration Files

### Core Files

- `nginx.conf` - Main Nginx configuration with TLS settings
- `docker-compose.nginx.yml` - Docker Compose override for Nginx service
- `generate-certs.sh` - Certificate generation script
- `renew-certs.sh` - Certificate renewal script

### Generated Files

- `certs/` - Directory containing SSL certificates
- `logs/` - Nginx access and error logs
- `dhparam.pem` - Diffie-Hellman parameters for enhanced security

## Certificate Types

### Self-Signed Certificates (Development)

```bash
# Generate self-signed certificates
./generate-certs.sh -t self-signed

# Custom domains
./generate-certs.sh -t self-signed -o orthanc.dev.local -b bridge.dev.local
```

**Note**: For self-signed certificates, add the CA certificate (`certs/ca.crt`) to your browser's trusted certificate store.

### Let's Encrypt Certificates (Production)

```bash
# Generate Let's Encrypt certificates
./generate-certs.sh -t letsencrypt -o orthanc.example.com -b bridge.example.com -e admin@example.com
```

**Requirements**:
- Domain names must resolve to your server's public IP
- Ports 80 and 443 must be accessible from the internet
- `certbot` must be installed on the system

## Security Features

### TLS Configuration

- **Protocols**: TLS 1.2 and 1.3 only
- **Ciphers**: Modern cipher suites with forward secrecy
- **HSTS**: Strict Transport Security with preload
- **OCSP Stapling**: Enabled for certificate validation

### Security Headers

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'; ...
Referrer-Policy: strict-origin-when-cross-origin
```

### Rate Limiting

- **API Endpoints**: 10 requests/second with burst of 20
- **Webhook Endpoints**: 100 requests/minute with burst of 200
- **DICOM Upload**: 50 requests burst for large file handling
- **Admin Endpoints**: 10 requests burst with IP restrictions

## Monitoring and Logging

### Log Files

- `logs/access.log` - HTTP access logs with timing information
- `logs/error.log` - Nginx error logs

### Health Checks

- Orthanc: `https://orthanc.local/system`
- Bridge: `https://bridge.local/health`
- Nginx: Built-in Docker health check

### Metrics

The configuration includes detailed timing information in access logs:
- Request time (`rt`)
- Upstream connect time (`uct`)
- Upstream header time (`uht`)
- Upstream response time (`urt`)

## Certificate Renewal

### Automatic Renewal

Set up a cron job for automatic certificate renewal:

```bash
# Add to crontab (crontab -e)
# Check for renewal daily at 2 AM
0 2 * * * /path/to/nginx-config/renew-certs.sh -t letsencrypt

# For self-signed certificates (renew every 6 months)
0 2 1 */6 * /path/to/nginx-config/renew-certs.sh -t self-signed
```

### Manual Renewal

```bash
# Check certificate status and renew if needed
./renew-certs.sh

# Force renewal
./renew-certs.sh -f

# Renew specific certificate type
./renew-certs.sh -t letsencrypt
```

## Customization

### Domain Names

Update domain names in:
1. `nginx.conf` - Server name directives
2. Certificate generation scripts
3. Docker Compose environment variables

### Rate Limits

Modify rate limiting in `nginx.conf`:
```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=webhook:10m rate=100r/m;
```

### Security Headers

Customize security headers in the `http` block of `nginx.conf`.

### IP Restrictions

Add IP whitelist for admin endpoints:
```nginx
location /admin {
    allow 10.0.0.0/8;
    allow 192.168.0.0/16;
    deny all;
    # ... rest of configuration
}
```

## Troubleshooting

### Common Issues

1. **Certificate Errors**
   ```bash
   # Validate certificates
   openssl x509 -in certs/orthanc.crt -text -noout
   
   # Check certificate-key match
   openssl x509 -noout -modulus -in certs/orthanc.crt | openssl md5
   openssl rsa -noout -modulus -in certs/orthanc.key | openssl md5
   ```

2. **Nginx Configuration Errors**
   ```bash
   # Test configuration
   docker exec nginx-tls-proxy nginx -t
   
   # Check logs
   docker logs nginx-tls-proxy
   ```

3. **Connection Issues**
   ```bash
   # Test internal connectivity
   docker exec nginx-tls-proxy curl http://orthanc:8042/system
   docker exec nginx-tls-proxy curl http://dicom-bridge:3000/health
   ```

### Debug Mode

Enable debug logging in `nginx.conf`:
```nginx
error_log /var/log/nginx/error.log debug;
```

## Production Deployment

### Pre-deployment Checklist

- [ ] Valid SSL certificates generated
- [ ] Domain names configured in DNS
- [ ] Firewall rules allow ports 80 and 443
- [ ] Certificate renewal automation configured
- [ ] Monitoring and alerting set up
- [ ] Backup procedures for certificates

### Performance Tuning

For high-traffic environments, consider:
- Increasing worker processes and connections
- Enabling HTTP/2 push for static assets
- Configuring upstream keepalive connections
- Implementing caching for static content

### Security Hardening

Additional security measures:
- Implement fail2ban for brute force protection
- Use ModSecurity WAF for application-level protection
- Enable audit logging for compliance requirements
- Implement certificate transparency monitoring

## Support

For issues related to:
- **Nginx Configuration**: Check Nginx documentation and logs
- **SSL/TLS Issues**: Validate certificates and test with SSL Labs
- **Docker Integration**: Verify container networking and health checks
- **Let's Encrypt**: Check certbot logs and domain validation

## References

- [Nginx SSL/TLS Configuration](https://nginx.org/en/docs/http/configuring_https_servers.html)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [OWASP TLS Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html)