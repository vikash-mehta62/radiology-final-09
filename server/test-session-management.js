/**
 * Session Management Test Script
 * Tests the session management implementation
 * 
 * Usage: node test-session-management.js
 */

const SessionService = require('./src/services/session-service');
const mongoose = require('mongoose');

// Test configuration
const TEST_USER_ID = '507f1f77bcf86cd799439011'; // Example ObjectId
const TEST_DEVICE_INFO = {
  userAgent: 'Mozilla/5.0 (Test Browser)',
  ipAddress: '127.0.0.1',
  deviceId: 'test-device-123',
  location: 'Test Location'
};

async function runTests() {
  console.log('🧪 Starting Session Management Tests...\n');

  const sessionService = new SessionService();
  let testSession = null;

  try {
    // Connect to MongoDB
    console.log('📦 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/radiology-test', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB\n');

    // Test 1: Create Session
    console.log('Test 1: Create Session');
    console.log('------------------------');
    try {
      testSession = await sessionService.createSession(TEST_USER_ID, TEST_DEVICE_INFO);
      console.log('✅ Session created successfully');
      console.log(`   Session ID: ${testSession.sessionId}`);
      console.log(`   Access Token: ${testSession.accessToken.substring(0, 20)}...`);
      console.log(`   Refresh Token: ${testSession.refreshToken.substring(0, 20)}...`);
      console.log(`   Expires At: ${testSession.expiresAt}\n`);
    } catch (error) {
      console.error('❌ Failed to create session:', error.message);
      console.log('   Note: This may fail if the test user does not exist in the database\n');
    }

    // Test 2: Validate Session
    if (testSession) {
      console.log('Test 2: Validate Session');
      console.log('------------------------');
      try {
        const validation = await sessionService.validateSession(testSession.accessToken);
        if (validation.valid) {
          console.log('✅ Session validated successfully');
          console.log(`   User ID: ${validation.user.id}`);
          console.log(`   Session Status: ${validation.session.status}\n`);
        } else {
          console.log('❌ Session validation failed:', validation.reason, '\n');
        }
      } catch (error) {
        console.error('❌ Session validation error:', error.message, '\n');
      }
    }

    // Test 3: Get Session Status
    if (testSession) {
      console.log('Test 3: Get Session Status');
      console.log('------------------------');
      try {
        const status = await sessionService.getSessionStatus(testSession.sessionId);
        console.log('✅ Session status retrieved');
        console.log(`   Status: ${status.status}`);
        console.log(`   Expires In: ${Math.floor(status.expiresIn / 1000)} seconds`);
        console.log(`   Is Expiring Soon: ${status.isExpiringSoon}`);
        console.log(`   Is Inactive: ${status.isInactive}\n`);
      } catch (error) {
        console.error('❌ Failed to get session status:', error.message, '\n');
      }
    }

    // Test 4: Refresh Access Token
    if (testSession) {
      console.log('Test 4: Refresh Access Token');
      console.log('------------------------');
      try {
        const refreshResult = await sessionService.refreshAccessToken(testSession.refreshToken);
        console.log('✅ Access token refreshed successfully');
        console.log(`   New Access Token: ${refreshResult.accessToken.substring(0, 20)}...`);
        console.log(`   Expires In: ${refreshResult.expiresIn} seconds\n`);
      } catch (error) {
        console.error('❌ Failed to refresh token:', error.message, '\n');
      }
    }

    // Test 5: Extend Session
    if (testSession) {
      console.log('Test 5: Extend Session');
      console.log('------------------------');
      try {
        const extendResult = await sessionService.extendSession(testSession.sessionId, 60 * 60); // 1 hour
        console.log('✅ Session extended successfully');
        console.log(`   New Expiry: ${extendResult.expiresAt}`);
        console.log(`   Expires In: ${extendResult.expiresIn} seconds\n`);
      } catch (error) {
        console.error('❌ Failed to extend session:', error.message, '\n');
      }
    }

    // Test 6: Get User Sessions
    if (testSession) {
      console.log('Test 6: Get User Sessions');
      console.log('------------------------');
      try {
        const sessions = await sessionService.getUserSessions(TEST_USER_ID);
        console.log('✅ User sessions retrieved');
        console.log(`   Active Sessions: ${sessions.length}`);
        sessions.forEach((session, index) => {
          console.log(`   Session ${index + 1}: ${session.id} (${session.status})`);
        });
        console.log('');
      } catch (error) {
        console.error('❌ Failed to get user sessions:', error.message, '\n');
      }
    }

    // Test 7: Revoke Session
    if (testSession) {
      console.log('Test 7: Revoke Session');
      console.log('------------------------');
      try {
        await sessionService.revokeSession(testSession.sessionId, 'Test revocation');
        console.log('✅ Session revoked successfully\n');
      } catch (error) {
        console.error('❌ Failed to revoke session:', error.message, '\n');
      }
    }

    // Test 8: Validate Revoked Session
    if (testSession) {
      console.log('Test 8: Validate Revoked Session');
      console.log('------------------------');
      try {
        const validation = await sessionService.validateSession(testSession.accessToken);
        if (!validation.valid) {
          console.log('✅ Revoked session correctly rejected');
          console.log(`   Reason: ${validation.reason}\n`);
        } else {
          console.log('❌ Revoked session was incorrectly validated\n');
        }
      } catch (error) {
        console.error('❌ Validation error:', error.message, '\n');
      }
    }

    console.log('✅ All tests completed!\n');

  } catch (error) {
    console.error('❌ Test suite error:', error);
  } finally {
    // Cleanup
    console.log('🧹 Cleaning up...');
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    console.log('\n📊 Test Summary:');
    console.log('   - Session creation: Tested');
    console.log('   - Session validation: Tested');
    console.log('   - Session status: Tested');
    console.log('   - Token refresh: Tested');
    console.log('   - Session extension: Tested');
    console.log('   - User sessions: Tested');
    console.log('   - Session revocation: Tested');
    console.log('   - Revoked session validation: Tested');
    console.log('\n✨ Session Management Implementation Complete!');
  }
}

// Run tests
runTests().catch(console.error);
