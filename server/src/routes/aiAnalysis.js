const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const medSigLIPService = require('../services/medSigLIPService');
const medGemmaService = require('../services/medGemmaService');

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

/**
 * POST /api/ai/detect
 * Detect abnormalities using MedSigLIP (Hugging Face)
 */
router.post('/detect', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    console.log(`🔍 [MedSigLIP] Analyzing: ${req.file.originalname} (${req.file.size} bytes)`);

    // Process image
    const imageBuffer = await sharp(req.file.buffer)
      .jpeg({ quality: 90 })
      .toBuffer();

    // Detect abnormalities using MedSigLIP (Hugging Face)
    const result = await medSigLIPService.detectAbnormalities(imageBuffer);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ MedSigLIP detection error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai/report
 * Generate medical report using MedGemma (Google Gemini)
 */
router.post('/report', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    console.log(`📝 [MedGemma] Generating report: ${req.file.originalname}`);

    // Parse detections from request body
    const detections = req.body.detections ? JSON.parse(req.body.detections) : [];
    const patientContext = req.body.patientContext ? JSON.parse(req.body.patientContext) : {};

    // Process image
    const imageBuffer = await sharp(req.file.buffer)
      .jpeg({ quality: 90 })
      .toBuffer();

    // Generate report using MedGemma (Google Gemini API)
    const result = await medGemmaService.generateReport(imageBuffer, detections, patientContext);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ MedGemma report error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai/analyze
 * Complete analysis: Detection + Report (accepts JSON with base64 image)
 */
router.post('/analyze', express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const { imageData, patientContext = {}, studyInstanceUID, seriesInstanceUID, frameIndex } = req.body;

    if (!imageData) {
      return res.status(400).json({ 
        success: false,
        error: 'No image data provided' 
      });
    }

    console.log(`Starting complete analysis for study: ${studyInstanceUID}, frame: ${frameIndex}`);

    // Convert base64 to buffer
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Process image
    const processedBuffer = await sharp(imageBuffer)
      .jpeg({ quality: 90 })
      .toBuffer();

    // Step 1: Detect abnormalities using MedSigLIP (Hugging Face)
    console.log('🔍 Step 1: Running MedSigLIP detection (Hugging Face)...');
    const detectionResult = await medSigLIPService.detectAbnormalities(processedBuffer);

    // Step 2: Generate report using MedGemma (Google Gemini)
    console.log('📝 Step 2: Generating MedGemma report (Google Gemini)...');
    const reportResult = await medGemmaService.generateReport(
      processedBuffer,
      detectionResult.detections,
      patientContext
    );

    // Format response to match frontend expectations
    const response = {
      success: true,
      analysisId: `AI-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`,
      analyzedAt: new Date().toISOString(),
      
      // Classification (from MedSigLIP detections)
      classification: {
        label: detectionResult.detections.length > 0 ? detectionResult.detections[0].label : 'Normal',
        confidence: detectionResult.detections.length > 0 ? detectionResult.detections[0].confidence : 0.95,
        topPredictions: detectionResult.detections.slice(0, 3).map(d => ({
          label: d.label,
          confidence: d.confidence
        })),
        model: 'MedSigLIP (Hugging Face)'
      },

      // Findings from MedSigLIP
      findings: detectionResult.detections.map(d => ({
        type: d.label,
        location: `Region (${d.x}, ${d.y})`,
        description: `${d.label} detected with ${(d.confidence * 100).toFixed(1)}% confidence`,
        confidence: d.confidence,
        severity: d.confidence > 0.7 ? 'high' : d.confidence > 0.5 ? 'medium' : 'low',
        boundingBox: { x: d.x, y: d.y, width: d.width, height: d.height }
      })),

      // Report from MedGemma
      report: {
        findings: reportResult.report || 'Analysis completed',
        impression: reportResult.metadata?.timestamp || 'See findings above',
        recommendations: [],
        model: 'MedGemma (Google Gemini)'
      },

      // Metadata
      metadata: {
        ...detectionResult.metadata,
        reportMetadata: reportResult.metadata
      },
      servicesUsed: ['MedSigLIP (Hugging Face)', 'MedGemma (Google Gemini)'],
      
      timestamp: new Date().toISOString()
    };

    console.log('✅ Analysis complete:', {
      findings: response.findings.length,
      classification: response.classification.label
    });

    res.json(response);

  } catch (error) {
    console.error('❌ Analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai/analyze-file
 * Complete analysis: Detection + Report (accepts file upload)
 */
router.post('/analyze-file', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    console.log(`Starting complete analysis for: ${req.file.originalname}`);

    // Parse patient context
    const patientContext = req.body.patientContext ? JSON.parse(req.body.patientContext) : {};

    // Process image
    const imageBuffer = await sharp(req.file.buffer)
      .jpeg({ quality: 90 })
      .toBuffer();

    // Step 1: Detect abnormalities using MedSigLIP
    console.log('🔍 Step 1: Running MedSigLIP detection (Hugging Face)...');
    const detectionResult = await medSigLIPService.detectAbnormalities(imageBuffer);

    // Step 2: Generate report using MedGemma
    console.log('📝 Step 2: Generating MedGemma report (Google Gemini)...');
    const reportResult = await medGemmaService.generateReport(
      imageBuffer,
      detectionResult.detections,
      patientContext
    );

    res.json({
      success: true,
      detections: detectionResult.detections,
      metadata: detectionResult.metadata,
      report: reportResult.report,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai/report-stream
 * Generate streaming medical report
 */
router.post('/report-stream', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const detections = req.body.detections ? JSON.parse(req.body.detections) : [];
    const patientContext = req.body.patientContext ? JSON.parse(req.body.patientContext) : {};

    // Process image
    const imageBuffer = await sharp(req.file.buffer)
      .jpeg({ quality: 90 })
      .toBuffer();

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Get streaming response
    const stream = await medGemmaService.generateStreamingReport(imageBuffer, detections, patientContext);

    // Pipe stream to response
    stream.on('data', (chunk) => {
      res.write(`data: ${chunk.toString()}\n\n`);
    });

    stream.on('end', () => {
      res.write('data: [DONE]\n\n');
      res.end();
    });

    stream.on('error', (error) => {
      console.error('Stream error:', error);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    });

  } catch (error) {
    console.error('Streaming error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/ai/test
 * Test AI service connections
 */
router.get('/test', async (req, res) => {
  try {
    console.log('🧪 Testing AI service connections...');

    const medSigLIPTest = await medSigLIPService.testConnection();
    const medGemmaTest = await medGemmaService.testConnection();

    res.json({
      success: true,
      services: {
        medSigLIP: medSigLIPTest,
        medGemma: medGemmaTest
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/ai/status
 * Get AI service status
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    enabled: process.env.HUGGINGFACE_ENABLED === 'true',
    mode: process.env.AI_MODE,
    services: {
      medSigLIP: {
        provider: 'Hugging Face API',
        model: process.env.MEDSIGLIP_MODEL || 'openai/clip-vit-base-patch32',
        gridSize: process.env.MEDSIGLIP_GRID_SIZE || 3,
        threshold: process.env.MEDSIGLIP_CONFIDENCE_THRESHOLD || 0.15,
        enabled: process.env.HUGGINGFACE_ENABLED === 'true'
      },
      medGemma: {
        provider: 'Google Gemini API',
        model: process.env.MEDGEMMA_MODEL || 'gemini-2.0-flash',
        maxTokens: process.env.MEDGEMMA_MAX_TOKENS || 2048,
        enabled: !!process.env.GOOGLE_AI_API_KEY
      }
    }
  });
});

module.exports = router;
