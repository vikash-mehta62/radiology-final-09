/**
 * Auto Analysis Service
 * Handles automatic analysis triggering and report generation
 */

export interface SliceAnalysis {
  sliceIndex: number;
  status: 'pending' | 'analyzing' | 'complete' | 'failed';
  progress: number;
  analysisId?: string;
  results?: any;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface ConsolidatedReport {
  reportId: string;
  slices: number[];
  generatedAt: Date;
  downloadUrl: string;
  reportData?: any;
}

class AutoAnalysisService {
  private analyses: Map<number, SliceAnalysis> = new Map();
  private listeners: Set<(analyses: Map<number, SliceAnalysis>) => void> = new Set();

  /**
   * Auto-trigger analysis when popup opens
   */
  async autoAnalyze(params: {
    studyInstanceUID: string;
    seriesInstanceUID?: string;
    slices: number[];
    mode: 'single' | 'all';
  }): Promise<void> {
    const { studyInstanceUID, seriesInstanceUID, slices, mode } = params;

    console.log(`🚀 Auto-triggering analysis for ${slices.length} slice(s)`);

    // Initialize all slices as pending
    slices.forEach(sliceIndex => {
      this.analyses.set(sliceIndex, {
        sliceIndex,
        status: 'pending',
        progress: 0
      });
    });

    this.notifyListeners();

    // Analyze based on mode
    if (mode === 'single' && slices.length === 1) {
      await this.analyzeSingleSlice(studyInstanceUID, seriesInstanceUID, slices[0]);
    } else {
      await this.analyzeMultipleSlices(studyInstanceUID, seriesInstanceUID, slices);
    }
  }

  /**
   * Analyze single slice - Route through BACKEND (NO DIRECT AI CALLS)
   */
  private async analyzeSingleSlice(
    studyInstanceUID: string,
    seriesInstanceUID: string | undefined,
    sliceIndex: number
  ): Promise<void> {
    const analysis = this.analyses.get(sliceIndex);
    if (!analysis) return;

    try {
      analysis.status = 'analyzing';
      analysis.progress = 10;
      analysis.startedAt = new Date();
      this.notifyListeners();

      console.log(`🔬 [BACKEND] Analyzing slice ${sliceIndex} via backend API`);

      // Step 1: Get image from canvas
      const imageData = await this.getImageDataForSlice(studyInstanceUID, seriesInstanceUID, sliceIndex);
      analysis.progress = 20;
      this.notifyListeners();

      // Step 2: Call BACKEND API for AI analysis (proxied to AI services)
      console.log(`📊 [BACKEND] Calling backend AI analysis API...`);
      
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
      if (!token) {
        throw new Error('Authentication required');
      }

      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';
      
      const analysisResponse = await fetch(`${backendUrl}/api/ai/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          studyInstanceUID,
          seriesInstanceUID,
          frameIndex: sliceIndex,
          imageData: imageData.base64,
          modality: imageData.modality || 'OT',
          patientContext: imageData.patientContext || {}
        })
      });

      if (!analysisResponse.ok) {
        const errorData = await analysisResponse.json().catch(() => ({}));
        throw new Error(errorData.message || `Backend AI analysis failed (${analysisResponse.status})`);
      }

      const analysisResult = await analysisResponse.json();
      console.log(`✅ Backend AI analysis complete:`, analysisResult);

      analysis.progress = 90;
      this.notifyListeners();

      // Step 3: Extract results from backend response
      const analysisId = analysisResult.analysisId || `AI-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

      const combinedResults = {
        analysisId,
        studyInstanceUID,
        sliceIndex,
        analyzedAt: analysisResult.analyzedAt || new Date().toISOString(),

        // Classification (from backend)
        classification: analysisResult.classification || {
          label: 'Unknown',
          confidence: 0,
          topPredictions: [],
          model: 'Backend AI Service'
        },

        // Findings (from backend)
        findings: analysisResult.findings || [],

        // Report (from backend)
        report: analysisResult.report || {
          findings: 'Analysis completed',
          impression: 'Awaiting radiologist review',
          recommendations: [],
          model: 'Backend AI Service'
        },

        // Metadata
        modality: imageData.modality,
        patientContext: imageData.patientContext,
        imageSnapshot: imageData.base64,

        // Provenance (from backend)
        provenance: analysisResult.provenance || null,

        // Status
        status: 'complete',
        servicesUsed: analysisResult.servicesUsed || ['Backend AI Service']
      };

      // Update analysis
      analysis.status = 'complete';
      analysis.progress = 100;
      analysis.analysisId = analysisId;
      analysis.results = combinedResults;
      analysis.completedAt = new Date();

      console.log(`✅ [BACKEND] Analysis complete: ${analysisId}`);
      console.log(`   Classification: ${combinedResults.classification.label}`);
      console.log(`   Findings: ${combinedResults.findings.length}`);
      console.log(`   Report: Generated`);

    } catch (error) {
      console.error(`❌ [BACKEND] Analysis failed:`, error);
      analysis.status = 'failed';
      analysis.error = error instanceof Error ? error.message : 'Analysis failed';
    }

    this.notifyListeners();
  }

  /**
   * Get image data for a specific slice
   */
  private async getImageDataForSlice(
    studyInstanceUID: string,
    seriesInstanceUID: string | undefined,
    sliceIndex: number
  ): Promise<{
    base64: string;
    modality: string;
    patientContext: any;
  }> {
    // Get the canvas element from the viewer
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) {
      throw new Error('Canvas not found');
    }

    // Get base64 image data
    const base64 = canvas.toDataURL('image/png').split(',')[1];

    // Default metadata (since API might fail)
    let modality = 'XA'; // Default to XA for angiography
    let patientContext = {
      age: 'Unknown',
      sex: 'Unknown',
      clinicalHistory: `Slice ${sliceIndex} analysis`
    };

    // Try to get study metadata (but don't fail if it doesn't work)
    try {
      const studyResponse = await fetch(`/api/studies/${studyInstanceUID}`);
      if (studyResponse.ok) {
        const studyData = await studyResponse.json();
        modality = studyData.modality || modality;
        patientContext = {
          age: studyData.patientAge || patientContext.age,
          sex: studyData.patientSex || patientContext.sex,
          clinicalHistory: studyData.studyDescription || patientContext.clinicalHistory
        };
        console.log(`✅ Got study metadata: ${modality}`);
      } else {
        console.warn(`⚠️ Study API returned ${studyResponse.status}, using defaults`);
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch study metadata, using defaults:', error);
    }

    return {
      base64,
      modality,
      patientContext
    };
  }



  /**
   * Analyze multiple slices
   */
  private async analyzeMultipleSlices(
    studyInstanceUID: string,
    seriesInstanceUID: string | undefined,
    slices: number[]
  ): Promise<void> {
    console.log(`📊 Analyzing ${slices.length} slices in batches...`);

    // Analyze slices in batches of 3 for performance
    const batchSize = 3;
    let completedCount = 0;

    for (let i = 0; i < slices.length; i += batchSize) {
      const batch = slices.slice(i, i + batchSize);

      console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(slices.length / batchSize)}`);

      await Promise.all(
        batch.map(sliceIndex =>
          this.analyzeSingleSlice(studyInstanceUID, seriesInstanceUID, sliceIndex)
        )
      );

      completedCount += batch.length;
      console.log(`📈 Progress: ${completedCount}/${slices.length} slices analyzed`);
    }

    console.log(`✅ All ${slices.length} slices analyzed successfully`);
  }

  /**
   * Retry failed analysis
   */
  async retryAnalysis(
    studyInstanceUID: string,
    seriesInstanceUID: string | undefined,
    sliceIndex: number
  ): Promise<void> {
    console.log(`🔄 Retrying analysis for slice ${sliceIndex}`);

    const analysis = this.analyses.get(sliceIndex);
    if (analysis) {
      analysis.status = 'pending';
      analysis.error = undefined;
      this.notifyListeners();
    }

    await this.analyzeSingleSlice(studyInstanceUID, seriesInstanceUID, sliceIndex);
  }

  /**
   * Generate consolidated report for multiple slices - DIRECT (NO BACKEND)
   */
  async generateConsolidatedReport(
    studyInstanceUID: string,
    slices: number[]
  ): Promise<ConsolidatedReport> {
    console.log(`📄 [DIRECT] Generating consolidated report for ${slices.length} slices...`);

    // Get all completed analyses
    const completedAnalyses = slices
      .map(slice => this.analyses.get(slice))
      .filter(a => a && a.status === 'complete' && a.results);

    if (completedAnalyses.length === 0) {
      throw new Error('No completed analyses found. Please ensure all slices are analyzed first.');
    }

    console.log(`📊 Found ${completedAnalyses.length} completed analyses`);

    const reportId = `CONSOLIDATED-${Date.now()}`;

    return {
      reportId,
      slices,
      generatedAt: new Date(),
      downloadUrl: '', // Not needed, we generate PDF directly
      reportData: completedAnalyses.map(a => a!.results)
    };
  }

  /**
   * Download report for single slice - Generate PDF directly in frontend
   */
  async downloadSliceReport(sliceIndex: number): Promise<void> {
    const analysis = this.analyses.get(sliceIndex);
    if (!analysis?.results) {
      throw new Error('No analysis results found for this slice');
    }

    console.log(`📥 [DIRECT] Generating PDF report for slice ${sliceIndex}...`);

    try {
      const results = analysis.results;

      // Generate PDF content as HTML
      const pdfContent = this.generatePDFHTML(results, sliceIndex);

      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      printWindow.document.write(pdfContent);
      printWindow.document.close();

      // Wait for content to load then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 500);
      };

      console.log(`✅ PDF report opened for slice ${sliceIndex}`);
    } catch (error) {
      console.error(`❌ Failed to generate report for slice ${sliceIndex}:`, error);
      throw error;
    }
  }

  /**
   * Generate PDF HTML content
   */
  private generatePDFHTML(results: any, sliceIndex: number): string {
    const date = new Date().toLocaleString();

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>AI Analysis Report - Slice ${sliceIndex}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 40px;
      line-height: 1.6;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #667eea;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #667eea;
      margin: 0;
    }
    .section {
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    .section-title {
      background: #667eea;
      color: white;
      padding: 10px;
      font-weight: bold;
      font-size: 16px;
    }
    .section-content {
      padding: 15px;
      border: 1px solid #ddd;
    }
    .finding-item {
      background: #f5f5f5;
      padding: 10px;
      margin: 10px 0;
      border-left: 4px solid #667eea;
    }
    .metadata {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 20px;
    }
    .metadata-item {
      padding: 8px;
      background: #f9f9f9;
    }
    .confidence {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-weight: bold;
      font-size: 14px;
    }
    .confidence-high { background: #4caf50; color: white; }
    .confidence-medium { background: #ff9800; color: white; }
    .confidence-low { background: #f44336; color: white; }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 2px solid #ddd;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
    @media print {
      body { margin: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🏥 AI Medical Analysis Report</h1>
    <p>Powered by MedSigLIP & MedGemma</p>
    <p style="font-size: 14px; color: #666;">Generated: ${date}</p>
  </div>

  <div class="metadata">
    <div class="metadata-item">
      <strong>Analysis ID:</strong> ${results.analysisId}
    </div>
    <div class="metadata-item">
      <strong>Slice Index:</strong> ${sliceIndex}
    </div>
    <div class="metadata-item">
      <strong>Study UID:</strong> ${results.studyInstanceUID}
    </div>
    <div class="metadata-item">
      <strong>Modality:</strong> ${results.modality}
    </div>
  </div>

  <div class="section">
    <div class="section-title">📊 CLASSIFICATION (MedSigLIP)</div>
    <div class="section-content">
      <p><strong>Primary Finding:</strong> ${results.classification.label}</p>
      <p><strong>Confidence:</strong> 
        <span class="confidence ${results.classification.confidence > 0.8 ? 'confidence-high' : results.classification.confidence > 0.5 ? 'confidence-medium' : 'confidence-low'}">
          ${(results.classification.confidence * 100).toFixed(1)}%
        </span>
      </p>
      ${results.classification.topPredictions && results.classification.topPredictions.length > 0 ? `
        <p><strong>Top Predictions:</strong></p>
        <ul>
          ${results.classification.topPredictions.map((p: any) =>
      `<li>${p.label || p.class}: ${((p.confidence || p.score) * 100).toFixed(1)}%</li>`
    ).join('')}
        </ul>
      ` : ''}
    </div>
  </div>

  ${results.findings && results.findings.length > 0 ? `
  <div class="section">
    <div class="section-title">🔍 DETAILED FINDINGS (${results.findings.length})</div>
    <div class="section-content">
      ${results.findings.map((finding: any, idx: number) => `
        <div class="finding-item">
          <strong>${idx + 1}. ${finding.type}</strong>
          ${finding.confidence ? `<span class="confidence ${finding.confidence > 0.8 ? 'confidence-high' : finding.confidence > 0.5 ? 'confidence-medium' : 'confidence-low'}">${(finding.confidence * 100).toFixed(1)}%</span>` : ''}
          ${finding.description ? `<p>${finding.description}</p>` : ''}
          ${finding.location ? `<p><em>Location: ${JSON.stringify(finding.location)}</em></p>` : ''}
          ${finding.severity ? `<p><strong>Severity:</strong> ${finding.severity.toUpperCase()}</p>` : ''}
        </div>
      `).join('')}
    </div>
  </div>
  ` : ''}

  <div class="section">
    <div class="section-title">📝 CLINICAL REPORT (MedGemma)</div>
    <div class="section-content">
      <h3>FINDINGS:</h3>
      <p style="white-space: pre-wrap;">${results.report.findings}</p>
      
      <h3>IMPRESSION:</h3>
      <p style="white-space: pre-wrap;">${results.report.impression}</p>
      
      ${results.report.recommendations && results.report.recommendations.length > 0 ? `
        <h3>RECOMMENDATIONS:</h3>
        <ul>
          ${results.report.recommendations.map((rec: string) => `<li>${rec}</li>`).join('')}
        </ul>
      ` : ''}
    </div>
  </div>

  ${results.patientContext && Object.keys(results.patientContext).length > 0 ? `
  <div class="section">
    <div class="section-title">👤 PATIENT INFORMATION</div>
    <div class="section-content">
      ${results.patientContext.age ? `<p><strong>Age:</strong> ${results.patientContext.age}</p>` : ''}
      ${results.patientContext.sex ? `<p><strong>Sex:</strong> ${results.patientContext.sex}</p>` : ''}
      ${results.patientContext.clinicalHistory ? `<p><strong>Clinical History:</strong> ${results.patientContext.clinicalHistory}</p>` : ''}
    </div>
  </div>
  ` : ''}

  <div class="section">
    <div class="section-title">⚙️ TECHNICAL DETAILS</div>
    <div class="section-content">
      <p><strong>AI Models Used:</strong> ${results.servicesUsed.join(', ')}</p>
      <p><strong>Analysis Status:</strong> ${results.status}</p>
      <p><strong>Analyzed At:</strong> ${new Date(results.analyzedAt).toLocaleString()}</p>
    </div>
  </div>

  <div class="footer">
    <p><strong>⚠️ DISCLAIMER:</strong> This report was generated by AI and must be reviewed by a qualified radiologist.</p>
    <p>AI-generated results are for assistance only and not for final diagnosis.</p>
    <p>© ${new Date().getFullYear()} Medical AI Analysis System</p>
  </div>

  <script>
    // Auto-print on load
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
    `;
  }

  /**
   * Download consolidated report - Generate PDF directly
   */
  async downloadConsolidatedReport(report: ConsolidatedReport): Promise<void> {
    console.log(`📥 [DIRECT] Generating consolidated PDF report...`);

    try {
      if (!report.reportData || report.reportData.length === 0) {
        throw new Error('No report data available');
      }

      // Generate consolidated PDF HTML
      const pdfContent = this.generateConsolidatedPDFHTML(report);

      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      printWindow.document.write(pdfContent);
      printWindow.document.close();

      // Wait for content to load then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 500);
      };

      console.log(`✅ Consolidated PDF report opened`);
    } catch (error) {
      console.error(`❌ Failed to generate consolidated report:`, error);
      throw error;
    }
  }

  /**
   * Generate consolidated PDF HTML
   */
  private generateConsolidatedPDFHTML(report: ConsolidatedReport): string {
    const date = new Date().toLocaleString();
    const allResults = report.reportData || [];

    // Calculate summary statistics
    const totalFindings = allResults.reduce((sum, r) => sum + (r.findings?.length || 0), 0);
    const avgConfidence = allResults.reduce((sum, r) => sum + (r.classification?.confidence || 0), 0) / allResults.length;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Consolidated AI Analysis Report</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 40px;
      line-height: 1.6;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #667eea;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #667eea;
      margin: 0;
    }
    .summary-box {
      background: #f0f4ff;
      border: 2px solid #667eea;
      padding: 20px;
      margin: 20px 0;
      border-radius: 8px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-top: 15px;
    }
    .summary-item {
      text-align: center;
      padding: 15px;
      background: white;
      border-radius: 4px;
    }
    .summary-value {
      font-size: 32px;
      font-weight: bold;
      color: #667eea;
    }
    .slice-section {
      margin: 30px 0;
      page-break-inside: avoid;
      border: 1px solid #ddd;
      padding: 20px;
      border-radius: 8px;
    }
    .slice-header {
      background: #667eea;
      color: white;
      padding: 10px;
      margin: -20px -20px 15px -20px;
      border-radius: 8px 8px 0 0;
      font-weight: bold;
    }
    .finding-item {
      background: #f5f5f5;
      padding: 10px;
      margin: 10px 0;
      border-left: 4px solid #667eea;
    }
    .confidence {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-weight: bold;
      font-size: 14px;
    }
    .confidence-high { background: #4caf50; color: white; }
    .confidence-medium { background: #ff9800; color: white; }
    .confidence-low { background: #f44336; color: white; }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 2px solid #ddd;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
    @media print {
      body { margin: 20px; }
      .slice-section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🏥 Consolidated AI Analysis Report</h1>
    <p>Multi-Slice Analysis - Powered by MedSigLIP & MedGemma</p>
    <p style="font-size: 14px; color: #666;">Generated: ${date}</p>
  </div>

  <div class="summary-box">
    <h2 style="margin-top: 0;">📊 Summary Statistics</h2>
    <div class="summary-grid">
      <div class="summary-item">
        <div class="summary-value">${allResults.length}</div>
        <div>Slices Analyzed</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${totalFindings}</div>
        <div>Total Findings</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${(avgConfidence * 100).toFixed(1)}%</div>
        <div>Avg Confidence</div>
      </div>
    </div>
  </div>

  <h2>📋 Per-Slice Analysis</h2>
  
  ${allResults.map((result, idx) => `
    <div class="slice-section">
      <div class="slice-header">
        Slice ${result.sliceIndex} - ${result.classification.label}
        <span class="confidence ${result.classification.confidence > 0.8 ? 'confidence-high' : result.classification.confidence > 0.5 ? 'confidence-medium' : 'confidence-low'}">
          ${(result.classification.confidence * 100).toFixed(1)}%
        </span>
      </div>
      
      <h3>Classification:</h3>
      <p><strong>${result.classification.label}</strong></p>
      
      ${result.findings && result.findings.length > 0 ? `
        <h3>Findings (${result.findings.length}):</h3>
        ${result.findings.map((finding: any, fidx: number) => `
          <div class="finding-item">
            <strong>${fidx + 1}. ${finding.type}</strong>
            ${finding.confidence ? `<span class="confidence ${finding.confidence > 0.8 ? 'confidence-high' : finding.confidence > 0.5 ? 'confidence-medium' : 'confidence-low'}">${(finding.confidence * 100).toFixed(1)}%</span>` : ''}
            ${finding.description ? `<p>${finding.description}</p>` : ''}
          </div>
        `).join('')}
      ` : '<p><em>No specific findings detected</em></p>'}
      
      <h3>Clinical Report:</h3>
      <p style="white-space: pre-wrap; font-size: 14px;">${result.report.findings}</p>
      
      <h3>Impression:</h3>
      <p style="white-space: pre-wrap; font-size: 14px;"><strong>${result.report.impression}</strong></p>
    </div>
  `).join('')}

  <div class="footer">
    <p><strong>⚠️ DISCLAIMER:</strong> This consolidated report was generated by AI and must be reviewed by a qualified radiologist.</p>
    <p>AI-generated results are for assistance only and not for final diagnosis.</p>
    <p>© ${new Date().getFullYear()} Medical AI Analysis System</p>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
    `;
  }

  /**
   * Get analysis status for a slice
   */
  getSliceAnalysis(sliceIndex: number): SliceAnalysis | undefined {
    return this.analyses.get(sliceIndex);
  }

  /**
   * Get all analyses
   */
  getAllAnalyses(): Map<number, SliceAnalysis> {
    return new Map(this.analyses);
  }

  /**
   * Check if all slices are complete
   */
  areAllComplete(): boolean {
    return Array.from(this.analyses.values()).every(
      analysis => analysis.status === 'complete'
    );
  }

  /**
   * Get completion percentage
   */
  getCompletionPercentage(): number {
    const total = this.analyses.size;
    if (total === 0) return 0;

    const complete = Array.from(this.analyses.values()).filter(
      analysis => analysis.status === 'complete'
    ).length;

    return Math.round((complete / total) * 100);
  }

  /**
   * Subscribe to analysis updates
   */
  subscribe(listener: (analyses: Map<number, SliceAnalysis>) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.getAllAnalyses()));
  }

  /**
   * Clear all analyses
   */
  clear(): void {
    this.analyses.clear();
    this.notifyListeners();
  }

  /**
   * Check AI services health - Route through BACKEND
   */
  async checkHealth(): Promise<{
    backend: boolean;
    aiServices: {
      medsiglip: boolean;
      medgemma: boolean;
    };
    message: string;
  }> {
    console.log('🏥 [BACKEND] Checking AI services health via backend...');

    const health = {
      backend: false,
      aiServices: {
        medsiglip: false,
        medgemma: false
      },
      message: ''
    };

    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';
      
      const healthResponse = await fetch(`${backendUrl}/api/medical-ai/health`, {
        method: 'GET',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        signal: AbortSignal.timeout(5000)
      });

      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        health.backend = true;
        health.aiServices.medsiglip = healthData.medSigLIP?.available || false;
        health.aiServices.medgemma = healthData.medGemma4B?.available || false;
        
        console.log(`✅ Backend: Available`);
        console.log(`🔍 MedSigLIP: ${health.aiServices.medsiglip ? '✅ Available' : '❌ Unavailable'}`);
        console.log(`📝 MedGemma: ${health.aiServices.medgemma ? '✅ Available' : '❌ Unavailable'}`);
        
        // Set message
        if (health.aiServices.medsiglip && health.aiServices.medgemma) {
          health.message = '✅ All AI services operational via backend';
        } else if (!health.aiServices.medsiglip && !health.aiServices.medgemma) {
          health.message = '❌ AI services not available. Please start AI services on backend.';
        } else {
          const missing = !health.aiServices.medsiglip ? 'MedSigLIP' : 'MedGemma';
          health.message = `⚠️ ${missing} not available. Analysis may be limited.`;
        }
      } else {
        throw new Error(`Backend health check failed (${healthResponse.status})`);
      }
    } catch (error) {
      console.error('❌ Backend health check failed:', error);
      health.backend = false;
      health.message = '❌ Cannot connect to backend. Please ensure backend server is running.';
    }

    return health;
  }

  /**
   * Get analysis results
   */
  getAnalysisResults(sliceIndex: number): any {
    return this.analyses.get(sliceIndex)?.results;
  }

  /**
   * Get failed analyses
   */
  getFailedAnalyses(): number[] {
    return Array.from(this.analyses.entries())
      .filter(([_, analysis]) => analysis.status === 'failed')
      .map(([sliceIndex]) => sliceIndex);
  }

  /**
   * Retry all failed analyses
   */
  async retryAllFailed(
    studyInstanceUID: string,
    seriesInstanceUID: string | undefined
  ): Promise<void> {
    const failedSlices = this.getFailedAnalyses();

    if (failedSlices.length === 0) {
      console.log('No failed analyses to retry');
      return;
    }

    console.log(`🔄 Retrying ${failedSlices.length} failed analyses...`);

    for (const sliceIndex of failedSlices) {
      await this.retryAnalysis(studyInstanceUID, seriesInstanceUID, sliceIndex);
    }
  }
}

// Singleton instance
export const autoAnalysisService = new AutoAnalysisService();
