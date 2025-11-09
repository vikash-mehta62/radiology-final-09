const axios = require('axios');

/**
 * Gemini Vision Service - Handles both detection and reporting
 * Uses Google's Gemini API for all AI tasks
 */
class GeminiVisionService {
  constructor() {
    this.apiKey = process.env.GOOGLE_AI_API_KEY;
    this.model = 'gemini-2.0-flash';
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1/models';
  }

  /**
   * Detect abnormalities in medical image
   */
  async detectAbnormalities(imageBuffer) {
    try {
      console.log('Starting Gemini Vision detection...');
      
      const base64Image = imageBuffer.toString('base64');
      
      const prompt = `You are an expert radiologist analyzing a medical image. 

Analyze this image and identify any abnormalities or significant findings.

For each finding, provide:
1. The type of abnormality (e.g., pneumonia, pleural effusion, nodule, mass, etc.)
2. The approximate location (e.g., "right upper lobe", "left lower zone", "central")
3. Your confidence level (high, medium, or low)

Format your response as a JSON array like this:
[
  {
    "label": "pneumonia",
    "location": "right lower lobe",
    "confidence": "high",
    "description": "Consolidation visible in right lower lobe"
  }
]

If the image appears normal, return an empty array: []

IMPORTANT: Return ONLY the JSON array, no other text.`;

      const response = await axios.post(
        `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`,
        {
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: base64Image
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 1024
          }
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        }
      );

      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) {
        throw new Error('No response from Gemini');
      }

      // Parse JSON response
      let detections = [];
      try {
        // Extract JSON from response (in case there's extra text)
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          detections = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        console.warn('Could not parse JSON, using text response');
        // If JSON parsing fails, create a single detection from text
        if (text.toLowerCase().includes('normal') || text.toLowerCase().includes('no abnormalities')) {
          detections = [];
        } else {
          detections = [{
            label: 'finding',
            location: 'see description',
            confidence: 'medium',
            description: text
          }];
        }
      }

      console.log(`Detection complete. Found ${detections.length} findings.`);

      return {
        detections: detections.map(det => ({
          label: det.label || 'finding',
          location: det.location || 'unspecified',
          confidence: this.convertConfidence(det.confidence),
          description: det.description || ''
        })),
        metadata: {
          model: this.model,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('Gemini detection error:', error.message);
      throw new Error(`Detection failed: ${error.message}`);
    }
  }

  /**
   * Generate medical report
   */
  async generateReport(imageBuffer, detections = [], patientContext = {}) {
    try {
      console.log('Generating medical report with Gemini...');
      
      const base64Image = imageBuffer.toString('base64');
      const prompt = this.buildReportPrompt(detections, patientContext);

      const response = await axios.post(
        `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`,
        {
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: base64Image
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2048
          }
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000
        }
      );

      const report = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!report) {
        throw new Error('No report generated');
      }

      console.log('Report generated successfully');

      return {
        report,
        detections,
        metadata: {
          model: this.model,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('Report generation error:', error.message);
      throw new Error(`Report generation failed: ${error.message}`);
    }
  }

  /**
   * Build prompt for report generation
   */
  buildReportPrompt(detections, patientContext) {
    let prompt = `You are an expert radiologist. Analyze this medical image and generate a comprehensive radiological report.

`;

    if (detections && detections.length > 0) {
      prompt += `PRELIMINARY FINDINGS:\n`;
      detections.forEach((det, idx) => {
        prompt += `${idx + 1}. ${det.label} - ${det.location} (${det.confidence} confidence)\n`;
        if (det.description) {
          prompt += `   ${det.description}\n`;
        }
      });
      prompt += `\n`;
    }

    if (patientContext.age || patientContext.gender || patientContext.clinicalHistory) {
      prompt += `PATIENT CONTEXT:\n`;
      if (patientContext.age) prompt += `Age: ${patientContext.age}\n`;
      if (patientContext.gender) prompt += `Gender: ${patientContext.gender}\n`;
      if (patientContext.clinicalHistory) prompt += `Clinical History: ${patientContext.clinicalHistory}\n`;
      prompt += `\n`;
    }

    prompt += `Please provide a detailed radiological report with the following sections:

1. TECHNIQUE
   Describe the imaging modality and technique used

2. FINDINGS
   Provide detailed observations including:
   - Overall image quality
   - Anatomical structures visible
   - Any abnormalities detected (validate the preliminary findings above)
   - Size, location, and characteristics of any lesions
   - Comparison with normal anatomy

3. IMPRESSION
   Summarize the key findings and provide clinical interpretation

4. RECOMMENDATIONS
   Suggest any follow-up imaging or clinical actions if needed

Format the report professionally as it would appear in a clinical setting.`;

    return prompt;
  }

  /**
   * Convert confidence string to number
   */
  convertConfidence(confidenceStr) {
    if (typeof confidenceStr === 'number') return confidenceStr;
    
    const str = (confidenceStr || '').toLowerCase();
    if (str.includes('high')) return 0.85;
    if (str.includes('medium') || str.includes('moderate')) return 0.65;
    if (str.includes('low')) return 0.45;
    return 0.50;
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`,
        {
          contents: [{
            parts: [{ text: 'Hello, respond with OK if you can read this.' }]
          }]
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        }
      );

      return {
        success: true,
        model: this.model,
        status: response.status,
        message: 'Connection successful'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: error.response?.status,
        message: 'Connection failed'
      };
    }
  }
}

module.exports = new GeminiVisionService();
