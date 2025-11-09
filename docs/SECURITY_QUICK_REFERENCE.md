# Security Quick Reference Guide

## For Developers

### Input Validation

**Always validate user input:**

```javascript
// ✅ GOOD - Use validation middleware
const { createValidator } = require('./middleware/input-validation-middleware');

const validateReport = createValidator({
  patientId: { required: true, type: 'objectId' },
  findings: { required: true, type: 'stringLength', min: 10, max: 10000 }
});

router.post('/reports', validateReport, createReportHandler);
```

```javascript
// ❌ BAD - No validation
router.post('/reports', createReportHandler);
```

### Database Queries

**Always use Mongoose models (parameterized queries):**

```javascript
// ✅ GOOD - Parameterized query
const user = await User.findOne({ email: req.body.email });

// ❌ BAD - String concatenation
const user = await User.findOne({ $where: `this.email == '${req.body.email}'` });
```

### XSS Prevention

**Sanitize output before sending to client:**

```javascript
// ✅ GOOD - Sanitize response
const { sanitizeResponse } = require('./middleware/xss-protection-middleware');

const report = await Report.findById(id);
const sanitizedReport = sanitizeResponse(report, ['findings', 'impression']);
res.json(sanitizedReport);
```

```javascript
// ❌ BAD - No sanitization
const report = await Report.findById(id);
res.json(report);
```

### CSRF Protection

**Include CSRF token in state-changing requests:**

```javascript
// ✅ GOOD - Include CSRF token
const csrfToken = document.cookie
  .split('; ')
  .find(row => row.startsWith('XSRF-TOKEN='))
  ?.split('=')[1];

fetch('/api/reports', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-XSRF-TOKEN': csrfToken
  },
  body: JSON.stringify(data)
});
```

```javascript
// ❌ BAD - No CSRF token
fetch('/api/reports', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});
```

### Authentication

**Always check authentication:**

```javascript
// ✅ GOOD - Protected route
const { authenticateToken } = require('./middleware/authMiddleware');

router.get('/reports', authenticateToken, getReportsHandler);
```

```javascript
// ❌ BAD - Unprotected route
router.get('/reports', getReportsHandler);
```

### Error Handling

**Don't leak sensitive information:**

```javascript
// ✅ GOOD - Generic error message
try {
  await processPayment(data);
} catch (error) {
  console.error('Payment error:', error); // Log details
  res.status(500).json({ 
    success: false, 
    message: 'Payment processing failed' // Generic message
  });
}
```

```javascript
// ❌ BAD - Exposes internal details
try {
  await processPayment(data);
} catch (error) {
  res.status(500).json({ 
    success: false, 
    message: error.message, // Exposes internal error
    stack: error.stack // Exposes code structure
  });
}
```

### Logging

**Don't log sensitive data:**

```javascript
// ✅ GOOD - Sanitized logging
console.log('User login:', { 
  userId: user.id, 
  email: user.email.replace(/(.{2}).*(@.*)/, '$1***$2') 
});
```

```javascript
// ❌ BAD - Logs sensitive data
console.log('User login:', { 
  userId: user.id, 
  email: user.email, 
  password: user.password // Never log passwords!
});
```

## Common Security Pitfalls

### 1. NoSQL Injection

```javascript
// ❌ VULNERABLE
const user = await User.findOne({ 
  username: req.body.username,
  password: req.body.password 
});
// Attack: { "username": {"$ne": null}, "password": {"$ne": null} }

// ✅ PROTECTED (middleware sanitizes input)
// Input validation middleware removes $ operators
```

### 2. XSS

```javascript
// ❌ VULNERABLE
res.send(`<h1>Welcome ${req.query.name}</h1>`);
// Attack: ?name=<script>alert('XSS')</script>

// ✅ PROTECTED
const { sanitizeString } = require('./middleware/xss-protection-middleware');
res.send(`<h1>Welcome ${sanitizeString(req.query.name)}</h1>`);
```

### 3. CSRF

```javascript
// ❌ VULNERABLE
router.post('/transfer', (req, res) => {
  transferMoney(req.body.amount, req.body.to);
});
// Attack: Malicious site submits form to this endpoint

// ✅ PROTECTED (CSRF middleware validates token)
router.post('/transfer', csrfProtection, (req, res) => {
  transferMoney(req.body.amount, req.body.to);
});
```

### 4. Authentication Bypass

```javascript
// ❌ VULNERABLE
router.get('/admin', (req, res) => {
  if (req.query.admin === 'true') {
    // Show admin panel
  }
});

// ✅ PROTECTED
router.get('/admin', authenticateToken, requireRole('admin'), (req, res) => {
  // Show admin panel
});
```

## Security Checklist

### Before Committing Code

- [ ] All user inputs validated
- [ ] Database queries parameterized
- [ ] Outputs sanitized
- [ ] Authentication required for protected routes
- [ ] Authorization checks in place
- [ ] CSRF tokens included in forms
- [ ] No sensitive data in logs
- [ ] Error messages don't leak information
- [ ] Security headers configured
- [ ] Dependencies up to date

### Before Deploying

- [ ] Security audit passed
- [ ] Penetration testing completed
- [ ] HTTPS/TLS configured
- [ ] Environment variables secured
- [ ] Secrets not in code
- [ ] Rate limiting enabled
- [ ] Monitoring configured
- [ ] Backup procedures tested
- [ ] Incident response plan ready
- [ ] Security documentation updated

## Testing Security

### Run Security Audit

```bash
npm run security:audit
```

### Manual Testing

```bash
# Test NoSQL injection
curl -X POST http://3.144.196.75:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": {"$ne": null}, "password": {"$ne": null}}'

# Test XSS
curl -X POST http://3.144.196.75:8001/api/reports \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"findings": "<script>alert(\"XSS\")</script>"}'

# Test CSRF
curl -X POST http://3.144.196.75:8001/api/reports \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"findings": "Test"}'
```

## Emergency Contacts

- **Security Team:** security@example.com
- **Emergency Hotline:** +1-XXX-XXX-XXXX
- **On-Call Engineer:** Available 24/7

## Resources

- [Full Security Documentation](./SECURITY_HARDENING.md)
- [Security Audit Findings](./SECURITY_AUDIT_FINDINGS.md)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html)
