const axios = require('axios');

class MedGemmaService {
  constructor() {
    this.apiKey = process.env.GOOGLE_AI_API_KEY;
    this.model = process.env.MEDGEMMA_MODEL || 'gemini-1.5-flash-latest';
    this.maxTokens = parseInt(process.env.MEDGEMMA_MAX_TOKENS) || 2048;
    this.apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
  }

  /**
   * Generate medical report from image and detections
   */
  async generateReport(imageBuffer, detections = [], patientContext = {}) {
    try {
      console.log('Generating medical report with MedGemma...');
      
      // Convert image to base64
      const base64Image = imageBuffer.toString('base64');
      
      // Build prompt
      const prompt = this.buildReportPrompt(detections, patientContext);
      
      console.log('Sending request to Google AI API...');
      
      const response = await axios.post(
        `${this.apiUrl}?key=${this.apiKey}`,
        {
          contents: [{
            parts: [
              {
                text: prompt
              },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: base64Image
                }
              }
            ]
          }],
          generationConfig: {
            maxOutputTokens: this.maxTokens,
            temperature: 0.4,
            topP: 0.8,
            topK: 40
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      );
      
      // Extract report text
      const reportText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!reportText) {
        throw new Error('No report generated');
      }
      
      console.log('Report generated successfully');
      
      return {
        report: reportText,
        detections: detections,
        metadata: {
          model: this.model,
          timestamp: new Date().toISOString(),
          detectionsCount: detections.length
        }
      };
      
    } catch (error) {
      console.error('MedGemma report generation error:', error);
      throw new Error(`Report generation failed: ${error.message}`);
    }
  }

  /**
   * Build prompt for report generation
   */
  buildReportPrompt(detections, patientContext) {
    let prompt = `You are an expert radiologist. Analyze this medical image and generate a comprehensive radiological report.

`;

    // Add detection findings if available
    if (detections && detections.length > 0) {
      prompt += `AUTOMATED DETECTION FINDINGS:\n`;
      detections.forEach((det, idx) => {
        prompt += `${idx + 1}. ${det.label} detected with ${(det.confidence * 100).toFixed(1)}% confidence at region (${det.x}, ${det.y})\n`;
      });
      prompt += `\n`;
    }

    // Add patient context if available
    if (patientContext.age || patientContext.gender || patientContext.clinicalHistory) {
      prompt += `PATIENT CONTEXT:\n`;
      if (patientContext.age) prompt += `Age: ${patientContext.age}\n`;
      if (patientContext.gender) prompt += `Gender: ${patientContext.gender}\n`;
      if (patientContext.clinicalHistory) prompt += `Clinical History: ${patientContext.clinicalHistory}\n`;
      prompt += `\n`;
    }

    prompt += `Please provide a detailed radiological report with the following sections:

1. TECHNIQUE: Describe the imaging modality and technique used

2. FINDINGS: Provide detailed observations of the image, including:
   - Overall image quality
   - Anatomical structures visible
   - Any abnormalities detected (validate the automated findings above)
   - Size, location, and characteristics of any lesions or abnormalities
   - Comparison with normal anatomy

3. IMPRESSION: Summarize the key findings and provide a clinical interpretation

4. RECOMMENDATIONS: Suggest any follow-up imaging or clinical actions if needed

Format the report professionally as it would appear in a clinical setting.`;

    return prompt;
  }

  /**
   * Generate streaming report (for real-time display)
   */
  async generateStreamingReport(imageBuffer, detections = [], patientContext = {}) {
    try {
      console.log('Generating streaming medical report...');
      
      const base64Image = imageBuffer.toString('base64');
      const prompt = this.buildReportPrompt(detections, patientContext);
      
      const response = await axios.post(
        `${this.apiUrl}?key=${this.apiKey}&alt=sse`,
        {
          contents: [{
            parts: [
              {
                text: prompt
              },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: base64Image
                }
              }
            ]
          }],
          generationConfig: {
            maxOutputTokens: this.maxTokens,
            temperature: 0.4
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          responseType: 'stream',
          timeout: 60000
        }
      );
      
      return response.data;
      
    } catch (error) {
      console.error('Streaming report error:', error);
      throw new Error(`Streaming failed: ${error.message}`);
    }
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      const response = await axios.post(
        `${this.apiUrl}?key=${this.apiKey}`,
        {
          contents: [{
            parts: [{
              text: 'Hello, this is a test. Please respond with "OK".'
            }]
          }]
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );
      
      return {
        success: true,
        model: this.model,
        status: response.status
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: error.response?.status
      };
    }
  }
}

module.exports = new MedGemmaService();
