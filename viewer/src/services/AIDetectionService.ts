export interface Detection {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  confidence: number;
  allScores?: Record<string, number>;
}

export interface DetectionResult {
  success: boolean;
  detections: Detection[];
  metadata: {
    imageWidth: number;
    imageHeight: number;
    gridSize: number;
    regionsProcessed: number;
    model: string;
  };
}

export interface ReportResult {
  success: boolean;
  report: string;
  detections: Detection[];
  metadata: {
    model: string;
    timestamp: string;
    detectionsCount: number;
  };
}

export interface AnalysisResult {
  success: boolean;
  detections: Detection[];
  metadata: any;
  report: string;
  timestamp: string;
}

export interface PatientContext {
  age?: string;
  gender?: string;
  clinicalHistory?: string;
}

class AIDetectionService {
  private baseUrl: string;

  constructor() {
    // Get backend URL - use relative URL in development for proxy
    if (import.meta.env && import.meta.env.DEV) {
      this.baseUrl = ''; // Use relative URLs for Vite proxy
    } else {
      this.baseUrl = import.meta.env?.VITE_BACKEND_URL || 'http://3.144.196.75:8001';
    }
  }

  /**
   * Detect abnormalities in medical image using MedSigLIP
   */
  async detectAbnormalities(imageFile: File): Promise<DetectionResult> {
    const formData = new FormData();
    formData.append('image', imageFile);

    const response = await fetch(`${this.baseUrl}/api/ai/detect`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Detection failed');
    }

    return await response.json();
  }

  /**
   * Generate medical report using MedGemma
   */
  async generateReport(
    imageFile: File,
    detections: Detection[] = [],
    patientContext: PatientContext = {}
  ): Promise<ReportResult> {
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('detections', JSON.stringify(detections));
    formData.append('patientContext', JSON.stringify(patientContext));

    const response = await fetch(`${this.baseUrl}/api/ai/report`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Report generation failed');
    }

    return await response.json();
  }

  /**
   * Complete analysis: Detection + Report
   */
  async analyzeImage(
    imageFile: File,
    patientContext: PatientContext = {}
  ): Promise<AnalysisResult> {
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('patientContext', JSON.stringify(patientContext));

    const response = await fetch(`${this.baseUrl}/api/ai/analyze`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Analysis failed');
    }

    return await response.json();
  }

  /**
   * Generate streaming report (for real-time display)
   */
  async generateStreamingReport(
    imageFile: File,
    detections: Detection[] = [],
    patientContext: PatientContext = {},
    onChunk: (text: string) => void
  ): Promise<void> {
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('detections', JSON.stringify(detections));
    formData.append('patientContext', JSON.stringify(patientContext));

    const response = await fetch(`${this.baseUrl}/api/ai/report-stream`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Streaming failed');
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No response body');
    }

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            return;
          }
          onChunk(data);
        }
      }
    }
  }

  /**
   * Test AI service connections
   */
  async testConnection(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/ai/test`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Connection test failed');
    }

    return await response.json();
  }

  /**
   * Get AI service status
   */
  async getStatus(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/ai/status`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to get status');
    }

    return await response.json();
  }

  /**
   * Convert image blob to File
   */
  blobToFile(blob: Blob, filename: string): File {
    return new File([blob], filename, { type: blob.type });
  }

  /**
   * Convert canvas to File
   */
  async canvasToFile(canvas: HTMLCanvasElement, filename: string = 'image.jpg'): Promise<File> {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(this.blobToFile(blob, filename));
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      }, 'image/jpeg', 0.9);
    });
  }
}

export default new AIDetectionService();
