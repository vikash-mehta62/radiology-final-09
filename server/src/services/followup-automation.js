const FollowUp = require('../models/FollowUp');
const StructuredReport = require('../models/StructuredReport');
const Study = require('../models/Study');

class FollowUpAutomationService {
  constructor() {
    // Clinical rules for automatic follow-up generation
    this.rules = [
      {
        id: 'nodule_detection',
        condition: (report) => this.hasKeyword(report, ['nodule', 'mass', 'lesion']),
        priority: 4,
        type: 'recommended',
        daysUntilFollowUp: 90,
        reason: 'Follow-up imaging recommended for nodule/lesion monitoring',
        confidence: 0.85
      },
      {
        id: 'fracture_healing',
        condition: (report) => this.hasKeyword(report, ['fracture', 'broken']),
        priority: 3,
        type: 'routine',
        daysUntilFollowUp: 42,
        reason: 'Follow-up to assess fracture healing',
        confidence: 0.9
      },
      {
        id: 'infection_monitoring',
        condition: (report) => this.hasKeyword(report, ['infection', 'abscess', 'pneumonia']),
        priority: 4,
        type: 'urgent',
        daysUntilFollowUp: 14,
        reason: 'Follow-up to monitor infection resolution',
        confidence: 0.88
      },
      {
        id: 'tumor_surveillance',
        condition: (report) => this.hasKeyword(report, ['tumor', 'neoplasm', 'cancer', 'malignancy']),
        priority: 5,
        type: 'critical',
        daysUntilFollowUp: 60,
        reason: 'Critical follow-up for tumor surveillance',
        confidence: 0.92
      },
      {
        id: 'post_surgical',
        condition: (report) => this.hasKeyword(report, ['post-operative', 'post-surgical', 'surgery']),
        priority: 3,
        type: 'routine',
        daysUntilFollowUp: 30,
        reason: 'Post-surgical follow-up imaging',
        confidence: 0.87
      },
      {
        id: 'aneurysm_monitoring',
        condition: (report) => this.hasKeyword(report, ['aneurysm']),
        priority: 5,
        type: 'critical',
        daysUntilFollowUp: 90,
        reason: 'Critical follow-up for aneurysm monitoring',
        confidence: 0.95
      },
      {
        id: 'pulmonary_embolism',
        condition: (report) => this.hasKeyword(report, ['pulmonary embolism', 'PE', 'blood clot']),
        priority: 4,
        type: 'urgent',
        daysUntilFollowUp: 21,
        reason: 'Follow-up for pulmonary embolism resolution',
        confidence: 0.9
      },
      {
        id: 'cardiac_abnormality',
        condition: (report) => this.hasKeyword(report, ['cardiomegaly', 'heart failure', 'cardiac']),
        priority: 4,
        type: 'recommended',
        daysUntilFollowUp: 60,
        reason: 'Follow-up for cardiac condition monitoring',
        confidence: 0.83
      }
    ];
  }

  /**
   * Check if report contains specific keywords
   */
  hasKeyword(report, keywords) {
    const text = `${report.findings || ''} ${report.impression || ''} ${report.conclusion || ''}`.toLowerCase();
    return keywords.some(keyword => text.includes(keyword.toLowerCase()));
  }

  /**
   * Analyze report and generate follow-up recommendations
   */
  async analyzeReport(reportId, userId) {
    try {
      const report = await StructuredReport.findById(reportId).populate('studyId');
      if (!report) {
        throw new Error('Report not found');
      }

      const recommendations = [];
      
      // Apply all rules
      for (const rule of this.rules) {
        if (rule.condition(report)) {
          const recommendation = {
            ruleId: rule.id,
            priority: rule.priority,
            type: rule.type,
            recommendedDate: this.calculateFollowUpDate(rule.daysUntilFollowUp),
            reason: rule.reason,
            confidence: rule.confidence,
            triggerFindings: this.extractTriggerFindings(report, rule)
          };
          recommendations.push(recommendation);
        }
      }

      // Sort by priority (highest first)
      recommendations.sort((a, b) => b.priority - a.priority);

      return recommendations;
    } catch (error) {
      console.error('Error analyzing report:', error);
      throw error;
    }
  }

  /**
   * Automatically create follow-up from report analysis
   */
  async createAutomaticFollowUp(reportId, userId) {
    try {
      const report = await StructuredReport.findById(reportId).populate('studyId');
      if (!report) {
        throw new Error('Report not found');
      }

      const recommendations = await this.analyzeReport(reportId, userId);
      
      if (recommendations.length === 0) {
        return null;
      }

      // Use the highest priority recommendation
      const topRecommendation = recommendations[0];

      const followUp = new FollowUp({
        patientId: report.patientId,
        studyId: report.studyId,
        reportId: report._id,
        type: topRecommendation.type,
        priority: topRecommendation.priority,
        recommendedDate: topRecommendation.recommendedDate,
        reason: topRecommendation.reason,
        findings: topRecommendation.triggerFindings,
        recommendations: recommendations.map(r => r.reason),
        modality: report.studyId?.modality,
        bodyPart: report.studyId?.bodyPart,
        autoGenerated: true,
        aiConfidence: topRecommendation.confidence,
        triggerFindings: topRecommendation.triggerFindings,
        createdBy: userId,
        metadata: {
          originalStudyDate: report.studyId?.studyDate,
          hospitalId: report.hospitalId,
          departmentId: report.departmentId
        }
      });

      await followUp.save();
      return followUp;
    } catch (error) {
      console.error('Error creating automatic follow-up:', error);
      throw error;
    }
  }

  /**
   * Calculate follow-up date based on days
   */
  calculateFollowUpDate(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }

  /**
   * Extract trigger findings from report
   */
  extractTriggerFindings(report, rule) {
    const findings = [];
    const text = `${report.findings || ''} ${report.impression || ''}`;
    
    // Simple extraction - in production, use NLP
    const sentences = text.split(/[.!?]+/);
    for (const sentence of sentences) {
      if (rule.condition({ findings: sentence })) {
        findings.push(sentence.trim());
      }
    }
    
    return findings.slice(0, 3); // Limit to 3 findings
  }

  /**
   * Check for overdue follow-ups and send notifications
   */
  async checkOverdueFollowUps() {
    try {
      const overdueFollowUps = await FollowUp.findOverdue();
      
      for (const followUp of overdueFollowUps) {
        // Update status
        if (followUp.status !== 'overdue') {
          followUp.status = 'overdue';
          await followUp.save();
        }
        
        // Send notification (implement notification service)
        await this.sendOverdueNotification(followUp);
      }

      return overdueFollowUps;
    } catch (error) {
      console.error('Error checking overdue follow-ups:', error);
      throw error;
    }
  }

  /**
   * Send upcoming follow-up reminders
   */
  async sendUpcomingReminders(days = 7) {
    try {
      const upcomingFollowUps = await FollowUp.findUpcoming(days);
      
      for (const followUp of upcomingFollowUps) {
        await this.sendReminderNotification(followUp);
      }

      return upcomingFollowUps;
    } catch (error) {
      console.error('Error sending reminders:', error);
      throw error;
    }
  }

  /**
   * Send overdue notification
   */
  async sendOverdueNotification(followUp) {
    // Implement notification logic (email, SMS, etc.)
    console.log(`Overdue notification for follow-up ${followUp._id}`);
    
    followUp.notifications.push({
      type: 'system',
      sentAt: new Date(),
      status: 'sent'
    });
    
    await followUp.save();
  }

  /**
   * Send reminder notification
   */
  async sendReminderNotification(followUp) {
    // Implement notification logic
    console.log(`Reminder notification for follow-up ${followUp._id}`);
    
    followUp.notifications.push({
      type: 'system',
      sentAt: new Date(),
      status: 'sent'
    });
    
    await followUp.save();
  }

  /**
   * Get follow-up statistics
   */
  async getStatistics(hospitalId = null) {
    try {
      const query = hospitalId ? { 'metadata.hospitalId': hospitalId } : {};
      
      const [total, pending, scheduled, completed, overdue] = await Promise.all([
        FollowUp.countDocuments(query),
        FollowUp.countDocuments({ ...query, status: 'pending' }),
        FollowUp.countDocuments({ ...query, status: 'scheduled' }),
        FollowUp.countDocuments({ ...query, status: 'completed' }),
        FollowUp.countDocuments({ 
          ...query, 
          status: { $in: ['pending', 'scheduled'] },
          recommendedDate: { $lt: new Date() }
        })
      ]);

      return {
        total,
        pending,
        scheduled,
        completed,
        overdue,
        completionRate: total > 0 ? (completed / total * 100).toFixed(2) : 0
      };
    } catch (error) {
      console.error('Error getting statistics:', error);
      throw error;
    }
  }
}

module.exports = new FollowUpAutomationService();
