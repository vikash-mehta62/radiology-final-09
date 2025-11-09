# 🤖 Medical AI Integration Guide

## Overview

This guide explains how to integrate **MedSigLIP** and **MedGemma** AI models into your medical imaging platform.

---

## 🎯 AI Models Overview

### **MedSigLIP** (0.4B parameters)
- **Purpose**: Fast medical image classification and retrieval
- **Use Cases**:
  - Classify X-rays, CT scans, MRIs
  - Find similar medical images
  - Extract image features for search
- **Resource Requirements**: 
  - GPU: 4GB VRAM (or CPU with slower performance)
  - RAM: 4GB
  - Inference Time: 50-200ms per image

### **MedGemma-4B** (4B parameters)
- **Purpose**: Radiology report generation
- **Use Cases**:
  - Generate structured radiology reports
  - Multimodal clinical reasoning (image + text)
  - Medical text summarization
- **Resource Requirements**:
  - GPU: 16GB VRAM (or CPU with much slower performance)
  - RAM: 16GB
  - Inference Time: 5-15 seconds per report

### **MedGemma-27B** (27B parameters) - Optional
- **Purpose**: Advanced clinical reasoning
- **Use Cases**:
  - Comprehensive clinical reasoning
  - EHR summarization and retrieval
  - Complex differential diagnosis
- **Resource Requirements**:
  - GPU: 48GB VRAM (2x A100 or 1x A100 80GB)
  - RAM: 64GB
  - Inference Time: 30-60 seconds per analysis

---

## 🚀 Quick Start

### **Option 1: Docker Deployment (Recommended)**

```bash
# Start MedSigLIP + MedGemma-4B (basic setup)
docker-compose -f docker-compose.ai-services.yml up -d medsigclip medgemma-4b

# Start all services including MedGemma-27B (advanced setup)
docker-compose -f docker-compose.ai-services.yml --profile advanced up -d

# Check service health
curl http://localhost:5001/health  # MedSigLIP
curl http://localhost:5002/health  # MedGemma-4B
curl http://localhost:5003/health  # MedGemma-27B (if enabled)
```

### **Option 2: Manual Installation**

```bash
# Install dependencies
pip install torch transformers accelerate bitsandbytes

# Download models
python scripts/download-ai-models.py --models medsigclip medgemma-4b

# Start services
python ai-services/medsigclip-server.py --port 5001
python ai-services/medgemma-4b-server.py --port 5002
```

---

## 📊 Architecture Integration

```
┌─────────────────────────────────────────────────┐
│           Medical Imaging Platform              │
├─────────────────────────────────────────────────┤
│                                                 │
│  DICOM Upload → Orthanc → Frame Extraction     │
│                     │                           │
│                     ├──► MedSigLIP              │
│                     │    • Image classification │
│                     │    • Feature extraction   │
│                     │    • Similarity search    │
│                     │                           │
│                     ├──► MedGemma-4B            │
│                     │    • Report generation    │
│                     │    • Clinical reasoning   │
│                     │    • Text summarization   │
│                     │                           │
│                     └──► MedGemma-27B (optional)│
│                          • Advanced reasoning   │
│                          • EHR integration      │
│                          • Complex diagnosis    │
│                                                 │
│  Results → MongoDB → Viewer UI                  │
└─────────────────────────────────────────────────┘
```

---

## 🔧 API Endpoints

### **Comprehensive Analysis**
```bash
POST /api/medical-ai/analyze-study
{
  "studyInstanceUID": "1.2.3.4.5...",
  "frameIndex": 0,
  "patientContext": {
    "age": 45,
    "sex": "M",
    "clinicalHistory": "Chest pain",
    "indication": "Rule out pneumonia"
  }
}
```

### **Image Classification**
```bash
POST /api/medical-ai/classify-image
{
  "studyInstanceUID": "1.2.3.4.5...",
  "frameIndex": 0
}
```

### **Report Generation**
```bash
POST /api/medical-ai/generate-report
{
  "studyInstanceUID": "1.2.3.4.5...",
  "frameIndex": 0,
  "patientContext": {
    "age": 45,
    "sex": "M",
    "clinicalHistory": "Chest pain"
  }
}
```

### **Find Similar Images**
```bash
POST /api/medical-ai/find-similar
{
  "studyInstanceUID": "1.2.3.4.5...",
  "frameIndex": 0,
  "topK": 5
}
```

### **Health Check**
```bash
GET /api/medical-ai/health
```

---

## 💻 Frontend Integration

### **Add AI Analysis Panel**

```typescript
// viewer/src/components/ai/AIAnalysisPanel.tsx
import React, { useEffect, useState } from 'react';
import { Box, Typography, Chip, CircularProgress } from '@mui/material';
import ApiService from '../../services/ApiService';

interface AIAnalysisPanelProps {
  studyInstanceUID: string;
  frameIndex: number;
}

export const AIAnalysisPanel: React.FC<AIAnalysisPanelProps> = ({
  studyInstanceUID,
  frameIndex
}) => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadAnalysis = async () => {
      setLoading(true);
      try {
        const result = await ApiService.analyzeStudyWithAI(
          studyInstanceUID,
          frameIndex
        );
        setAnalysis(result.data);
      } catch (error) {
        console.error('AI analysis failed:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAnalysis();
  }, [studyInstanceUID, frameIndex]);

  if (loading) {
    return <CircularProgress />;
  }

  if (!analysis) {
    return <Typography>No AI analysis available</Typography>;
  }

  return (
    <Box sx={{ p: 2 }}>
      {/* Classification Results */}
      {analysis.analyses.classification && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6">🔍 Classification</Typography>
          <Chip 
            label={analysis.analyses.classification.classification}
            color="primary"
          />
          <Typography variant="caption">
            Confidence: {(analysis.analyses.classification.confidence * 100).toFixed(1)}%
          </Typography>
        </Box>
      )}

      {/* Generated Report */}
      {analysis.analyses.report && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6">📝 AI-Generated Report</Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            <strong>Findings:</strong>
            {analysis.analyses.report.findings}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            <strong>Impression:</strong>
            {analysis.analyses.report.impression}
          </Typography>
        </Box>
      )}
    </Box>
  );
};
```

### **Add to ApiService**

```typescript
// viewer/src/services/ApiService.ts
class ApiService {
  // ... existing methods ...

  async analyzeStudyWithAI(studyInstanceUID: string, frameIndex: number = 0) {
    return await axios.post('/api/medical-ai/analyze-study', {
      studyInstanceUID,
      frameIndex
    });
  }

  async classifyImage(studyInstanceUID: string, frameIndex: number = 0) {
    return await axios.post('/api/medical-ai/classify-image', {
      studyInstanceUID,
      frameIndex
    });
  }

  async generateReport(studyInstanceUID: string, frameIndex: number = 0, patientContext: any = {}) {
    return await axios.post('/api/medical-ai/generate-report', {
      studyInstanceUID,
      frameIndex,
      patientContext
    });
  }

  async findSimilarImages(studyInstanceUID: string, frameIndex: number = 0, topK: number = 5) {
    return await axios.post('/api/medical-ai/find-similar', {
      studyInstanceUID,
      frameIndex,
      topK
    });
  }
}
```

---

## ⚙️ Configuration

### **Environment Variables**

```bash
# .env
MEDSIGCLIP_API_URL=http://localhost:5001
MEDSIGCLIP_ENABLED=true

MEDGEMMA_4B_API_URL=http://localhost:5002
MEDGEMMA_4B_ENABLED=true

MEDGEMMA_27B_API_URL=http://localhost:5003
MEDGEMMA_27B_ENABLED=false  # Disable by default (high resource)
```

### **Feature Flags**

```javascript
// server/src/index.js
const { getMedicalAIService } = require('./services/medical-ai-service');

const medicalAIService = getMedicalAIService({
  enableMedSigLIP: process.env.MEDSIGCLIP_ENABLED === 'true',
  enableMedGemma4B: process.env.MEDGEMMA_4B_ENABLED === 'true',
  enableMedGemma27B: process.env.MEDGEMMA_27B_ENABLED === 'true'
});
```

---

## 📈 Performance Optimization

### **Caching Strategy**

```javascript
// Cache AI results to avoid reprocessing
const cacheKey = `ai:${studyInstanceUID}:${frameIndex}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const results = await medicalAIService.analyzeStudy(...);
await redis.setex(cacheKey, 3600, JSON.stringify(results)); // Cache for 1 hour
```

### **Batch Processing**

```javascript
// Process multiple frames in parallel
const framePromises = frameIndices.map(index =>
  medicalAIService.classifyImage(frameBuffer[index], modality)
);

const results = await Promise.all(framePromises);
```

### **GPU Optimization**

```yaml
# docker-compose.ai-services.yml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: 1
          capabilities: [gpu]
```

---

## 🔒 Security & Compliance

### **HIPAA Compliance**
- ✅ All AI processing happens on-premises
- ✅ No data sent to external APIs
- ✅ Results stored in encrypted MongoDB
- ✅ Audit logging for all AI operations

### **Clinical Validation**
- ⚠️ **IMPORTANT**: AI-generated reports MUST be reviewed by licensed radiologists
- ⚠️ All AI results marked with `requiresReview: true`
- ⚠️ Not FDA-approved for clinical diagnosis

---

## 🧪 Testing

```bash
# Test AI services
npm run test:ai

# Test specific model
curl -X POST http://3.144.196.75:8001/api/medical-ai/classify-image \
  -H "Content-Type: application/json" \
  -d '{"studyInstanceUID": "1.2.3.4.5", "frameIndex": 0}'
```

---

## 📊 Monitoring

```bash
# Check AI service health
curl http://3.144.196.75:8001/api/medical-ai/health

# View AI analysis for a study
curl http://3.144.196.75:8001/api/medical-ai/study/1.2.3.4.5/analysis
```

---

## 🎯 Use Cases

### **1. Automated Preliminary Findings**
- AI analyzes uploaded studies automatically
- Radiologist reviews AI-generated report
- Faster turnaround time

### **2. Quality Assurance**
- AI flags potential missed findings
- Second opinion for complex cases
- Consistency checking

### **3. Similar Case Retrieval**
- Find similar historical cases
- Educational purposes
- Research and analysis

### **4. Report Assistance**
- AI generates draft report
- Radiologist edits and finalizes
- Standardized reporting

---

## 💰 Cost Analysis

| Model | GPU Required | Monthly Cost (Cloud) | Inference Time |
|-------|-------------|---------------------|----------------|
| MedSigLIP-0.4B | 4GB VRAM | $50-100 | 50-200ms |
| MedGemma-4B | 16GB VRAM | $200-400 | 5-15s |
| MedGemma-27B | 48GB VRAM | $800-1500 | 30-60s |

**Recommendation**: Start with MedSigLIP + MedGemma-4B for optimal cost/performance.

---

## 🚀 Next Steps

1. ✅ Deploy AI services with Docker
2. ✅ Test API endpoints
3. ✅ Integrate AI panel into viewer
4. ✅ Configure caching and optimization
5. ✅ Set up monitoring and alerts
6. ✅ Train staff on AI-assisted workflow

---

## 📚 Resources

- [MedSigLIP Paper](https://arxiv.org/abs/...)
- [MedGemma Documentation](https://github.com/google/medgemma)
- [Medical AI Best Practices](https://...)

---

**Last Updated**: $(date)
