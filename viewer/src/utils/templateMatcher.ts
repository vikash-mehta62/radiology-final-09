/**
 * Smart Template Matcher
 * Automatically selects the best report template based on AI analysis and study metadata
 */

import { REPORT_TEMPLATES, type ReportTemplate } from '../data/reportTemplates';

export interface TemplateMatchResult {
  template: ReportTemplate;
  confidence: number;
  reason: string;
}

/**
 * Match template based on modality and AI-detected body part/organ
 */
export function matchTemplate(
  modality: string,
  aiAnalysis?: any,
  studyDescription?: string
): TemplateMatchResult | null {
  
  // Extract body part from AI analysis or study description
  const bodyPart = detectBodyPart(aiAnalysis, studyDescription);
  
  console.log('🔍 Template Matching:', { modality, bodyPart, studyDescription });
  
  // Priority 1: Exact match (modality + body part)
  const exactMatch = findExactMatch(modality, bodyPart);
  if (exactMatch) {
    return {
      template: exactMatch,
      confidence: 0.95,
      reason: `Detected ${bodyPart} ${modality} study`
    };
  }
  
  // Priority 2: Modality match with body part inference
  const modalityMatch = findModalityMatch(modality, bodyPart);
  if (modalityMatch) {
    return {
      template: modalityMatch,
      confidence: 0.80,
      reason: `Matched ${modality} modality with ${bodyPart || 'general'} imaging`
    };
  }
  
  // Priority 3: Generic template for modality
  const genericMatch = findGenericModalityMatch(modality);
  if (genericMatch) {
    return {
      template: genericMatch,
      confidence: 0.60,
      reason: `Generic ${modality} template`
    };
  }
  
  return null;
}

/**
 * Detect body part from AI analysis results
 */
function detectBodyPart(aiAnalysis?: any, studyDescription?: string): string | null {
  const text = (
    (aiAnalysis?.results?.findings || '') + ' ' +
    (aiAnalysis?.results?.classification || '') + ' ' +
    (studyDescription || '')
  ).toLowerCase();
  
  // Brain/Head detection
  if (text.match(/brain|head|skull|cerebral|intracranial|neuro/i)) {
    return 'brain';
  }
  
  // Chest detection
  if (text.match(/chest|lung|pulmonary|thorax|cardiac|heart/i)) {
    return 'chest';
  }
  
  // Abdomen detection
  if (text.match(/abdomen|abdominal|liver|kidney|spleen|pancreas|bowel/i)) {
    return 'abdomen';
  }
  
  // Spine detection
  if (text.match(/spine|spinal|vertebra|cervical|thoracic|lumbar|sacral/i)) {
    return 'spine';
  }
  
  // Breast detection
  if (text.match(/breast|mammary|mammography/i)) {
    return 'breast';
  }
  
  // Bone/Musculoskeletal detection
  if (text.match(/bone|fracture|joint|extremity|limb|musculoskeletal/i)) {
    return 'bone';
  }
  
  // Cardiac detection
  if (text.match(/cardiac|coronary|angiography|angiogram|heart|echo/i)) {
    return 'cardiac';
  }
  
  return null;
}

/**
 * Find exact match based on modality and body part
 */
function findExactMatch(modality: string, bodyPart: string | null): ReportTemplate | null {
  if (!bodyPart) return null;
  
  const matches: Record<string, string[]> = {
    'brain': ['ct-head', 'mri-brain'],
    'chest': ['chest-xray', 'ct-chest'],
    'abdomen': ['ct-abdomen', 'us-abdomen'],
    'spine': ['mri-spine'],
    'breast': ['mammography'],
    'bone': ['bone-xray'],
    'cardiac': ['cardiac-angio', 'echo']
  };
  
  const templateIds = matches[bodyPart] || [];
  
  for (const id of templateIds) {
    const template = REPORT_TEMPLATES.find(t => t.id === id);
    if (template && template.modality.includes(modality.toUpperCase())) {
      return template;
    }
  }
  
  return null;
}

/**
 * Find match based on modality with body part consideration
 */
function findModalityMatch(modality: string, bodyPart: string | null): ReportTemplate | null {
  const modalityUpper = modality.toUpperCase();
  
  // Filter templates by modality
  const modalityTemplates = REPORT_TEMPLATES.filter(t => 
    t.modality.includes(modalityUpper)
  );
  
  if (modalityTemplates.length === 0) return null;
  
  // If we have body part, try to match category
  if (bodyPart) {
    const categoryMatch = modalityTemplates.find(t => 
      t.category.toLowerCase().includes(bodyPart) ||
      t.name.toLowerCase().includes(bodyPart)
    );
    if (categoryMatch) return categoryMatch;
  }
  
  // Return first modality match
  return modalityTemplates[0];
}

/**
 * Find generic template for modality
 */
function findGenericModalityMatch(modality: string): ReportTemplate | null {
  const modalityUpper = modality.toUpperCase();
  
  // Generic mappings
  const genericMap: Record<string, string> = {
    'CT': 'ct-head',
    'MR': 'mri-brain',
    'CR': 'chest-xray',
    'DX': 'chest-xray',
    'US': 'us-abdomen',
    'MG': 'mammography',
    'XA': 'cardiac-angio',
    'RF': 'cardiac-angio'
  };
  
  const templateId = genericMap[modalityUpper];
  return REPORT_TEMPLATES.find(t => t.id === templateId) || null;
}

/**
 * Get all possible templates for a modality
 */
export function getTemplatesForModality(modality: string): ReportTemplate[] {
  const modalityUpper = modality.toUpperCase();
  return REPORT_TEMPLATES.filter(t => t.modality.includes(modalityUpper));
}

/**
 * Get template by ID
 */
export function getTemplateById(templateId: string): ReportTemplate | null {
  return REPORT_TEMPLATES.find(t => t.id === templateId) || null;
}
