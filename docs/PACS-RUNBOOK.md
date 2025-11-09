# 📋 PACS/Biomed Runbook - Orthanc Bridge Integration

## Quick Reference
- **AE Title**: `ORTHANC_DEV_AE`
- **DICOM Port**: `4242`
- **Host**: `[ORTHANC_SERVER_IP]`
- **Test Dataset**: Single-frame CT or MR slice
- **Rollback**: `docker stop orthanc-dev`

## Pre-Deployment Checklist

### Network Requirements
- [ ] Orthanc server accessible on modality VLAN
- [ ] Port 4242 open for DICOM traffic
- [ ] Port 8042 open for REST API (admin only)
- [ ] Firewall rules configured

### PACS Configuration
- [ ] Add `ORTHANC_DEV_AE` as known destination
- [ ] Configure as **secondary destination only**
- [ ] Do NOT modify primary PACS routing
- [ ] Test connectivity with C-ECHO first

## Deployment Steps

### 1. Deploy Orthanc (Staging)
```bash
# Start services
docker-compose up -d orthanc dicom-bridge redis

# Verify services
docker-compose ps
curl http://69.62.70.102:8042/system
```

### 2. Test DICOM Connectivity
```bash
# Test C-ECHO (if dcmtk available)
echoscu -aec ORTHANC_DEV_AE localhost 4242

# Or use Orthanc REST
curl -u orthanc:orthanc_secure_2024 http://69.62.70.102:8042/modalities/self/echo
```

### 3. Configure PACS Secondary Destination
**CRITICAL**: Only add as secondary, never replace primary routing

Example PACS config:
```
Destination: ORTHANC_DEV_AE
Host: [ORTHANC_IP]
Port: 4242
AE Title: ORTHANC_DEV_AE
Type: Secondary Copy
```

### 4. Send Test Study
- Use single-frame CT or MR
- Verify original reaches primary PACS
- Verify copy reaches Orthanc
- Check bridge processing logs

## Validation Tests

### Test 1: Basic Connectivity
```bash
# Send test DICOM
storescu -aec ORTHANC_DEV_AE [ORTHANC_IP] 4242 test.dcm

# Verify received
curl -u orthanc:orthanc_secure_2024 http://69.62.70.102:8042/studies
```

### Test 2: Bridge Processing
```bash
# Check webhook logs
docker logs dicom-bridge-dev

# Verify job processing
curl http://localhost:3001/health/detailed
```

### Test 3: Original Workflow
- Query primary PACS for test study
- Retrieve images to workstation
- Verify no changes to existing workflow

## Monitoring

### Health Endpoints
```bash
# Bridge health
curl http://localhost:3001/health

# Orthanc health  
curl -u orthanc:orthanc_secure_2024 http://69.62.70.102:8042/system

# Queue status
curl http://localhost:3001/health/detailed
```

### Log Locations
- Bridge logs: `./dicom-bridge/logs/`
- Orthanc logs: `docker logs orthanc-dev`
- Queue logs: `docker logs redis-bridge`

## Troubleshooting

### Common Issues

**DICOM Association Rejected**
```bash
# Check AE title configuration
docker exec orthanc-dev cat /etc/orthanc/orthanc.json | grep -A5 DicomAet

# Verify port binding
netstat -ln | grep 4242
```

**Webhook Not Firing**
```bash
# Check Orthanc config
curl -u orthanc:orthanc_secure_2024 http://69.62.70.102:8042/tools/configuration

# Test webhook manually
curl -X POST http://localhost:3001/api/orthanc/new-instance \
  -H "Content-Type: application/json" \
  -d '{"instanceId":"test","studyInstanceUID":"1.2.3"}'
```

**Bridge Processing Fails**
```bash
# Check Redis connection
docker exec redis-bridge redis-cli ping

# Check main API connectivity
curl http://localhost:8001/
```

## Emergency Procedures

### Immediate Disable
```bash
# Stop webhook processing
curl -u orthanc:orthanc_secure_2024 -X PUT \
  "http://69.62.70.102:8042/tools/configuration" \
  -d '{"OnStoredInstance": []}' \
  -H "Content-Type: application/json"

# Stop bridge
docker stop dicom-bridge-dev
```

### Complete Rollback
```bash
# Remove from PACS routing
# (Remove ORTHANC_DEV_AE from secondary destinations)

# Stop all services
docker-compose down

# Verify cleanup
ps aux | grep orthanc
```

## Contact Information
- **Technical Lead**: [Your Contact]
- **PACS Admin**: [PACS Contact]  
- **Emergency**: [Emergency Contact]
- **Documentation**: See `docs/` directory