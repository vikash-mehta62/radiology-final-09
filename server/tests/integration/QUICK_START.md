# Integration Tests - Quick Start Guide

## Prerequisites

1. **MongoDB Running**
   ```bash
   # Make sure MongoDB is running on localhost:27017
   # Or set MONGODB_URI in your .env file
   ```

2. **Environment Variables**
   ```bash
   # Copy .env.example to .env if needed
   cp .env.example .env
   
   # Ensure these are set:
   NODE_ENV=test
   MONGODB_URI=mongodb://localhost:27017/pacs-test
   JWT_SECRET=your-jwt-secret
   JWT_REFRESH_SECRET=your-refresh-secret
   ```

3. **Dependencies Installed**
   ```bash
   npm install
   ```

## Running Tests

### Run All Integration Tests
```bash
npm run test:integration
```

### Run Individual Test Suites
```bash
# Notification workflow tests
npm run test:integration:notification

# Signature workflow tests
npm run test:integration:signature

# Export workflow tests
npm run test:integration:export

# Session workflow tests
npm run test:integration:session
```

### Run with Verbose Output
```bash
VERBOSE_TESTS=true npm run test:integration
```

## Expected Output

### Successful Test Run
```
PASS  tests/integration/notification-workflow.test.js
  Critical Notification Workflow - End-to-End
    Notification Creation and Delivery
      ✓ should create critical notification with all required fields (150ms)
      ✓ should deliver notification via multiple channels (2050ms)
    Notification Acknowledgment
      ✓ should acknowledge notification successfully (120ms)
      ✓ should prevent duplicate acknowledgment (140ms)
    ...

Test Suites: 4 passed, 4 total
Tests:       71 passed, 71 total
Snapshots:   0 total
Time:        45.234s
```

## Troubleshooting

### MongoDB Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
**Solution**: Start MongoDB service
```bash
# Windows
net start MongoDB

# Linux/Mac
sudo systemctl start mongod
# or
brew services start mongodb-community
```

### JWT Secret Not Set
```
Error: JWT_SECRET is not defined
```
**Solution**: Set environment variables in `.env` file

### Test Timeout
```
Error: Timeout - Async callback was not invoked within the 10000ms timeout
```
**Solution**: Increase timeout in `jest.config.js` or check if services are running

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::8001
```
**Solution**: Tests should not start the server (NODE_ENV=test prevents this)

## Test Database

Tests use a separate database: `pacs-test`

### Clean Test Database
```bash
# Connect to MongoDB
mongo

# Switch to test database
use pacs-test

# Drop all collections
db.dropDatabase()
```

## What Gets Tested

### ✅ Notification Workflow (15 tests)
- Notification creation and delivery
- Multi-channel delivery (email, SMS, in-app)
- Acknowledgment workflow
- Escalation logic
- History and settings

### ✅ Signature Workflow (17 tests)
- Report signing with FDA compliance
- Signature verification
- Tamper detection
- Signature revocation
- Complete audit trail

### ✅ Export Workflow (16 tests)
- PDF, DICOM SR, and FHIR exports
- Export processing and progress
- File download
- Export validation
- Audit logging

### ✅ Session Workflow (23 tests)
- Login and session creation
- Token refresh mechanism
- Session validation and timeout
- Session extension
- Multiple sessions management
- Security features

## Next Steps

After running tests successfully:

1. **Review Test Coverage**
   ```bash
   npm test -- --coverage
   ```

2. **Check Test Results**
   - All tests should pass
   - Review any warnings or errors
   - Check audit logs created during tests

3. **Clean Up**
   ```bash
   # Tests clean up automatically, but you can manually clean:
   mongo pacs-test --eval "db.dropDatabase()"
   ```

## CI/CD Integration

For automated testing in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Integration Tests
  run: |
    npm install
    npm run test:integration
  env:
    NODE_ENV: test
    MONGODB_URI: mongodb://localhost:27017/pacs-test
    JWT_SECRET: test-secret
    JWT_REFRESH_SECRET: test-refresh-secret
```

## Support

If you encounter issues:

1. Check the detailed logs in `INTEGRATION_TEST_SUMMARY.md`
2. Review individual test files for specific requirements
3. Ensure all prerequisites are met
4. Check that all required services are running

## Test Maintenance

When adding new features:

1. Add corresponding integration tests
2. Follow existing test patterns
3. Update this documentation
4. Ensure tests clean up after themselves
5. Run full test suite before committing

---

**Last Updated**: Task 20 Implementation
**Status**: ✅ All integration tests implemented and passing
