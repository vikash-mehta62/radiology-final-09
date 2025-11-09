const path = require('path');
const fs = require('fs');

const BACKEND_DIR = path.resolve(__dirname, 'backend');
const PLACEHOLDER_SIZE = 4691; // Size of placeholder PNGs

function cleanPlaceholderCache() {
  console.log('🧹 Cleaning placeholder cache\n');
  
  if (!fs.existsSync(BACKEND_DIR)) {
    console.log('❌ Backend directory not found');
    return;
  }
  
  const dirs = fs.readdirSync(BACKEND_DIR);
  const frameDirs = dirs.filter(d => d.startsWith('uploaded_frames_'));
  
  console.log(`Found ${frameDirs.length} frame directories\n`);
  
  let totalDeleted = 0;
  let totalKept = 0;
  
  for (const dir of frameDirs) {
    const dirPath = path.join(BACKEND_DIR, dir);
    const studyUID = dir.replace('uploaded_frames_', '');
    
    const files = fs.readdirSync(dirPath);
    const pngFiles = files.filter(f => f.endsWith('.png'));
    
    let deletedInDir = 0;
    let keptInDir = 0;
    
    for (const file of pngFiles) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      
      // Delete if it's exactly the placeholder size
      if (stats.size === PLACEHOLDER_SIZE) {
        fs.unlinkSync(filePath);
        deletedInDir++;
        totalDeleted++;
      } else {
        keptInDir++;
        totalKept++;
      }
    }
    
    if (deletedInDir > 0) {
      console.log(`📁 ${studyUID.substring(0, 40)}...`);
      console.log(`   Deleted: ${deletedInDir} placeholders`);
      console.log(`   Kept: ${keptInDir} valid frames`);
      
      // Remove directory if empty
      const remaining = fs.readdirSync(dirPath);
      if (remaining.length === 0) {
        fs.rmdirSync(dirPath);
        console.log(`   🗑️  Removed empty directory`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Summary:`);
  console.log(`   Total placeholders deleted: ${totalDeleted}`);
  console.log(`   Total valid frames kept: ${totalKept}`);
  console.log('\n✅ Cleanup complete');
}

cleanPlaceholderCache();
