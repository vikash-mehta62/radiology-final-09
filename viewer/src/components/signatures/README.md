# FDA-Compliant Digital Signature Components

This directory contains the UI components for implementing FDA 21 CFR Part 11 compliant digital signatures in the medical imaging reporting system.

## Components

### SignatureModal
A modal dialog for signing reports with FDA compliance notices.

**Features:**
- Signature meaning selector (Author, Reviewer, Approver)
- Password confirmation for identity verification
- FDA 21 CFR Part 11 compliance notice
- Loading states and error handling
- Keyboard shortcuts (Enter to sign)

**Usage:**
```tsx
import { SignatureModal } from '@/components/signatures'

<SignatureModal
  open={isOpen}
  reportId={reportId}
  onClose={() => setIsOpen(false)}
  onSigned={(signature) => console.log('Signed:', signature)}
/>
```

### SignatureVerificationBadge
A badge component that displays signature verification status with detailed tooltips.

**Features:**
- Auto-verification on mount
- Visual status indicators (Valid, Invalid, Revoked)
- Detailed tooltip with signature information
- Real-time verification status
- Support for different sizes

**Usage:**
```tsx
import { SignatureVerificationBadge } from '@/components/signatures'

<SignatureVerificationBadge
  signatureId={signatureId}
  reportId={reportId}
  showDetails={true}
  size="medium"
  onVerificationComplete={(result) => console.log('Verified:', result)}
/>
```

### AuditTrailViewer
A timeline component for displaying signature audit events.

**Features:**
- Timeline visualization of audit events
- Event filtering and search
- Export to CSV functionality
- Real-time updates
- Detailed event information

**Usage:**
```tsx
import { AuditTrailViewer } from '@/components/signatures'

<AuditTrailViewer
  reportId={reportId}
  signatureId={signatureId}
  maxHeight={600}
  showExport={true}
/>
```

## Hooks

### useSignature
A custom hook for managing signature operations.

**Features:**
- Sign reports
- Verify signatures
- Revoke signatures
- Fetch audit trails
- State management for signatures

**Usage:**
```tsx
import { useSignature } from '@/hooks/useSignature'

const {
  signature,
  verificationResult,
  loading,
  error,
  signReport,
  verifySignature,
  revokeSignature,
  getAuditTrail,
  clearError
} = useSignature()

// Sign a report
await signReport(reportId, 'author', password)

// Verify a signature
const result = await verifySignature(signatureId)

// Revoke a signature
await revokeSignature(signatureId, reason, password)

// Get audit trail
const events = await getAuditTrail(reportId, signatureId)
```

## Services

### signatureService
A service class for making API calls related to signatures.

**Methods:**
- `signReport(reportId, meaning, password)` - Sign a report
- `verifySignature(signatureId)` - Verify a signature
- `revokeSignature(signatureId, reason, password)` - Revoke a signature
- `validateSignature(reportId)` - Validate report signature
- `getAuditTrail(reportId, signatureId?)` - Get audit events
- `exportAuditTrail(reportId, signatureId?, format)` - Export audit trail
- `getSignaturesByReport(reportId)` - Get all signatures for a report
- `getSignatureById(signatureId)` - Get signature details

## Integration

The signature components are integrated into the ReportingPage:

1. **Sign Report Button** - Appears when report is finalized but not signed
2. **Signature Badge** - Displays verification status for signed reports
3. **Audit Trail Viewer** - Shows signature history and events
4. **Edit Protection** - Prevents editing of signed reports

## FDA 21 CFR Part 11 Compliance

These components implement the following FDA requirements:

- **Electronic Signatures** - Cryptographically secure signatures using RSA-SHA256
- **Signature Meaning** - Captures the meaning of each signature (author, reviewer, approver)
- **Identity Verification** - Requires password confirmation before signing
- **Audit Trail** - Complete tamper-proof logging of all signature operations
- **Non-repudiation** - Signatures cannot be denied by the signer
- **Report Integrity** - Signed reports cannot be modified without invalidating the signature

## API Endpoints

The components expect the following backend API endpoints:

- `POST /api/signatures/sign` - Sign a report
- `GET /api/signatures/verify/:signatureId` - Verify a signature
- `POST /api/signatures/revoke/:signatureId` - Revoke a signature
- `POST /api/signatures/validate` - Validate report signature
- `GET /api/signatures/audit-trail/:reportId` - Get audit trail
- `GET /api/signatures/:signatureId` - Get signature details
- `GET /api/signatures/report/:reportId` - Get all signatures for report

## Security Considerations

- All signature operations require password verification
- Signatures use RSA-2048 with SHA-256 hashing
- Audit logs are encrypted and tamper-proof
- Session tokens are validated on all API calls
- IP addresses and user agents are logged for all operations

## Future Enhancements

- Multi-factor authentication for signature operations
- Hardware security module (HSM) integration
- Biometric signature support
- Advanced audit trail filtering and search
- Signature delegation and approval workflows
- Batch signing capabilities
