/**
 * Report Statistics Calculator
 * Calculates aggregate statistics across multiple frames
 */

/**
 * Calculate comprehensive statistics for multi-frame analysis
 * @param {Array} validFrames - Array of validated frame data
 * @returns {Object} Aggregate statistics
 */
function calculateAggregateStatistics(validFrames) {
  if (!Array.isArray(validFrames) || validFrames.length === 0) {
    return {
      totalFrames: 0,
      error: 'No valid frames to analyze'
    };
  }

  const stats = {
    // Basic counts
    totalFrames: validFrames.length,
    framesWithClassification: 0,
    framesWithReport: 0,
    framesWithDetections: 0,
    framesWithCriticalFindings: 0,

    // Classification statistics
    classifications: {},
    mostCommonFinding: null,
    mostCommonFindingCount: 0,

    // Confidence statistics
    confidenceScores: [],
    averageConfidence: 0,
    highestConfidence: { score: 0, frameIndex: null },
    lowestConfidence: { score: 1, frameIndex: null },
    highConfidenceFrames: [], // > 0.8
    lowConfidenceFrames: [], // < 0.5

    // Detection statistics
    totalDetections: 0,
    detectionsByType: {},
    criticalFindings: [],

    // Quality metrics
    qualityScores: [],
    averageQuality: 0,

    // Service usage
    servicesUsed: new Set(),
    
    // Frame indices
    analyzedFrameIndices: [],
    
    // Timestamps
    firstAnalysis: null,
    lastAnalysis: null
  };

  // Process each frame
  validFrames.forEach((frame, idx) => {
    const frameIndex = frame.frameIndex !== undefined ? frame.frameIndex : idx;
    stats.analyzedFrameIndices.push(frameIndex);

    // Track services used
    if (frame.servicesUsed && Array.isArray(frame.servicesUsed)) {
      frame.servicesUsed.forEach(service => stats.servicesUsed.add(service));
    }

    // Classification statistics
    if (frame.classification) {
      stats.framesWithClassification++;
      
      const label = frame.classification.label || frame.classification;
      if (label) {
        stats.classifications[label] = (stats.classifications[label] || 0) + 1;
        
        if (stats.classifications[label] > stats.mostCommonFindingCount) {
          stats.mostCommonFinding = label;
          stats.mostCommonFindingCount = stats.classifications[label];
        }
      }

      // Confidence scores
      const confidence = frame.classification.confidence || frame.confidence;
      if (confidence !== undefined && confidence !== null) {
        stats.confidenceScores.push(confidence);
        
        if (confidence > stats.highestConfidence.score) {
          stats.highestConfidence = { score: confidence, frameIndex, label };
        }
        
        if (confidence < stats.lowestConfidence.score) {
          stats.lowestConfidence = { score: confidence, frameIndex, label };
        }

        if (confidence > 0.8) {
          stats.highConfidenceFrames.push({ frameIndex, confidence, label });
        } else if (confidence < 0.5) {
          stats.lowConfidenceFrames.push({ frameIndex, confidence, label });
        }
      }
    }

    // Report statistics
    if (frame.report) {
      stats.framesWithReport++;
    }

    // Detection statistics
    if (frame.findings && Array.isArray(frame.findings)) {
      stats.framesWithDetections++;
      stats.totalDetections += frame.findings.length;

      frame.findings.forEach(finding => {
        const type = finding.type || 'unknown';
        stats.detectionsByType[type] = (stats.detectionsByType[type] || 0) + 1;

        // Track critical findings
        if (finding.severity === 'critical' || finding.severity === 'severe') {
          stats.criticalFindings.push({
            frameIndex,
            type,
            description: finding.description,
            severity: finding.severity,
            confidence: finding.confidence
          });
          stats.framesWithCriticalFindings++;
        }
      });
    }

    // Quality metrics
    if (frame.imageQuality !== undefined) {
      stats.qualityScores.push(frame.imageQuality);
    } else if (frame.metadata?.imageQuality !== undefined) {
      stats.qualityScores.push(frame.metadata.imageQuality);
    }

    // Timestamps
    const timestamp = frame.analyzedAt || frame.timestamp;
    if (timestamp) {
      const date = new Date(timestamp);
      if (!stats.firstAnalysis || date < stats.firstAnalysis) {
        stats.firstAnalysis = date;
      }
      if (!stats.lastAnalysis || date > stats.lastAnalysis) {
        stats.lastAnalysis = date;
      }
    }
  });

  // Calculate averages
  if (stats.confidenceScores.length > 0) {
    stats.averageConfidence = stats.confidenceScores.reduce((a, b) => a + b, 0) / stats.confidenceScores.length;
  }

  if (stats.qualityScores.length > 0) {
    stats.averageQuality = stats.qualityScores.reduce((a, b) => a + b, 0) / stats.qualityScores.length;
  }

  // Calculate percentages
  stats.classificationPercentage = (stats.framesWithClassification / stats.totalFrames * 100).toFixed(1);
  stats.reportPercentage = (stats.framesWithReport / stats.totalFrames * 100).toFixed(1);
  stats.detectionPercentage = (stats.framesWithDetections / stats.totalFrames * 100).toFixed(1);
  stats.criticalFindingsPercentage = (stats.framesWithCriticalFindings / stats.totalFrames * 100).toFixed(1);

  // Convert Set to Array
  stats.servicesUsed = Array.from(stats.servicesUsed);

  // Sort frames by confidence
  stats.highConfidenceFrames.sort((a, b) => b.confidence - a.confidence);
  stats.lowConfidenceFrames.sort((a, b) => a.confidence - b.confidence);

  // Create classification distribution array
  stats.classificationDistribution = Object.entries(stats.classifications)
    .map(([label, count]) => ({
      label,
      count,
      percentage: (count / stats.totalFrames * 100).toFixed(1)
    }))
    .sort((a, b) => b.count - a.count);

  // Create detection distribution array
  stats.detectionDistribution = Object.entries(stats.detectionsByType)
    .map(([type, count]) => ({
      type,
      count,
      percentage: (count / stats.totalDetections * 100).toFixed(1)
    }))
    .sort((a, b) => b.count - a.count);

  return stats;
}

/**
 * Generate executive summary from statistics
 * @param {Object} stats - Aggregate statistics
 * @returns {String} Executive summary text
 */
function generateExecutiveSummary(stats) {
  if (!stats || stats.totalFrames === 0) {
    return 'No frames were analyzed.';
  }

  let summary = `EXECUTIVE SUMMARY\n\n`;
  summary += `Total Frames Analyzed: ${stats.totalFrames}\n`;
  summary += `Analysis Period: ${stats.firstAnalysis ? stats.firstAnalysis.toLocaleString() : 'N/A'} to ${stats.lastAnalysis ? stats.lastAnalysis.toLocaleString() : 'N/A'}\n`;
  summary += `AI Services Used: ${stats.servicesUsed.join(', ')}\n\n`;

  // Key findings
  summary += `KEY FINDINGS:\n`;
  if (stats.mostCommonFinding) {
    summary += `- Most Common Finding: ${stats.mostCommonFinding} (${stats.mostCommonFindingCount} occurrences, ${(stats.mostCommonFindingCount / stats.totalFrames * 100).toFixed(1)}%)\n`;
  }
  
  if (stats.averageConfidence > 0) {
    summary += `- Average Confidence: ${(stats.averageConfidence * 100).toFixed(1)}%\n`;
  }

  if (stats.totalDetections > 0) {
    summary += `- Total Detections: ${stats.totalDetections} across ${stats.framesWithDetections} frames\n`;
  }

  if (stats.criticalFindings.length > 0) {
    summary += `- Critical Findings: ${stats.criticalFindings.length} (${stats.criticalFindingsPercentage}% of frames)\n`;
  }

  if (stats.averageQuality > 0) {
    summary += `- Average Image Quality: ${(stats.averageQuality * 100).toFixed(1)}%\n`;
  }

  // Classification distribution
  if (stats.classificationDistribution.length > 0) {
    summary += `\nCLASSIFICATION DISTRIBUTION:\n`;
    stats.classificationDistribution.slice(0, 5).forEach(item => {
      summary += `- ${item.label}: ${item.count} frames (${item.percentage}%)\n`;
    });
  }

  // Critical findings detail
  if (stats.criticalFindings.length > 0) {
    summary += `\nCRITICAL FINDINGS DETAIL:\n`;
    stats.criticalFindings.forEach((finding, idx) => {
      summary += `${idx + 1}. Frame ${finding.frameIndex}: ${finding.type} - ${finding.description}\n`;
    });
  }

  return summary;
}

/**
 * Generate detailed statistics report
 * @param {Object} stats - Aggregate statistics
 * @returns {String} Detailed statistics text
 */
function generateDetailedStatistics(stats) {
  if (!stats || stats.totalFrames === 0) {
    return 'No statistics available.';
  }

  let report = `DETAILED STATISTICS\n\n`;

  // Frame coverage
  report += `FRAME COVERAGE:\n`;
  report += `- Total Frames: ${stats.totalFrames}\n`;
  report += `- Frames with Classification: ${stats.framesWithClassification} (${stats.classificationPercentage}%)\n`;
  report += `- Frames with Report: ${stats.framesWithReport} (${stats.reportPercentage}%)\n`;
  report += `- Frames with Detections: ${stats.framesWithDetections} (${stats.detectionPercentage}%)\n`;
  report += `- Frames with Critical Findings: ${stats.framesWithCriticalFindings} (${stats.criticalFindingsPercentage}%)\n\n`;

  // Confidence analysis
  report += `CONFIDENCE ANALYSIS:\n`;
  report += `- Average Confidence: ${(stats.averageConfidence * 100).toFixed(1)}%\n`;
  report += `- Highest Confidence: ${(stats.highestConfidence.score * 100).toFixed(1)}% (Frame ${stats.highestConfidence.frameIndex})\n`;
  report += `- Lowest Confidence: ${(stats.lowestConfidence.score * 100).toFixed(1)}% (Frame ${stats.lowestConfidence.frameIndex})\n`;
  report += `- High Confidence Frames (>80%): ${stats.highConfidenceFrames.length}\n`;
  report += `- Low Confidence Frames (<50%): ${stats.lowConfidenceFrames.length}\n\n`;

  // Detection analysis
  if (stats.totalDetections > 0) {
    report += `DETECTION ANALYSIS:\n`;
    report += `- Total Detections: ${stats.totalDetections}\n`;
    report += `- Average Detections per Frame: ${(stats.totalDetections / stats.framesWithDetections).toFixed(1)}\n`;
    report += `- Detection Types:\n`;
    stats.detectionDistribution.forEach(item => {
      report += `  • ${item.type}: ${item.count} (${item.percentage}%)\n`;
    });
    report += `\n`;
  }

  // Quality metrics
  if (stats.averageQuality > 0) {
    report += `QUALITY METRICS:\n`;
    report += `- Average Image Quality: ${(stats.averageQuality * 100).toFixed(1)}%\n`;
    report += `- Quality Scores Available: ${stats.qualityScores.length} frames\n\n`;
  }

  return report;
}

module.exports = {
  calculateAggregateStatistics,
  generateExecutiveSummary,
  generateDetailedStatistics
};
