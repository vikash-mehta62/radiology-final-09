/**
 * Quality Assurance and Validation Module
 * Comprehensive validation for medical reports
 */

/**
 * Perform comprehensive quality assurance on report data
 * @param {Object} reportData - Complete report data
 * @returns {Object} QA results
 */
function performQualityAssurance(reportData) {
  const qa = {
    passed: false,
    score: 0,
    maxScore: 100,
    checks: [],
    errors: [],
    warnings: [],
    recommendations: [],
    summary: ''
  };

  // Run all validation checks
  validateFrameProcessing(reportData, qa);
  validateDataFields(reportData, qa);
  validateConfidenceScores(reportData, qa);
  validateTimestamps(reportData, qa);
  validateImageData(reportData, qa);
  validateClinicalData(reportData, qa);
  validateMetadata(reportData, qa);

  // Calculate final score
  qa.percentage = (qa.score / qa.maxScore * 100).toFixed(1);
  qa.grade = qa.score >= 90 ? 'Excellent' :
              qa.score >= 75 ? 'Good' :
              qa.score >= 60 ? 'Acceptable' :
              qa.score >= 40 ? 'Poor' : 'Failed';

  qa.passed = qa.score >= 60 && qa.errors.length === 0;

  // Generate summary
  qa.summary = generateQASummary(qa);

  return qa;
}

/**
 * Validate frame processing
 */
function validateFrameProcessing(reportData, qa) {
  const check = {
    name: 'Frame Processing Validation',
    passed: false,
    points: 0,
    maxPoints: 20,
    details: []
  };

  // Check if at least one frame was processed
  if (!reportData.frames || reportData.frames.length === 0) {
    qa.errors.push('No frames were processed by AI');
    check.details.push('❌ No AI-processed frames');
  } else {
    check.points += 10;
    check.details.push(`✅ ${reportData.frames.length} frame(s) processed`);

    // Check if all frames have AI services
    const framesWithServices = reportData.frames.filter(f => 
      f.servicesUsed && f.servicesUsed.length > 0
    ).length;

    if (framesWithServices === reportData.frames.length) {
      check.points += 10;
      check.details.push('✅ All frames have AI service attribution');
    } else {
      qa.warnings.push(`${reportData.frames.length - framesWithServices} frame(s) missing service attribution`);
      check.details.push(`⚠️ ${framesWithServices}/${reportData.frames.length} frames have service attribution`);
      check.points += 5;
    }
  }

  check.passed = check.points >= check.maxPoints * 0.7;
  qa.score += check.points;
  qa.checks.push(check);
}

/**
 * Validate required data fields
 */
function validateDataFields(reportData, qa) {
  const check = {
    name: 'Required Data Fields',
    passed: false,
    points: 0,
    maxPoints: 20,
    details: []
  };

  const requiredFields = {
    'studyInstanceUID': reportData.studyInstanceUID,
    'patientID': reportData.patientID,
    'reportDate': reportData.reportDate,
    'radiologistName': reportData.radiologistName
  };

  let fieldsPresent = 0;
  Object.entries(requiredFields).forEach(([field, value]) => {
    if (value) {
      fieldsPresent++;
      check.details.push(`✅ ${field} present`);
    } else {
      qa.warnings.push(`Missing required field: ${field}`);
      check.details.push(`⚠️ ${field} missing`);
    }
  });

  check.points = (fieldsPresent / Object.keys(requiredFields).length) * check.maxPoints;
  check.passed = check.points >= check.maxPoints * 0.8;
  qa.score += check.points;
  qa.checks.push(check);
}

/**
 * Validate confidence scores
 */
function validateConfidenceScores(reportData, qa) {
  const check = {
    name: 'Confidence Score Validation',
    passed: false,
    points: 0,
    maxPoints: 15,
    details: []
  };

  if (!reportData.frames || reportData.frames.length === 0) {
    check.details.push('⚠️ No frames to validate');
    qa.checks.push(check);
    return;
  }

  let validScores = 0;
  let invalidScores = 0;
  let missingScores = 0;

  reportData.frames.forEach((frame, idx) => {
    const confidence = frame.classification?.confidence || frame.confidence;

    if (confidence === undefined || confidence === null) {
      missingScores++;
    } else if (confidence < 0 || confidence > 1) {
      invalidScores++;
      qa.errors.push(`Frame ${idx}: Invalid confidence score ${confidence} (must be 0-1)`);
    } else {
      validScores++;
    }
  });

  if (invalidScores > 0) {
    check.details.push(`❌ ${invalidScores} invalid confidence score(s)`);
  }

  if (missingScores > 0) {
    check.details.push(`⚠️ ${missingScores} frame(s) missing confidence scores`);
    qa.warnings.push(`${missingScores} frame(s) missing confidence scores`);
  }

  if (validScores > 0) {
    check.details.push(`✅ ${validScores} valid confidence score(s)`);
  }

  check.points = (validScores / reportData.frames.length) * check.maxPoints;
  check.passed = invalidScores === 0;
  qa.score += check.points;
  qa.checks.push(check);
}

/**
 * Validate timestamps
 */
function validateTimestamps(reportData, qa) {
  const check = {
    name: 'Timestamp Validation',
    passed: false,
    points: 0,
    maxPoints: 10,
    details: []
  };

  // Validate report date
  if (reportData.reportDate) {
    const reportDate = new Date(reportData.reportDate);
    if (isNaN(reportDate.getTime())) {
      qa.errors.push('Invalid report date format');
      check.details.push('❌ Invalid report date');
    } else {
      check.points += 5;
      check.details.push('✅ Valid report date');
    }
  } else {
    qa.warnings.push('Missing report date');
    check.details.push('⚠️ Missing report date');
  }

  // Validate frame timestamps
  if (reportData.frames && reportData.frames.length > 0) {
    let validTimestamps = 0;
    reportData.frames.forEach((frame, idx) => {
      const timestamp = frame.timestamp || frame.analyzedAt;
      if (timestamp) {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          validTimestamps++;
        }
      }
    });

    if (validTimestamps === reportData.frames.length) {
      check.points += 5;
      check.details.push('✅ All frame timestamps valid');
    } else {
      check.details.push(`⚠️ ${validTimestamps}/${reportData.frames.length} valid frame timestamps`);
      check.points += (validTimestamps / reportData.frames.length) * 5;
    }
  }

  check.passed = check.points >= check.maxPoints * 0.7;
  qa.score += check.points;
  qa.checks.push(check);
}

/**
 * Validate image data
 */
function validateImageData(reportData, qa) {
  const check = {
    name: 'Image Data Validation',
    passed: false,
    points: 0,
    maxPoints: 15,
    details: []
  };

  if (!reportData.frames || reportData.frames.length === 0) {
    check.details.push('⚠️ No frames to validate');
    qa.checks.push(check);
    return;
  }

  let framesWithImages = 0;
  let validImages = 0;

  reportData.frames.forEach((frame, idx) => {
    if (frame.imageSnapshot) {
      framesWithImages++;

      // Basic validation of base64 data
      const imageData = frame.imageSnapshot.data || frame.imageSnapshot;
      if (typeof imageData === 'string' && imageData.length > 100) {
        validImages++;
      }
    }
  });

  if (framesWithImages === 0) {
    qa.warnings.push('No image snapshots available');
    check.details.push('⚠️ No image snapshots');
  } else {
    check.details.push(`✅ ${framesWithImages} frame(s) with images`);
    check.points = (validImages / reportData.frames.length) * check.maxPoints;

    if (validImages < framesWithImages) {
      qa.warnings.push(`${framesWithImages - validImages} image(s) may be invalid`);
    }
  }

  check.passed = framesWithImages > 0;
  qa.score += check.points;
  qa.checks.push(check);
}

/**
 * Validate clinical data
 */
function validateClinicalData(reportData, qa) {
  const check = {
    name: 'Clinical Data Validation',
    passed: false,
    points: 0,
    maxPoints: 15,
    details: []
  };

  // Check findings
  if (reportData.findingsText && reportData.findingsText.length > 50) {
    check.points += 5;
    check.details.push('✅ Findings text present');
  } else {
    qa.warnings.push('Findings text missing or too short');
    check.details.push('⚠️ Insufficient findings text');
  }

  // Check impression
  if (reportData.impression && reportData.impression.length > 20) {
    check.points += 5;
    check.details.push('✅ Impression present');
  } else {
    qa.warnings.push('Impression missing or too short');
    check.details.push('⚠️ Insufficient impression');
  }

  // Check technique
  if (reportData.technique) {
    check.points += 5;
    check.details.push('✅ Technique documented');
  } else {
    qa.recommendations.push('Consider adding technique description');
    check.details.push('ℹ️ Technique not documented');
  }

  check.passed = check.points >= check.maxPoints * 0.6;
  qa.score += check.points;
  qa.checks.push(check);
}

/**
 * Validate metadata
 */
function validateMetadata(reportData, qa) {
  const check = {
    name: 'Metadata Validation',
    passed: false,
    points: 0,
    maxPoints: 5,
    details: []
  };

  // Check report ID
  if (reportData.reportId) {
    check.points += 2;
    check.details.push('✅ Report ID present');
  }

  // Check modality
  if (reportData.modality) {
    check.points += 2;
    check.details.push('✅ Modality specified');
  }

  // Check tags
  if (reportData.tags && reportData.tags.length > 0) {
    check.points += 1;
    check.details.push('✅ Tags present');
  }

  check.passed = check.points >= check.maxPoints * 0.6;
  qa.score += check.points;
  qa.checks.push(check);
}

/**
 * Generate QA summary
 */
function generateQASummary(qa) {
  let summary = `Quality Assurance Report\n\n`;
  summary += `Overall Score: ${qa.score}/${qa.maxScore} (${qa.percentage}%)\n`;
  summary += `Grade: ${qa.grade}\n`;
  summary += `Status: ${qa.passed ? 'PASSED ✅' : 'FAILED ❌'}\n\n`;

  if (qa.errors.length > 0) {
    summary += `Errors (${qa.errors.length}):\n`;
    qa.errors.forEach((error, idx) => {
      summary += `${idx + 1}. ${error}\n`;
    });
    summary += `\n`;
  }

  if (qa.warnings.length > 0) {
    summary += `Warnings (${qa.warnings.length}):\n`;
    qa.warnings.forEach((warning, idx) => {
      summary += `${idx + 1}. ${warning}\n`;
    });
    summary += `\n`;
  }

  if (qa.recommendations.length > 0) {
    summary += `Recommendations (${qa.recommendations.length}):\n`;
    qa.recommendations.forEach((rec, idx) => {
      summary += `${idx + 1}. ${rec}\n`;
    });
  }

  return summary;
}

/**
 * Validate report before PDF generation
 */
function validateForPDFGeneration(reportData) {
  const validation = {
    canGenerate: false,
    blockers: [],
    warnings: []
  };

  // Critical checks
  if (!reportData.reportId) {
    validation.blockers.push('Missing report ID');
  }

  if (!reportData.studyInstanceUID) {
    validation.blockers.push('Missing study UID');
  }

  if (!reportData.frames || reportData.frames.length === 0) {
    validation.blockers.push('No frames to include in report');
  }

  // Warning checks
  if (!reportData.patientName) {
    validation.warnings.push('Patient name not specified');
  }

  if (!reportData.findingsText) {
    validation.warnings.push('No findings text');
  }

  if (!reportData.impression) {
    validation.warnings.push('No impression');
  }

  validation.canGenerate = validation.blockers.length === 0;

  return validation;
}

/**
 * Log QA results
 */
function logQAResults(qa, reportId) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Quality Assurance Report - ${reportId}`);
  console.log('='.repeat(60));
  console.log(`Score: ${qa.score}/${qa.maxScore} (${qa.percentage}%) - ${qa.grade}`);
  console.log(`Status: ${qa.passed ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (qa.errors.length > 0) {
    console.log(`\n❌ Errors: ${qa.errors.length}`);
    qa.errors.forEach(e => console.log(`   - ${e}`));
  }

  if (qa.warnings.length > 0) {
    console.log(`\n⚠️  Warnings: ${qa.warnings.length}`);
    qa.warnings.forEach(w => console.log(`   - ${w}`));
  }

  console.log(`\n${'='.repeat(60)}\n`);
}

module.exports = {
  performQualityAssurance,
  validateForPDFGeneration,
  logQAResults,
  generateQASummary
};
