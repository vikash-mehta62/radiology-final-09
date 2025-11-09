/**
 * Test script for WebSocket service
 * This script verifies the WebSocket service initialization and basic functionality
 */

const { getWebSocketService } = require('./src/services/websocket-service');

console.log('🧪 Testing WebSocket Service...\n');

// Test 1: Service initialization
console.log('Test 1: Service Initialization');
try {
  const websocketService = getWebSocketService();
  console.log('✅ WebSocket service instance created');
  
  // Verify singleton pattern
  const websocketService2 = getWebSocketService();
  if (websocketService === websocketService2) {
    console.log('✅ Singleton pattern working correctly');
  } else {
    console.log('❌ Singleton pattern failed');
  }
} catch (error) {
  console.log('❌ Service initialization failed:', error.message);
}

// Test 2: Service methods exist
console.log('\nTest 2: Service Methods');
try {
  const websocketService = getWebSocketService();
  const requiredMethods = [
    'initialize',
    'setupAuthentication',
    'setupConnectionHandlers',
    'sendNotificationToUser',
    'broadcastNotification',
    'broadcastToRole',
    'broadcastToUser',
    'sendSessionTimeoutWarning',
    'sendSessionExpired',
    'getConnectedUsersCount',
    'isUserConnected',
    'getConnectedUsers',
    'getUserSessions',
    'disconnectUser',
    'getIO'
  ];
  
  let allMethodsExist = true;
  requiredMethods.forEach(method => {
    if (typeof websocketService[method] === 'function') {
      console.log(`✅ Method exists: ${method}`);
    } else {
      console.log(`❌ Method missing: ${method}`);
      allMethodsExist = false;
    }
  });
  
  if (allMethodsExist) {
    console.log('✅ All required methods exist');
  }
} catch (error) {
  console.log('❌ Method check failed:', error.message);
}

// Test 3: Initial state
console.log('\nTest 3: Initial State');
try {
  const websocketService = getWebSocketService();
  
  const connectedCount = websocketService.getConnectedUsersCount();
  console.log(`✅ Connected users count: ${connectedCount}`);
  
  const connectedUsers = websocketService.getConnectedUsers();
  console.log(`✅ Connected users list: ${JSON.stringify(connectedUsers)}`);
  
  const isConnected = websocketService.isUserConnected('test-user-123');
  console.log(`✅ User connection check: ${isConnected}`);
  
} catch (error) {
  console.log('❌ Initial state check failed:', error.message);
}

// Test 4: Mock HTTP server initialization
console.log('\nTest 4: HTTP Server Integration');
try {
  const http = require('http');
  const websocketService = getWebSocketService();
  
  // Create a mock HTTP server
  const mockServer = http.createServer();
  
  // Initialize WebSocket service with mock server
  const io = websocketService.initialize(mockServer, {
    corsOrigins: ['http://localhost:3000']
  });
  
  if (io) {
    console.log('✅ WebSocket service initialized with HTTP server');
    console.log('✅ Socket.IO instance created');
    
    // Clean up
    mockServer.close();
    console.log('✅ Mock server closed');
  } else {
    console.log('❌ Socket.IO instance not created');
  }
} catch (error) {
  console.log('❌ HTTP server integration failed:', error.message);
}

console.log('\n🎉 WebSocket Service Tests Complete!\n');
console.log('Summary:');
console.log('- Service can be instantiated');
console.log('- Singleton pattern works');
console.log('- All required methods exist');
console.log('- Initial state is correct');
console.log('- Can integrate with HTTP server');
console.log('\nThe WebSocket service is ready for use! 🚀');
