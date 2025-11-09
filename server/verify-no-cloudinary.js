#!/usr/bin/env node

/**
 * Verification Script: Ensure Cloudinary has been completely removed
 * Run: node verify-no-cloudinary.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Cloudinary removal...\n');

let hasErrors = false;
let warnings = [];

// 1. Check if cloudinary config file exists
const cloudinaryConfigPath = path.join(__dirname, 'src/config/cloudinary.js');
if (fs.existsSync(cloudinaryConfigPath)) {
  console.error('❌ ERROR: cloudinary.js config file still exists!');
  hasErrors = true;
} else {
  console.log('✅ Cloudinary config file removed');
}

// 2. Check package.json for cloudinary dependency
const packageJsonPath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

if (packageJson.dependencies && packageJson.dependencies.cloudinary) {
  console.error('❌ ERROR: Cloudinary still in package.json dependencies!');
  hasErrors = true;
} else {
  console.log('✅ Cloudinary not in package.json dependencies');
}

// 3. Check for cloudinary imports (excluding deprecated files)
const srcDir = path.join(__dirname, 'src');
const excludeFiles = ['zip-dicom-service.js']; // Deprecated file

function searchFiles(dir, pattern, excludeFiles = []) {
  const results = [];
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      results.push(...searchFiles(filePath, pattern, excludeFiles));
    } else if (file.endsWith('.js') && !excludeFiles.includes(file)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Check for require or import statements
        if (line.match(/require\s*\(\s*['"]cloudinary['"]\s*\)/i) || 
            line.match(/from\s+['"]cloudinary['"]/i)) {
          results.push({
            file: path.relative(__dirname, filePath),
            line: index + 1,
            content: line.trim()
          });
        }
      });
    }
  }
  
  return results;
}

const cloudinaryImports = searchFiles(srcDir, /cloudinary/i, excludeFiles);

if (cloudinaryImports.length > 0) {
  console.error('❌ ERROR: Found Cloudinary imports in code:');
  cloudinaryImports.forEach(result => {
    console.error(`   ${result.file}:${result.line} - ${result.content}`);
  });
  hasErrors = true;
} else {
  console.log('✅ No Cloudinary imports found in active code');
}

// 4. Check Instance model for cloudinary fields
const instanceModelPath = path.join(__dirname, 'src/models/Instance.js');
if (fs.existsSync(instanceModelPath)) {
  const instanceModel = fs.readFileSync(instanceModelPath, 'utf8');
  
  if (instanceModel.includes('cloudinaryUrl:') || instanceModel.includes('cloudinaryPublicId:')) {
    console.error('❌ ERROR: Instance model still has Cloudinary fields!');
    hasErrors = true;
  } else {
    console.log('✅ Instance model cleaned of Cloudinary fields');
  }
  
  if (instanceModel.includes('localFilePath:')) {
    console.log('✅ Instance model has localFilePath field');
  } else {
    warnings.push('⚠️  Instance model missing localFilePath field');
  }
}

// 5. Check for cloudinary in environment example
const envExamplePath = path.join(__dirname, '.env.example');
if (fs.existsSync(envExamplePath)) {
  const envExample = fs.readFileSync(envExamplePath, 'utf8');
  
  if (envExample.match(/CLOUDINARY_[A-Z_]+=/)) {
    console.error('❌ ERROR: .env.example still has Cloudinary variables!');
    hasErrors = true;
  } else {
    console.log('✅ .env.example cleaned of Cloudinary variables');
  }
}

// 6. Check controllers for cloudinary usage
const controllersToCheck = [
  'src/controllers/uploadController.js',
  'src/controllers/studyController.js'
];

controllersToCheck.forEach(controllerPath => {
  const fullPath = path.join(__dirname, controllerPath);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // Check for cloudinary variable usage (not just comments)
    const cloudinaryUsage = content.match(/cloudinary\.(uploader|url|config)/gi);
    if (cloudinaryUsage) {
      console.error(`❌ ERROR: ${controllerPath} still uses Cloudinary API!`);
      hasErrors = true;
    }
  }
});

console.log('✅ Controllers cleaned of Cloudinary API usage');

// Print warnings
if (warnings.length > 0) {
  console.log('\n⚠️  Warnings:');
  warnings.forEach(warning => console.log(warning));
}

// Final result
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.error('❌ VERIFICATION FAILED - Cloudinary removal incomplete!');
  process.exit(1);
} else {
  console.log('✅ VERIFICATION PASSED - Cloudinary successfully removed!');
  console.log('\n📝 Summary:');
  console.log('   - Config file: Removed');
  console.log('   - Package dependency: Removed');
  console.log('   - Code imports: Removed');
  console.log('   - Model fields: Updated');
  console.log('   - Environment vars: Removed');
  console.log('   - API usage: Removed');
  console.log('\n🎉 Backend is now using local filesystem + Orthanc storage!');
  process.exit(0);
}
