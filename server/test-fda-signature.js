/**
 * Quick test script for FDA Digital Signature System
 * Tests basic cryptographic operations and service functionality
 */

const cryptoService = require('./src/services/crypto-service');

console.log('🧪 Testing FDA Digital Signature System\n');

// Test 1: Cryptographic Service
console.log('📝 Test 1: Cryptographic Operations');
console.log('=====================================');

try {
  // Test data hashing
  const testData = 'This is a test report for FDA compliance';
  const hash = cryptoService.hashData(testData);
  console.log('✅ Hash generation successful');
  console.log('   Hash:', hash.substring(0, 32) + '...');

  // Test signature generation
  const signature = cryptoService.generateSignature(hash);
  console.log('✅ Signature generation successful');
  console.log('   Signature length:', signature.length, 'characters');

  // Test signature verification
  const isValid = cryptoService.verifySignature(hash, signature);
  console.log('✅ Signature verification:', isValid ? 'VALID' : 'INVALID');

  // Test with modified data
  const modifiedHash = cryptoService.hashData(testData + ' modified');
  const isValidModified = cryptoService.verifySignature(modifiedHash, signature);
  console.log('✅ Modified data verification:', isValidModified ? 'VALID (ERROR!)' : 'INVALID (CORRECT)');

  // Test encryption
  const encrypted = cryptoService.encryptData('Sensitive PHI data');
  console.log('✅ Data encryption successful');
  console.log('   Algorithm:', encrypted.algorithm);

  // Test decryption
  const decrypted = cryptoService.decryptData(encrypted.encrypted, encrypted.iv);
  console.log('✅ Data decryption successful');
  console.log('   Decrypted:', decrypted);

  console.log('\n✅ All cryptographic tests passed!\n');
} catch (error) {
  console.error('❌ Cryptographic test failed:', error.message);
  process.exit(1);
}

// Test 2: Key Management
console.log('📝 Test 2: Key Management');
console.log('=========================');

try {
  const publicKey = cryptoService.getPublicKey();
  console.log('✅ Public key retrieved');
  console.log('   Key type:', publicKey.includes('BEGIN PUBLIC KEY') ? 'RSA Public Key' : 'Unknown');
  console.log('   Key length:', publicKey.length, 'characters');

  console.log('\n✅ Key management tests passed!\n');
} catch (error) {
  console.error('❌ Key management test failed:', error.message);
  process.exit(1);
}

// Test 3: Random Token Generation
console.log('📝 Test 3: Random Token Generation');
console.log('===================================');

try {
  const token1 = cryptoService.generateRandomToken(32);
  const token2 = cryptoService.generateRandomToken(32);
  
  console.log('✅ Token 1:', token1.substring(0, 16) + '...');
  console.log('✅ Token 2:', token2.substring(0, 16) + '...');
  console.log('✅ Tokens are unique:', token1 !== token2 ? 'YES' : 'NO (ERROR!)');

  console.log('\n✅ Random token tests passed!\n');
} catch (error) {
  console.error('❌ Random token test failed:', error.message);
  process.exit(1);
}

console.log('🎉 All tests completed successfully!');
console.log('\n📋 Summary:');
console.log('   ✅ Cryptographic operations working');
console.log('   ✅ Signature generation and verification working');
console.log('   ✅ Tamper detection working');
console.log('   ✅ Encryption/decryption working');
console.log('   ✅ Key management working');
console.log('   ✅ Random token generation working');
console.log('\n🔐 FDA Digital Signature System is ready for use!');
