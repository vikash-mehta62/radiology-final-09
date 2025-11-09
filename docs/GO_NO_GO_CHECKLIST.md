# Go/No-Go Checklist - Unified Reporting System

## Pre-Flight Checks (T-24h)

### Code Quality ✅
- [ ] CI pipeline green on main branch
- [ ] All tests passing (unit, E2E, a11y, chaos)
- [ ] TypeScript: 0 errors
- [ ] ESLint: 0 warnings
- [ ] Test coverage ≥ 80%
- [ ] Security audit clean (no high/critical)
- [ ] No known P0/P1 bugs

### Infrastructure ✅
- [ ] Health check endpoint responding (`/api/health`)
- [ ] Database backups verified (< 24h old)
- [ ] CDN cache purge tested
- [ ] Monitoring dashboards deployed
- [ ] Alert rules configured and tested
- [ ] PagerDuty rotation confirmed
- [ ] Rollback procedure tested in staging

### Feature Flags ✅
- [ ] Feature flags default to OFF (`REPORTING_UNIFIED_PERCENT=0`)
- [ ] Toggle script tested (`./scripts/flags/toggle-reporting.sh`)
- [ ] Flags file accessible (`/flags.json`)
- [ ] Runtime flag loading verified

### Documentation ✅
- [ ] Runbooks updated
- [ ] Rollback procedures documented
- [ ] Communication templates ready
- [ ] On-call guide distributed

## Stakeholder Sign-Off (T-4h)

### Business ✅
- [ ] **Radiology Lead**: Approved for launch
- [ ] **Product Manager**: Feature complete
- [ ] **Compliance**: HIPAA review passed
- [ ] **Legal**: Digital signature validation confirmed

### Technical ✅
- [ ] **Engineering Manager**: Code review complete
- [ ] **SRE Lead**: Infrastructure ready
- [ ] **Security Team**: Audit passed
- [ ] **QA Lead**: Test plan executed

### Operations ✅
- [ ] **Support Team**: Briefed and on standby
- [ ] **Training**: User guides published
- [ ] **Communications**: Announcement drafted

## Rollout Plan (24-hour window)

### Phase 1: Canary (0-4h)
**Target**: 10% of users

- [ ] T+0h: Set `REPORTING_UNIFIED_PERCENT=10`
- [ ] T+0h: Verify flag propagation
- [ ] T+0h: Monitor Grafana dashboard
- [ ] T+1h: Check error rate < 1%
- [ ] T+1h: Check autosave success > 99%
- [ ] T+2h: Review user feedback
- [ ] T+4h: **HOLD POINT** - Go/No-Go decision

**Go Criteria**:
- Error rate < 1%
- Autosave success > 99%
- No P0 bugs reported
- User feedback neutral/positive

**No-Go Triggers**:
- Error rate > 2%
- Data loss reported
- Security issue discovered
- Multiple user complaints

### Phase 2: Ramp (4-12h)
**Target**: 25% → 50% of users

- [ ] T+4h: Set `REPORTING_UNIFIED_PERCENT=25`
- [ ] T+6h: Monitor metrics
- [ ] T+8h: **HOLD POINT** - Go/No-Go decision
- [ ] T+8h: Set `REPORTING_UNIFIED_PERCENT=50`
- [ ] T+10h: Monitor metrics
- [ ] T+12h: **HOLD POINT** - Go/No-Go decision

**Go Criteria** (each phase):
- Error rate < 0.5%
- Autosave success > 99.5%
- API latency p95 < 1s
- No P0/P1 bugs

### Phase 3: Full Rollout (12-24h)
**Target**: 100% of users

- [ ] T+12h: Set `REPORTING_UNIFIED_PERCENT=100`
- [ ] T+12h: Monitor closely for 2h
- [ ] T+14h: Verify all metrics stable
- [ ] T+24h: **FINAL CHECKPOINT**

**Success Criteria**:
- Error rate < 0.5%
- Autosave success > 99.5%
- API latency p95 < 800ms
- User adoption > 80%
- No critical incidents

## Monitoring Checklist

### Real-Time (Every 15 min during rollout)
- [ ] Grafana: Autosave success rate
- [ ] Grafana: API latency p95
- [ ] Grafana: Error budget burn
- [ ] PagerDuty: No critical alerts
- [ ] Slack: User feedback channel
- [ ] Logs: No error spikes

### Hourly
- [ ] Version conflicts trending
- [ ] Export success rate
- [ ] Finalize/sign throughput
- [ ] Network offline events
- [ ] Support ticket volume

### Daily (Post-rollout)
- [ ] SLO compliance review
- [ ] Error budget status
- [ ] User adoption metrics
- [ ] Performance trends

## Rollback Triggers

### Immediate Rollback (< 5 min)
Execute if ANY of these occur:
- [ ] Error rate > 5%
- [ ] Data loss or corruption detected
- [ ] Security vulnerability discovered
- [ ] System unavailable > 5 minutes
- [ ] Critical functionality broken

**Action**: `./scripts/flags/toggle-reporting.sh --percent 0`

### Planned Rollback (< 15 min)
Execute if ANY of these persist > 15 min:
- [ ] Error rate > 2%
- [ ] Autosave success < 98%
- [ ] API latency p95 > 2s
- [ ] Multiple P0 bugs reported
- [ ] User complaints > 10

**Action**: Follow `docs/ROLLBACK.md` Level 1-2

## Communication Plan

### T-24h: Heads-Up
- [ ] Email to all users
- [ ] In-app notification
- [ ] Status page update

### T-0h: Launch
- [ ] Slack announcement (#general, #radiology)
- [ ] Status page: "Monitoring"
- [ ] Support team notified

### T+4h, T+8h, T+12h: Updates
- [ ] Slack progress update
- [ ] Status page update
- [ ] Stakeholder email

### T+24h: Success
- [ ] Announcement email
- [ ] Status page: "Completed"
- [ ] Thank you to team

### If Rollback Needed
- [ ] Immediate Slack alert
- [ ] Status page: "Investigating"
- [ ] User notification
- [ ] Incident postmortem scheduled

## Exit Criteria

### Success ✅
- [ ] 100% rollout achieved
- [ ] Error rate < 0.5% for 24h
- [ ] Autosave success > 99.5%
- [ ] No critical incidents
- [ ] User feedback positive
- [ ] SLOs met

### Partial Success ⚠️
- [ ] Rollout paused at < 100%
- [ ] Metrics stable at current %
- [ ] Issues identified and tracked
- [ ] Plan for next attempt

### Failure ❌
- [ ] Rolled back to 0%
- [ ] Root cause identified
- [ ] Postmortem completed
- [ ] Fixes implemented
- [ ] Re-launch date set

## On-Call Rotation

### Primary On-Call
- **Name**: [Engineer Name]
- **Phone**: [Phone]
- **Slack**: @engineer
- **Hours**: T-4h to T+28h

### Secondary On-Call
- **Name**: [Engineer Name]
- **Phone**: [Phone]
- **Slack**: @engineer
- **Hours**: T-4h to T+28h

### Escalation
- **Engineering Manager**: [Contact]
- **SRE Lead**: [Contact]
- **VP Engineering**: [Contact]

## Decision Log

| Time | Decision | Rationale | Approver |
|------|----------|-----------|----------|
| T-24h | Go for launch | All checks passed | [Name] |
| T+4h | Continue to 25% | Metrics stable | [Name] |
| T+8h | Continue to 50% | No issues | [Name] |
| T+12h | Continue to 100% | Success criteria met | [Name] |

## Notes

- This checklist must be completed in order
- All checkboxes must be checked before proceeding
- Document any deviations in Decision Log
- Keep stakeholders informed at each phase
- Celebrate success! 🎉

---

**Launch Date**: [Date]
**Launch Time**: [Time UTC]
**Launch Lead**: [Name]
**Version**: 1.0
