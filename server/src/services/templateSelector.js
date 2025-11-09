/**
 * Smart Template Selector Service
 * Automatically selects the best report template based on study characteristics
 */

const ReportTemplate = require('../models/ReportTemplate');

class TemplateSelector {
  /**
   * Select the best matching template for a study
   * @param {Object} study - Study information
   * @returns {Promise<Object>} Selected template with match score
   */
  async selectTemplate(study) {
    const {
      modality,
      bodyPart,
      studyDescription,
      procedureType,
      seriesDescription
    } = study;

    console.log('🔍 Selecting template for study:', {
      modality,
      bodyPart,
      studyDescription
    });

    // Get all active templates
    const templates = await ReportTemplate.findActive();

    if (templates.length === 0) {
      console.warn('⚠️  No active templates found, using default');
      return {
        template: null,
        matchScore: 0,
        matchDetails: {
          reason: 'No active templates available'
        }
      };
    }

    // Calculate match scores for all templates
    const scoredTemplates = templates.map(template => {
      const score = this.calculateMatchScore(study, template);
      return {
        template,
        matchScore: score.total,
        matchDetails: score.details
      };
    });

    // Sort by score (highest first)
    scoredTemplates.sort((a, b) => b.matchScore - a.matchScore);

    const bestMatch = scoredTemplates[0];

    console.log(`✅ Selected template: ${bestMatch.template.name}`);
    console.log(`   Match score: ${bestMatch.matchScore}`);
    console.log(`   Match details:`, bestMatch.matchDetails);

    // Increment usage counter
    if (bestMatch.template) {
      await bestMatch.template.incrementUsage();
    }

    return bestMatch;
  }

  /**
   * Calculate match score between study and template
   * @param {Object} study - Study information
   * @param {Object} template - Template to match against
   * @returns {Object} Score breakdown
   */
  calculateMatchScore(study, template) {
    const details = {
      modalityMatch: 0,
      bodyPartMatch: 0,
      keywordMatch: 0,
      procedureTypeMatch: 0,
      matchedKeywords: [],
      matchedBodyParts: []
    };

    const weights = template.matchingWeights;

    // 1. Modality matching (highest weight)
    if (study.modality && template.matchingCriteria.modalities) {
      const modalityMatch = template.matchingCriteria.modalities.some(m => 
        m.toUpperCase() === study.modality.toUpperCase()
      );
      if (modalityMatch) {
        details.modalityMatch = weights.modalityWeight;
      }
    }

    // 2. Body part matching
    if (study.bodyPart && template.matchingCriteria.bodyParts) {
      const bodyPartUpper = study.bodyPart.toUpperCase();
      template.matchingCriteria.bodyParts.forEach(bp => {
        if (bodyPartUpper.includes(bp.toUpperCase()) || 
            bp.toUpperCase().includes(bodyPartUpper)) {
          details.bodyPartMatch += weights.bodyPartWeight;
          details.matchedBodyParts.push(bp);
        }
      });
    }

    // 3. Keyword matching in study description
    if (template.matchingCriteria.keywords) {
      const searchText = [
        study.studyDescription,
        study.seriesDescription,
        study.procedureDescription
      ].filter(Boolean).join(' ').toLowerCase();

      template.matchingCriteria.keywords.forEach(keyword => {
        if (searchText.includes(keyword.toLowerCase())) {
          details.keywordMatch += weights.keywordWeight;
          details.matchedKeywords.push(keyword);
        }
      });
    }

    // 4. Procedure type matching
    if (study.procedureType && template.matchingCriteria.procedureTypes) {
      const procedureMatch = template.matchingCriteria.procedureTypes.some(pt =>
        pt.toLowerCase() === study.procedureType.toLowerCase()
      );
      if (procedureMatch) {
        details.procedureTypeMatch = weights.procedureTypeWeight;
      }
    }

    // Calculate total score
    const total = 
      details.modalityMatch +
      details.bodyPartMatch +
      details.keywordMatch +
      details.procedureTypeMatch;

    return {
      total,
      details
    };
  }

  /**
   * Get template suggestions for a study (top 3)
   * @param {Object} study - Study information
   * @returns {Promise<Array>} Top 3 template suggestions
   */
  async getSuggestions(study) {
    const templates = await ReportTemplate.findActive();

    const scoredTemplates = templates.map(template => {
      const score = this.calculateMatchScore(study, template);
      return {
        templateId: template.templateId,
        name: template.name,
        description: template.description,
        category: template.category,
        matchScore: score.total,
        matchDetails: score.details
      };
    });

    // Return top 3
    return scoredTemplates
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 3);
  }

  /**
   * Apply template to report data
   * @param {Object} template - Selected template
   * @param {Object} reportData - Report data to populate
   * @returns {Object} Report data with template applied
   */
  applyTemplate(template, reportData) {
    if (!template) {
      return reportData;
    }

    // Add template sections
    reportData.templateId = template.templateId;
    reportData.templateName = template.name;
    reportData.templateSections = template.sections;

    // Pre-fill fields if available
    if (template.fields) {
      reportData.templateFields = Object.fromEntries(template.fields);
    }

    // Add field options for dropdowns
    if (template.fieldOptions) {
      reportData.fieldOptions = Object.fromEntries(template.fieldOptions);
    }

    // Add AI integration settings
    if (template.aiIntegration && template.aiIntegration.enabled) {
      reportData.aiAutoFillFields = template.aiIntegration.autoFillFields;
      reportData.aiSuggestedFindings = template.aiIntegration.suggestedFindings;
    }

    return reportData;
  }

  /**
   * Learn from user corrections (future ML enhancement)
   * @param {String} templateId - Template that was used
   * @param {Object} study - Study information
   * @param {Boolean} wasCorrect - Whether template was appropriate
   */
  async learnFromUsage(templateId, study, wasCorrect) {
    // This is a placeholder for future ML-based learning
    // Could track which templates work best for which studies
    console.log(`📚 Learning: Template ${templateId} was ${wasCorrect ? 'correct' : 'incorrect'} for study`);
    
    // Future: Store learning data for ML model training
    // Future: Adjust matching weights based on feedback
  }

  /**
   * Get template by ID
   * @param {String} templateId - Template ID
   * @returns {Promise<Object>} Template
   */
  async getTemplateById(templateId) {
    return await ReportTemplate.findOne({ templateId, active: true });
  }

  /**
   * Get templates by category
   * @param {String} category - Template category
   * @returns {Promise<Array>} Templates
   */
  async getTemplatesByCategory(category) {
    return await ReportTemplate.findByCategory(category);
  }

  /**
   * Search templates
   * @param {String} query - Search query
   * @returns {Promise<Array>} Matching templates
   */
  async searchTemplates(query) {
    const searchRegex = new RegExp(query, 'i');
    
    return await ReportTemplate.find({
      active: true,
      $or: [
        { name: searchRegex },
        { description: searchRegex },
        { 'matchingCriteria.keywords': searchRegex }
      ]
    }).sort({ priority: -1, 'usageStats.timesUsed': -1 });
  }
}

module.exports = new TemplateSelector();
