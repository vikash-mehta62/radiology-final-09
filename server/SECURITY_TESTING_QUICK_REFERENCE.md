# Security Testing - Quick Reference

## Quick Start

```bash
# Run all security tests
npm run test:security

# Run comprehensive audit
npm run security:audit

# Run specific test suite
npm run test:security:penetration
npm run test:security:vulnerability
npm run test:security:compliance
```

## Test Files

| File | Purpose | Tests |
|------|---------|-------|
| `penetration-testing.test.js` | Attack simulation | 50+ |
| `vulnerability-scanning.test.js` | Vulnerability detection | 60+ |
| `compliance-validation.test.js` | Regulatory compliance | 40+ |

## What's Tested

### 🔐 Security
- Authentication bypass
- Authorization bypass
- Injection attacks (NoSQL, SQL, Command, LDAP, XML)
- Session hijacking
- CSRF attacks
- XSS vulnerabilities
- File upload security
- Cryptographic security

### 📋 Compliance
- FDA 21 CFR Part 11 (Electronic signatures)
- HIPAA (PHI protection)
- SOC 2 (Security controls)

## Common Commands

```bash
# Development
npm run test:security              # Run all security tests
npm run test:security:penetration  # Penetration tests only
npm run test:security:vulnerability # Vulnerability scans only
npm run test:security:compliance   # Compliance tests only

# Production
npm run security:audit             # Full audit with report

# CI/CD
npm test -- tests/security --ci    # CI mode
```

## Report Locations

- **Reports**: `server/security-reports/`
- **Markdown**: `security-audit-YYYY-MM-DD.md`
- **JSON**: `security-audit-YYYY-MM-DD.json`

## Test Results

- ✅ **PASS** - Security control working
- ❌ **FAIL** - Vulnerability detected
- ⚠️ **WARNING** - Review recommended

## Critical Checks

Before deployment:
- [ ] All security tests pass
- [ ] No critical vulnerabilities
- [ ] FDA compliance validated
- [ ] HIPAA compliance validated
- [ ] SOC 2 compliance validated

## Quick Fixes

### NoSQL Injection
```javascript
// Sanitize MongoDB operators
req.body = sanitizeMongoQuery(req.body);
```

### XSS
```javascript
// Sanitize HTML
const xss = require('xss');
const clean = xss(userInput);
```

### CSRF
```javascript
// Add CSRF protection
app.use(csrf({ cookie: true }));
```

### Weak Passwords
```javascript
// Enforce strong passwords
const bcrypt = require('bcryptjs');
const hash = await bcrypt.hash(password, 10);
```

## Environment Variables

```bash
# Required for security tests
MONGODB_TEST_URI=mongodb://localhost:27017/dicomdb-test
JWT_SECRET=your-secret-key-min-32-chars
ENCRYPTION_KEY=your-encryption-key
SESSION_TIMEOUT=1800000
```

## Support

- **Guide**: `SECURITY_TESTING_GUIDE.md`
- **Complete Docs**: `SECURITY_TESTING_COMPLETE.md`
- **Utils**: `src/utils/security-testing.js`

## Metrics

Track:
- Vulnerabilities detected
- Time to fix
- Test coverage
- Compliance score

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [FDA 21 CFR Part 11](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/part-11-electronic-records-electronic-signatures-scope-and-application)
- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html)

---

**Total Tests**: 150+
**Coverage**: Authentication, Authorization, Injection, Session, CSRF, XSS, Compliance
**Status**: ✅ Ready for Production
