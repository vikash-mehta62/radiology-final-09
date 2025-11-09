/**
 * Complete Data Extraction Utilities
 * Extracts all required fields from AI analysis results
 */

/**
 * Extract complete data from AI analysis frame
 * @param {Object} frame - AI analysis result
 * @returns {Object} Extracted data with all fields
 */
function extractCompleteData(frame) {
  const extracted = {
    // Basic frame info
    frameIndex: frame.frameIndex,
    timestamp: frame.analyzedAt || frame.timestamp || new Date(),
    servicesUsed: frame.servicesUsed || [],

    // Classification data
    classification: extractClassification(frame),

    // Findings and detections
    findings: extractFindings(frame),
    keyFindings: extractKeyFindings(frame),
    criticalFindings: extractCriticalFindings(frame),
    detectionSummary: extractDetectionSummary(frame),

    // Report data
    report: extractReport(frame),

    // Quality metrics
    quality: extractQualityMetrics(frame),

    // Image data
    imageSnapshot: extractImageSnapshot(frame),

    // Metadata
    metadata: extractMetadata(frame),

    // Validation
    dataCompleteness: 0
  };

  // Calculate data completeness
  extracted.dataCompleteness = calculateDataCompleteness(extracted);

  return extracted;
}

/**
 * Extract classification data
 */
function extractClassification(frame) {
  if (!frame.classification) {
    return null;
  }

  const classification = frame.classification;

  return {
    label: classification.label || classification,
    confidence: classification.confidence !== undefined ? classification.confidence : null,
    topPredictions: classification.topPredictions || [],
    model: classification.model || 'MedSigLIP',
    timestamp: classification.timestamp || frame.timestamp
  };
}

/**
 * Extract findings/detections
 */
function extractFindings(frame) {
  const findings = [];

  // From findings array
  if (frame.findings && Array.isArray(frame.findings)) {
    frame.findings.forEach(finding => {
      findings.push({
        type: finding.type || 'unknown',
        description: finding.description || '',
        location: finding.location || 'unspecified',
        confidence: finding.confidence,
        severity: finding.severity || 'normal',
        boundingBox: finding.boundingBox || null,
        clinicalCode: finding.clinicalCode || null
      });
    });
  }

  // From detections array (alternative structure)
  if (frame.detections && Array.isArray(frame.detections)) {
    frame.detections.forEach(detection => {
      findings.push({
        type: detection.label || detection.type || 'unknown',
        description: detection.description || `${detection.label} detected`,
        location: detection.location || `Region (${detection.x}, ${detection.y})`,
        confidence: detection.confidence,
        severity: detection.severity || (detection.confidence > 0.8 ? 'moderate' : 'mild'),
        boundingBox: detection.x !== undefined ? {
          x: detection.x,
          y: detection.y,
          width: detection.width,
          height: detection.height
        } : null
      });
    });
  }

  return findings;
}

/**
 * Extract key findings
 */
function extractKeyFindings(frame) {
  const keyFindings = [];

  // From report.keyFindings
  if (frame.report?.keyFindings && Array.isArray(frame.report.keyFindings)) {
    return frame.report.keyFindings.map(kf => ({
      finding: kf.finding || kf.description || kf,
      significance: kf.significance || 'moderate',
      location: kf.location || 'unspecified',
      recommendation: kf.recommendation || null
    }));
  }

  // From results.keyFindings
  if (frame.results?.keyFindings && Array.isArray(frame.results.keyFindings)) {
    return frame.results.keyFindings.map(kf => ({
      finding: kf.finding || kf.description || kf,
      significance: kf.significance || 'moderate',
      location: kf.location || 'unspecified',
      recommendation: kf.recommendation || null
    }));
  }

  // Auto-generate from high-confidence findings
  const findings = extractFindings(frame);
  findings.forEach(finding => {
    if (finding.confidence > 0.8 || finding.severity === 'severe' || finding.severity === 'critical') {
      keyFindings.push({
        finding: `${finding.type}: ${finding.description}`,
        significance: finding.severity,
        location: finding.location,
        recommendation: null
      });
    }
  });

  return keyFindings;
}

/**
 * Extract critical findings
 */
function extractCriticalFindings(frame) {
  const criticalFindings = [];

  // From report.criticalFindings
  if (frame.report?.criticalFindings && Array.isArray(frame.report.criticalFindings)) {
    return frame.report.criticalFindings.map(cf => ({
      finding: cf.finding || cf.description || cf,
      urgency: cf.urgency || 'high',
      action: cf.action || cf.recommendation || 'Immediate review required',
      timestamp: cf.timestamp || frame.timestamp
    }));
  }

  // From results.criticalFindings
  if (frame.results?.criticalFindings && Array.isArray(frame.results.criticalFindings)) {
    return frame.results.criticalFindings.map(cf => ({
      finding: cf.finding || cf.description || cf,
      urgency: cf.urgency || 'high',
      action: cf.action || cf.recommendation || 'Immediate review required',
      timestamp: cf.timestamp || frame.timestamp
    }));
  }

  // Auto-identify from findings with critical severity
  const findings = extractFindings(frame);
  findings.forEach(finding => {
    if (finding.severity === 'critical' || finding.severity === 'severe') {
      criticalFindings.push({
        finding: `${finding.type}: ${finding.description}`,
        urgency: finding.severity === 'critical' ? 'critical' : 'high',
        action: 'Immediate clinical review and correlation required',
        timestamp: frame.timestamp
      });
    }
  });

  return criticalFindings;
}

/**
 * Extract detection summary
 */
function extractDetectionSummary(frame) {
  // From results.detectionSummary
  if (frame.results?.detectionSummary) {
    return frame.results.detectionSummary;
  }

  // From detections
  if (frame.detections?.summary) {
    return frame.detections.summary;
  }

  // Generate from findings
  const findings = extractFindings(frame);
  if (findings.length === 0) {
    return {
      totalDetections: 0,
      summary: 'No abnormalities detected',
      confidence: frame.classification?.confidence || 0
    };
  }

  const detectionTypes = {};
  findings.forEach(f => {
    detectionTypes[f.type] = (detectionTypes[f.type] || 0) + 1;
  });

  const summaryText = Object.entries(detectionTypes)
    .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
    .join(', ');

  return {
    totalDetections: findings.length,
    summary: `Detected: ${summaryText}`,
    detectionTypes,
    averageConfidence: findings.reduce((sum, f) => sum + (f.confidence || 0), 0) / findings.length
  };
}

/**
 * Extract report data
 */
function extractReport(frame) {
  if (!frame.report) {
    return null;
  }

  const report = frame.report;

  return {
    findings: report.findings || 'Data unavailable',
    impression: report.impression || 'Data unavailable',
    recommendations: Array.isArray(report.recommendations) ? report.recommendations : 
                     report.recommendations ? [report.recommendations] : [],
    technique: report.technique || null,
    comparison: report.comparison || null,
    model: report.model || 'MedGemma'
  };
}

/**
 * Extract quality metrics
 */
function extractQualityMetrics(frame) {
  const quality = {
    overallConfidence: null,
    imageQuality: null,
    reliability: null,
    completeness: null
  };

  // Overall confidence
  if (frame.combined?.overallConfidence !== undefined) {
    quality.overallConfidence = frame.combined.overallConfidence;
  } else if (frame.overallConfidence !== undefined) {
    quality.overallConfidence = frame.overallConfidence;
  } else if (frame.classification?.confidence !== undefined) {
    quality.overallConfidence = frame.classification.confidence;
  }

  // Image quality
  if (frame.imageQuality !== undefined) {
    quality.imageQuality = frame.imageQuality;
  } else if (frame.metadata?.imageQuality !== undefined) {
    quality.imageQuality = frame.metadata.imageQuality;
  } else if (frame.quality?.imageQuality !== undefined) {
    quality.imageQuality = frame.quality.imageQuality;
  }

  // Reliability
  if (frame.reliability !== undefined) {
    quality.reliability = frame.reliability;
  } else if (frame.metadata?.reliability !== undefined) {
    quality.reliability = frame.metadata.reliability;
  } else if (frame.quality?.reliability !== undefined) {
    quality.reliability = frame.quality.reliability;
  }

  // Completeness
  if (frame.completeness !== undefined) {
    quality.completeness = frame.completeness;
  } else if (frame.metadata?.completeness !== undefined) {
    quality.completeness = frame.metadata.completeness;
  } else if (frame.quality?.completeness !== undefined) {
    quality.completeness = frame.quality.completeness;
  }

  return quality;
}

/**
 * Extract image snapshot
 */
function extractImageSnapshot(frame) {
  // From imageSnapshot
  if (frame.imageSnapshot) {
    return {
      data: frame.imageSnapshot.data || frame.imageSnapshot,
      caption: frame.imageSnapshot.caption || `Frame ${frame.frameIndex}`,
      timestamp: frame.imageSnapshot.timestamp || frame.timestamp,
      metadata: frame.imageSnapshot.metadata || null
    };
  }

  // From image
  if (frame.image) {
    return {
      data: frame.image.data || frame.image,
      caption: `Frame ${frame.frameIndex}`,
      timestamp: frame.timestamp,
      metadata: null
    };
  }

  return null;
}

/**
 * Extract metadata
 */
function extractMetadata(frame) {
  const metadata = {
    studyUID: frame.studyInstanceUID || frame.studyUID || null,
    seriesUID: frame.seriesInstanceUID || frame.seriesUID || null,
    instanceUID: frame.instanceUID || null,
    frameIndex: frame.frameIndex,
    sliceLocation: frame.sliceLocation || null,
    windowLevel: frame.windowLevel || null,
    zoom: frame.zoom || null,
    hasAIOverlay: frame.hasAIOverlay || false,
    hasAnnotations: frame.hasAnnotations || false,
    processingTime: frame.processingTime || null,
    modelVersions: frame.modelVersions || null
  };

  // Merge with existing metadata
  if (frame.metadata) {
    Object.assign(metadata, frame.metadata);
  }

  return metadata;
}

/**
 * Calculate data completeness percentage
 */
function calculateDataCompleteness(extracted) {
  let score = 0;
  let maxScore = 100;

  // Classification (20 points)
  if (extracted.classification) {
    score += 10;
    if (extracted.classification.confidence !== null) score += 10;
  }

  // Findings (20 points)
  if (extracted.findings && extracted.findings.length > 0) {
    score += 20;
  }

  // Report (30 points)
  if (extracted.report) {
    if (extracted.report.findings && extracted.report.findings !== 'Data unavailable') score += 10;
    if (extracted.report.impression && extracted.report.impression !== 'Data unavailable') score += 10;
    if (extracted.report.recommendations && extracted.report.recommendations.length > 0) score += 10;
  }

  // Quality metrics (15 points)
  if (extracted.quality.overallConfidence !== null) score += 5;
  if (extracted.quality.imageQuality !== null) score += 5;
  if (extracted.quality.reliability !== null) score += 5;

  // Image snapshot (10 points)
  if (extracted.imageSnapshot) score += 10;

  // Metadata (5 points)
  if (extracted.metadata.studyUID) score += 5;

  return (score / maxScore * 100).toFixed(1);
}

/**
 * Extract data from multiple frames
 */
function extractMultipleFrames(frames) {
  if (!Array.isArray(frames)) {
    return [];
  }

  return frames.map(frame => extractCompleteData(frame));
}

/**
 * Validate extracted data
 */
function validateExtractedData(extracted) {
  const issues = [];
  const warnings = [];

  // Check required fields
  if (!extracted.frameIndex && extracted.frameIndex !== 0) {
    issues.push('Missing frame index');
  }

  if (!extracted.servicesUsed || extracted.servicesUsed.length === 0) {
    issues.push('No AI services used');
  }

  if (!extracted.classification && !extracted.report) {
    issues.push('Missing both classification and report data');
  }

  // Check data quality
  if (extracted.dataCompleteness < 50) {
    warnings.push(`Low data completeness: ${extracted.dataCompleteness}%`);
  }

  if (extracted.quality.overallConfidence !== null && extracted.quality.overallConfidence < 0.5) {
    warnings.push(`Low confidence: ${(extracted.quality.overallConfidence * 100).toFixed(1)}%`);
  }

  if (!extracted.imageSnapshot) {
    warnings.push('No image snapshot available');
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings,
    dataCompleteness: extracted.dataCompleteness
  };
}

module.exports = {
  extractCompleteData,
  extractMultipleFrames,
  validateExtractedData,
  extractClassification,
  extractFindings,
  extractKeyFindings,
  extractCriticalFindings,
  extractDetectionSummary,
  extractReport,
  extractQualityMetrics,
  extractImageSnapshot,
  extractMetadata
};
