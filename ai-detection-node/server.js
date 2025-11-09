const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sharp = require('sharp');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5004;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

/**
 * Detection Templates by Modality
 */
const DETECTION_TEMPLATES = {
  XR: {
    types: ['pneumonia', 'pneumothorax', 'pleural_effusion', 'cardiomegaly', 'nodule', 'fracture'],
    commonFindings: [
      { type: 'consolidation', label: 'Consolidation', severity: 'MEDIUM', confidence: [0.65, 0.85] },
      { type: 'cardiomegaly', label: 'Cardiomegaly', severity: 'LOW', confidence: [0.60, 0.75] },
      { type: 'pleural_effusion', label: 'Pleural Effusion', severity: 'MEDIUM', confidence: [0.70, 0.85] },
      { type: 'pneumothorax', label: 'Pneumothorax', severity: 'CRITICAL', confidence: [0.75, 0.90] },
      { type: 'nodule', label: 'Pulmonary Nodule', severity: 'MEDIUM', confidence: [0.70, 0.85] }
    ]
  },
  CT: {
    types: ['fracture', 'hemorrhage', 'tumor', 'lesion', 'calcification', 'pneumothorax'],
    commonFindings: [
      { type: 'nodule', label: 'Pulmonary Nodule', severity: 'MEDIUM', confidence: [0.75, 0.90] },
      { type: 'lesion', label: 'Lesion', severity: 'HIGH', confidence: [0.70, 0.85] },
      { type: 'calcification', label: 'Calcification', severity: 'LOW', confidence: [0.80, 0.95] },
      { type: 'fracture', label: 'Fracture', severity: 'HIGH', confidence: [0.75, 0.90] }
    ]
  },
  MR: {
    types: ['tumor', 'lesion', 'hemorrhage', 'infarct', 'edema'],
    commonFindings: [
      { type: 'lesion', label: 'Brain Lesion', severity: 'HIGH', confidence: [0.70, 0.85] },
      { type: 'edema', label: 'Edema', severity: 'MEDIUM', confidence: [0.65, 0.80] },
      { type: 'tumor', label: 'Mass Lesion', severity: 'HIGH', confidence: [0.70, 0.85] }
    ]
  },
  US: {
    types: ['mass', 'cyst', 'fluid_collection', 'calcification'],
    commonFindings: [
      { type: 'cyst', label: 'Cyst', severity: 'LOW', confidence: [0.75, 0.90] },
      { type: 'mass', label: 'Mass', severity: 'MEDIUM', confidence: [0.65, 0.80] },
      { type: 'fluid_collection', label: 'Fluid Collection', severity: 'MEDIUM', confidence: [0.70, 0.85] }
    ]
  }
};

/**
 * Generate random detection based on modality
 */
function generateDetection(modality, index) {
  const template = DETECTION_TEMPLATES[modality] || DETECTION_TEMPLATES.XR;
  const findings = template.commonFindings;
  const finding = findings[Math.floor(Math.random() * findings.length)];
  
  // Random confidence within range
  const [minConf, maxConf] = finding.confidence;
  const confidence = minConf + Math.random() * (maxConf - minConf);
  
  // Random position (avoid edges)
  const x = 0.2 + Math.random() * 0.6;
  const y = 0.2 + Math.random() * 0.6;
  const width = 0.08 + Math.random() * 0.15;
  const height = 0.08 + Math.random() * 0.15;
  
  // Generate description
  const descriptions = {
    consolidation: `Possible consolidation detected with ${(confidence * 100).toFixed(1)}% confidence. May represent pneumonia or atelectasis.`,
    cardiomegaly: `Mild cardiomegaly noted with ${(confidence * 100).toFixed(1)}% confidence. Cardiothoracic ratio appears increased.`,
    pleural_effusion: `Pleural effusion noted with ${(confidence * 100).toFixed(1)}% confidence. Fluid collection in pleural space.`,
    pneumothorax: `Pneumothorax identified with ${(confidence * 100).toFixed(1)}% confidence. Air collection in pleural space requires immediate attention.`,
    nodule: `Pulmonary nodule identified with ${(confidence * 100).toFixed(1)}% confidence. Measures approximately ${(width * 100).toFixed(0)}mm.`,
    lesion: `Lesion detected with ${(confidence * 100).toFixed(1)}% confidence. Further characterization needed.`,
    fracture: `Fracture detected with ${(confidence * 100).toFixed(1)}% confidence. Cortical disruption visible.`,
    cyst: `Cyst identified with ${(confidence * 100).toFixed(1)}% confidence. Appears benign.`,
    mass: `Mass lesion detected with ${(confidence * 100).toFixed(1)}% confidence. Requires further evaluation.`
  };
  
  // Generate recommendations
  const recommendations = {
    CRITICAL: [
      'Immediate radiologist review required',
      'Consider urgent clinical correlation',
      'Urgent intervention may be needed'
    ],
    HIGH: [
      'Radiologist review recommended within 24 hours',
      'Clinical correlation advised',
      'Consider follow-up imaging or biopsy'
    ],
    MEDIUM: [
      'Radiologist review recommended',
      'Clinical correlation advised',
      'Consider follow-up if symptoms persist'
    ],
    LOW: [
      'Routine radiologist review',
      'Clinical correlation recommended',
      'Follow-up per clinical guidelines'
    ]
  };
  
  // Generate measurements
  const measurements = {};
  if (finding.type === 'nodule' || finding.type === 'mass' || finding.type === 'lesion') {
    measurements.diameter = `${(width * 100).toFixed(0)} mm`;
    measurements.volume = `${(width * height * 100).toFixed(0)} mm³`;
  }
  if (finding.type === 'consolidation' || finding.type === 'pleural_effusion') {
    measurements.area = `${(width * height * 100).toFixed(1)} cm²`;
  }
  if (finding.type === 'cardiomegaly') {
    measurements.cardiothoracic_ratio = (0.48 + Math.random() * 0.08).toFixed(2);
  }
  
  return {
    id: `detection-${Date.now()}-${index}`,
    type: finding.type,
    label: finding.label,
    confidence: parseFloat(confidence.toFixed(3)),
    severity: finding.severity,
    boundingBox: {
      x: parseFloat(x.toFixed(3)),
      y: parseFloat(y.toFixed(3)),
      width: parseFloat(width.toFixed(3)),
      height: parseFloat(height.toFixed(3))
    },
    description: descriptions[finding.type] || `${finding.label} detected with ${(confidence * 100).toFixed(1)}% confidence.`,
    recommendations: recommendations[finding.severity],
    measurements: measurements,
    metadata: {
      detectedAt: new Date().toISOString(),
      model: 'AI Detection Service v1.0',
      modality: modality
    }
  };
}

/**
 * Analyze image and return detections
 */
async function analyzeImage(imageBase64, modality, options = {}) {
  try {
    // Decode base64 image
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    
    // Get image info using sharp
    const metadata = await sharp(imageBuffer).metadata();
    console.log(`Image: ${metadata.width}x${metadata.height}, format: ${metadata.format}`);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    
    // Generate 1-3 detections based on modality
    const numDetections = Math.floor(Math.random() * 3) + 1;
    const detections = [];
    
    for (let i = 0; i < numDetections; i++) {
      detections.push(generateDetection(modality, i));
    }
    
    // Sort by severity (Critical first)
    const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    detections.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
    
    return detections;
  } catch (error) {
    console.error('Image analysis error:', error);
    throw error;
  }
}

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'AI Detection Service',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

/**
 * Detect abnormalities endpoint
 */
app.post('/detect', async (req, res) => {
  try {
    const { image, modality = 'XR', confidence_threshold = 0.5 } = req.body;
    
    if (!image) {
      return res.status(400).json({
        error: 'Missing required field: image (base64 encoded)'
      });
    }
    
    console.log(`🔍 Detecting abnormalities for ${modality} image...`);
    
    // Analyze image
    const detections = await analyzeImage(image, modality, { confidence_threshold });
    
    // Filter by confidence threshold
    const filteredDetections = detections.filter(d => d.confidence >= confidence_threshold);
    
    console.log(`✅ Found ${filteredDetections.length} detections`);
    
    res.json({
      success: true,
      detections: filteredDetections,
      metadata: {
        total_detections: filteredDetections.length,
        critical_count: filteredDetections.filter(d => d.severity === 'CRITICAL').length,
        high_count: filteredDetections.filter(d => d.severity === 'HIGH').length,
        medium_count: filteredDetections.filter(d => d.severity === 'MEDIUM').length,
        low_count: filteredDetections.filter(d => d.severity === 'LOW').length,
        modality: modality,
        confidence_threshold: confidence_threshold,
        processed_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Detection error:', error);
    res.status(500).json({
      success: false,
      error: 'Detection failed',
      message: error.message
    });
  }
});

/**
 * Batch detection endpoint
 */
app.post('/detect-batch', async (req, res) => {
  try {
    const { images, modality = 'XR', confidence_threshold = 0.5 } = req.body;
    
    if (!images || !Array.isArray(images)) {
      return res.status(400).json({
        error: 'Missing required field: images (array of base64 encoded images)'
      });
    }
    
    console.log(`🔍 Batch detecting abnormalities for ${images.length} ${modality} images...`);
    
    const results = [];
    for (let i = 0; i < images.length; i++) {
      const detections = await analyzeImage(images[i], modality, { confidence_threshold });
      const filteredDetections = detections.filter(d => d.confidence >= confidence_threshold);
      results.push({
        index: i,
        detections: filteredDetections,
        count: filteredDetections.length
      });
    }
    
    console.log(`✅ Batch processing complete`);
    
    res.json({
      success: true,
      results: results,
      metadata: {
        total_images: images.length,
        total_detections: results.reduce((sum, r) => sum + r.count, 0),
        processed_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Batch detection error:', error);
    res.status(500).json({
      success: false,
      error: 'Batch detection failed',
      message: error.message
    });
  }
});

/**
 * Get supported modalities
 */
app.get('/modalities', (req, res) => {
  res.json({
    success: true,
    modalities: Object.keys(DETECTION_TEMPLATES).map(key => ({
      code: key,
      name: {
        XR: 'X-Ray',
        CT: 'CT Scan',
        MR: 'MRI',
        US: 'Ultrasound'
      }[key],
      detection_types: DETECTION_TEMPLATES[key].types
    }))
  });
});

/**
 * Error handling
 */
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

/**
 * Start server
 */
app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║                                                        ║');
  console.log('║   🏥 Medical AI Detection Service                      ║');
  console.log('║                                                        ║');
  console.log('║   Status: ✅ Running                                   ║');
  console.log(`║   Port: ${PORT}                                           ║`);
  console.log('║                                                        ║');
  console.log('║   Endpoints:                                           ║');
  console.log(`║   - GET  http://localhost:${PORT}/health                  ║`);
  console.log(`║   - POST http://localhost:${PORT}/detect                  ║`);
  console.log(`║   - POST http://localhost:${PORT}/detect-batch            ║`);
  console.log(`║   - GET  http://localhost:${PORT}/modalities              ║`);
  console.log('║                                                        ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Ready to detect abnormalities! 🎯');
  console.log('');
});

module.exports = app;
