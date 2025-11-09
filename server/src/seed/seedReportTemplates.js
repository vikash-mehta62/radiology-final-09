/**
 * Seed Default Report Templates
 * Creates 5 common medical report templates
 */

const mongoose = require('mongoose');
const ReportTemplate = require('../models/ReportTemplate');
require('dotenv').config();

const defaultTemplates = [
  {
    templateId: 'TPL-CORONARY-ANGIO-001',
    name: 'Coronary Angiography Report',
    description: 'Standard template for coronary angiography procedures',
    category: 'cardiology',
    matchingCriteria: {
      modalities: ['XA', 'RF'],
      bodyParts: ['HEART', 'CHEST', 'CARDIAC'],
      keywords: ['coronary', 'angiography', 'cardiac cath', 'catheterization', 'pci', 'stent'],
      procedureTypes: ['diagnostic', 'interventional']
    },
    matchingWeights: {
      modalityWeight: 50,
      bodyPartWeight: 30,
      keywordWeight: 5,
      procedureTypeWeight: 15
    },
    sections: [
      {
        id: 'clinical-indication',
        title: 'Clinical Indication',
        order: 1,
        required: true,
        placeholder: 'Reason for procedure (e.g., chest pain, abnormal stress test)'
      },
      {
        id: 'procedure-details',
        title: 'Procedure Details',
        order: 2,
        required: true,
        placeholder: 'Access site, contrast used, fluoroscopy time'
      },
      {
        id: 'vessel-assessment',
        title: 'Vessel Assessment',
        order: 3,
        required: true,
        placeholder: 'Detailed assessment of coronary vessels'
      },
      {
        id: 'findings',
        title: 'Findings',
        order: 4,
        required: true,
        placeholder: 'Detailed findings from angiography'
      },
      {
        id: 'stenosis-grading',
        title: 'Stenosis Grading',
        order: 5,
        required: false,
        placeholder: 'Percentage stenosis for each vessel'
      },
      {
        id: 'impression',
        title: 'Impression',
        order: 6,
        required: true,
        placeholder: 'Summary and clinical significance'
      },
      {
        id: 'recommendations',
        title: 'Recommendations',
        order: 7,
        required: true,
        placeholder: 'Follow-up recommendations and treatment plan'
      }
    ],
    fields: new Map([
      ['vessels', ['Left Main (LM)', 'Left Anterior Descending (LAD)', 'Left Circumflex (LCX)', 'Right Coronary Artery (RCA)']],
      ['accessSite', ['Right Radial', 'Left Radial', 'Right Femoral', 'Left Femoral']],
      ['contrast', ['Iohexol', 'Iopamidol', 'Iodixanol', 'Ioversol']]
    ]),
    fieldOptions: new Map([
      ['stenosisGrade', ['Normal (0%)', 'Minimal (<25%)', 'Mild (25-49%)', 'Moderate (50-69%)', 'Severe (70-99%)', 'Total Occlusion (100%)']],
      ['timiFlow', ['TIMI 0 (No flow)', 'TIMI 1 (Penetration without perfusion)', 'TIMI 2 (Partial perfusion)', 'TIMI 3 (Complete perfusion)']],
      ['intervention', ['None', 'Balloon Angioplasty', 'Stent Placement', 'Drug-Eluting Stent', 'Bare Metal Stent', 'Atherectomy']]
    ]),
    aiIntegration: {
      enabled: true,
      autoFillFields: ['vessels', 'stenosisGrade', 'timiFlow'],
      suggestedFindings: ['stenosis', 'occlusion', 'calcification', 'dissection', 'thrombus']
    },
    priority: 100,
    active: true,
    isDefault: true
  },

  {
    templateId: 'TPL-CHEST-XRAY-001',
    name: 'Chest X-Ray Report',
    description: 'Standard template for chest radiography',
    category: 'radiology',
    matchingCriteria: {
      modalities: ['CR', 'DX', 'RF'],
      bodyParts: ['CHEST', 'THORAX', 'LUNG'],
      keywords: ['chest', 'thorax', 'cxr', 'chest x-ray', 'chest radiograph'],
      procedureTypes: ['diagnostic', 'screening']
    },
    matchingWeights: {
      modalityWeight: 50,
      bodyPartWeight: 30,
      keywordWeight: 5,
      procedureTypeWeight: 15
    },
    sections: [
      {
        id: 'clinical-indication',
        title: 'Clinical Indication',
        order: 1,
        required: true,
        placeholder: 'Reason for examination'
      },
      {
        id: 'technique',
        title: 'Technique',
        order: 2,
        required: true,
        placeholder: 'PA and lateral views, portable AP, etc.'
      },
      {
        id: 'comparison',
        title: 'Comparison',
        order: 3,
        required: false,
        placeholder: 'Prior studies for comparison'
      },
      {
        id: 'findings',
        title: 'Findings',
        order: 4,
        required: true,
        placeholder: 'Detailed findings'
      },
      {
        id: 'impression',
        title: 'Impression',
        order: 5,
        required: true,
        placeholder: 'Summary and clinical significance'
      }
    ],
    fieldOptions: new Map([
      ['lungFields', ['Clear', 'Infiltrate', 'Consolidation', 'Effusion', 'Pneumothorax', 'Atelectasis', 'Mass', 'Nodule']],
      ['heartSize', ['Normal', 'Borderline', 'Enlarged', 'Cardiomegaly']],
      ['mediastinum', ['Normal', 'Widened', 'Mass', 'Lymphadenopathy']],
      ['bones', ['Normal', 'Fracture', 'Degenerative changes', 'Lytic lesion', 'Sclerotic lesion']],
      ['softTissues', ['Normal', 'Subcutaneous emphysema', 'Mass', 'Calcification']]
    ]),
    aiIntegration: {
      enabled: true,
      autoFillFields: ['lungFields', 'heartSize', 'mediastinum'],
      suggestedFindings: ['infiltrate', 'consolidation', 'effusion', 'pneumothorax', 'cardiomegaly']
    },
    priority: 90,
    active: true,
    isDefault: true
  },

  {
    templateId: 'TPL-BRAIN-MRI-001',
    name: 'Brain MRI Report',
    description: 'Standard template for brain MRI studies',
    category: 'neurology',
    matchingCriteria: {
      modalities: ['MR', 'MRI'],
      bodyParts: ['BRAIN', 'HEAD', 'SKULL'],
      keywords: ['brain', 'head', 'mri', 'cerebral', 'intracranial'],
      procedureTypes: ['diagnostic']
    },
    matchingWeights: {
      modalityWeight: 50,
      bodyPartWeight: 30,
      keywordWeight: 5,
      procedureTypeWeight: 15
    },
    sections: [
      {
        id: 'clinical-indication',
        title: 'Clinical Indication',
        order: 1,
        required: true,
        placeholder: 'Reason for examination'
      },
      {
        id: 'technique',
        title: 'Technique',
        order: 2,
        required: true,
        placeholder: 'Sequences performed, contrast administration'
      },
      {
        id: 'comparison',
        title: 'Comparison',
        order: 3,
        required: false,
        placeholder: 'Prior studies for comparison'
      },
      {
        id: 'findings',
        title: 'Findings',
        order: 4,
        required: true,
        placeholder: 'Detailed findings by anatomical region'
      },
      {
        id: 'impression',
        title: 'Impression',
        order: 5,
        required: true,
        placeholder: 'Summary and clinical significance'
      }
    ],
    fieldOptions: new Map([
      ['grayMatter', ['Normal', 'Atrophy', 'Lesion', 'Infarct', 'Hemorrhage']],
      ['whiteMatter', ['Normal', 'Hyperintensities', 'Demyelination', 'Infarct']],
      ['ventricles', ['Normal', 'Enlarged', 'Hydrocephalus', 'Asymmetric']],
      ['vessels', ['Normal', 'Aneurysm', 'Stenosis', 'Occlusion', 'AVM']],
      ['extraAxial', ['Normal', 'Subdural', 'Epidural', 'Subarachnoid hemorrhage', 'Hygroma']]
    ]),
    aiIntegration: {
      enabled: true,
      autoFillFields: ['grayMatter', 'whiteMatter', 'ventricles'],
      suggestedFindings: ['infarct', 'hemorrhage', 'mass', 'atrophy', 'lesion']
    },
    priority: 85,
    active: true,
    isDefault: true
  },

  {
    templateId: 'TPL-CT-ABDOMEN-001',
    name: 'CT Abdomen/Pelvis Report',
    description: 'Standard template for abdominal CT studies',
    category: 'radiology',
    matchingCriteria: {
      modalities: ['CT'],
      bodyParts: ['ABDOMEN', 'PELVIS', 'ABD', 'ABDOMINAL'],
      keywords: ['abdomen', 'pelvis', 'abdominal', 'ct abdomen', 'ct pelvis'],
      procedureTypes: ['diagnostic']
    },
    matchingWeights: {
      modalityWeight: 50,
      bodyPartWeight: 30,
      keywordWeight: 5,
      procedureTypeWeight: 15
    },
    sections: [
      {
        id: 'clinical-indication',
        title: 'Clinical Indication',
        order: 1,
        required: true,
        placeholder: 'Reason for examination'
      },
      {
        id: 'technique',
        title: 'Technique',
        order: 2,
        required: true,
        placeholder: 'Contrast phases, slice thickness'
      },
      {
        id: 'comparison',
        title: 'Comparison',
        order: 3,
        required: false,
        placeholder: 'Prior studies for comparison'
      },
      {
        id: 'findings',
        title: 'Findings',
        order: 4,
        required: true,
        placeholder: 'Organ-by-organ assessment'
      },
      {
        id: 'impression',
        title: 'Impression',
        order: 5,
        required: true,
        placeholder: 'Summary and clinical significance'
      }
    ],
    fieldOptions: new Map([
      ['liver', ['Normal', 'Fatty infiltration', 'Cirrhosis', 'Mass', 'Cyst', 'Hemangioma']],
      ['gallbladder', ['Normal', 'Stones', 'Wall thickening', 'Distended', 'Absent']],
      ['pancreas', ['Normal', 'Pancreatitis', 'Mass', 'Atrophy', 'Calcifications']],
      ['spleen', ['Normal', 'Enlarged', 'Atrophic', 'Mass', 'Infarct']],
      ['kidneys', ['Normal', 'Stones', 'Hydronephrosis', 'Mass', 'Cyst', 'Atrophy']],
      ['bowel', ['Normal', 'Obstruction', 'Wall thickening', 'Diverticulosis', 'Mass']],
      ['vessels', ['Normal', 'Aneurysm', 'Stenosis', 'Thrombosis']],
      ['lymphNodes', ['Normal', 'Enlarged', 'Lymphadenopathy']]
    ]),
    aiIntegration: {
      enabled: true,
      autoFillFields: ['liver', 'kidneys', 'spleen'],
      suggestedFindings: ['mass', 'stones', 'obstruction', 'inflammation', 'free fluid']
    },
    priority: 80,
    active: true,
    isDefault: true
  },

  {
    templateId: 'TPL-GENERAL-RAD-001',
    name: 'General Radiology Report',
    description: 'Generic template for various radiology studies',
    category: 'general',
    matchingCriteria: {
      modalities: ['CR', 'DX', 'CT', 'MR', 'US', 'RF', 'XA'],
      bodyParts: [],
      keywords: [],
      procedureTypes: ['diagnostic', 'screening', 'follow-up']
    },
    matchingWeights: {
      modalityWeight: 10,
      bodyPartWeight: 10,
      keywordWeight: 5,
      procedureTypeWeight: 5
    },
    sections: [
      {
        id: 'clinical-indication',
        title: 'Clinical Indication',
        order: 1,
        required: true,
        placeholder: 'Reason for examination'
      },
      {
        id: 'technique',
        title: 'Technique',
        order: 2,
        required: true,
        placeholder: 'Imaging technique and parameters'
      },
      {
        id: 'comparison',
        title: 'Comparison',
        order: 3,
        required: false,
        placeholder: 'Prior studies for comparison'
      },
      {
        id: 'findings',
        title: 'Findings',
        order: 4,
        required: true,
        placeholder: 'Detailed findings'
      },
      {
        id: 'impression',
        title: 'Impression',
        order: 5,
        required: true,
        placeholder: 'Summary and clinical significance'
      },
      {
        id: 'recommendations',
        title: 'Recommendations',
        order: 6,
        required: false,
        placeholder: 'Follow-up recommendations'
      }
    ],
    aiIntegration: {
      enabled: true,
      autoFillFields: [],
      suggestedFindings: []
    },
    priority: 0,
    active: true,
    isDefault: true
  }
];

async function seedTemplates() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medical-imaging');
    console.log('✅ Connected to MongoDB');

    // Clear existing templates (optional - comment out to preserve existing)
    // await ReportTemplate.deleteMany({});
    // console.log('🗑️  Cleared existing templates');

    // Insert default templates
    for (const templateData of defaultTemplates) {
      const existing = await ReportTemplate.findOne({ templateId: templateData.templateId });
      
      if (existing) {
        console.log(`⏭️  Template ${templateData.templateId} already exists, skipping`);
        continue;
      }

      const template = new ReportTemplate(templateData);
      await template.save();
      console.log(`✅ Created template: ${template.name} (${template.templateId})`);
    }

    console.log('\n🎉 Template seeding completed!');
    console.log(`📊 Total templates: ${defaultTemplates.length}`);
    
    // Display summary
    const templates = await ReportTemplate.find({ active: true });
    console.log('\n📋 Active Templates:');
    templates.forEach(t => {
      console.log(`   - ${t.name} (${t.category})`);
      console.log(`     Modalities: ${t.matchingCriteria.modalities.join(', ')}`);
      console.log(`     Priority: ${t.priority}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding templates:', error);
    process.exit(1);
  }
}

// Run seeding
if (require.main === module) {
  seedTemplates();
}

module.exports = { seedTemplates, defaultTemplates };
