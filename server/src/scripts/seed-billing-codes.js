const mongoose = require('mongoose');
require('dotenv').config();

const BillingCode = require('../models/BillingCode');
const DiagnosisCode = require('../models/DiagnosisCode');

// Sample CPT Codes for Radiology
const cptCodes = [
  // Chest X-Ray
  { cptCode: '71045', cptDescription: 'Chest X-ray, 2 views', cptCategory: 'Radiology', modality: ['XR', 'XA'], bodyPart: ['Chest'], basePrice: 75.00, keywords: ['chest', 'xray', 'radiograph', 'thorax', 'lung'] },
  { cptCode: '71046', cptDescription: 'Chest X-ray, 3 views', cptCategory: 'Radiology', modality: ['XR', 'XA'], bodyPart: ['Chest'], basePrice: 95.00, keywords: ['chest', 'xray', 'three view'] },
  { cptCode: '71047', cptDescription: 'Chest X-ray, 4 or more views', cptCategory: 'Radiology', modality: ['XR', 'XA'], bodyPart: ['Chest'], basePrice: 115.00, keywords: ['chest', 'xray', 'multiple views'] },
  
  // CT Scans
  { cptCode: '70450', cptDescription: 'CT head without contrast', cptCategory: 'Radiology', modality: ['CT'], bodyPart: ['Head'], basePrice: 450.00, keywords: ['ct', 'head', 'brain', 'skull', 'non-contrast'] },
  { cptCode: '70460', cptDescription: 'CT head with contrast', cptCategory: 'Radiology', modality: ['CT'], bodyPart: ['Head'], basePrice: 550.00, keywords: ['ct', 'head', 'brain', 'contrast'] },
  { cptCode: '71250', cptDescription: 'CT chest without contrast', cptCategory: 'Radiology', modality: ['CT'], bodyPart: ['Chest'], basePrice: 500.00, keywords: ['ct', 'chest', 'thorax', 'non-contrast'] },
  { cptCode: '71260', cptDescription: 'CT chest with contrast', cptCategory: 'Radiology', modality: ['CT'], bodyPart: ['Chest'], basePrice: 600.00, keywords: ['ct', 'chest', 'contrast'] },
  { cptCode: '71275', cptDescription: 'CT angiography chest', cptCategory: 'Radiology', modality: ['CT'], bodyPart: ['Chest'], basePrice: 750.00, keywords: ['cta', 'angiography', 'chest', 'pulmonary embolism'] },
  { cptCode: '74150', cptDescription: 'CT abdomen without contrast', cptCategory: 'Radiology', modality: ['CT'], bodyPart: ['Abdomen'], basePrice: 500.00, keywords: ['ct', 'abdomen', 'non-contrast'] },
  { cptCode: '74160', cptDescription: 'CT abdomen with contrast', cptCategory: 'Radiology', modality: ['CT'], bodyPart: ['Abdomen'], basePrice: 600.00, keywords: ['ct', 'abdomen', 'contrast'] },
  
  // MRI
  { cptCode: '70551', cptDescription: 'MRI brain without contrast', cptCategory: 'Radiology', modality: ['MR', 'MRI'], bodyPart: ['Head'], basePrice: 800.00, keywords: ['mri', 'brain', 'head', 'non-contrast'] },
  { cptCode: '70552', cptDescription: 'MRI brain with contrast', cptCategory: 'Radiology', modality: ['MR', 'MRI'], bodyPart: ['Head'], basePrice: 950.00, keywords: ['mri', 'brain', 'contrast'] },
  { cptCode: '71550', cptDescription: 'MRI chest without contrast', cptCategory: 'Radiology', modality: ['MR', 'MRI'], bodyPart: ['Chest'], basePrice: 850.00, keywords: ['mri', 'chest', 'thorax'] },
  
  // Ultrasound
  { cptCode: '76700', cptDescription: 'Ultrasound abdomen complete', cptCategory: 'Radiology', modality: ['US'], bodyPart: ['Abdomen'], basePrice: 250.00, keywords: ['ultrasound', 'abdomen', 'sonography'] },
  { cptCode: '76770', cptDescription: 'Ultrasound retroperitoneal', cptCategory: 'Radiology', modality: ['US'], bodyPart: ['Abdomen'], basePrice: 275.00, keywords: ['ultrasound', 'kidney', 'retroperitoneal'] },
  { cptCode: '93306', cptDescription: 'Echocardiography complete', cptCategory: 'Radiology', modality: ['US'], bodyPart: ['Cardiac'], basePrice: 400.00, keywords: ['echo', 'echocardiography', 'heart', 'cardiac'] },
  
  // Cardiac Angiography
  { cptCode: '93454', cptDescription: 'Cardiac catheterization, left heart', cptCategory: 'Radiology', modality: ['XA'], bodyPart: ['Cardiac'], basePrice: 1200.00, keywords: ['cardiac', 'catheterization', 'angiography', 'coronary'] },
  { cptCode: '93458', cptDescription: 'Cardiac catheterization with coronary angiography', cptCategory: 'Radiology', modality: ['XA'], bodyPart: ['Cardiac'], basePrice: 1500.00, keywords: ['cardiac', 'angiography', 'coronary', 'catheterization'] },
  { cptCode: '93459', cptDescription: 'Cardiac catheterization with left ventriculography', cptCategory: 'Radiology', modality: ['XA'], bodyPart: ['Cardiac'], basePrice: 1400.00, keywords: ['cardiac', 'ventriculography', 'catheterization'] },
  
  // Mammography
  { cptCode: '77065', cptDescription: 'Mammography, bilateral', cptCategory: 'Radiology', modality: ['MG'], bodyPart: ['Breast'], basePrice: 200.00, keywords: ['mammography', 'breast', 'screening'] },
  { cptCode: '77066', cptDescription: 'Mammography, unilateral', cptCategory: 'Radiology', modality: ['MG'], bodyPart: ['Breast'], basePrice: 150.00, keywords: ['mammography', 'breast', 'diagnostic'] }
];

// Sample ICD-10 Codes
const icd10Codes = [
  // Respiratory
  { icd10Code: 'J18.9', icd10Description: 'Pneumonia, unspecified organism', category: 'Respiratory', severity: 'moderate', keywords: ['pneumonia', 'lung infection', 'infiltrate'], relatedCPTCodes: ['71045', '71250'] },
  { icd10Code: 'J44.0', icd10Description: 'COPD with acute lower respiratory infection', category: 'Respiratory', severity: 'moderate', keywords: ['copd', 'chronic obstructive', 'emphysema'], relatedCPTCodes: ['71045', '71250'] },
  { icd10Code: 'J91.8', icd10Description: 'Pleural effusion', category: 'Respiratory', severity: 'mild', keywords: ['effusion', 'pleural', 'fluid'], relatedCPTCodes: ['71045', '71250'] },
  { icd10Code: 'J93.0', icd10Description: 'Spontaneous tension pneumothorax', category: 'Respiratory', severity: 'severe', keywords: ['pneumothorax', 'collapsed lung', 'air'], relatedCPTCodes: ['71045', '71250'] },
  { icd10Code: 'J98.4', icd10Description: 'Other disorders of lung', category: 'Respiratory', severity: 'mild', keywords: ['lung disorder', 'pulmonary'], relatedCPTCodes: ['71045', '71250'] },
  
  // Cardiovascular
  { icd10Code: 'I25.10', icd10Description: 'Coronary artery disease without angina', category: 'Cardiovascular', severity: 'moderate', keywords: ['coronary', 'cad', 'heart disease', 'stenosis'], relatedCPTCodes: ['93458', '93454'] },
  { icd10Code: 'I25.110', icd10Description: 'Coronary artery disease with unstable angina', category: 'Cardiovascular', severity: 'severe', keywords: ['angina', 'coronary', 'chest pain'], relatedCPTCodes: ['93458', '93454'] },
  { icd10Code: 'I21.9', icd10Description: 'Acute myocardial infarction', category: 'Cardiovascular', severity: 'critical', keywords: ['heart attack', 'mi', 'myocardial infarction'], relatedCPTCodes: ['93458', '71250'] },
  { icd10Code: 'I50.9', icd10Description: 'Heart failure, unspecified', category: 'Cardiovascular', severity: 'moderate', keywords: ['heart failure', 'chf', 'cardiac'], relatedCPTCodes: ['93306', '71045'] },
  { icd10Code: 'I48.91', icd10Description: 'Atrial fibrillation', category: 'Cardiovascular', severity: 'moderate', keywords: ['afib', 'atrial fibrillation', 'arrhythmia'], relatedCPTCodes: ['93306'] },
  
  // Musculoskeletal
  { icd10Code: 'M25.561', icd10Description: 'Pain in right knee', category: 'Musculoskeletal', severity: 'mild', keywords: ['knee pain', 'joint pain'], relatedCPTCodes: ['73560'] },
  { icd10Code: 'S22.9', icd10Description: 'Fracture of unspecified part of thorax', category: 'Musculoskeletal', severity: 'moderate', keywords: ['fracture', 'rib', 'chest'], relatedCPTCodes: ['71045'] },
  { icd10Code: 'M54.5', icd10Description: 'Low back pain', category: 'Musculoskeletal', severity: 'mild', keywords: ['back pain', 'lumbar', 'spine'], relatedCPTCodes: ['72148'] },
  
  // Neurological
  { icd10Code: 'G43.909', icd10Description: 'Migraine, unspecified', category: 'Neurological', severity: 'mild', keywords: ['migraine', 'headache'], relatedCPTCodes: ['70450'] },
  { icd10Code: 'I63.9', icd10Description: 'Cerebral infarction, unspecified', category: 'Neurological', severity: 'critical', keywords: ['stroke', 'cva', 'infarction'], relatedCPTCodes: ['70450', '70460'] },
  { icd10Code: 'G40.909', icd10Description: 'Epilepsy, unspecified', category: 'Neurological', severity: 'moderate', keywords: ['epilepsy', 'seizure'], relatedCPTCodes: ['70450'] },
  
  // Gastrointestinal
  { icd10Code: 'K80.20', icd10Description: 'Calculus of gallbladder without cholecystitis', category: 'Gastrointestinal', severity: 'mild', keywords: ['gallstone', 'cholelithiasis'], relatedCPTCodes: ['76700', '74150'] },
  { icd10Code: 'K29.70', icd10Description: 'Gastritis, unspecified', category: 'Gastrointestinal', severity: 'mild', keywords: ['gastritis', 'stomach'], relatedCPTCodes: ['74150'] },
  
  // General/Screening
  { icd10Code: 'Z00.00', icd10Description: 'Encounter for general examination', category: 'Other', severity: 'normal', keywords: ['screening', 'checkup', 'examination'], relatedCPTCodes: [] },
  { icd10Code: 'R07.9', icd10Description: 'Chest pain, unspecified', category: 'Other', severity: 'mild', keywords: ['chest pain', 'pain'], relatedCPTCodes: ['71045', '93458'] },
  { icd10Code: 'R06.02', icd10Description: 'Shortness of breath', category: 'Respiratory', severity: 'mild', keywords: ['dyspnea', 'shortness of breath', 'sob'], relatedCPTCodes: ['71045', '71250'] }
];

async function seedBillingCodes() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/radiology';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    // Clear existing data
    await BillingCode.deleteMany({});
    await DiagnosisCode.deleteMany({});
    console.log('🗑️  Cleared existing billing codes');
    
    // Insert CPT codes
    const insertedCPT = await BillingCode.insertMany(cptCodes);
    console.log(`✅ Inserted ${insertedCPT.length} CPT codes`);
    
    // Insert ICD-10 codes
    const insertedICD10 = await DiagnosisCode.insertMany(icd10Codes);
    console.log(`✅ Inserted ${insertedICD10.length} ICD-10 codes`);
    
    console.log('\n🎉 Billing code seeding completed successfully!');
    console.log(`\nSummary:`);
    console.log(`- CPT Codes: ${insertedCPT.length}`);
    console.log(`- ICD-10 Codes: ${insertedICD10.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding billing codes:', error);
    process.exit(1);
  }
}

// Run the seed function
seedBillingCodes();
