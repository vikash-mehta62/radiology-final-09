# Integration Tests

This directory contains end-to-end integration tests for the production features.

## Test Files

### 1. notification-workflow.test.js
Tests the complete critical notification workflow including:
- Notification creation and delivery
- Multi-channel delivery (email, SMS, in-app)
- Notification acknowledgment
- Escalation workflow
- Notification history and settings

### 2. signature-workflow.test.js
Tests the FDA-compliant digital signature workflow including:
- Report signing with password verification
- Signature verification and validation
- Tamper detection
- Signature revocation
- Complete audit trail
- Signed report access controls

### 3. export-workflow.test.js
Tests the export system workflow including:
- Export initiation (PDF, DICOM SR, FHIR)
- Export processing and progress tracking
- Export download
- Export validation
- Export history and audit logging

### 4. session-workflow.test.js
Tests the session management workflow including:
- Login and session creation
- Token refresh mechanism
- Session validation and timeout
- Session extension
- Logout and session termination
- Multiple sessions management
- Session security features

## Running Tests

### Run all integration tests:
```bash
npm run test:integration
```

### Run specific test file:
```bash
npm test -- tests/integration/notification-workflow.test.js
npm test -- tests/integration/signature-workflow.test.js
npm test -- tests/integration/export-workflow.test.js
npm test -- tests/integration/session-workflow.test.js
```

### Run with verbose output:
```bash
VERBOSE_TESTS=true npm run test:integration
```

## Test Environment

Tests use a separate test database to avoid affecting production data:
- Database: `mongodb://localhost:27017/pacs-test`
- Environment: `NODE_ENV=test`

## Prerequisites

1. MongoDB running locally or accessible via connection string
2. All required environment variables set in `.env` file
3. Signature keys generated (run `npm run generate-keys` if needed)
4. Email/SMS services configured (or mocked for testing)

## Test Coverage

These integration tests cover:
- ✅ Complete end-to-end workflows
- ✅ API endpoint functionality
- ✅ Database operations
- ✅ Service integrations
- ✅ Error handling
- ✅ Security features
- ✅ Audit logging
- ✅ Compliance requirements

## Notes

- Tests run in sequence (`--runInBand`) to avoid database conflicts
- Each test suite cleans up after itself
- Tests use real database operations (not mocked)
- Some tests may take longer due to async processing (exports, notifications)
- Failed tests will output detailed error information

## Troubleshooting

### Tests timing out
- Increase timeout in jest.config.js
- Check database connection
- Verify external services are accessible

### Database connection errors
- Ensure MongoDB is running
- Check connection string in environment variables
- Verify test database permissions

### Authentication errors
- Verify JWT secrets are set
- Check user creation in beforeEach hooks
- Ensure password hashing is working

### Export tests failing
- Check file system permissions
- Verify export directory exists
- Ensure PDF/DICOM libraries are installed
