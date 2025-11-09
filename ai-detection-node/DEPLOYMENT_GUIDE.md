# 🚀 Deployment Guide - AI Detection Service

## Quick Deploy Options

### Option 1: Heroku (Easiest - Free Tier Available)

```bash
# 1. Install Heroku CLI
# Download from: https://devcenter.heroku.com/articles/heroku-cli

# 2. Login
heroku login

# 3. Create app
heroku create my-ai-detection-service

# 4. Deploy
git init
git add .
git commit -m "Initial commit"
git push heroku main

# 5. Get URL
heroku open
```

Your service will be at: `https://my-ai-detection-service.herokuapp.com`

### Option 2: Railway (Very Easy - Free Tier)

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Initialize
railway init

# 4. Deploy
railway up

# 5. Get URL
railway open
```

### Option 3: Render (Easy - Free Tier)

1. Push code to GitHub
2. Go to https://render.com
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Configure:
   - Name: `ai-detection-service`
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
6. Click "Create Web Service"

Your service will be at: `https://ai-detection-service.onrender.com`

### Option 4: DigitalOcean App Platform

1. Push code to GitHub
2. Go to https://cloud.digitalocean.com/apps
3. Click "Create App"
4. Connect GitHub repository
5. Configure:
   - Name: `ai-detection-service`
   - Type: Web Service
   - HTTP Port: 5004
6. Click "Next" → "Create Resources"

### Option 5: Vercel (Serverless)

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Deploy
vercel

# 3. Follow prompts
```

### Option 6: Netlify Functions

```bash
# 1. Install Netlify CLI
npm install -g netlify-cli

# 2. Deploy
netlify deploy --prod

# 3. Follow prompts
```

### Option 7: AWS EC2 (Full Control)

```bash
# 1. Launch EC2 instance (Ubuntu)
# 2. SSH into instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# 3. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 4. Clone your code
git clone your-repo
cd ai-detection-node

# 5. Install dependencies
npm install

# 6. Install PM2
sudo npm install -g pm2

# 7. Start service
pm2 start server.js --name ai-detection

# 8. Save PM2 config
pm2 save
pm2 startup
```

### Option 8: Docker (Any Platform)

```bash
# 1. Build image
docker build -t ai-detection-service .

# 2. Run container
docker run -d -p 5004:5004 --name ai-detection ai-detection-service

# 3. Check logs
docker logs ai-detection

# 4. Stop
docker stop ai-detection
```

### Option 9: Google Cloud Run

```bash
# 1. Install gcloud CLI
# Download from: https://cloud.google.com/sdk/docs/install

# 2. Login
gcloud auth login

# 3. Set project
gcloud config set project YOUR_PROJECT_ID

# 4. Build and deploy
gcloud run deploy ai-detection-service \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Option 10: Azure App Service

```bash
# 1. Install Azure CLI
# Download from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli

# 2. Login
az login

# 3. Create resource group
az group create --name ai-detection-rg --location eastus

# 4. Create app service plan
az appservice plan create --name ai-detection-plan --resource-group ai-detection-rg --sku FREE

# 5. Create web app
az webapp create --resource-group ai-detection-rg --plan ai-detection-plan --name my-ai-detection --runtime "NODE|18-lts"

# 6. Deploy
az webapp deployment source config-zip --resource-group ai-detection-rg --name my-ai-detection --src deploy.zip
```

---

## 🔧 Connect to Your PACS

After deploying, update your backend `.env`:

```bash
# If deployed to Heroku
AI_DETECTION_URL=https://my-ai-detection-service.herokuapp.com

# If deployed to Railway
AI_DETECTION_URL=https://ai-detection-service.up.railway.app

# If deployed to Render
AI_DETECTION_URL=https://ai-detection-service.onrender.com

# If deployed to your own server
AI_DETECTION_URL=http://your-server-ip:5004
```

Then restart your backend:

```bash
cd server
npm start
```

---

## ✅ Verify Deployment

Test your deployed service:

```bash
# Replace with your actual URL
curl https://your-service-url.com/health
```

Expected response:

```json
{
  "status": "healthy",
  "service": "AI Detection Service",
  "version": "1.0.0",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

---

## 🎯 Recommended: Railway or Render

**Why?**
- ✅ Free tier available
- ✅ Easy deployment
- ✅ Automatic HTTPS
- ✅ No credit card required
- ✅ Good performance
- ✅ Easy to scale

**Railway:**
- Best for: Quick deployment
- Free tier: 500 hours/month
- Deploy time: 2 minutes

**Render:**
- Best for: Production use
- Free tier: Always free
- Deploy time: 5 minutes
- Auto-deploy from GitHub

---

## 🔒 Production Checklist

Before going to production:

- [ ] Add API key authentication
- [ ] Enable rate limiting
- [ ] Set up monitoring
- [ ] Configure CORS properly
- [ ] Use HTTPS only
- [ ] Set up logging
- [ ] Add health checks
- [ ] Configure auto-scaling
- [ ] Set up backups
- [ ] Add error tracking (Sentry)

---

## 📊 Monitoring

### Add Health Checks

Most platforms support health checks. Configure:

- **Health Check URL:** `/health`
- **Expected Status:** 200
- **Interval:** 30 seconds

### Add Logging

Use platform-specific logging:

```javascript
// Add to server.js
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console()
  ]
});
```

---

## 🎉 Done!

Your AI detection service is now deployed and ready to use!

Test it with your PACS system and see the detections appear! 🎯
