/**
 * Pre-defined Report Templates for Different Medical Specialties
 */

export interface ReportTemplate {
  id: string
  name: string
  category: string
  modality: string[]
  sections: ReportSection[]
  findings: FindingTemplate[]
  icon?: string
}

export interface ReportSection {
  id: string
  title: string
  placeholder: string
  required: boolean
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'checkbox'
  options?: string[]
  defaultValue?: string
}

export interface FindingTemplate {
  id: string
  label: string
  category: string
  severity: 'normal' | 'mild' | 'moderate' | 'severe'
  description: string
}

export const REPORT_TEMPLATES: ReportTemplate[] = [
  // 1. Chest X-Ray
  {
    id: 'chest-xray',
    name: 'Chest X-Ray Report',
    category: 'Radiology',
    modality: ['CR', 'DX'],
    icon: '🫁',
    sections: [
      { id: 'indication', title: 'Clinical Indication', placeholder: 'Enter reason...', required: true, type: 'textarea' },
      { id: 'technique', title: 'Technique', placeholder: 'PA and lateral views', required: true, type: 'text', defaultValue: 'PA and lateral chest radiographs' },
      { id: 'findings', title: 'Findings', placeholder: 'Describe findings...', required: true, type: 'textarea' },
      { id: 'impression', title: 'Impression', placeholder: 'Summary...', required: true, type: 'textarea' }
    ],
    findings: [
      { id: 'normal-lungs', label: 'Clear lungs', category: 'Lungs', severity: 'normal', description: 'Lungs are clear' },
      { id: 'cardiomegaly', label: 'Cardiomegaly', category: 'Heart', severity: 'moderate', description: 'Enlarged cardiac silhouette' }
    ]
  },

  // 2. CT Head
  {
    id: 'ct-head',
    name: 'CT Head Report',
    category: 'Neuroradiology',
    modality: ['CT'],
    icon: '🧠',
    sections: [
      { id: 'indication', title: 'Clinical Indication', placeholder: 'Enter history...', required: true, type: 'textarea' },
      { id: 'technique', title: 'Technique', placeholder: 'Non-contrast CT', required: true, type: 'text' },
      { id: 'findings', title: 'Findings', placeholder: 'Brain findings...', required: true, type: 'textarea' },
      { id: 'impression', title: 'Impression', placeholder: 'Summary...', required: true, type: 'textarea' }
    ],
    findings: [
      { id: 'normal-brain', label: 'Normal brain', category: 'Brain', severity: 'normal', description: 'No acute abnormality' },
      { id: 'hemorrhage', label: 'Hemorrhage', category: 'Brain', severity: 'severe', description: 'Acute hemorrhage' }
    ]
  },

  // 3. Cardiac Angiography
  {
    id: 'cardiac-angio',
    name: 'Cardiac Angiography',
    category: 'Cardiology',
    modality: ['XA', 'RF'],
    icon: '❤️',
    sections: [
      { id: 'indication', title: 'Indication', placeholder: 'Chest pain...', required: true, type: 'textarea' },
      { id: 'procedure', title: 'Procedure', placeholder: 'Describe...', required: true, type: 'textarea' },
      { id: 'findings', title: 'Findings', placeholder: 'Coronary findings...', required: true, type: 'textarea' },
      { id: 'conclusion', title: 'Conclusion', placeholder: 'Summary...', required: true, type: 'textarea' }
    ],
    findings: [
      { id: 'normal-coronaries', label: 'Normal coronaries', category: 'Vessels', severity: 'normal', description: 'No CAD' },
      { id: 'stenosis', label: 'Stenosis', category: 'Vessels', severity: 'severe', description: 'Significant stenosis' }
    ]
  },

  // 4. Abdominal CT
  {
    id: 'ct-abdomen',
    name: 'CT Abdomen & Pelvis',
    category: 'Body Imaging',
    modality: ['CT'],
    icon: '🫃',
    sections: [
      { id: 'indication', title: 'Indication', placeholder: 'Abdominal pain...', required: true, type: 'textarea' },
      { id: 'technique', title: 'Technique', placeholder: 'CT protocol...', required: true, type: 'text' },
      { id: 'findings', title: 'Findings', placeholder: 'Organ findings...', required: true, type: 'textarea' },
      { id: 'impression', title: 'Impression', placeholder: 'Summary...', required: true, type: 'textarea' }
    ],
    findings: [
      { id: 'normal-abdomen', label: 'Normal abdomen', category: 'Abdomen', severity: 'normal', description: 'No acute abnormality' },
      { id: 'appendicitis', label: 'Appendicitis', category: 'Appendix', severity: 'severe', description: 'Acute appendicitis' }
    ]
  },

  // 5. MRI Brain
  {
    id: 'mri-brain',
    name: 'MRI Brain Report',
    category: 'Neuroradiology',
    modality: ['MR'],
    icon: '🧠',
    sections: [
      { id: 'indication', title: 'Indication', placeholder: 'Clinical history...', required: true, type: 'textarea' },
      { id: 'technique', title: 'Technique', placeholder: 'MRI sequences...', required: true, type: 'text' },
      { id: 'findings', title: 'Findings', placeholder: 'MRI findings...', required: true, type: 'textarea' },
      { id: 'impression', title: 'Impression', placeholder: 'Summary...', required: true, type: 'textarea' }
    ],
    findings: [
      { id: 'normal-mri', label: 'Normal MRI', category: 'Brain', severity: 'normal', description: 'Normal brain MRI' },
      { id: 'tumor', label: 'Mass lesion', category: 'Brain', severity: 'severe', description: 'Intracranial mass' }
    ]
  },

  // 6. Mammography
  {
    id: 'mammography',
    name: 'Mammography Report',
    category: 'Breast Imaging',
    modality: ['MG'],
    icon: '🎗️',
    sections: [
      { id: 'indication', title: 'Indication', placeholder: 'Screening/Diagnostic...', required: true, type: 'select', options: ['Screening', 'Diagnostic', 'Follow-up'] },
      { id: 'technique', title: 'Technique', placeholder: 'Views obtained...', required: true, type: 'text' },
      { id: 'findings', title: 'Findings', placeholder: 'Breast findings...', required: true, type: 'textarea' },
      { id: 'birads', title: 'BI-RADS', placeholder: 'Category...', required: true, type: 'select', options: ['0', '1', '2', '3', '4', '5', '6'] },
      { id: 'impression', title: 'Impression', placeholder: 'Summary...', required: true, type: 'textarea' }
    ],
    findings: [
      { id: 'normal-mammo', label: 'Normal', category: 'Breast', severity: 'normal', description: 'No suspicious findings' },
      { id: 'mass', label: 'Mass', category: 'Breast', severity: 'moderate', description: 'Suspicious mass' }
    ]
  },

  // 7. Ultrasound Abdomen
  {
    id: 'us-abdomen',
    name: 'Abdominal Ultrasound',
    category: 'Ultrasound',
    modality: ['US'],
    icon: '📡',
    sections: [
      { id: 'indication', title: 'Indication', placeholder: 'Clinical indication...', required: true, type: 'textarea' },
      { id: 'technique', title: 'Technique', placeholder: 'US technique...', required: true, type: 'text' },
      { id: 'findings', title: 'Findings', placeholder: 'Organ findings...', required: true, type: 'textarea' },
      { id: 'impression', title: 'Impression', placeholder: 'Summary...', required: true, type: 'textarea' }
    ],
    findings: [
      { id: 'normal-us', label: 'Normal ultrasound', category: 'Abdomen', severity: 'normal', description: 'Normal findings' },
      { id: 'gallstones', label: 'Gallstones', category: 'Gallbladder', severity: 'mild', description: 'Cholelithiasis' }
    ]
  },

  // 8. Spine MRI
  {
    id: 'mri-spine',
    name: 'MRI Spine Report',
    category: 'Musculoskeletal',
    modality: ['MR'],
    icon: '🦴',
    sections: [
      { id: 'indication', title: 'Indication', placeholder: 'Back pain...', required: true, type: 'textarea' },
      { id: 'technique', title: 'Technique', placeholder: 'MRI sequences...', required: true, type: 'text' },
      { id: 'findings', title: 'Findings', placeholder: 'Spine findings...', required: true, type: 'textarea' },
      { id: 'impression', title: 'Impression', placeholder: 'Summary...', required: true, type: 'textarea' }
    ],
    findings: [
      { id: 'normal-spine', label: 'Normal spine', category: 'Spine', severity: 'normal', description: 'No abnormality' },
      { id: 'disc-herniation', label: 'Disc herniation', category: 'Spine', severity: 'moderate', description: 'Herniated disc' }
    ]
  },

  // 9. Echocardiography
  {
    id: 'echo',
    name: 'Echocardiography Report',
    category: 'Cardiology',
    modality: ['US'],
    icon: '💓',
    sections: [
      { id: 'indication', title: 'Indication', placeholder: 'Clinical indication...', required: true, type: 'textarea' },
      { id: 'technique', title: 'Technique', placeholder: 'Echo technique...', required: true, type: 'text' },
      { id: 'findings', title: 'Findings', placeholder: 'Cardiac findings...', required: true, type: 'textarea' },
      { id: 'ef', title: 'Ejection Fraction', placeholder: 'EF %...', required: true, type: 'text' },
      { id: 'impression', title: 'Impression', placeholder: 'Summary...', required: true, type: 'textarea' }
    ],
    findings: [
      { id: 'normal-echo', label: 'Normal echo', category: 'Heart', severity: 'normal', description: 'Normal cardiac function' },
      { id: 'reduced-ef', label: 'Reduced EF', category: 'Heart', severity: 'severe', description: 'Reduced ejection fraction' }
    ]
  },

  // 10. Bone X-Ray
  {
    id: 'bone-xray',
    name: 'Bone X-Ray Report',
    category: 'Musculoskeletal',
    modality: ['CR', 'DX'],
    icon: '🦴',
    sections: [
      { id: 'indication', title: 'Indication', placeholder: 'Trauma, pain...', required: true, type: 'textarea' },
      { id: 'technique', title: 'Technique', placeholder: 'Views obtained...', required: true, type: 'text' },
      { id: 'findings', title: 'Findings', placeholder: 'Bone findings...', required: true, type: 'textarea' },
      { id: 'impression', title: 'Impression', placeholder: 'Summary...', required: true, type: 'textarea' }
    ],
    findings: [
      { id: 'normal-bone', label: 'Normal bones', category: 'Bone', severity: 'normal', description: 'No fracture' },
      { id: 'fracture', label: 'Fracture', category: 'Bone', severity: 'severe', description: 'Acute fracture identified' }
    ]
  }
]

// Custom template storage
export interface CustomTemplate extends ReportTemplate {
  createdBy: string
  createdAt: string
  isCustom: true
}

export const getCustomTemplates = (): CustomTemplate[] => {
  const stored = localStorage.getItem('customReportTemplates')
  return stored ? JSON.parse(stored) : []
}

export const saveCustomTemplate = (template: Omit<CustomTemplate, 'createdAt' | 'isCustom'>): void => {
  const templates = getCustomTemplates()
  const newTemplate: CustomTemplate = {
    ...template,
    createdAt: new Date().toISOString(),
    isCustom: true
  }
  templates.push(newTemplate)
  localStorage.setItem('customReportTemplates', JSON.stringify(templates))
}

export const deleteCustomTemplate = (templateId: string): void => {
  const templates = getCustomTemplates().filter(t => t.id !== templateId)
  localStorage.setItem('customReportTemplates', JSON.stringify(templates))
}

export const getAllTemplates = (): (ReportTemplate | CustomTemplate)[] => {
  return [...REPORT_TEMPLATES, ...getCustomTemplates()]
}
