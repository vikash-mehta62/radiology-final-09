/**
 * Frame Validation Utilities
 * Validates AI-processed frames to ensure only real analysis data is included
 */

/**
 * Validate if a frame was actually processed by AI services
 * @param {Object} frameData - AI analysis results for a frame
 * @returns {Object} { isValid: boolean, reason: string }
 */
function validateAIProcessedFrame(frameData) {
  if (!frameData) {
    return { isValid: false, reason: 'No frame data provided' };
  }

  // Check if AI status indicates unavailable
  if (frameData.aiStatus?.status === 'unavailable') {
    return { isValid: false, reason: 'AI status marked as unavailable' };
  }

  // Check if services were actually used
  if (!frameData.servicesUsed || !Array.isArray(frameData.servicesUsed) || frameData.servicesUsed.length === 0) {
    return { isValid: false, reason: 'No AI services were used' };
  }

  // Check if has classification OR report data (at least one must exist)
  const hasClassification = frameData.classification && 
    (frameData.classification.label || frameData.classification.confidence !== undefined);
  
  const hasReport = frameData.report && 
    (frameData.report.findings || frameData.report.impression);

  if (!hasClassification && !hasReport) {
    return { isValid: false, reason: 'No classification or report data available' };
  }

  // Check for dummy/fallback data indicators
  if (frameData.isDummy || frameData.isFallback || frameData.isPlaceholder) {
    return { isValid: false, reason: 'Frame contains dummy/fallback data' };
  }

  // Validate confidence scores are in valid range (0-1)
  if (frameData.classification?.confidence !== undefined) {
    const confidence = frameData.classification.confidence;
    if (confidence < 0 || confidence > 1) {
      return { isValid: false, reason: `Invalid confidence score: ${confidence}` };
    }
  }

  return { isValid: true, reason: 'Frame is valid' };
}

/**
 * Filter and validate multiple frames
 * @param {Array} frames - Array of frame analysis results
 * @returns {Object} { validFrames: Array, invalidFrames: Array, stats: Object }
 */
function validateAndFilterFrames(frames) {
  if (!Array.isArray(frames)) {
    return {
      validFrames: [],
      invalidFrames: [],
      stats: { total: 0, valid: 0, invalid: 0 }
    };
  }

  const validFrames = [];
  const invalidFrames = [];

  frames.forEach((frame, index) => {
    const validation = validateAIProcessedFrame(frame);
    
    if (validation.isValid) {
      validFrames.push({
        ...frame,
        validationStatus: 'valid',
        frameIndex: frame.frameIndex !== undefined ? frame.frameIndex : index
      });
    } else {
      invalidFrames.push({
        frameIndex: frame.frameIndex !== undefined ? frame.frameIndex : index,
        reason: validation.reason,
        data: frame
      });
      
      console.warn(`Frame ${frame.frameIndex || index} excluded: ${validation.reason}`);
    }
  });

  return {
    validFrames,
    invalidFrames,
    stats: {
      total: frames.length,
      valid: validFrames.length,
      invalid: invalidFrames.length,
      validPercentage: frames.length > 0 ? (validFrames.length / frames.length * 100).toFixed(1) : 0
    }
  };
}

/**
 * Validate required data fields in a frame
 * @param {Object} frame - Frame data
 * @returns {Object} { hasAllRequired: boolean, missingFields: Array }
 */
function validateRequiredFields(frame) {
  const requiredFields = {
    'frameIndex': frame.frameIndex !== undefined,
    'servicesUsed': frame.servicesUsed && frame.servicesUsed.length > 0,
    'analyzedAt': frame.analyzedAt || frame.timestamp,
    'classification OR report': frame.classification || frame.report
  };

  const missingFields = Object.entries(requiredFields)
    .filter(([field, exists]) => !exists)
    .map(([field]) => field);

  return {
    hasAllRequired: missingFields.length === 0,
    missingFields
  };
}

/**
 * Validate data quality and completeness
 * @param {Object} frame - Frame data
 * @returns {Object} Quality assessment
 */
function assessDataQuality(frame) {
  const quality = {
    score: 0,
    maxScore: 100,
    issues: [],
    strengths: []
  };

  // Check classification data (30 points)
  if (frame.classification) {
    if (frame.classification.label) {
      quality.score += 15;
      quality.strengths.push('Has classification label');
    }
    if (frame.classification.confidence !== undefined) {
      quality.score += 15;
      quality.strengths.push('Has confidence score');
    }
  } else {
    quality.issues.push('Missing classification data');
  }

  // Check report data (30 points)
  if (frame.report) {
    if (frame.report.findings) {
      quality.score += 10;
      quality.strengths.push('Has findings');
    }
    if (frame.report.impression) {
      quality.score += 10;
      quality.strengths.push('Has impression');
    }
    if (frame.report.recommendations && frame.report.recommendations.length > 0) {
      quality.score += 10;
      quality.strengths.push('Has recommendations');
    }
  } else {
    quality.issues.push('Missing report data');
  }

  // Check detections/findings (20 points)
  if (frame.findings && Array.isArray(frame.findings) && frame.findings.length > 0) {
    quality.score += 20;
    quality.strengths.push(`Has ${frame.findings.length} detection(s)`);
  } else {
    quality.issues.push('No detections found');
  }

  // Check metadata (20 points)
  if (frame.metadata) {
    quality.score += 10;
    quality.strengths.push('Has metadata');
  }
  if (frame.imageSnapshot) {
    quality.score += 10;
    quality.strengths.push('Has image snapshot');
  } else {
    quality.issues.push('Missing image snapshot');
  }

  quality.percentage = (quality.score / quality.maxScore * 100).toFixed(1);
  quality.grade = quality.score >= 80 ? 'Excellent' :
                  quality.score >= 60 ? 'Good' :
                  quality.score >= 40 ? 'Fair' : 'Poor';

  return quality;
}

module.exports = {
  validateAIProcessedFrame,
  validateAndFilterFrames,
  validateRequiredFields,
  assessDataQuality
};
