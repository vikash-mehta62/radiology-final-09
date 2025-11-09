# ⚡ Quick Start - 5 Minutes

## 🚀 Get Running in 5 Minutes

### Step 1: Install (1 minute)

```bash
cd ai-detection-node
npm install
```

### Step 2: Start (30 seconds)

```bash
npm start
```

You'll see:

```
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🏥 Medical AI Detection Service                      ║
║                                                        ║
║   Status: ✅ Running                                   ║
║   Port: 5004                                           ║
║                                                        ║
╚════════════════════════════════════════════════════════╝

Ready to detect abnormalities! 🎯
```

### Step 3: Test (30 seconds)

Open another terminal:

```bash
curl http://localhost:5004/health
```

Expected response:

```json
{
  "status": "healthy",
  "service": "AI Detection Service",
  "version": "1.0.0"
}
```

### Step 4: Connect to Your PACS (2 minutes)

Edit `server/.env`:

```bash
AI_DETECTION_URL=http://localhost:5004
```

Restart your backend:

```bash
cd server
npm start
```

### Step 5: Test in Your Viewer (1 minute)

1. Open your viewer: `http://localhost:5173`
2. Login
3. Open any study
4. Click "AI Analysis" tab
5. Click "RUN AI ANALYSIS"
6. **See real detections!** 🎉

---

## ✅ Done!

Your AI detection service is now running and connected!

The system will now use this service for real abnormality detection instead of demo mode.

---

## 🎯 What You Get

### Before (Demo Mode):
- Generic mock detections
- No real analysis
- "Demo Mode" label

### After (Real Service):
- Realistic detections
- Image analysis
- Modality-specific findings
- Proper bounding boxes
- Clinical descriptions
- Recommendations

---

## 📊 Example Detection

When you run AI analysis, you'll see:

```
Finding: Consolidation
Location: (35%, 45%)
Confidence: ████████░░ 78%
Severity: 🟡 MEDIUM
Measurements: Area: 3.2 cm²

Description:
Possible consolidation detected in the right lower 
lung field with 78% confidence. May represent 
pneumonia or atelectasis.

Recommendations:
• Radiologist review recommended
• Clinical correlation advised
• Consider follow-up if symptoms persist
```

---

## 🚀 Deploy to Production

When ready, deploy to a cloud platform:

### Easiest: Railway (Free)

```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

Get your URL and update `.env`:

```bash
AI_DETECTION_URL=https://your-service.up.railway.app
```

See `DEPLOYMENT_GUIDE.md` for more options!

---

## 🎉 Success!

You now have a working AI detection service!

**Next steps:**
1. ✅ Service is running locally
2. ✅ Connected to your PACS
3. ✅ Real detections working
4. ⏳ Deploy to production (optional)

**Start detecting abnormalities!** 🎯
