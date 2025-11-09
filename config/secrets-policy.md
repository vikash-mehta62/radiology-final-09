# Secrets Policy - Unified Reporting System

## Overview

This document defines the policy for handling secrets, credentials, and sensitive data in the codebase.

## Core Principles

1. **Never commit secrets to version control**
2. **Use environment variables for all secrets**
3. **Rotate secrets regularly**
4. **Audit access to secrets**
5. **Encrypt secrets at rest and in transit**

## Prohibited Patterns

The following patterns are **NEVER** allowed in committed code:

### API Keys & Tokens
```regex
AKIA[0-9A-Z]{16}                           # AWS Access Key
['\"]?api[_-]?key['\"]?\s*[:=]\s*['\"][^'\"]{16,}
['\"]?token['\"]?\s*[:=]\s*['\"][^'\"]{16,}
Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+  # JWT
```

### Private Keys
```regex
-----BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY-----
```

### Passwords & Secrets
```regex
['\"]?password['\"]?\s*[:=]\s*['\"][^'\"]{8,}
['\"]?secret['\"]?\s*[:=]\s*['\"][^'\"]{16,}
['\"]?passwd['\"]?\s*[:=]\s*['\"][^'\"]{8,}
```

### Database Connection Strings
```regex
mongodb(\+srv)?://[^:]+:[^@]+@
postgres://[^:]+:[^@]+@
mysql://[^:]+:[^@]+@
```

### Email & Phone (PII)
```regex
[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}  # Email
\+?1?\d{10,}                                     # Phone
\d{3}-\d{2}-\d{4}                                # SSN
```

### Medical Record Numbers (MRN)
```regex
MRN[:\s]*[A-Z0-9]{6,10}
[A-Z]{2,3}\d{6,10}
```

## Allowed Patterns

The following are acceptable:

### Placeholders
```typescript
const API_KEY = process.env.VITE_API_KEY || 'YOUR_API_KEY_HERE';
const PASSWORD = 'PLACEHOLDER_PASSWORD';  // OK - clearly a placeholder
const EXAMPLE_TOKEN = 'example-token-12345';  // OK - marked as example
```

### Test/Mock Data
```typescript
// In test files only
const MOCK_API_KEY = 'test-key-12345';
const TEST_PASSWORD = 'test-password';
```

## Pre-commit Checks

### Git Hooks

Install pre-commit hook:

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Check for secrets
if git diff --cached | grep -E "AKIA[0-9A-Z]{16}|-----BEGIN.*PRIVATE KEY"; then
    echo "ERROR: Potential secret detected in commit"
    echo "Please remove secrets and use environment variables"
    exit 1
fi
```

### Manual Check

Before committing:

```bash
# Search for potential secrets
grep -rE "AKIA[0-9A-Z]{16}|password.*=.*['\"]" viewer/src/ --exclude-dir=node_modules

# Run security audit
npm run security:audit
```

## Environment Variables

### Required Variables

```bash
# API Configuration
VITE_API_URL=https://api.example.com
VITE_API_KEY=<secret>

# Database
MONGO_URI=<secret>
MONGO_DB_NAME=radiology

# Authentication
JWT_SECRET=<secret>
SESSION_SECRET=<secret>

# External Services
AWS_ACCESS_KEY_ID=<secret>
AWS_SECRET_ACCESS_KEY=<secret>
SENTRY_DSN=<secret>
```

### Storage

- **Development**: `.env.local` (gitignored)
- **Staging**: Environment variables in CI/CD
- **Production**: Secrets manager (AWS Secrets Manager, HashiCorp Vault)

## Secret Rotation

### Schedule

- **API Keys**: Every 90 days
- **Database Passwords**: Every 90 days
- **JWT Secrets**: Every 180 days
- **Service Account Keys**: Every 90 days

### Process

1. Generate new secret
2. Update in secrets manager
3. Deploy with both old and new (grace period)
4. Switch to new secret
5. Revoke old secret after 24h

## Incident Response

### If Secret is Committed

1. **Immediately revoke the secret**
2. Generate new secret
3. Update all systems
4. Remove from git history:
   ```bash
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch path/to/file" \
     --prune-empty --tag-name-filter cat -- --all
   ```
5. Force push (coordinate with team)
6. Document in incident log

### If Secret is Leaked

1. **Revoke immediately**
2. Assess impact (check logs for unauthorized access)
3. Generate new secret
4. Update all systems
5. Notify security team
6. File incident report

## PII Handling

### Redaction

Always redact PII before logging or sending to telemetry:

```typescript
import { redactPII } from './utils/redaction';

// Before logging
const message = redactPII(userInput);
console.log(message);

// Before telemetry
telemetryEmit('event', { data: redactPII(data) });
```

### Storage

- **Never log PII** to console or files
- **Encrypt PII** in database
- **Mask PII** in UI (show last 4 digits only)
- **Audit access** to PII

## Compliance

### HIPAA

- All PHI must be encrypted at rest and in transit
- Access to PHI must be logged
- PHI must not be in logs or telemetry
- Regular audits required

### GDPR

- PII must be deletable (right to be forgotten)
- PII must be portable (data export)
- Consent required for processing
- Data minimization principle

## Audit Trail

### What to Log

- Secret access (who, when, what)
- Secret rotation events
- Failed authentication attempts
- Unauthorized access attempts

### What NOT to Log

- Secret values
- Passwords
- API keys
- PII (unless redacted)

## Tools

### Recommended

- **git-secrets**: Prevent committing secrets
- **truffleHog**: Scan git history for secrets
- **detect-secrets**: Pre-commit hook
- **Vault**: Secret management
- **SOPS**: Encrypted config files

### Installation

```bash
# git-secrets
brew install git-secrets
git secrets --install
git secrets --register-aws

# detect-secrets
pip install detect-secrets
detect-secrets scan > .secrets.baseline
```

## Training

All team members must:

1. Read this policy
2. Complete security training
3. Acknowledge understanding
4. Review annually

## Enforcement

Violations of this policy may result in:

1. Code review rejection
2. Incident investigation
3. Mandatory retraining
4. Disciplinary action

## Contact

- **Security Team**: security@example.com
- **On-Call**: [PagerDuty]
- **Incident Hotline**: [Phone]

## References

- [OWASP Secrets Management](https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_password)
- [NIST SP 800-63B](https://pages.nist.gov/800-63-3/sp800-63b.html)
- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html)

---

**Last Updated**: 2024-01-15
**Version**: 1.0
**Owner**: Security Team
