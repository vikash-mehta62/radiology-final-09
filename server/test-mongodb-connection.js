#!/usr/bin/env node

/**
 * MongoDB Connection Test Script
 * 
 * This script tests the MongoDB connection and provides detailed diagnostics.
 * Run with: node test-mongodb-connection.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('');
  log('═'.repeat(60), 'cyan');
  log(` ${title}`, 'bright');
  log('═'.repeat(60), 'cyan');
}

async function testMongoDBConnection() {
  logSection('MongoDB Connection Test');
  
  // Step 1: Check environment variable
  log('\n1. Checking MONGODB_URI environment variable...', 'blue');
  
  const mongoUri = process.env.MONGODB_URI;
  
  if (!mongoUri) {
    log('   ❌ MONGODB_URI not found in environment', 'red');
    log('   → Check your .env file in node-server directory', 'yellow');
    process.exit(1);
  }
  
  // Hide password in logs
  const safeUri = mongoUri.replace(/:([^:@]+)@/, ':****@');
  log(`   ✓ MONGODB_URI found: ${safeUri}`, 'green');
  
  // Parse URI components
  try {
    const uriMatch = mongoUri.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^/]+)\/(.+)/);
    if (uriMatch) {
      const [, username, , host, database] = uriMatch;
      log(`   ✓ Username: ${username}`, 'green');
      log(`   ✓ Host: ${host}`, 'green');
      log(`   ✓ Database: ${database}`, 'green');
    }
  } catch (e) {
    log('   ⚠ Could not parse URI components', 'yellow');
  }
  
  // Step 2: Test DNS resolution
  logSection('2. Testing DNS Resolution');
  
  try {
    const dns = require('dns').promises;
    const hostMatch = mongoUri.match(/@([^/]+)\//);
    if (hostMatch) {
      const host = hostMatch[1];
      log(`   Testing DNS lookup for: ${host}`, 'blue');
      const addresses = await dns.resolve(host);
      log(`   ✓ DNS resolution successful`, 'green');
      log(`   ✓ Resolved to ${addresses.length} address(es)`, 'green');
    }
  } catch (dnsError) {
    log(`   ❌ DNS resolution failed: ${dnsError.message}`, 'red');
    log('   → Check your internet connection', 'yellow');
    log('   → Verify the MongoDB host address is correct', 'yellow');
  }
  
  // Step 3: Attempt connection
  logSection('3. Attempting MongoDB Connection');
  
  mongoose.set('strictQuery', true);
  
  const options = {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    minPoolSize: 2,
    retryWrites: true,
    retryReads: true,
    tls: true,
    tlsAllowInvalidCertificates: false,
    tlsAllowInvalidHostnames: false,
  };
  
  log('   Connecting with options:', 'blue');
  log(`   - Server selection timeout: ${options.serverSelectionTimeoutMS}ms`, 'cyan');
  log(`   - Socket timeout: ${options.socketTimeoutMS}ms`, 'cyan');
  log(`   - TLS enabled: ${options.tls}`, 'cyan');
  
  const startTime = Date.now();
  
  try {
    log('\n   Connecting...', 'blue');
    await mongoose.connect(mongoUri, options);
    
    const duration = Date.now() - startTime;
    log(`   ✓ Connected successfully in ${duration}ms!`, 'green');
    
    // Step 4: Verify connection details
    logSection('4. Connection Details');
    
    log(`   ✓ Database: ${mongoose.connection.name}`, 'green');
    log(`   ✓ Host: ${mongoose.connection.host}`, 'green');
    log(`   ✓ Port: ${mongoose.connection.port || 'default'}`, 'green');
    log(`   ✓ Ready state: ${mongoose.connection.readyState} (1 = connected)`, 'green');
    
    // Step 5: Test database operations
    logSection('5. Testing Database Operations');
    
    try {
      log('   Testing ping...', 'blue');
      await mongoose.connection.db.admin().ping();
      log('   ✓ Ping successful', 'green');
    } catch (pingError) {
      log(`   ❌ Ping failed: ${pingError.message}`, 'red');
    }
    
    try {
      log('   Listing collections...', 'blue');
      const collections = await mongoose.connection.db.listCollections().toArray();
      log(`   ✓ Found ${collections.length} collection(s)`, 'green');
      
      if (collections.length > 0) {
        log('   Collections:', 'cyan');
        collections.forEach(col => {
          log(`     - ${col.name}`, 'cyan');
        });
      } else {
        log('   ⚠ No collections found (database may be empty)', 'yellow');
      }
    } catch (listError) {
      log(`   ❌ Failed to list collections: ${listError.message}`, 'red');
    }
    
    // Step 6: Test write operation
    logSection('6. Testing Write Operation');
    
    try {
      log('   Creating test collection...', 'blue');
      const testCollection = mongoose.connection.db.collection('_connection_test');
      
      const testDoc = {
        test: true,
        timestamp: new Date(),
        message: 'Connection test successful'
      };
      
      await testCollection.insertOne(testDoc);
      log('   ✓ Write operation successful', 'green');
      
      // Clean up
      await testCollection.deleteOne({ test: true });
      log('   ✓ Cleanup successful', 'green');
    } catch (writeError) {
      log(`   ❌ Write operation failed: ${writeError.message}`, 'red');
      log('   → Check user permissions in MongoDB Atlas', 'yellow');
    }
    
    // Success summary
    logSection('✅ Connection Test PASSED');
    log('\nYour MongoDB connection is working correctly!', 'green');
    log('You can now use ZIP upload and other database features.', 'green');
    
    await mongoose.disconnect();
    process.exit(0);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    log(`   ❌ Connection failed after ${duration}ms`, 'red');
    log(`   Error: ${error.message}`, 'red');
    
    // Provide specific troubleshooting advice
    logSection('❌ Connection Test FAILED');
    
    log('\nError Analysis:', 'yellow');
    
    if (error.message.includes('ENOTFOUND')) {
      log('   → DNS lookup failed', 'red');
      log('   Solutions:', 'yellow');
      log('     1. Check your internet connection', 'cyan');
      log('     2. Verify the MongoDB host address in MONGODB_URI', 'cyan');
      log('     3. Ensure no typos in the connection string', 'cyan');
    } else if (error.message.includes('ETIMEDOUT')) {
      log('   → Connection timed out', 'red');
      log('   Solutions:', 'yellow');
      log('     1. Check your firewall settings', 'cyan');
      log('     2. Verify network access in MongoDB Atlas', 'cyan');
      log('     3. Ensure your IP address is whitelisted', 'cyan');
    } else if (error.message.includes('authentication failed') || error.message.includes('bad auth')) {
      log('   → Authentication failed', 'red');
      log('   Solutions:', 'yellow');
      log('     1. Verify username and password in MONGODB_URI', 'cyan');
      log('     2. Check Database Access settings in MongoDB Atlas', 'cyan');
      log('     3. Ensure the user has Read and Write permissions', 'cyan');
    } else if (error.message.includes('MongoServerSelectionError')) {
      log('   → Cannot connect to MongoDB cluster', 'red');
      log('   Solutions:', 'yellow');
      log('     1. Verify cluster is running (not paused) in MongoDB Atlas', 'cyan');
      log('     2. Check network access settings', 'cyan');
      log('     3. Ensure correct connection string format', 'cyan');
    } else {
      log('   → Unknown error', 'red');
      log('   Full error:', 'yellow');
      console.error(error);
    }
    
    log('\nNext Steps:', 'yellow');
    log('   1. Review the error message above', 'cyan');
    log('   2. Check MONGODB-TROUBLESHOOTING.md for detailed help', 'cyan');
    log('   3. Verify MongoDB Atlas settings:', 'cyan');
    log('      - Cluster status (running/paused)', 'cyan');
    log('      - Network Access (IP whitelist)', 'cyan');
    log('      - Database Access (user permissions)', 'cyan');
    log('   4. Try the connection string in MongoDB Compass', 'cyan');
    
    process.exit(1);
  }
}

// Run the test
testMongoDBConnection().catch(error => {
  log('\n❌ Unexpected error:', 'red');
  console.error(error);
  process.exit(1);
});
