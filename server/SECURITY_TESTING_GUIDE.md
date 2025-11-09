# Security Testing Guide

This guide explains how to run security tests and interpret the results.

## Overview

The security testing suite includes:

1. **Penetration Testing** - Tests for authentication bypass, authorization bypass, injection attacks, and session hijacking
2. **Vulnerability Scanning** - Automated scans for known security vulnerabilities
3. **Compliance Validation** - Tests for FDA 21 CFR Part 11, HIPAA, and SOC 2 compliance

## Running Security Tests

### Option 1: Run All Security Tests with Jest

```bash
# Run all security tests
npm test -- tests/security

# Run specific test suite
npm test -- tests/security/penetration-testing.test.js
npm test -- tests/security/vulnerability-scanning.test.js
npm test -- tests/security/compliance-validation.test.js
```

### Option 2: Run Comprehensive Security Audit

```bash
# Run full security audit with report generation
node run-security-audit.js

# With custom configuration
API_BASE_URL=http://3.144.196.75:8001 \
TEST_USERNAME=admin \
TEST_PASSWORD=admin123 \
node run-security-audit.js
```

### Option 3: Run Individual Security Tests

```bash
# Test specific vulnerability
node -e "const { testNoSQLInjection } = require('./src/utils/security-testing'); testNoSQLInjection('http://3.144.196.75:8001', '/api/auth/login').then(console.log);"
```

## Test Categories

### 1. Penetration Testing

Tests for common attack vectors:

- **Authentication Bypass**
  - Invalid tokens
  - Expired tokens
  - Malformed tokens
  - Tampered tokens

- **Authorization Bypass**
  - Privilege escalation
  - Horizontal privilege escalation
  - Role modification attempts

- **Injection Attacks**
  - NoSQL injection
  - SQL injection patterns
  - Command injection
  - LDAP injection
  - XML injection

- **Session Hijacking**
  - Token invalidation after logout
  - Session fixation
  - Concurrent session abuse
  - IP binding

- **CSRF Attacks**
  - Missing CSRF tokens
  - Invalid CSRF tokens

- **Rate Limiting**
  - Login attempt limits
  - API request limits

- **Information Disclosure**
  - Sensitive error messages
  - Stack trace exposure
  - Database error exposure

### 2. Vulnerability Scanning

Automated scans for:

- **Dependency Vulnerabilities**
  - Known vulnerable packages
  - Deprecated packages
  - Outdated dependencies

- **XSS Vulnerabilities**
  - HTML injection
  - Script injection
  - Event handler injection
  - Security headers (CSP, X-XSS-Protection)

- **Injection Vulnerabilities**
  - NoSQL injection in all endpoints
  - LDAP injection
  - XML injection (XXE)

- **Authentication Vulnerabilities**
  - Weak password requirements
  - Password storage (hashing)
  - Password exposure in responses
  - Account lockout mechanisms

- **Session Management Vulnerabilities**
  - Secure token generation
  - Secure cookie flags
  - Session timeout

- **File Upload Vulnerabilities**
  - File type validation
  - File size limits
  - Filename sanitization

- **API Security Headers**
  - X-Frame-Options
  - Strict-Transport-Security
  - X-Content-Type-Options
  - Server information exposure
  - CORS configuration

- **Cryptographic Vulnerabilities**
  - Weak encryption algorithms
  - Insufficient key lengths
  - Hardcoded secrets

- **Error Handling Vulnerabilities**
  - Internal error exposure
  - Malformed JSON handling
  - Database error handling

### 3. Compliance Validation

Tests for regulatory compliance:

#### FDA 21 CFR Part 11 Compliance

- **Electronic Signatures (§11.50)**
  - Signature-record linking
  - Signer identification
  - Date and time stamps
  - Signature meaning

- **Signature Manifestations (§11.70)**
  - Signed record display
  - Signature status indication

- **Signature/Record Linking (§11.100)**
  - Prevention of signed record modification
  - Tampering detection

- **Audit Trail (§11.10(e))**
  - Complete audit trail maintenance
  - Signature operation logging
  - Tamper-proof audit logs

- **System Validation (§11.10(a))**
  - Signature algorithm validation
  - Key size validation

#### HIPAA Compliance

- **Access Controls (§164.312(a)(1))**
  - Unique user identification
  - Role-based access control
  - Automatic logoff

- **Audit Controls (§164.312(b))**
  - PHI access logging
  - PHI modification logging
  - Audit log retention

- **Integrity Controls (§164.312(c)(1))**
  - Protection from improper alteration
  - Unauthorized modification detection

- **Transmission Security (§164.312(e)(1))**
  - Encryption for data transmission
  - PHI protection during transmission

- **Encryption (§164.312(a)(2)(iv))**
  - PHI encryption at rest
  - Strong encryption algorithms
  - Encryption key protection

- **Minimum Necessary (§164.502(b))**
  - Limited data access

#### SOC 2 Compliance

- **Security (CC6)**
  - Logical access controls
  - Authorization controls
  - Malicious software protection

- **Availability (CC7)**
  - Backup procedures
  - System monitoring

- **Processing Integrity (CC8)**
  - Input data validation
  - Data integrity maintenance

- **Confidentiality (CC9)**
  - Confidential information protection
  - Data classification

- **Privacy (P1)**
  - Privacy notice
  - Consent management

## Interpreting Results

### Test Status

- ✅ **PASS** - Security control is properly implemented
- ❌ **FAIL** - Vulnerability detected, requires immediate attention
- ⚠️ **WARNING** - Potential issue, review recommended

### Severity Levels

- **CRITICAL** - Immediate security risk, fix immediately
- **HIGH** - Significant security risk, fix within 24 hours
- **MEDIUM** - Moderate security risk, fix within 1 week
- **LOW** - Minor security issue, fix in next release

### Common Vulnerabilities and Fixes

#### NoSQL Injection

**Vulnerability**: Accepting MongoDB operators in user input

**Fix**: Sanitize all user inputs to remove `$` operators

```javascript
function sanitizeMongoQuery(obj) {
  if (typeof obj === 'object') {
    for (const key in obj) {
      if (key.startsWith('$')) {
        delete obj[key];
      }
    }
  }
  return obj;
}
```

#### XSS (Cross-Site Scripting)

**Vulnerability**: Reflecting user input without sanitization

**Fix**: Sanitize HTML and set proper security headers

```javascript
const xss = require('xss');
const sanitized = xss(userInput);
```

#### CSRF (Cross-Site Request Forgery)

**Vulnerability**: Accepting state-changing requests without CSRF tokens

**Fix**: Implement CSRF protection

```javascript
const csrf = require('csurf');
app.use(csrf({ cookie: true }));
```

#### Weak Authentication

**Vulnerability**: Accepting weak passwords or not hashing properly

**Fix**: Enforce strong password requirements and use bcrypt

```javascript
const bcrypt = require('bcryptjs');
const hashedPassword = await bcrypt.hash(password, 10);
```

#### Session Hijacking

**Vulnerability**: Insecure session management

**Fix**: Use secure session tokens and implement timeout

```javascript
app.use(session({
  secret: process.env.SESSION_SECRET,
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 1800000 // 30 minutes
  }
}));
```

## Security Testing Checklist

Before deploying to production, ensure:

- [ ] All penetration tests pass
- [ ] No critical or high vulnerabilities detected
- [ ] All dependencies are up to date
- [ ] FDA 21 CFR Part 11 compliance validated
- [ ] HIPAA compliance validated
- [ ] SOC 2 compliance validated
- [ ] Security headers properly configured
- [ ] Encryption enabled for PHI
- [ ] Audit logging enabled
- [ ] Rate limiting configured
- [ ] CSRF protection enabled
- [ ] Input validation implemented
- [ ] Error handling doesn't expose sensitive information
- [ ] Session management is secure
- [ ] File upload restrictions in place

## Continuous Security Testing

### Automated Testing

Add security tests to CI/CD pipeline:

```yaml
# .github/workflows/security.yml
name: Security Tests
on: [push, pull_request]
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run security tests
        run: npm test -- tests/security
      - name: Run security audit
        run: node run-security-audit.js
```

### Regular Audits

Schedule regular security audits:

- **Daily**: Automated vulnerability scans
- **Weekly**: Penetration testing
- **Monthly**: Compliance validation
- **Quarterly**: Full security audit with external review

### Monitoring

Monitor for security events:

- Failed login attempts
- Unauthorized access attempts
- Unusual API usage patterns
- Signature verification failures
- Audit log anomalies

## Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** create a public GitHub issue
2. Email security@yourcompany.com with details
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [FDA 21 CFR Part 11](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/part-11-electronic-records-electronic-signatures-scope-and-application)
- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html)
- [SOC 2 Compliance](https://www.aicpa.org/interestareas/frc/assuranceadvisoryservices/aicpasoc2report.html)

## Support

For questions about security testing:

- Review this guide
- Check test output and reports
- Consult security team
- Review security documentation in `/docs`
