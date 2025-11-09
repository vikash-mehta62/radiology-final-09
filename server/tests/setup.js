// Test setup file
process.env.NODE_ENV = 'test';
process.env.WEBHOOK_SECRET = 'test-webhook-secret-key';

// Suppress console logs during tests unless explicitly needed
if (process.env.VERBOSE_TESTS !== 'true') {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
}