# Rollback Procedures - Unified Reporting System

## Overview

This document provides step-by-step procedures for rolling back the Unified Reporting System in case of critical issues.

## When to Rollback

Execute rollback immediately if:
- **Error rate > 5%** for more than 5 minutes
- **Data loss or corruption** detected
- **Security vulnerability** discovered
- **System unavailable** for more than 5 minutes
- **Critical functionality broken** (cannot create/save reports)
- **SLO violation** with no immediate fix

## Rollback Levels

### Level 1: Feature Flag Toggle (< 2 minutes)

**Use when**: Feature is causing issues but system is stable

**Steps**:
```bash
# 1. Disable feature flag
curl -X POST https://api.yourdomain.com/api/admin/flags \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"REPORTING_UNIFIED": false}'

# 2. Verify flag is disabled
curl https://api.yourdomain.com/api/admin/flags | jq '.REPORTING_UNIFIED'

# 3. Clear CDN cache
aws cloudfront create-invalidation \
  --distribution-id $CF_DISTRIBUTION_ID \
  --paths "/*"

# 4. Verify users redirected to legacy
curl https://app.yourdomain.com/reports
```

**Verification**:
- Users see legacy reporting interface
- No new reports created in unified system
- Existing reports still accessible

### Level 2: Frontend Rollback (< 10 minutes)

**Use when**: Frontend code has critical bugs

**Steps**:
```bash
# 1. Identify last good deployment
git log --oneline -10

# 2. Revert to previous version
git revert HEAD
git push origin main

# 3. Trigger deployment
gh workflow run deploy.yml

# 4. Monitor deployment
gh run watch

# 5. Clear CDN cache
aws cloudfront create-invalidation \
  --distribution-id $CF_DISTRIBUTION_ID \
  --paths "/*"

# 6. Verify deployment
curl -I https://app.yourdomain.com
```

**Verification**:
- Previous version deployed
- Users can access application
- No JavaScript errors in console

### Level 3: Backend Rollback (< 15 minutes)

**Use when**: API has critical bugs or performance issues

**Steps**:
```bash
# 1. Identify last good deployment
kubectl rollout history deployment/api-server

# 2. Rollback to previous version
kubectl rollout undo deployment/api-server

# 3. Monitor rollback
kubectl rollout status deployment/api-server

# 4. Verify pods are healthy
kubectl get pods -l app=api-server

# 5. Check logs
kubectl logs -l app=api-server --tail=100

# 6. Verify API health
curl https://api.yourdomain.com/api/health
```

**Verification**:
- Previous API version running
- Health check passes
- No errors in logs

### Level 4: Database Rollback (< 30 minutes)

**Use when**: Database migration caused issues

**⚠️ WARNING**: This is destructive and may result in data loss

**Steps**:
```bash
# 1. Stop all writes
kubectl scale deployment/api-server --replicas=0

# 2. Backup current state
mongodump --uri="$MONGO_URI" --archive=backup-emergency-$(date +%Y%m%d-%H%M%S).gz

# 3. Identify last good backup
aws s3 ls s3://backups/mongodb/ | tail -10

# 4. Restore from backup
mongorestore --uri="$MONGO_URI" --archive=backup-YYYYMMDD.gz --drop

# 5. Verify restoration
mongo --eval "db.reports.count()"

# 6. Restart API servers
kubectl scale deployment/api-server --replicas=3

# 7. Verify system health
curl https://api.yourdomain.com/api/health
```

**Verification**:
- Database restored to previous state
- API servers running
- Reports accessible

## Brownout Switch

**Use when**: Need to gradually reduce traffic to new system

### Enable Brownout

```bash
# Reduce traffic to 50%
curl -X POST https://api.yourdomain.com/api/admin/traffic \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"unified_reporting_traffic": 0.5}'

# Reduce to 25%
curl -X POST https://api.yourdomain.com/api/admin/traffic \
  -d '{"unified_reporting_traffic": 0.25}'

# Disable completely
curl -X POST https://api.yourdomain.com/api/admin/traffic \
  -d '{"unified_reporting_traffic": 0}'
```

### Monitor During Brownout

```bash
# Watch error rates
watch -n 5 'curl -s https://api.yourdomain.com/api/metrics | jq ".error_rate"'

# Watch active users
watch -n 5 'curl -s https://api.yourdomain.com/api/metrics | jq ".active_users"'
```

## Cache Purge

### CDN Cache

```bash
# CloudFront
aws cloudfront create-invalidation \
  --distribution-id $CF_DISTRIBUTION_ID \
  --paths "/*"

# Verify invalidation
aws cloudfront get-invalidation \
  --distribution-id $CF_DISTRIBUTION_ID \
  --id $INVALIDATION_ID
```

### Application Cache

```bash
# Redis cache
redis-cli FLUSHALL

# Verify cache cleared
redis-cli DBSIZE
```

### Browser Cache

Instruct users to:
1. Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
2. Clear browser cache
3. Close and reopen browser

## Communication Plan

### Internal Communication

**Slack Announcement**:
```
@channel URGENT: Rolling back Unified Reporting System due to [REASON]

Status: In Progress
ETA: [TIME]
Impact: [DESCRIPTION]
Action Required: [IF ANY]

Updates will be posted every 5 minutes.
```

### User Communication

**Status Page Update**:
```
Title: Unified Reporting System Rollback
Status: Investigating
Message: We are experiencing issues with the Unified Reporting System 
and are rolling back to the previous version. Your reports are safe 
and accessible. We will update you as soon as the rollback is complete.

Expected Resolution: [TIME]
```

### Post-Rollback Communication

```
Title: Unified Reporting System Restored
Status: Resolved
Message: The Unified Reporting System has been rolled back to the 
previous stable version. All functionality is restored. We apologize 
for any inconvenience.

Root Cause: [BRIEF DESCRIPTION]
Next Steps: [WHAT WE'RE DOING]
```

## Verification Checklist

After rollback, verify:

- [ ] Health checks pass
- [ ] Error rate < 1%
- [ ] Response time < 500ms (p95)
- [ ] Users can log in
- [ ] Users can create reports
- [ ] Users can save reports
- [ ] Users can finalize reports
- [ ] Users can sign reports
- [ ] Users can export reports
- [ ] No JavaScript errors in console
- [ ] No errors in server logs
- [ ] Database queries working
- [ ] Cache functioning
- [ ] CDN serving correct version

## Post-Rollback Actions

### Immediate (< 1 hour)

1. **Incident Report**: Create incident ticket
2. **Team Notification**: Notify all stakeholders
3. **Log Collection**: Gather logs from all systems
4. **Metrics Review**: Analyze metrics leading to rollback

### Short-term (< 24 hours)

1. **Root Cause Analysis**: Identify what went wrong
2. **Fix Development**: Develop fix for the issue
3. **Testing**: Test fix thoroughly
4. **Postmortem Scheduling**: Schedule postmortem meeting

### Long-term (< 1 week)

1. **Postmortem**: Conduct blameless postmortem
2. **Action Items**: Create action items to prevent recurrence
3. **Documentation**: Update runbooks and procedures
4. **Re-deployment Plan**: Plan for re-deploying fixed version

## Rollback Decision Tree

```
Issue Detected
    ↓
Is it critical? (data loss, security, >5% error rate)
    ↓ YES                    ↓ NO
Level 4: Full Rollback    Monitor closely
    ↓                        ↓
Is it frontend only?      Does it resolve?
    ↓ YES    ↓ NO            ↓ YES    ↓ NO
Level 2    Level 3        Continue    Level 1
```

## Testing Rollback Procedures

### Quarterly Drill

Practice rollback procedures quarterly:

1. Schedule maintenance window
2. Execute Level 1 rollback
3. Verify system functionality
4. Re-enable feature
5. Document any issues
6. Update procedures

### Metrics to Track

- Time to detect issue
- Time to decision
- Time to execute rollback
- Time to verify
- Total downtime
- Data loss (if any)

## Emergency Contacts

- **On-Call Engineer**: [PagerDuty]
- **Engineering Manager**: [Phone/Slack]
- **DevOps Lead**: [Phone/Slack]
- **Database Admin**: [Phone/Slack]
- **Security Team**: [Phone/Slack]

## Escalation

If rollback fails or takes longer than expected:

1. **+15 min**: Escalate to Engineering Manager
2. **+30 min**: Escalate to VP Engineering
3. **+60 min**: Escalate to CTO
4. **+120 min**: Executive team notification

## Lessons Learned

After each rollback, document:

- What triggered the rollback
- What went well
- What could be improved
- Action items to prevent recurrence
- Updates to this document

---

**Last Updated**: 2024-01-15
**Version**: 1.0
**Owner**: SRE Team
**Review**: After each rollback
