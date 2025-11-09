const PriorAuthorization = require('../models/PriorAuthorization');
const Study = require('../models/Study');

/**
 * Prior Authorization Automation Service
 * Automatically checks medical necessity, appropriateness, and coverage
 */
class PriorAuthAutomationService {
  
  /**
   * Run all automated checks for a prior authorization request
   */
  async runAutomatedChecks(authRequest) {
    console.log(`🤖 Running automated checks for auth: ${authRequest.authorizationNumber}`);
    
    const checks = {
      medicalNecessity: await this.checkMedicalNecessity(authRequest),
      appropriateness: await this.checkAppropriateness(authRequest),
      duplicateCheck: await this.checkDuplicates(authRequest),
      coverageCheck: await this.checkCoverage(authRequest)
    };
    
    // Calculate overall recommendation
    const allPassed = Object.values(checks).every(check => check.passed);
    const recommendation = allPassed ? 'approve' : 'review';
    
    return {
      checks,
      recommendation,
      confidence: this.calculateConfidence(checks)
    };
  }
  
  /**
   * Check medical necessity based on diagnosis and procedure
   */
  async checkMedicalNecessity(authRequest) {
    const { diagnosis, procedureCode, clinicalIndication } = authRequest;
    
    const reasons = [];
    let score = 0;
    
    // Check if diagnosis codes are provided
    if (!diagnosis || diagnosis.length === 0) {
      reasons.push('No diagnosis codes provided');
    } else {
      score += 30;
      reasons.push(`${diagnosis.length} diagnosis code(s) provided`);
    }
    
    // Check if clinical indication is provided
    if (clinicalIndication && clinicalIndication.length > 20) {
      score += 30;
      reasons.push('Detailed clinical indication provided');
    } else {
      reasons.push('Limited clinical indication');
    }
    
    // Check procedure-diagnosis alignment (simplified)
    if (this.isProcedureDiagnosisAligned(procedureCode, diagnosis)) {
      score += 40;
      reasons.push('Procedure aligns with diagnosis');
    } else {
      reasons.push('Procedure-diagnosis alignment unclear');
    }
    
    return {
      passed: score >= 70,
      score,
      reasons
    };
  }
  
  /**
   * Check appropriateness using ACR criteria (simplified)
   */
  async checkAppropriateness(authRequest) {
    const { procedureCode, modality, bodyPart, diagnosis } = authRequest;
    
    const reasons = [];
    let passed = true;
    
    // Check if modality is appropriate for body part
    const appropriateModality = this.isModalityAppropriate(modality, bodyPart);
    if (appropriateModality) {
      reasons.push(`${modality} is appropriate for ${bodyPart}`);
    } else {
      passed = false;
      reasons.push(`${modality} may not be most appropriate for ${bodyPart}`);
    }
    
    // Check ACR appropriateness criteria (simplified)
    const acrRating = this.getACRRating(modality, bodyPart, diagnosis);
    if (acrRating >= 7) {
      reasons.push(`ACR rating: ${acrRating}/9 (Usually Appropriate)`);
    } else if (acrRating >= 4) {
      reasons.push(`ACR rating: ${acrRating}/9 (May Be Appropriate)`);
    } else {
      passed = false;
      reasons.push(`ACR rating: ${acrRating}/9 (Usually Not Appropriate)`);
    }
    
    return {
      passed,
      criteria: 'ACR Appropriateness Criteria',
      reasons
    };
  }
  
  /**
   * Check for duplicate authorizations
   */
  async checkDuplicates(authRequest) {
    const { patientID, procedureCode, modality, bodyPart } = authRequest;
    
    // Look for similar authorizations in last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const duplicates = await PriorAuthorization.find({
      patientID,
      procedureCode,
      modality,
      bodyPart,
      status: { $in: ['approved', 'pending'] },
      createdAt: { $gte: ninetyDaysAgo },
      _id: { $ne: authRequest._id }
    }).select('authorizationNumber createdAt status');
    
    return {
      passed: duplicates.length === 0,
      duplicates: duplicates.map(d => d.authorizationNumber)
    };
  }
  
  /**
   * Check insurance coverage
   */
  async checkCoverage(authRequest) {
    const { insuranceProvider, procedureCode, modality } = authRequest;
    
    const reasons = [];
    let covered = true;
    
    // Check if procedure is typically covered (simplified)
    const commonlyCovered = this.isCommonlyCovered(procedureCode, modality);
    if (commonlyCovered) {
      reasons.push('Procedure is commonly covered');
    } else {
      covered = false;
      reasons.push('Procedure may require special approval');
    }
    
    // Check insurance-specific rules (would integrate with real payer APIs)
    if (insuranceProvider) {
      reasons.push(`Insurance: ${insuranceProvider}`);
    } else {
      reasons.push('Insurance provider not specified');
    }
    
    return {
      passed: covered,
      covered,
      reasons
    };
  }
  
  /**
   * Helper: Check if procedure aligns with diagnosis
   */
  isProcedureDiagnosisAligned(procedureCode, diagnosisCodes) {
    if (!diagnosisCodes || diagnosisCodes.length === 0) return false;
    
    // Simplified alignment check
    // In production, use LCD/NCD databases
    return true; // Assume aligned for now
  }
  
  /**
   * Helper: Check if modality is appropriate for body part
   */
  isModalityAppropriate(modality, bodyPart) {
    const appropriateness = {
      'CT': ['head', 'chest', 'abdomen', 'pelvis', 'spine'],
      'MR': ['brain', 'spine', 'joints', 'soft tissue'],
      'XR': ['chest', 'bones', 'joints'],
      'US': ['abdomen', 'pelvis', 'vascular', 'obstetric'],
      'NM': ['cardiac', 'bone', 'thyroid']
    };
    
    const appropriate = appropriateness[modality] || [];
    return appropriate.some(part => bodyPart?.toLowerCase().includes(part));
  }
  
  /**
   * Helper: Get ACR appropriateness rating (simplified)
   */
  getACRRating(modality, bodyPart, diagnosisCodes) {
    // Simplified ACR rating
    // In production, integrate with ACR API
    
    // Default ratings based on common scenarios
    if (modality === 'CT' && bodyPart?.includes('head')) return 8;
    if (modality === 'MR' && bodyPart?.includes('brain')) return 9;
    if (modality === 'XR' && bodyPart?.includes('chest')) return 7;
    if (modality === 'US' && bodyPart?.includes('abdomen')) return 7;
    
    return 5; // Default: May Be Appropriate
  }
  
  /**
   * Helper: Check if procedure is commonly covered
   */
  isCommonlyCovered(procedureCode, modality) {
    // Simplified coverage check
    // In production, integrate with payer coverage databases
    
    const commonModalities = ['CT', 'MR', 'XR', 'US', 'NM'];
    return commonModalities.includes(modality);
  }
  
  /**
   * Calculate confidence score for recommendation
   */
  calculateConfidence(checks) {
    const scores = [];
    
    if (checks.medicalNecessity.score) {
      scores.push(checks.medicalNecessity.score);
    }
    
    if (checks.appropriateness.passed) scores.push(100);
    else scores.push(50);
    
    if (checks.duplicateCheck.passed) scores.push(100);
    else scores.push(30);
    
    if (checks.coverageCheck.passed) scores.push(100);
    else scores.push(40);
    
    const average = scores.reduce((a, b) => a + b, 0) / scores.length;
    return Math.round(average);
  }
  
  /**
   * Auto-approve if all checks pass with high confidence
   */
  async autoApprove(authRequest) {
    const result = await this.runAutomatedChecks(authRequest);
    
    if (result.recommendation === 'approve' && result.confidence >= 85) {
      authRequest.status = 'approved';
      authRequest.approvalDate = new Date();
      authRequest.expirationDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
      authRequest.automatedChecks = result.checks;
      authRequest.reviewNotes = `Auto-approved with ${result.confidence}% confidence`;
      
      await authRequest.save();
      
      console.log(`✅ Auto-approved: ${authRequest.authorizationNumber}`);
      return true;
    }
    
    return false;
  }
}

module.exports = new PriorAuthAutomationService();
