const axios = require('axios');
const sharp = require('sharp');

class MedSigLIPService {
  constructor() {
    // Check if using local server or Hugging Face API
    this.useLocal = process.env.MEDSIGCLIP_ENABLED === 'true';
    this.localUrl = process.env.MEDSIGCLIP_API_URL || 'http://localhost:5001';
    
    // Hugging Face API settings (fallback)
    this.apiKey = process.env.HUGGINGFACE_API_KEY;
    this.model = process.env.MEDSIGLIP_MODEL || 'openai/clip-vit-large-patch14';
    this.apiUrl = `https://api-inference.huggingface.co/models/${this.model}`;
    
    // Configuration
    this.gridSize = parseInt(process.env.MEDSIGLIP_GRID_SIZE) || 3;
    this.confidenceThreshold = parseFloat(process.env.MEDSIGLIP_CONFIDENCE_THRESHOLD) || 0.15;
    
    console.log(`🔧 MedSigLIP Service initialized:`);
    console.log(`   Mode: ${this.useLocal ? 'Local Server' : 'Hugging Face API'}`);
    console.log(`   URL: ${this.useLocal ? this.localUrl : this.apiUrl}`);
    
    // Medical conditions to detect
    this.conditions = [
      'pneumonia',
      'pleural effusion',
      'cardiomegaly',
      'lung nodule',
      'atelectasis',
      'consolidation',
      'pulmonary edema',
      'mass',
      'normal lung tissue'
    ];
  }

  /**
   * Detect abnormalities in medical image using grid-based approach
   */
  async detectAbnormalities(imageBuffer) {
    try {
      console.log(`🔍 Starting MedSigLIP detection (${this.useLocal ? 'Local' : 'HF API'})...`);
      
      // Validate input
      if (!imageBuffer) {
        throw new Error('No image buffer provided');
      }
      
      // Log buffer info for debugging
      if (Buffer.isBuffer(imageBuffer)) {
        console.log(`   Image buffer size: ${imageBuffer.length} bytes`);
      } else if (typeof imageBuffer === 'string') {
        console.log(`   Image data type: string (will convert to buffer)`);
      } else {
        console.log(`   Image data type: ${typeof imageBuffer}`);
      }
      
      // If using local server, call it directly
      if (this.useLocal) {
        return await this.detectWithLocalServer(imageBuffer);
      }
      
      // Otherwise use Hugging Face API (original code)
      const metadata = await sharp(imageBuffer).metadata();
      const { width, height } = metadata;
      
      console.log(`Image dimensions: ${width}x${height}`);
      
      // Create grid regions
      const regions = this.createGridRegions(width, height);
      console.log(`Created ${regions.length} regions (${this.gridSize}x${this.gridSize} grid)`);
      
      // Process each region
      const detections = [];
      
      for (let i = 0; i < regions.length; i++) {
        const region = regions[i];
        console.log(`Processing region ${i + 1}/${regions.length}...`);
        
        try {
          // Extract region from image
          const regionBuffer = await sharp(imageBuffer)
            .extract({
              left: region.x,
              top: region.y,
              width: region.width,
              height: region.height
            })
            .resize(224, 224) // Resize for model input
            .toBuffer();
          
          // Classify region
          const scores = await this.classifyRegion(regionBuffer);
          
          // Check if abnormality detected
          const abnormality = this.detectAbnormality(scores);
          
          if (abnormality) {
            detections.push({
              x: region.x,
              y: region.y,
              width: region.width,
              height: region.height,
              label: abnormality.label,
              confidence: abnormality.confidence,
              allScores: scores
            });
            console.log(`✓ Abnormality detected: ${abnormality.label} (${(abnormality.confidence * 100).toFixed(1)}%)`);
          }
        } catch (error) {
          console.error(`Error processing region ${i + 1}:`, error.message);
        }
      }
      
      console.log(`Detection complete. Found ${detections.length} abnormalities.`);
      
      return {
        detections,
        metadata: {
          imageWidth: width,
          imageHeight: height,
          gridSize: this.gridSize,
          regionsProcessed: regions.length,
          model: this.model
        }
      };
      
    } catch (error) {
      console.error('❌ MedSigLIP detection error:', error);
      throw new Error(`Detection failed: ${error.message}`);
    }
  }

  /**
   * Detect abnormalities using local Python server
   */
  async detectWithLocalServer(imageBuffer) {
    try {
      const FormData = require('form-data');
      const form = new FormData();
      
      // Ensure imageBuffer is a Buffer
      let buffer = imageBuffer;
      if (typeof imageBuffer === 'string') {
        // If it's a base64 string, convert it
        const base64Data = imageBuffer.replace(/^data:image\/\w+;base64,/, '');
        buffer = Buffer.from(base64Data, 'base64');
      } else if (!Buffer.isBuffer(imageBuffer)) {
        throw new Error('Invalid image data: must be Buffer or base64 string');
      }
      
      // Append image as buffer with proper options
      form.append('image', buffer, {
        filename: 'image.jpg',
        contentType: 'image/jpeg'
      });
      form.append('grid_size', this.gridSize.toString());
      
      console.log(`📡 Calling local MedSigLIP server: ${this.localUrl}/detect`);
      console.log(`   Image size: ${buffer.length} bytes`);
      console.log(`   Grid size: ${this.gridSize}x${this.gridSize}`);
      
      const response = await axios.post(
        `${this.localUrl}/detect`,
        form,
        {
          headers: {
            ...form.getHeaders()
          },
          timeout: 60000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );
      
      if (response.data.success) {
        console.log(`✅ Local server response: ${response.data.detections.length} detections`);
        return {
          detections: response.data.detections,
          metadata: response.data.metadata
        };
      } else {
        throw new Error(response.data.error || 'Detection failed');
      }
      
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.error('❌ Cannot connect to local MedSigLIP server');
        console.error('   Make sure Python server is running on', this.localUrl);
        console.error('   Start with: python ai-detection-node/medsigclip_server.py');
        throw new Error('Local MedSigLIP server not running');
      }
      
      // Log detailed error for debugging
      console.error('❌ Local server error:', error.message);
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Data:', error.response.data);
      }
      
      throw error;
    }
  }

  /**
   * Create grid regions for image analysis
   */
  createGridRegions(imageWidth, imageHeight) {
    const regions = [];
    const regionWidth = Math.floor(imageWidth / this.gridSize);
    const regionHeight = Math.floor(imageHeight / this.gridSize);
    
    for (let row = 0; row < this.gridSize; row++) {
      for (let col = 0; col < this.gridSize; col++) {
        regions.push({
          x: col * regionWidth,
          y: row * regionHeight,
          width: regionWidth,
          height: regionHeight,
          gridPosition: { row, col }
        });
      }
    }
    
    return regions;
  }

  /**
   * Classify a region using CLIP zero-shot classification
   */
  async classifyRegion(imageBuffer) {
    try {
      const response = await axios.post(
        this.apiUrl,
        imageBuffer,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          },
          params: {
            candidate_labels: this.conditions.join(',')
          },
          timeout: 30000
        }
      );
      
      // Parse response for zero-shot classification
      if (response.data && Array.isArray(response.data)) {
        const scores = {};
        response.data.forEach(item => {
          scores[item.label] = item.score;
        });
        return scores;
      }
      
      throw new Error('Invalid API response format');
      
    } catch (error) {
      if (error.response?.status === 503) {
        console.log('Model loading, retrying in 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        return this.classifyRegion(imageBuffer);
      }
      throw error;
    }
  }

  /**
   * Detect abnormality from classification scores
   */
  detectAbnormality(scores) {
    const normalScore = scores['normal lung tissue'] || 0;
    
    // Find highest scoring abnormal condition
    let maxAbnormalScore = 0;
    let maxAbnormalLabel = null;
    
    for (const [label, score] of Object.entries(scores)) {
      if (label !== 'normal lung tissue' && score > maxAbnormalScore) {
        maxAbnormalScore = score;
        maxAbnormalLabel = label;
      }
    }
    
    // Check if abnormality is significant
    const scoreDifference = maxAbnormalScore - normalScore;
    
    if (scoreDifference > this.confidenceThreshold && maxAbnormalScore > 0.3) {
      return {
        label: maxAbnormalLabel,
        confidence: maxAbnormalScore,
        normalScore: normalScore,
        scoreDifference: scoreDifference
      };
    }
    
    return null;
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      if (this.useLocal) {
        // Test local server
        console.log(`🧪 Testing local MedSigLIP server: ${this.localUrl}`);
        
        const response = await axios.get(`${this.localUrl}/health`, {
          timeout: 5000
        });
        
        return {
          success: response.data.status === 'healthy',
          model: 'MedSigLIP (Local)',
          status: response.status,
          modelLoaded: response.data.model_loaded,
          url: this.localUrl
        };
      } else {
        // Test Hugging Face API
        const testImage = await sharp({
          create: {
            width: 224,
            height: 224,
            channels: 3,
            background: { r: 128, g: 128, b: 128 }
          }
        }).png().toBuffer();
        
        const response = await axios.post(
          this.apiUrl,
          testImage,
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`
            },
            params: {
              candidate_labels: 'normal,abnormal'
            },
            timeout: 30000
          }
        );
        
        return {
          success: true,
          model: this.model,
          status: response.status,
          url: this.apiUrl
        };
      }
      
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        return {
          success: false,
          error: 'Local server not running',
          message: `Start with: python ai-detection-node/medsigclip_server.py`,
          url: this.localUrl
        };
      }
      
      return {
        success: false,
        error: error.message,
        status: error.response?.status
      };
    }
  }
}

module.exports = new MedSigLIPService();
