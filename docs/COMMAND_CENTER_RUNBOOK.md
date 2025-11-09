# Command Center Runbook - Unified Reporting System

## Quick Reference

**Dashboard**: https://grafana.example.com/d/reporting-dashboard
**Alerts**: https://alertmanager.example.com
**Logs**: https://kibana.example.com
**Status**: https://status.example.com

## What to Watch

### Critical Panels (Check every 15 min)

1. **Autosave Success Rate** (Gauge, top-left)
   - **Green**: ≥99.5% - All good
   - **Yellow**: 99-99.5% - Watch closely
   - **Red**: <99% - **ALERT** - Investigate immediately

2. **Error Budget Burn Rate** (Stat, top-right)
   - **Green**: <1x - Normal
   - **Yellow**: 3-10x - Moderate burn
   - **Red**: >10x - **CRITICAL** - Fast burn, page on-call

3. **API Latency p95** (Graph, middle-left)
   - **Good**: <800ms
   - **Warning**: 800-1500ms
   - **Critical**: >1500ms

### Important Panels (Check hourly)

4. **Version Conflicts** - Should be near zero
5. **Finalize/Sign Throughput** - Should match historical baseline
6. **Export Error Rate** - Should be <1%
7. **Online/Offline Sessions** - Watch for spikes in offline events

## Alert Triage Flow

### 1. AutosaveSuccessRateLow

**Severity**: Critical
**Threshold**: <99% for 10 minutes

**Immediate Actions**:
```bash
# 1. Check current rate
curl -s "http://prometheus:9090/api/v1/query?query=autosave_success_rate:5m" | jq '.data.result[0].value[1]'

# 2. Check error logs
kubectl logs -l app=api-server --tail=100 | grep -i "autosave.*error"

# 3. Check database connectivity
mongo --eval "db.adminCommand('ping')"
```

**Common Causes**:
- Database connection issues
- Network problems
- API server overload
- Version conflicts spike

**Resolution**:
- If database issue: Restart database connection pool
- If network issue: Check CDN/load balancer
- If overload: Scale up API servers
- If persistent: Execute rollback

### 2. APIErrorRateHigh

**Severity**: Critical
**Threshold**: >2% for 5 minutes

**Immediate Actions**:
```bash
# 1. Check error rate by endpoint
curl -s "http://prometheus:9090/api/v1/query?query=api_error_rate:5m" | jq '.data.result'

# 2. Check recent errors
kubectl logs -l app=api-server --tail=50 | grep "ERROR"

# 3. Check API health
curl http://api.example.com/api/health
```

**Common Causes**:
- Deployment issue
- Database migration problem
- External service down
- Rate limiting triggered

**Resolution**:
- If recent deployment: Rollback
- If database: Check migrations
- If external service: Enable fallback
- If rate limiting: Increase limits

### 3. FastBurnRate

**Severity**: Critical
**Threshold**: Error budget burning at 10x rate

**Immediate Actions**:
```bash
# 1. Check burn rate
curl -s "http://prometheus:9090/api/v1/query?query=autosave_error_budget_burn:5m" | jq '.data.result[0].value[1]'

# 2. Identify root cause
# Check all critical metrics

# 3. Execute rollback if needed
./scripts/flags/toggle-reporting.sh --percent 0
```

**Resolution**:
- **Always** page on-call immediately
- Investigate root cause
- Execute rollback if no quick fix
- Document in incident log

## Copy/Paste Queries

### Prometheus Queries

```promql
# Autosave success rate (5min)
autosave_success_rate:5m{env="production",service="viewer"}

# API latency p95 by endpoint
api_latency:p95{env="production",service="viewer"}

# Version conflicts per minute
rate(version_conflict_total{env="production",service="viewer"}[5m]) * 60

# Error budget remaining
autosave_error_budget_remaining:5m{env="production",service="viewer"}

# Export error rate by format
export_error_rate:5m{env="production",service="viewer"}

# Finalize throughput
report_finalize_rate:5m{env="production",service="viewer"} * 60

# Sign throughput
report_sign_rate:5m{env="production",service="viewer"} * 60

# Offline session rate
network_offline_rate:5m{env="production",service="viewer"}
```

### Kubernetes Commands

```bash
# Check pod status
kubectl get pods -l app=api-server

# View logs (last 100 lines)
kubectl logs -l app=api-server --tail=100

# View logs (follow)
kubectl logs -l app=api-server -f

# Check pod resources
kubectl top pods -l app=api-server

# Restart pods
kubectl rollout restart deployment/api-server

# Scale up
kubectl scale deployment/api-server --replicas=5

# Check recent events
kubectl get events --sort-by='.lastTimestamp' | head -20
```

### Database Queries

```javascript
// MongoDB - Check report counts
db.reports.count({ reportStatus: "draft" })
db.reports.count({ reportStatus: "preliminary" })
db.reports.count({ reportStatus: "final" })

// Check recent reports
db.reports.find().sort({ "metadata.createdAt": -1 }).limit(10)

// Check for version conflicts
db.reports.find({ version: { $gt: 5 } }).count()

// Check autosave failures
db.reports.find({ 
  "metadata.lastModifiedAt": { $gt: new Date(Date.now() - 3600000) }
}).count()
```

### Feature Flag Commands

```bash
# Check current flags
./scripts/flags/toggle-reporting.sh --status

# Disable unified reporting (emergency)
./scripts/flags/toggle-reporting.sh --percent 0

# Enable for 10% (canary)
./scripts/flags/toggle-reporting.sh --percent 10

# Enable for 50%
./scripts/flags/toggle-reporting.sh --percent 50

# Full rollout
./scripts/flags/toggle-reporting.sh --percent 100

# Enable unified-only mode
./scripts/flags/toggle-reporting.sh --unified-only on

# Disable unified-only mode
./scripts/flags/toggle-reporting.sh --unified-only off
```

## Escalation Path

### Level 1: On-Call Engineer (0-15 min)
- Acknowledge alert
- Run initial diagnostics
- Attempt quick fix
- If unresolved, escalate to Level 2

### Level 2: Senior Engineer (15-30 min)
- Deep dive investigation
- Coordinate with on-call
- Make rollback decision
- If unresolved, escalate to Level 3

### Level 3: Engineering Manager (30-60 min)
- Assess business impact
- Coordinate cross-team response
- Approve major changes (rollback, scaling)
- If unresolved, escalate to Level 4

### Level 4: VP Engineering (60+ min)
- Executive decision making
- External communication
- Resource allocation
- Incident commander

## Common Issues & Solutions

### Issue: Autosave Failing

**Symptoms**: Autosave success rate drops, users see "unsaved" indicator

**Diagnosis**:
```bash
# Check API logs
kubectl logs -l app=api-server | grep "autosave"

# Check database
mongo --eval "db.reports.find().limit(1)"

# Check network
curl -I http://api.example.com/api/reports
```

**Solutions**:
1. Restart API servers: `kubectl rollout restart deployment/api-server`
2. Check database connection pool
3. Verify network connectivity
4. If persistent: Rollback

### Issue: High Latency

**Symptoms**: API latency p95 >1500ms, slow UI

**Diagnosis**:
```bash
# Check API latency
curl -s "http://prometheus:9090/api/v1/query?query=api_latency:p95" | jq '.'

# Check database slow queries
mongo --eval "db.currentOp({'secs_running': {$gte: 1}})"

# Check server load
kubectl top pods
```

**Solutions**:
1. Scale up API servers
2. Add database indexes
3. Enable caching
4. Optimize slow queries

### Issue: Version Conflicts Spike

**Symptoms**: Many version conflict errors, users see conflict modal

**Diagnosis**:
```bash
# Check conflict rate
curl -s "http://prometheus:9090/api/v1/query?query=version_conflict_rate:5m" | jq '.'

# Check concurrent edits
db.reports.find({ version: { $gt: 10 } })
```

**Solutions**:
1. Verify autosave interval (should be 3s)
2. Check for race conditions
3. Review conflict resolution logic
4. If widespread: Investigate root cause

## Rollback Procedures

### Quick Rollback (< 2 min)
```bash
# Disable unified reporting
./scripts/flags/toggle-reporting.sh --percent 0

# Verify
./scripts/flags/toggle-reporting.sh --status

# Clear CDN cache
aws cloudfront create-invalidation --distribution-id $CF_ID --paths "/*"
```

### Full Rollback (< 15 min)
See `docs/ROLLBACK.md` for complete procedures

## Communication Templates

### Slack Alert (Critical)
```
@channel 🚨 CRITICAL: Unified Reporting Issue

Status: Investigating
Impact: [Describe impact]
Action: [What we're doing]
ETA: [Estimated resolution time]

Updates every 15 minutes.
```

### Slack Update (Progress)
```
📊 UPDATE: Unified Reporting

Status: [Investigating/Mitigating/Resolved]
Progress: [What's been done]
Next: [Next steps]
ETA: [Updated ETA]
```

### Slack Resolution
```
✅ RESOLVED: Unified Reporting

Issue: [Brief description]
Duration: [How long]
Impact: [Who was affected]
Resolution: [What fixed it]

Postmortem: [Link]
```

## Assumptions

1. **Prometheus** is running and scraping metrics from viewer service
2. **Grafana** has access to Prometheus data source
3. **kubectl** is configured for production cluster
4. **mongo** CLI has access to production database (read-only recommended)
5. **Feature flags** are served from `/flags.json` or `window.__FLAGS__`
6. **CDN** is CloudFront (adjust commands for other CDNs)
7. **Metrics** are tagged with `env`, `service`, `endpoint`
8. **Logs** are aggregated in Kubernetes or centralized logging system

## Tools Required

- `kubectl` - Kubernetes CLI
- `curl` - HTTP client
- `jq` - JSON processor
- `mongo` - MongoDB CLI
- `aws` - AWS CLI (for CloudFront)
- Access to Grafana, Prometheus, PagerDuty

## Contact Information

- **On-Call**: [PagerDuty]
- **Slack**: #incidents-reporting
- **Email**: oncall@example.com
- **Phone**: [Emergency Hotline]

---

**Last Updated**: 2024-01-15
**Version**: 1.0
**Owner**: SRE Team
