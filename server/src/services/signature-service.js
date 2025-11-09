const DigitalSignature = require('../models/DigitalSignature');
const Report = require('../models/Report');
const User = require('../models/User');
const cryptoService = require('./crypto-service');
const auditService = require('./audit-service');

class SignatureService {
  async signReport(reportId, userId, meaning, metadata = {}) {
    try {
      const report = await Report.findOne({ reportId });
      if (!report) throw new Error('Report not found');

      this.validateReportForSigning(report);

      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      const existingSignature = await DigitalSignature.findOne({ reportId, meaning, status: 'valid' });
      if (existingSignature) throw new Error(`Report already has a valid ${meaning} signature`);

      const reportData = this.serializeReport(report);
      const reportHash = cryptoService.hashData(reportData);

      const signatureHash = cryptoService.generateSignature(reportHash);

      const signature = new DigitalSignature({
        reportId,
        signerId: userId,
        signerName: user.name || user.username,
        signerRole: user.role || 'radiologist',
        signatureHash,
        algorithm: 'RSA-SHA256',
        keySize: 2048,
        keyVersion: cryptoService.getKeyVersion(),
        timestamp: new Date(),
        meaning,
        status: 'valid',
        metadata: {
          ipAddress: metadata.ipAddress || 'unknown',
          userAgent: metadata.userAgent || 'unknown',
          location: metadata.location,
          deviceId: metadata.deviceId
        },
        reportHash,
        auditTrail: []
      });

      await signature.save();

      if (meaning === 'author' && report.status === 'draft') {
        report.status = 'preliminary';
      } else if (meaning === 'approver') {
        report.status = 'final';
      }

      report.signature = report.signature || {};
      report.signature.signedBy = user.name || user.username;
      report.signature.signedAt = new Date();
      report.signature.credentials = user.credentials || user.role;
      await report.save();

      await auditService.logSignature(signature, 'created', userId, metadata.ipAddress);
      return signature;
    } catch (err) {
      console.error('Error signing report:', err);
      throw err;
    }
  }

  async verifySignature(signatureId, userId = null, ipAddress = 'unknown') {
    try {
      const signature = await DigitalSignature.findById(signatureId);
      if (!signature) throw new Error('Signature not found');

      if (signature.status === 'revoked') {
        return { valid: false, signature, reason: 'Signature has been revoked', verifiedAt: new Date() };
      }

      const report = await Report.findOne({ reportId: signature.reportId });
      if (!report) throw new Error('Report not found');

      const reportData = this.serializeReport(report);
      const currentHash = cryptoService.hashData(reportData);

      if (currentHash !== signature.reportHash) {
        await signature.invalidate(userId, ipAddress, 'Report content has been modified after signing');
        return {
          valid: false,
          signature,
          reason: 'Report has been modified after signing',
          verifiedAt: new Date(),
          currentHash,
          originalHash: signature.reportHash
        };
      }

      const isValid = cryptoService.verifySignature(currentHash, signature.signatureHash, signature.keyVersion);
      if (userId) await signature.addVerificationEvent(userId, ipAddress, isValid);
      if (userId) await auditService.logSignature(signature, 'verified', userId, ipAddress, isValid ? 'success' : 'failure');

      return {
        valid: isValid,
        signature,
        reportHash: currentHash,
        verifiedAt: new Date(),
        reason: isValid ? 'Signature is valid' : 'Signature verification failed'
      };
    } catch (err) {
      console.error('Error verifying signature:', err);
      throw err;
    }
  }

  async revokeSignature(signatureId, reason, userId, ipAddress = 'unknown') {
    try {
      const signature = await DigitalSignature.findById(signatureId);
      if (!signature) throw new Error('Signature not found');
      if (signature.status === 'revoked') throw new Error('Signature is already revoked');

      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      if (signature.signerId.toString() !== userId && user.role !== 'admin' && user.role !== 'superadmin') {
        throw new Error('Insufficient permissions to revoke signature');
      }

      await signature.revoke(reason, userId, ipAddress);

      const report = await Report.findOne({ reportId: signature.reportId });
      if (report) {
        if (signature.meaning === 'approver') report.status = 'preliminary';
        else if (signature.meaning === 'author') report.status = 'draft';
        await report.save();
      }

      await auditService.logSignature(signature, 'revoked', userId, ipAddress, 'success', reason);
      return signature;
    } catch (err) {
      console.error('Error revoking signature:', err);
      throw err;
    }
  }

  async getAuditTrail(reportId) {
    try {
      const signatures = await DigitalSignature.find({ reportId })
        .sort({ timestamp: -1 })
        .populate('signerId', 'name username email role');

      const auditTrail = [];
      for (const signature of signatures) {
        auditTrail.push({
          timestamp: signature.timestamp,
          action: 'signature_created',
          user: signature.signerName,
          userId: signature.signerId,
          meaning: signature.meaning,
          status: signature.status,
          details: `Report signed by ${signature.signerName} as ${signature.meaning}`
        });

        for (const event of signature.auditTrail) {
          auditTrail.push({
            timestamp: event.timestamp,
            action: event.action,
            user: event.userId,
            result: event.result,
            details: event.details,
            ipAddress: event.ipAddress
          });
        }
      }

      auditTrail.sort((a, b) => b.timestamp - a.timestamp);
      return auditTrail;
    } catch (err) {
      console.error('Error getting audit trail:', err);
      throw err;
    }
  }

  validateReportForSigning(report) {
    if (report.status === 'cancelled') throw new Error('Cannot sign a cancelled report');
    if (!report.findings && !report.findingsText) throw new Error('Report must have findings before signing');
    if (!report.impression) throw new Error('Report must have impression before signing');
  }

  serializeReport(report) {
    const reportData = {
      reportId: report.reportId,
      studyInstanceUID: report.studyInstanceUID,
      patientID: report.patientID,
      patientName: report.patientName,
      studyDate: report.studyDate,
      modality: report.modality,
      clinicalHistory: report.clinicalHistory || '',
      technique: report.technique || '',
      comparison: report.comparison || '',
      findings: report.findings || report.findingsText || '',
      impression: report.impression || '',
      recommendations: report.recommendations || '',
      structuredFindings: report.structuredFindings || [],
      measurements: report.measurements || [],
      createdAt: report.createdAt,
      version: report.version || 1
    };

    return JSON.stringify(reportData, Object.keys(reportData).sort());
  }
}

module.exports = new SignatureService();

