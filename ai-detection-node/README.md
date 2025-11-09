# 🏥 Medical AI Detection Service

Simple Node.js service for detecting abnormalities in medical images.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Service

```bash
npm start
```

The service will start on `http://localhost:5004`

### 3. Test the Service

```bash
curl http://localhost:5004/health
```

## 📋 API Endpoints

### Health Check

```bash
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "AI Detection Service",
  "version": "1.0.0",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

### Detect Abnormalities

```bash
POST /detect
Content-Type: application/json

{
  "image": "base64_encoded_image",
  "modality": "XR",
  "confidence_threshold": 0.5
}
```

**Response:**
```json
{
  "success": true,
  "detections": [
    {
      "id": "detection-1234567890-0",
      "type": "consolidation",
      "label": "Consolidation",
      "confidence": 0.78,
      "severity": "MEDIUM",
      "boundingBox": {
        "x": 0.35,
        "y": 0.45,
        "width": 0.15,
        "height": 0.12
      },
      "description": "Possible consolidation detected with 78% confidence...",
      "recommendations": [
        "Radiologist review recommended",
        "Clinical correlation advised"
      ],
      "measurements": {
        "area": "3.2 cm²"
      },
      "metadata": {
        "detectedAt": "2025-01-15T10:30:00Z",
        "model": "AI Detection Service v1.0",
        "modality": "XR"
      }
    }
  ],
  "metadata": {
    "total_detections": 1,
    "critical_count": 0,
    "high_count": 0,
    "medium_count": 1,
    "low_count": 0,
    "modality": "XR",
    "confidence_threshold": 0.5,
    "processed_at": "2025-01-15T10:30:00Z"
  }
}
```

### Batch Detection

```bash
POST /detect-batch
Content-Type: application/json

{
  "images": ["base64_image1", "base64_image2"],
  "modality": "CT",
  "confidence_threshold": 0.6
}
```

### Get Supported Modalities

```bash
GET /modalities
```

**Response:**
```json
{
  "success": true,
  "modalities": [
    {
      "code": "XR",
      "name": "X-Ray",
      "detection_types": ["pneumonia", "pneumothorax", "pleural_effusion", "cardiomegaly", "nodule", "fracture"]
    },
    {
      "code": "CT",
      "name": "CT Scan",
      "detection_types": ["fracture", "hemorrhage", "tumor", "lesion", "calcification", "pneumothorax"]
    }
  ]
}
```

## 🔧 Configuration

Create a `.env` file:

```bash
PORT=5004
CORS_ORIGIN=*
LOG_LEVEL=info
```

## 📦 Deployment

### Deploy to Heroku

```bash
# Login to Heroku
heroku login

# Create app
heroku create my-ai-detection-service

# Deploy
git push heroku main

# Open
heroku open
```

### Deploy to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize
railway init

# Deploy
railway up
```

### Deploy to Render

1. Push code to GitHub
2. Go to render.com
3. New Web Service
4. Connect repository
5. Deploy!

### Deploy to DigitalOcean App Platform

1. Push code to GitHub
2. Go to DigitalOcean
3. Create App
4. Connect repository
5. Deploy!

## 🐳 Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 5004

CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t ai-detection-service .
docker run -p 5004:5004 ai-detection-service
```

## 🌐 Connect to Your PACS

Update your backend `.env`:

```bash
AI_DETECTION_URL=http://localhost:5004
```

Or if deployed:

```bash
AI_DETECTION_URL=https://your-service.herokuapp.com
```

The system will automatically use this service for real detections!

## 🧪 Testing

### Test with curl:

```bash
# Health check
curl http://localhost:5004/health

# Test detection (with dummy base64)
curl -X POST http://localhost:5004/detect \
  -H "Content-Type: application/json" \
  -d '{
    "image": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "modality": "XR"
  }'
```

### Test with your PACS:

1. Start this service: `npm start`
2. Update backend `.env`: `AI_DETECTION_URL=http://localhost:5004`
3. Restart your backend
4. Run AI analysis in your viewer
5. See real detections!

## 📊 Features

- ✅ Simple Node.js service
- ✅ Easy to deploy anywhere
- ✅ Realistic mock detections
- ✅ Modality-specific findings
- ✅ Bounding box coordinates
- ✅ Clinical descriptions
- ✅ Recommendations
- ✅ Measurements
- ✅ Batch processing
- ✅ Health checks
- ✅ CORS enabled
- ✅ Error handling

## 🎯 Detection Types

### X-Ray (XR):
- Pneumonia
- Pneumothorax
- Pleural Effusion
- Cardiomegaly
- Nodule
- Fracture

### CT Scan:
- Fracture
- Hemorrhage
- Tumor
- Lesion
- Calcification

### MRI:
- Tumor
- Lesion
- Hemorrhage
- Infarct
- Edema

### Ultrasound (US):
- Mass
- Cyst
- Fluid Collection
- Calcification

## 🔒 Security

For production:

1. Add API key authentication
2. Rate limiting
3. Input validation
4. HTTPS only
5. Whitelist CORS origins

## 📝 License

MIT

## 🤝 Support

For issues or questions, please open an issue on GitHub.

---

**Ready to detect abnormalities!** 🎯
