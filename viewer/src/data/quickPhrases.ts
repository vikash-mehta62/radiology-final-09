/**
 * Quick Phrases Library
 * Pre-defined common phrases organized by modality and section
 */

export interface QuickPhrasesLibrary {
  [modality: string]: {
    technique: string[];
    clinicalHistory: string[];
    findings: string[];
    impression: string[];
    recommendations: string[];
  };
}

export const quickPhrases: QuickPhrasesLibrary = {
  // ============================================================================
  // CT CHEST
  // ============================================================================
  'CT': {
    technique: [
      'CT chest with IV contrast',
      'CT chest without contrast',
      'High-resolution CT chest',
      'CT chest with and without IV contrast',
      'CT pulmonary angiography (CTPA)'
    ],
    clinicalHistory: [
      'Chest pain',
      'Shortness of breath',
      'Rule out pulmonary embolism',
      'Follow-up pulmonary nodule',
      'Chronic cough'
    ],
    findings: [
      'No acute pulmonary embolism',
      'Clear lungs bilaterally without focal consolidation',
      'No pleural effusion or pneumothorax',
      'Heart size is normal',
      'No mediastinal or hilar lymphadenopathy',
      'Small bilateral pleural effusions',
      'Mild emphysematous changes',
      'Ground-glass opacities in the right upper lobe',
      'Scattered pulmonary nodules, largest measuring [X] mm',
      'Mild cardiomegaly',
      'Trace pericardial effusion',
      'Atherosclerotic calcifications of the coronary arteries',
      'Mild bronchial wall thickening',
      'Subsegmental atelectasis in the left lower lobe'
    ],
    impression: [
      'No acute cardiopulmonary abnormality',
      'Negative for pulmonary embolism',
      'Findings consistent with COPD',
      'Findings suggestive of community-acquired pneumonia',
      'Small bilateral pleural effusions, likely related to CHF',
      'Pulmonary nodules as described, recommend follow-up',
      'Mild cardiomegaly without acute findings'
    ],
    recommendations: [
      'Clinical correlation recommended',
      'Follow-up CT in 3-6 months for pulmonary nodules',
      'Consider pulmonology consultation',
      'No further imaging needed at this time',
      'Recommend comparison with prior studies if available',
      'Follow-up chest X-ray in 4-6 weeks',
      'Consider echocardiogram for further cardiac evaluation'
    ]
  },

  // ============================================================================
  // MRI SPINE
  // ============================================================================
  'MR': {
    technique: [
      'MRI lumbar spine without contrast',
      'MRI cervical spine without contrast',
      'MRI thoracic spine without contrast',
      'MRI lumbar spine with and without contrast',
      'MRI whole spine without contrast'
    ],
    clinicalHistory: [
      'Low back pain',
      'Radiculopathy',
      'Neck pain',
      'Numbness and tingling',
      'Post-operative evaluation'
    ],
    findings: [
      'Normal vertebral body height and alignment',
      'No significant spinal canal stenosis',
      'Multilevel degenerative disc disease',
      'Disc herniation at L4-L5 with posterior displacement',
      'Mild central canal stenosis at L4-L5',
      'Facet arthropathy at L4-L5 and L5-S1',
      'Disc desiccation at multiple levels',
      'No abnormal marrow signal',
      'Conus medullaris terminates normally at L1-L2',
      'Mild bilateral neural foraminal narrowing at L5-S1',
      'Schmorl nodes at multiple levels',
      'Mild spondylolisthesis of L4 on L5',
      'No evidence of cord compression',
      'Ligamentum flavum hypertrophy at L4-L5'
    ],
    impression: [
      'Degenerative changes without significant stenosis',
      'Disc herniation at L4-L5 with mild central canal stenosis',
      'Multilevel degenerative disc disease with facet arthropathy',
      'Moderate spinal stenosis at L4-L5',
      'No acute findings',
      'Mild spondylolisthesis with associated degenerative changes'
    ],
    recommendations: [
      'Correlate with clinical symptoms and physical examination',
      'Consider neurosurgery consultation if symptomatic',
      'Conservative management appropriate',
      'Follow-up imaging if symptoms worsen',
      'Consider pain management consultation',
      'Physical therapy may be beneficial'
    ]
  },

  // ============================================================================
  // X-RAY CHEST
  // ============================================================================
  'CR': {
    technique: [
      'Frontal and lateral chest radiographs',
      'Portable AP chest radiograph',
      'PA and lateral chest radiographs',
      'Single frontal chest radiograph'
    ],
    clinicalHistory: [
      'Chest pain',
      'Shortness of breath',
      'Cough',
      'Fever',
      'Post-operative evaluation'
    ],
    findings: [
      'Clear lungs bilaterally',
      'No focal consolidation',
      'No pleural effusion or pneumothorax',
      'Heart size is normal',
      'No acute bony abnormality',
      'Mild cardiomegaly',
      'Small left pleural effusion',
      'Right lower lobe opacity consistent with pneumonia',
      'Mild pulmonary vascular congestion',
      'Blunting of the right costophrenic angle',
      'Hyperinflated lungs consistent with COPD',
      'Calcified granulomas in both lungs'
    ],
    impression: [
      'No acute cardiopulmonary abnormality',
      'Findings consistent with pneumonia',
      'Small pleural effusion',
      'Mild cardiomegaly',
      'Findings consistent with CHF',
      'Findings consistent with COPD'
    ],
    recommendations: [
      'Clinical correlation recommended',
      'Follow-up chest X-ray in 4-6 weeks',
      'Consider CT chest for further evaluation',
      'No further imaging needed at this time'
    ]
  },

  // ============================================================================
  // CT ABDOMEN/PELVIS
  // ============================================================================
  'CT_ABDOMEN': {
    technique: [
      'CT abdomen and pelvis with IV contrast',
      'CT abdomen and pelvis without contrast',
      'CT abdomen and pelvis with oral and IV contrast',
      'CT abdomen and pelvis with and without IV contrast'
    ],
    clinicalHistory: [
      'Abdominal pain',
      'Rule out appendicitis',
      'Nausea and vomiting',
      'Follow-up known mass',
      'Trauma'
    ],
    findings: [
      'Liver, spleen, pancreas, and adrenal glands are unremarkable',
      'Kidneys enhance symmetrically without hydronephrosis',
      'No free fluid or free air',
      'Appendix is normal in caliber',
      'No bowel obstruction or wall thickening',
      'No lymphadenopathy',
      'Gallbladder is unremarkable without stones',
      'Small amount of free fluid in the pelvis',
      'Mild hepatic steatosis',
      'Simple renal cysts bilaterally',
      'Diverticulosis without diverticulitis',
      'Cholelithiasis without cholecystitis',
      'Small hiatal hernia'
    ],
    impression: [
      'No acute intra-abdominal abnormality',
      'Negative for appendicitis',
      'Findings consistent with diverticulosis',
      'Cholelithiasis without acute cholecystitis',
      'Simple renal cysts',
      'Mild hepatic steatosis'
    ],
    recommendations: [
      'Clinical correlation recommended',
      'No further imaging needed at this time',
      'Consider ultrasound for further evaluation',
      'Follow-up CT in 3-6 months',
      'Recommend surgical consultation'
    ]
  },

  // ============================================================================
  // MRI BRAIN
  // ============================================================================
  'MR_BRAIN': {
    technique: [
      'MRI brain without contrast',
      'MRI brain with and without contrast',
      'MRI brain with contrast',
      'MRI brain with diffusion-weighted imaging'
    ],
    clinicalHistory: [
      'Headache',
      'Seizure',
      'Stroke evaluation',
      'Altered mental status',
      'Follow-up known lesion'
    ],
    findings: [
      'No acute intracranial abnormality',
      'No evidence of acute infarct on DWI',
      'No intracranial hemorrhage or mass effect',
      'Ventricles and sulci are normal in size',
      'No abnormal enhancement',
      'Mild chronic small vessel ischemic changes',
      'Age-appropriate volume loss',
      'Normal flow voids in major intracranial vessels',
      'Paranasal sinuses are clear',
      'Mastoid air cells are clear',
      'Small focus of T2/FLAIR hyperintensity in the white matter',
      'Pineal cyst measuring [X] mm'
    ],
    impression: [
      'No acute intracranial abnormality',
      'Negative for acute infarct',
      'Mild chronic small vessel ischemic disease',
      'Age-appropriate findings',
      'Nonspecific white matter changes',
      'Incidental pineal cyst'
    ],
    recommendations: [
      'Clinical correlation recommended',
      'No further imaging needed at this time',
      'Consider neurology consultation',
      'Follow-up MRI in 6-12 months',
      'Recommend vascular imaging if clinically indicated'
    ]
  },

  // ============================================================================
  // ULTRASOUND ABDOMEN
  // ============================================================================
  'US': {
    technique: [
      'Ultrasound of the abdomen',
      'Ultrasound of the right upper quadrant',
      'Ultrasound of the kidneys',
      'Ultrasound of the pelvis',
      'Doppler ultrasound of the liver'
    ],
    clinicalHistory: [
      'Right upper quadrant pain',
      'Elevated liver enzymes',
      'Hematuria',
      'Pelvic pain',
      'Follow-up known finding'
    ],
    findings: [
      'Liver is normal in size and echogenicity',
      'No focal hepatic lesion',
      'Gallbladder is unremarkable without stones or wall thickening',
      'Common bile duct measures [X] mm (normal)',
      'Pancreas is partially visualized and unremarkable',
      'Spleen is normal in size',
      'Kidneys are normal in size without hydronephrosis',
      'No renal stones',
      'Bladder is unremarkable',
      'No free fluid',
      'Cholelithiasis without sonographic Murphy sign',
      'Simple renal cyst in the right kidney',
      'Mild hepatic steatosis',
      'Small amount of ascites'
    ],
    impression: [
      'Normal abdominal ultrasound',
      'Cholelithiasis without acute cholecystitis',
      'Simple renal cyst',
      'Mild hepatic steatosis',
      'No hydronephrosis or renal stones',
      'Small amount of ascites'
    ],
    recommendations: [
      'Clinical correlation recommended',
      'No further imaging needed at this time',
      'Consider CT for further evaluation',
      'Follow-up ultrasound in 6-12 months',
      'Recommend HIDA scan if clinically indicated'
    ]
  }
};

// Helper function to get phrases for a specific modality and section
export const getQuickPhrases = (
  modality: string,
  section: 'technique' | 'clinicalHistory' | 'findings' | 'impression' | 'recommendations'
): string[] => {
  // Normalize modality
  const normalizedModality = modality.toUpperCase();
  
  // Try exact match first
  if (quickPhrases[normalizedModality]) {
    return quickPhrases[normalizedModality][section] || [];
  }
  
  // Try partial match
  const matchingKey = Object.keys(quickPhrases).find(key => 
    normalizedModality.includes(key) || key.includes(normalizedModality)
  );
  
  if (matchingKey) {
    return quickPhrases[matchingKey][section] || [];
  }
  
  // Default to CT if no match
  return quickPhrases['CT']?.[section] || [];
};
