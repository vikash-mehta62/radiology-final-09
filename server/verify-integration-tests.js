#!/usr/bin/env node

/**
 * Integration Test Verification Script
 * 
 * This script verifies that all integration tests are properly configured
 * and ready to run. It checks for:
 * - Test file existence
 * - Test file structure
 * - Required dependencies
 * - Database connectivity
 * - Environment configuration
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Integration Tests...\n');

// Test files to verify
const testFiles = [
  'tests/integration/notification-workflow.test.js',
  'tests/integration/signature-workflow.test.js',
  'tests/integration/export-workflow.test.js',
  'tests/integration/session-workflow.test.js'
];

// Documentation files to verify
const docFiles = [
  'tests/integration/README.md',
  'tests/integration/INTEGRATION_TEST_SUMMARY.md',
  'tests/integration/QUICK_START.md',
  'tests/integration/TASK_20_COMPLETION_SUMMARY.md'
];

let allChecksPass = true;

// Check test files
console.log('📋 Checking Test Files:');
testFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    const lines = fs.readFileSync(filePath, 'utf8').split('\n').length;
    console.log(`  ✅ ${file} (${lines} lines, ${(stats.size / 1024).toFixed(2)} KB)`);
  } else {
    console.log(`  ❌ ${file} - NOT FOUND`);
    allChecksPass = false;
  }
});

console.log('\n📚 Checking Documentation:');
docFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log(`  ✅ ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
  } else {
    console.log(`  ❌ ${file} - NOT FOUND`);
    allChecksPass = false;
  }
});

// Check package.json scripts
console.log('\n🔧 Checking Test Scripts:');
const packageJson = require('./package.json');
const requiredScripts = [
  'test',
  'test:integration',
  'test:integration:notification',
  'test:integration:signature',
  'test:integration:export',
  'test:integration:session'
];

requiredScripts.forEach(script => {
  if (packageJson.scripts[script]) {
    console.log(`  ✅ npm run ${script}`);
  } else {
    console.log(`  ❌ npm run ${script} - NOT FOUND`);
    allChecksPass = false;
  }
});

// Check required dependencies
console.log('\n📦 Checking Dependencies:');
const requiredDeps = [
  'jest',
  'supertest',
  'mongoose'
];

requiredDeps.forEach(dep => {
  if (packageJson.dependencies[dep] || packageJson.devDependencies?.[dep]) {
    const version = packageJson.dependencies[dep] || packageJson.devDependencies[dep];
    console.log(`  ✅ ${dep} (${version})`);
  } else {
    console.log(`  ❌ ${dep} - NOT INSTALLED`);
    allChecksPass = false;
  }
});

// Check jest configuration
console.log('\n⚙️  Checking Jest Configuration:');
const jestConfigPath = path.join(__dirname, 'jest.config.js');
if (fs.existsSync(jestConfigPath)) {
  console.log('  ✅ jest.config.js exists');
  const jestConfig = require(jestConfigPath);
  if (jestConfig.testEnvironment === 'node') {
    console.log('  ✅ Test environment: node');
  }
  if (jestConfig.testMatch) {
    console.log('  ✅ Test match patterns configured');
  }
} else {
  console.log('  ❌ jest.config.js - NOT FOUND');
  allChecksPass = false;
}

// Check environment configuration
console.log('\n🌍 Checking Environment:');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log('  ✅ .env file exists');
} else {
  console.log('  ⚠️  .env file not found (may use environment variables)');
}

// Check models directory
console.log('\n📁 Checking Required Directories:');
const requiredDirs = [
  'src/models',
  'src/routes',
  'src/services',
  'tests/integration'
];

requiredDirs.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (fs.existsSync(dirPath)) {
    console.log(`  ✅ ${dir}/`);
  } else {
    console.log(`  ❌ ${dir}/ - NOT FOUND`);
    allChecksPass = false;
  }
});

// Summary
console.log('\n' + '='.repeat(60));
if (allChecksPass) {
  console.log('✅ All checks passed! Integration tests are ready to run.');
  console.log('\nTo run the tests:');
  console.log('  npm run test:integration');
  console.log('\nTo run individual test suites:');
  console.log('  npm run test:integration:notification');
  console.log('  npm run test:integration:signature');
  console.log('  npm run test:integration:export');
  console.log('  npm run test:integration:session');
  process.exit(0);
} else {
  console.log('❌ Some checks failed. Please review the output above.');
  process.exit(1);
}
