# 🔄 Security Migration Guide

**Purpose:** Upgrade existing deployments to secured authentication  
**Impact:** Breaking change - all API clients must use authentication  
**Estimated Downtime:** 5-10 minutes

---

## ⚠️ Breaking Changes

### What Changed

**Before (Insecure):**
```bash
# Anyone could access without authentication
curl http://localhost:8001/api/dicom/studies
```

**After (Secure):**
```bash
# Authentication required
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8001/api/dicom/studies
```

### Affected Endpoints

All endpoints now require authentication except:
- `/` - Health check
- `/health/*` - Health monitoring
- `/auth/*` - Authentication endpoints

---

## 📋 Migration Steps

### Step 1: Backup Current System

```bash
# Backup MongoDB
mongodump --uri="mongodb://localhost:27017/dicomdb" --out=./backup

# Backup environment configuration
cp server/.env server/.env.backup

# Backup application files
tar -czf app-backup-$(date +%Y%m%d).tar.gz server/
```

### Step 2: Update Environment Variables

```bash
# Edit server/.env
nano server/.env

# Add JWT_SECRET (generate strong secret)
JWT_SECRET=$(openssl rand -base64 32)
echo "JWT_SECRET=$JWT_SECRET" >> server/.env

# Optional: Enable auth logging
echo "ENABLE_AUTH_LOGGING=true" >> server/.env
```

### Step 3: Pull Latest Code

```bash
# Pull security updates
git pull origin main

# Install dependencies (if any new ones)
cd server
npm install
cd ..
```

### Step 4: Test in Development

```bash
# Start server in development mode
cd server
npm run dev

# In another terminal, test authentication
# 1. Login
curl -X POST http://localhost:8001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 2. Copy token from response
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 3. Test protected endpoint
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8001/api/dicom/studies
```

### Step 5: Update Frontend/Client Applications

**React Frontend (viewer):**

```typescript
// viewer/src/services/ApiService.ts

// Add token to all requests
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

**External API Clients:**

```python
# Python client example
import requests

# Login
response = requests.post('http://localhost:8001/auth/login', json={
    'username': 'admin',
    'password': 'admin123'
})
token = response.json()['token']

# Use token in subsequent requests
headers = {'Authorization': f'Bearer {token}'}
studies = requests.get('http://localhost:8001/api/dicom/studies', headers=headers)
```

### Step 6: Deploy to Production

```bash
# Stop current server
pm2 stop dicom-server

# Pull latest code
git pull origin main

# Update dependencies
cd server
npm install

# Restart server
pm2 restart dicom-server

# Check logs
pm2 logs dicom-server
```

### Step 7: Verify Deployment

```bash
# 1. Check server health
curl http://localhost:8001/health

# 2. Test authentication
curl -X POST http://localhost:8001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 3. Verify protected endpoints require auth
curl http://localhost:8001/api/dicom/studies
# Should return 401 Unauthorized

# 4. Test with valid token
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8001/api/dicom/studies
# Should return studies
```

---

## 🔧 Configuration Updates

### Required Environment Variables

```bash
# server/.env

# CRITICAL: Set strong JWT secret
JWT_SECRET=your_generated_secret_here

# Optional: Enable auth logging
ENABLE_AUTH_LOGGING=true

# Ensure production mode
NODE_ENV=production
```

### Generate JWT Secret

```bash
# Linux/Mac
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## 🚨 Rollback Procedure

If issues occur, rollback to previous version:

```bash
# Stop current server
pm2 stop dicom-server

# Restore previous code
git checkout <previous_commit_hash>

# Restore environment
cp server/.env.backup server/.env

# Restart server
pm2 restart dicom-server

# Verify
curl http://localhost:8001/api/dicom/studies
# Should work without authentication (old behavior)
```

---

## 📊 Post-Migration Checklist

### Immediate (Day 1)

- [ ] Server starts without errors
- [ ] Admin user can login
- [ ] Protected endpoints require authentication
- [ ] Frontend application works with authentication
- [ ] External API clients updated and working
- [ ] Audit logs showing authentication events

### Short-term (Week 1)

- [ ] Monitor error logs for authentication issues
- [ ] Verify all users can login
- [ ] Check for any unauthorized access attempts
- [ ] Review audit logs for anomalies
- [ ] Update API documentation
- [ ] Train staff on new authentication flow

### Long-term (Month 1)

- [ ] Security audit completed
- [ ] Penetration testing performed
- [ ] HIPAA compliance verified
- [ ] Backup procedures tested
- [ ] Disaster recovery plan updated
- [ ] Performance monitoring shows no degradation

---

## 🐛 Common Issues & Solutions

### Issue 1: "Server configuration error"

**Symptom:** 500 error on all requests  
**Cause:** JWT_SECRET not set in production  
**Solution:**
```bash
# Set JWT_SECRET
echo "JWT_SECRET=$(openssl rand -base64 32)" >> server/.env
pm2 restart dicom-server
```

### Issue 2: "Invalid token"

**Symptom:** 401 error with valid-looking token  
**Cause:** JWT_SECRET mismatch  
**Solution:**
```bash
# Verify JWT_SECRET is consistent
cat server/.env | grep JWT_SECRET

# If changed, users need to re-login
```

### Issue 3: Frontend can't access API

**Symptom:** All API calls fail with 401  
**Cause:** Frontend not sending token  
**Solution:**
```typescript
// Check token is stored
console.log(localStorage.getItem('authToken'));

// Verify axios interceptor is configured
// See Step 5 above
```

### Issue 4: Admin can't login

**Symptom:** Login fails with "Invalid credentials"  
**Cause:** Admin user not seeded  
**Solution:**
```bash
# Check server logs for seeding errors
pm2 logs dicom-server | grep "Admin"

# Manually seed admin
cd server
node -e "require('./src/seed/seedAdmin').seedAdmin()"
```

### Issue 5: Token expires too quickly

**Symptom:** Users logged out frequently  
**Cause:** Short token expiration  
**Solution:**
```javascript
// Update token expiration in auth controller
// server/src/controllers/authController.js
const token = jwt.sign(payload, secret, { 
  expiresIn: '8h' // Increase from default
});
```

---

## 📞 Support & Escalation

### Level 1: Self-Service
- Check this migration guide
- Review error logs: `pm2 logs dicom-server`
- Test with curl commands above

### Level 2: Team Support
- Contact: dev-team@company.com
- Slack: #dicom-support
- Include: Error logs, environment config (redacted)

### Level 3: Emergency
- Contact: security-team@company.com
- Phone: [Emergency Number]
- For: Security breaches, data access issues

---

## 📚 Additional Resources

- [Authentication Security Documentation](./AUTHENTICATION_SECURITY.md)
- [Production Readiness Report](./PRODUCTION_READINESS_REPORT.md)
- [PACS Runbook](./PACS-RUNBOOK.md)
- [Rollback Procedures](./ROLLBACK.md)

---

## ✅ Migration Completion

Once migration is complete:

1. **Update documentation**
   - Mark migration as complete
   - Document any custom changes
   - Update API documentation

2. **Notify stakeholders**
   - Send migration completion email
   - Update status page
   - Schedule post-migration review

3. **Monitor system**
   - Watch error rates
   - Check authentication logs
   - Monitor performance metrics

4. **Archive migration artifacts**
   - Save backup files
   - Document lessons learned
   - Update runbooks

---

**Migration Date:** _____________  
**Completed By:** _____________  
**Sign-off:** _____________

**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Complete | ⬜ Rolled Back
