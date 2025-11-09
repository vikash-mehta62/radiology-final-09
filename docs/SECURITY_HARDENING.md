# Security Hardening Documentation

## Overview

This document describes the security hardening measures implemented in the Medical Imaging System to protect against common web vulnerabilities and ensure HIPAA compliance.

## Security Measures Implemented

### 1. NoSQL Injection Prevention

**Implementation:** `server/src/middleware/input-validation-middleware.js`

**Protection Mechanisms:**
- Sanitizes all MongoDB query operators (keys starting with `$`)
- Validates and sanitizes request body, query parameters, and route parameters
- Removes potentially malicious operators before database queries
- Logs blocked injection attempts for security monitoring

**Usage:**
```javascript
const { inputValidationMiddleware } = require('./middleware/input-validation-middleware');
app.use(inputValidationMiddleware);
```

**Field Validators:**
- Email validation
- MongoDB ObjectId validation
- Phone number validation
- URL validation
- Date validation (ISO 8601)
- Alphanumeric validation
- Integer/Float validation
- String length validation

**Example:**
```javascript
const { createValidator } = require('./middleware/input-validation-middleware');

// Create validation middleware for specific endpoint
const validateUser = createValidator({
  email: { required: true, type: 'email' },
  name: { required: true, type: 'stringLength', min: 2, max: 100 },
  age: { required: false, type: 'integer' }
});

router.post('/users', validateUser, createUserHandler);
```

### 2. XSS (Cross-Site Scripting) Protection

**Implementation:** `server/src/middleware/xss-protection-middleware.js`

**Protection Mechanisms:**
- Sanitizes all user input to remove malicious scripts
- Allows safe HTML tags for medical report content
- Escapes HTML entities in non-HTML fields
- Sets Content Security Policy (CSP) headers
- Implements X-XSS-Protection headers

**Security Headers Set:**
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; ...
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

**Allowed HTML Tags for Medical Reports:**
- Formatting: `<p>`, `<br>`, `<strong>`, `<em>`, `<u>`, `<span>`, `<div>`
- Lists: `<ul>`, `<ol>`, `<li>`
- Tables: `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`
- Headings: `<h1>` through `<h6>`

**Usage:**
```javascript
const { xssProtectionMiddleware, setSecurityHeaders } = require('./middleware/xss-protection-middleware');

app.use(setSecurityHeaders);
app.use(xssProtectionMiddleware({
  htmlFields: ['findings', 'impression', 'clinicalHistory'],
  excludePaths: ['/health', '/metrics']
}));
```

### 3. CSRF (Cross-Site Request Forgery) Protection

**Implementation:** `server/src/middleware/csrf-protection-middleware.js`

**Protection Mechanisms:**
- Double Submit Cookie pattern (doesn't require server-side session storage)
- HMAC-signed CSRF tokens
- Timing-safe token comparison
- SameSite cookie attribute
- Automatic token generation for safe methods (GET, HEAD, OPTIONS)
- Token validation for state-changing methods (POST, PUT, DELETE, PATCH)

**How It Works:**
1. Server generates CSRF token and signs it with HMAC
2. Token is sent to client in cookie (readable by JavaScript)
3. Client includes token in request header for state-changing operations
4. Server validates token signature and matches cookie value with header value

**Excluded Paths:**
- `/health` - Health check endpoint
- `/metrics` - Metrics endpoint
- `/api/auth/login` - Login endpoint
- `/api/auth/register` - Registration endpoint
- `/api/auth/refresh-token` - Token refresh endpoint
- `/api/orthanc-webhook` - Webhook endpoint

**Client-Side Integration:**
```javascript
// Read CSRF token from cookie
const csrfToken = document.cookie
  .split('; ')
  .find(row => row.startsWith('XSRF-TOKEN='))
  ?.split('=')[1];

// Include in request headers
fetch('/api/reports', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-XSRF-TOKEN': csrfToken
  },
  body: JSON.stringify(data)
});
```

**Cookie Configuration:**
```javascript
{
  httpOnly: false,  // Client needs to read this
  secure: true,     // HTTPS only in production
  sameSite: 'strict',
  maxAge: 24 * 60 * 60 * 1000  // 24 hours
}
```

### 4. Security Testing

**Implementation:** `server/src/utils/security-testing.js`

**Test Categories:**
1. **NoSQL Injection Tests**
   - Tests various injection payloads
   - Validates query sanitization
   - Checks for operator injection

2. **XSS Tests**
   - Tests script injection
   - Tests event handler injection
   - Tests iframe injection
   - Validates output sanitization

3. **CSRF Tests**
   - Tests requests without CSRF token
   - Tests requests with invalid CSRF token
   - Validates token requirement

4. **Authentication/Authorization Tests**
   - Tests unauthenticated access
   - Tests invalid token access
   - Validates access control

**Running Security Audit:**
```bash
# Run comprehensive security audit
node server/src/scripts/run-security-audit.js

# Results saved to:
# - server/security-reports/security-audit-[timestamp].md
# - server/security-reports/security-audit-[timestamp].json
```

**Automated Testing:**
```javascript
const { runSecurityAudit } = require('./utils/security-testing');

const results = await runSecurityAudit('http://localhost:8001', {
  endpoints: ['/api/users', '/api/reports'],
  authHeaders: { Authorization: 'Bearer token' }
});
```

## Security Best Practices

### Input Validation

**Always validate user input:**
```javascript
const { createValidator } = require('./middleware/input-validation-middleware');

const validateReport = createValidator({
  patientId: { required: true, type: 'objectId' },
  findings: { required: true, type: 'stringLength', min: 10, max: 10000 },
  impression: { required: true, type: 'stringLength', min: 10, max: 5000 }
});

router.post('/reports', validateReport, createReportHandler);
```

### Output Sanitization

**Sanitize data before sending to client:**
```javascript
const { sanitizeResponse } = require('./middleware/xss-protection-middleware');

const report = await Report.findById(id);
const sanitizedReport = sanitizeResponse(report, ['findings', 'impression']);
res.json(sanitizedReport);
```

### Parameterized Queries

**Always use Mongoose models (parameterized by default):**
```javascript
// ✅ SAFE - Uses parameterized query
const user = await User.findOne({ email: req.body.email });

// ❌ UNSAFE - Direct query construction
const user = await User.findOne({ $where: `this.email == '${req.body.email}'` });
```

### CSRF Token Handling

**Include CSRF token in all state-changing requests:**
```javascript
// Frontend service
class ApiService {
  getCSRFToken() {
    return document.cookie
      .split('; ')
      .find(row => row.startsWith('XSRF-TOKEN='))
      ?.split('=')[1];
  }

  async post(url, data) {
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-XSRF-TOKEN': this.getCSRFToken()
      },
      body: JSON.stringify(data)
    });
  }
}
```

## Security Monitoring

### Audit Logging

All security events are logged:
- Blocked NoSQL injection attempts
- XSS sanitization events
- CSRF token validation failures
- Authentication failures
- Authorization violations

**Log Format:**
```javascript
{
  timestamp: '2024-01-01T12:00:00.000Z',
  level: 'warn',
  event: 'nosql_injection_blocked',
  details: {
    path: '/api/users',
    method: 'POST',
    ip: '192.168.1.1',
    userId: 'user123',
    payload: '{ "username": { "$ne": null } }'
  }
}
```

### Security Alerts

Configure alerts for security events:
```javascript
// In production, integrate with SIEM or alerting system
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    req.on('security-event', (event) => {
      // Send to SIEM
      siemClient.send(event);
      
      // Send alert for critical events
      if (event.severity === 'critical') {
        alertManager.sendAlert(event);
      }
    });
    next();
  });
}
```

## Compliance

### HIPAA Security Rule

Security hardening measures support HIPAA compliance:

1. **Access Control (§164.312(a)(1))**
   - Authentication required for all endpoints
   - Authorization checks on sensitive data
   - Session management with timeout

2. **Audit Controls (§164.312(b))**
   - All security events logged
   - Audit logs encrypted and tamper-proof
   - 7-year retention period

3. **Integrity (§164.312(c)(1))**
   - Input validation prevents data corruption
   - CSRF protection prevents unauthorized modifications
   - Digital signatures ensure data integrity

4. **Transmission Security (§164.312(e)(1))**
   - TLS 1.3 for all communications
   - Secure cookie attributes
   - Content Security Policy headers

### FDA 21 CFR Part 11

Security measures support FDA compliance:

1. **System Validation (§11.10(a))**
   - Automated security testing
   - Regular security audits
   - Documented security procedures

2. **Audit Trail (§11.10(e))**
   - All security events logged
   - Tamper-proof audit logs
   - Complete traceability

3. **System Security (§11.10(g))**
   - Multi-layer security protection
   - Input validation and sanitization
   - CSRF and XSS protection

## Deployment Checklist

### Production Security Configuration

- [ ] Enable HTTPS/TLS 1.3
- [ ] Set `NODE_ENV=production`
- [ ] Configure secure cookie settings
- [ ] Set strong CSRF secret
- [ ] Enable security headers
- [ ] Configure CSP for production domains
- [ ] Set up security monitoring
- [ ] Configure audit log retention
- [ ] Enable rate limiting
- [ ] Set up IP whitelisting (if applicable)
- [ ] Configure MFA for sensitive operations
- [ ] Set up automated security scanning
- [ ] Configure backup and disaster recovery
- [ ] Document security procedures
- [ ] Train staff on security best practices

### Environment Variables

```bash
# Security Configuration
NODE_ENV=production
CSRF_SECRET=<strong-random-secret>
JWT_SECRET=<strong-random-secret>
JWT_REFRESH_SECRET=<strong-random-secret>

# Cookie Configuration
COOKIE_SECURE=true
COOKIE_SAMESITE=strict

# Security Headers
CSP_ENABLED=true
HSTS_ENABLED=true

# Monitoring
SIEM_ENABLED=true
SIEM_ENDPOINT=<siem-endpoint>
ALERTS_ENABLED=true
```

## Testing

### Manual Testing

```bash
# Test NoSQL injection protection
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": {"$ne": null}, "password": {"$ne": null}}'
# Expected: 400 Bad Request (blocked)

# Test XSS protection
curl -X POST http://localhost:8001/api/reports \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"findings": "<script>alert(\"XSS\")</script>"}'
# Expected: Script tags removed/escaped

# Test CSRF protection
curl -X POST http://localhost:8001/api/reports \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"findings": "Test"}'
# Expected: 403 Forbidden (missing CSRF token)
```

### Automated Testing

```bash
# Run security audit
npm run security:audit

# Run with specific endpoints
node server/src/scripts/run-security-audit.js
```

## Incident Response

### Security Incident Procedure

1. **Detection**
   - Monitor security logs
   - Review security alerts
   - Analyze anomalies

2. **Containment**
   - Block malicious IPs
   - Revoke compromised tokens
   - Isolate affected systems

3. **Investigation**
   - Review audit logs
   - Identify attack vector
   - Assess impact

4. **Remediation**
   - Patch vulnerabilities
   - Update security rules
   - Strengthen controls

5. **Recovery**
   - Restore from backups
   - Verify system integrity
   - Resume normal operations

6. **Post-Incident**
   - Document incident
   - Update procedures
   - Train staff
   - Implement improvements

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP NoSQL Injection](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/05.6-Testing_for_NoSQL_Injection)
- [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html)
- [FDA 21 CFR Part 11](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/part-11-electronic-records-electronic-signatures-scope-and-application)

## Support

For security concerns or questions:
- Email: security@example.com
- Security Hotline: +1-XXX-XXX-XXXX
- Bug Bounty Program: https://example.com/security/bounty
