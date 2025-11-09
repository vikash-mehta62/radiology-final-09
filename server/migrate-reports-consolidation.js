/**
 * Report Consolidation Migration Script
 * Migrates StructuredReport records to unified Report model
 * 
 * IMPORTANT: Run this script AFTER backing up your database
 * 
 * Usage:
 *   node migrate-reports-consolidation.js [--dry-run] [--verify]
 * 
 * Options:
 *   --dry-run: Preview changes without applying them
 *   --verify: Verify migration after completion
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const crypto = require('crypto');

// Models
const Report = require('./src/models/Report');

// Get StructuredReport schema dynamically (it will be deprecated)
const StructuredReportSchema = new mongoose.Schema({}, { strict: false, collection: 'structuredreports' });
const StructuredReport = mongoose.model('StructuredReport_Legacy', StructuredReportSchema);

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerify = args.includes('--verify');

/**
 * Map StructuredReport to unified Report model
 */
function mapStructuredReportToReport(structuredReport) {
  const mapped = {
    // Core fields (already compatible)
    studyInstanceUID: structuredReport.studyInstanceUID,
    patientID: structuredReport.patientID,
    patientName: structuredReport.patientName,
    patientBirthDate: structuredReport.patientBirthDate,
    patientSex: structuredReport.patientSex,
    patientAge: structuredReport.patientAge,
    
    // Study info
    studyDate: structuredReport.studyDate,
    studyTime: structuredReport.studyTime,
    studyDescription: structuredReport.studyDescription,
    modality: structuredReport.modality,
    
    // Report metadata
    reportId: structuredReport.reportId,
    reportDate: structuredReport.reportDate,
    status: structuredReport.reportStatus || 'draft',
    
    // Template
    templateId: structuredReport.templateId,
    templateName: structuredReport.templateName,
    
    // Creation mode (infer from data)
    creationMode: inferCreationMode(structuredReport),
    
    // Report sections
    clinicalHistory: structuredReport.clinicalHistory,
    technique: structuredReport.technique,
    comparison: structuredReport.comparison,
    findings: structuredReport.findingsText || structuredReport.findings,
    findingsText: structuredReport.findingsText || structuredReport.findings,
    impression: structuredReport.impression,
    recommendations: structuredReport.recommendations,
    reportSections: structuredReport.reportSections,
    
    // Structured data
    structuredFindings: structuredReport.findings || [],
    measurements: structuredReport.measurements || [],
    annotations: structuredReport.annotations || [],
    
    // Images
    keyImages: structuredReport.keyImages || [],
    imageCount: structuredReport.imageCount || 0,
    
    // AI data (if present)
    aiAnalysisId: structuredReport.aiAnalysisId,
    aiModelsUsed: structuredReport.aiModelsUsed || [],
    
    // Signature
    radiologistSignature: structuredReport.radiologistSignature,
    radiologistSignatureUrl: structuredReport.radiologistSignatureUrl,
    radiologistSignaturePublicId: structuredReport.radiologistSignaturePublicId,
    radiologistId: structuredReport.radiologistId,
    radiologistName: structuredReport.radiologistName,
    signedAt: structuredReport.signedAt,
    
    // Workflow
    createdBy: structuredReport.createdBy,
    finalizedBy: structuredReport.finalizedBy,
    finalizedAt: structuredReport.finalizedAt,
    
    // Addenda
    addenda: structuredReport.addenda || [],
    
    // Critical
    isCritical: structuredReport.isCritical || false,
    criticalNotifiedAt: structuredReport.criticalNotifiedAt,
    criticalNotifiedTo: structuredReport.criticalNotifiedTo || [],
    priority: structuredReport.priority || 'routine',
    
    // Audit
    revisionHistory: structuredReport.revisionHistory || [],
    version: structuredReport.version || 1,
    previousVersionId: structuredReport.previousVersionId,
    tags: structuredReport.tags || [],
    
    // Hospital
    hospitalId: structuredReport.hospitalId,
    
    // Timestamps
    createdAt: structuredReport.createdAt,
    updatedAt: structuredReport.updatedAt
  };
  
  // Add AI provenance if AI data exists
  if (structuredReport.aiModelsUsed && structuredReport.aiModelsUsed.length > 0) {
    mapped.aiProvenance = {
      modelName: structuredReport.aiModelsUsed[0],
      modelVersion: '1.0',
      requestId: structuredReport.aiAnalysisId || 'legacy-migration',
      timestamp: structuredReport.createdAt,
      rawOutputHash: hashObject(structuredReport),
      confidence: 0.8, // Default
      processingTime: 0
    };
  }
  
  return mapped;
}

/**
 * Infer creation mode from report data
 */
function inferCreationMode(report) {
  // Check if AI was used
  const hasAI = report.aiModelsUsed && report.aiModelsUsed.length > 0;
  const hasAITag = report.tags && report.tags.some(t => t.toLowerCase().includes('ai'));
  
  if (hasAI || hasAITag) {
    // Check if report was edited after AI generation
    const hasManualEdits = report.revisionHistory && report.revisionHistory.length > 0;
    return hasManualEdits ? 'ai-assisted' : 'ai-only';
  }
  
  return 'manual';
}

/**
 * Hash object for provenance
 */
function hashObject(obj) {
  const str = JSON.stringify(obj);
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Migrate single report
 */
async function migrateReport(structuredReport, dryRun = false) {
  try {
    // Check if already migrated
    const existing = await Report.findOne({ reportId: structuredReport.reportId });
    if (existing) {
      return { success: true, skipped: true, reason: 'already_exists' };
    }
    
    // Map to new schema
    const mappedReport = mapStructuredReportToReport(structuredReport);
    
    if (dryRun) {
      console.log(`  [DRY RUN] Would migrate report: ${structuredReport.reportId}`);
      console.log(`    Mode: ${mappedReport.creationMode}`);
      console.log(`    Status: ${mappedReport.status}`);
      return { success: true, dryRun: true };
    }
    
    // Create new report
    await Report.create(mappedReport);
    
    return { success: true, migrated: true };
  } catch (error) {
    console.error(`  ❌ Failed to migrate ${structuredReport.reportId}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Verify migration
 */
async function verifyMigration() {
  console.log('\n🔍 Verifying migration...\n');
  
  const structuredCount = await StructuredReport.countDocuments();
  const reportCount = await Report.countDocuments();
  
  console.log(`StructuredReports: ${structuredCount}`);
  console.log(`Reports: ${reportCount}`);
  
  // Sample verification
  const sampleSize = Math.min(10, structuredCount);
  const samples = await StructuredReport.find().limit(sampleSize);
  
  let verified = 0;
  let failed = 0;
  
  for (const sample of samples) {
    const migrated = await Report.findOne({ reportId: sample.reportId });
    if (migrated) {
      // Verify key fields
      const fieldsMatch = 
        migrated.studyInstanceUID === sample.studyInstanceUID &&
        migrated.patientID === sample.patientID &&
        migrated.reportId === sample.reportId;
      
      if (fieldsMatch) {
        verified++;
      } else {
        failed++;
        console.log(`  ⚠️  Mismatch in report: ${sample.reportId}`);
      }
    } else {
      failed++;
      console.log(`  ❌ Missing report: ${sample.reportId}`);
    }
  }
  
  console.log(`\n✅ Verified: ${verified}/${sampleSize}`);
  console.log(`❌ Failed: ${failed}/${sampleSize}`);
  
  return { verified, failed, total: sampleSize };
}

/**
 * Main migration function
 */
async function main() {
  try {
    console.log('🔄 Report Consolidation Migration\n');
    console.log('=' .repeat(60));
    
    if (isDryRun) {
      console.log('⚠️  DRY RUN MODE - No changes will be made\n');
    }
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Get counts
    const structuredCount = await StructuredReport.countDocuments();
    const existingReportCount = await Report.countDocuments();
    
    console.log(`📊 Current state:`);
    console.log(`   StructuredReports: ${structuredCount}`);
    console.log(`   Reports (existing): ${existingReportCount}\n`);
    
    if (structuredCount === 0) {
      console.log('✅ No StructuredReports to migrate');
      process.exit(0);
    }
    
    // Confirm migration
    if (!isDryRun && !isVerify) {
      console.log('⚠️  WARNING: This will migrate all StructuredReports to the unified Report model');
      console.log('⚠️  Make sure you have backed up your database!');
      console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Migrate reports
    console.log('🚀 Starting migration...\n');
    
    const results = {
      total: structuredCount,
      migrated: 0,
      skipped: 0,
      failed: 0
    };
    
    const reports = await StructuredReport.find();
    
    for (const report of reports) {
      const result = await migrateReport(report, isDryRun);
      
      if (result.success) {
        if (result.skipped) {
          results.skipped++;
        } else if (result.migrated) {
          results.migrated++;
        }
      } else {
        results.failed++;
      }
      
      // Progress indicator
      const processed = results.migrated + results.skipped + results.failed;
      if (processed % 10 === 0) {
        console.log(`  Progress: ${processed}/${results.total}`);
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 Migration Summary:');
    console.log(`   Total reports: ${results.total}`);
    console.log(`   Migrated: ${results.migrated}`);
    console.log(`   Skipped (already exists): ${results.skipped}`);
    console.log(`   Failed: ${results.failed}`);
    
    // Verify if requested
    if (isVerify || (!isDryRun && results.migrated > 0)) {
      await verifyMigration();
    }
    
    // Recommendations
    console.log('\n📝 Next Steps:');
    if (isDryRun) {
      console.log('   1. Review the dry run output');
      console.log('   2. Backup your database');
      console.log('   3. Run without --dry-run to perform migration');
    } else if (results.failed === 0) {
      console.log('   ✅ Migration completed successfully!');
      console.log('   1. Verify your application works with the new model');
      console.log('   2. Monitor for any issues');
      console.log('   3. After verification, you can drop the structuredreports collection');
      console.log('      (Keep backup for at least 30 days)');
    } else {
      console.log('   ⚠️  Some reports failed to migrate');
      console.log('   1. Review the error messages above');
      console.log('   2. Fix any data issues');
      console.log('   3. Re-run the migration');
    }
    
    console.log('\n');
    process.exit(results.failed > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration
main();
