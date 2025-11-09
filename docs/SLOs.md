# Service Level Objectives (SLOs) - Unified Reporting System

## Overview

This document defines the Service Level Objectives (SLOs), Service Level Indicators (SLIs), and error budget policies for the Unified Reporting System.

## Core SLOs

### 1. Autosave Reliability

**Objective**: Autosave operations should succeed 99.5% of the time over a 5-minute window.

- **SLI**: `autosave_success_rate = successful_autosaves / total_autosave_attempts`
- **Target**: ≥ 99.5%
- **Measurement Window**: 5 minutes
- **Error Budget**: 0.5% (30 seconds of failures per 5 minutes)

**Rationale**: Autosave is critical for preventing data loss. Users expect their work to be saved automatically without intervention.

### 2. Autosave Latency

**Objective**: Median autosave latency should be under 800ms.

- **SLI**: `autosave_latency_p50`
- **Target**: < 800ms (p50), < 1500ms (p95)
- **Measurement Window**: 5 minutes

**Rationale**: Fast autosave ensures users don't experience lag while typing or editing reports.

### 3. Report Finalization Success

**Objective**: Report finalization should succeed 99.9% of the time.

- **SLI**: `finalize_success_rate = successful_finalizations / total_finalization_attempts`
- **Target**: ≥ 99.9%
- **Measurement Window**: 1 hour
- **Error Budget**: 0.1% (36 seconds of failures per hour)

**Rationale**: Finalization is a critical workflow step. Failures block radiologists from completing reports.

### 4. Digital Signature Success

**Objective**: Digital signature operations should succeed 99.9% of the time.

- **SLI**: `sign_success_rate = successful_signatures / total_signature_attempts`
- **Target**: ≥ 99.9%
- **Measurement Window**: 1 hour
- **Error Budget**: 0.1%

**Rationale**: Signature failures prevent report completion and may have legal/compliance implications.

### 5. Editor Crash Rate

**Objective**: Editor should not crash more than 0.1% of sessions.

- **SLI**: `crash_rate = crashed_sessions / total_sessions`
- **Target**: < 0.1%
- **Measurement Window**: 24 hours
- **Error Budget**: 0.1% (86 seconds per day)

**Rationale**: Editor crashes result in data loss and poor user experience.

### 6. API Availability

**Objective**: API should be available 99.9% of the time.

- **SLI**: `availability = successful_requests / total_requests`
- **Target**: ≥ 99.9%
- **Measurement Window**: 1 hour
- **Error Budget**: 0.1% (36 seconds per hour)

**Rationale**: API unavailability blocks all reporting functionality.

### 7. Export Success Rate

**Objective**: Report exports (PDF/DOCX) should succeed 99% of the time.

- **SLI**: `export_success_rate = successful_exports / total_export_attempts`
- **Target**: ≥ 99%
- **Measurement Window**: 1 hour
- **Error Budget**: 1%

**Rationale**: Export failures prevent report distribution but are less critical than core editing.

## Error Budget Policy

### What is an Error Budget?

An error budget is the maximum amount of time a service can fail while still meeting its SLO. It's calculated as:

```
Error Budget = (1 - SLO) × Time Window
```

Example: For a 99.9% SLO over 1 hour:
```
Error Budget = (1 - 0.999) × 3600 seconds = 3.6 seconds
```

### Error Budget Consumption

Error budgets are consumed by:
- Service outages
- Failed requests
- Slow responses (above latency SLO)
- Bugs causing crashes
- Deployment issues

### Policy Actions

#### Budget Healthy (> 50% remaining)

- **Status**: Green
- **Actions**:
  - Normal deployment cadence
  - Feature development continues
  - Experimental features allowed
  - Performance optimizations optional

#### Budget Warning (25-50% remaining)

- **Status**: Yellow
- **Actions**:
  - Increase monitoring frequency
  - Review recent changes
  - Defer non-critical deployments
  - Focus on reliability improvements
  - Notify team of budget status

#### Budget Critical (< 25% remaining)

- **Status**: Orange
- **Actions**:
  - Freeze feature deployments
  - Emergency reliability fixes only
  - Incident response team on standby
  - Daily budget review meetings
  - Root cause analysis for all incidents

#### Budget Exhausted (0% remaining)

- **Status**: Red
- **Actions**:
  - **DEPLOYMENT FREEZE** (except hotfixes)
  - All hands on reliability
  - Mandatory postmortems
  - Executive escalation
  - No new features until budget restored

### Budget Reset

Error budgets reset at the end of each measurement window:
- 5-minute windows: Reset every 5 minutes
- 1-hour windows: Reset every hour
- 24-hour windows: Reset daily at midnight UTC

## Burn Rate Alerts

Burn rate measures how quickly error budget is being consumed.

### Fast Burn (Critical)

**Condition**: Consuming error budget at 10x normal rate

- **Alert**: Page on-call engineer immediately
- **Example**: 99.9% SLO with 0.1% budget
  - Normal: 0.1% errors
  - Fast burn: 1% errors (10x)
- **Action**: Immediate investigation and mitigation

### Moderate Burn (Warning)

**Condition**: Consuming error budget at 3x normal rate

- **Alert**: Notify team in Slack
- **Example**: 99.9% SLO with 0.1% budget
  - Normal: 0.1% errors
  - Moderate burn: 0.3% errors (3x)
- **Action**: Investigate within 1 hour

### Slow Burn (Info)

**Condition**: Consuming error budget at 1.5x normal rate

- **Alert**: Log for review
- **Example**: 99.9% SLO with 0.1% budget
  - Normal: 0.1% errors
  - Slow burn: 0.15% errors (1.5x)
- **Action**: Review in next team meeting

## Measurement & Monitoring

### Data Collection

Metrics are collected via:
- Frontend: `viewer/src/observability/metrics.ts`
- Backend: API server metrics
- Infrastructure: Load balancer, database metrics

### Dashboards

#### SLO Dashboard (Grafana)

**Panels**:
1. Autosave Success Rate (5min window)
2. Autosave Latency (p50, p95, p99)
3. Finalization Success Rate (1hr window)
4. Signature Success Rate (1hr window)
5. Editor Crash Rate (24hr window)
6. API Availability (1hr window)
7. Export Success Rate (1hr window)
8. Error Budget Remaining (all SLOs)

#### Burn Rate Dashboard

**Panels**:
1. Current Burn Rate (all SLOs)
2. Projected Budget Exhaustion Time
3. Historical Burn Rate (7 days)
4. Budget Consumption by Service

### Queries

#### Autosave Success Rate (Prometheus)

```promql
sum(rate(autosave_success_total[5m])) 
/ 
sum(rate(autosave_attempt_total[5m]))
```

#### Autosave Latency p95

```promql
histogram_quantile(0.95, 
  sum(rate(autosave_latency_bucket[5m])) by (le)
)
```

#### Error Budget Remaining

```promql
1 - (
  sum(rate(autosave_failure_total[5m])) 
  / 
  sum(rate(autosave_attempt_total[5m]))
) / (1 - 0.995)
```

## Incident Response

### SLO Violation Process

1. **Detection**: Alert fires
2. **Acknowledge**: On-call acknowledges within 5 minutes
3. **Assess**: Determine severity and impact
4. **Mitigate**: Implement fix or rollback
5. **Resolve**: Verify SLO is met
6. **Postmortem**: Document incident and improvements

### Escalation

- **Tier 1**: On-call engineer (0-15 min)
- **Tier 2**: Senior engineer (15-30 min)
- **Tier 3**: Engineering manager (30-60 min)
- **Tier 4**: VP Engineering (60+ min)

## Review & Adjustment

### Quarterly Review

Every quarter, review:
- SLO targets (too strict or too loose?)
- Error budget consumption patterns
- Incident frequency and severity
- User feedback and satisfaction
- Business impact of SLO violations

### Adjustment Criteria

**Tighten SLO** (increase target) if:
- Consistently exceeding target by >2x
- Error budget never consumed
- User expectations higher than SLO

**Loosen SLO** (decrease target) if:
- Consistently missing target
- Error budget always exhausted
- Cost of meeting SLO too high

## Reporting

### Weekly SLO Report

Sent to: Engineering team, Product, Leadership

**Contents**:
- SLO compliance (met/missed)
- Error budget remaining
- Top incidents
- Trends and patterns
- Action items

### Monthly SLO Review

Meeting with: Engineering, Product, Operations

**Agenda**:
- Review all SLOs
- Discuss violations and root causes
- Evaluate error budget policy
- Plan reliability improvements
- Adjust SLOs if needed

## References

- [Google SRE Book - SLOs](https://sre.google/sre-book/service-level-objectives/)
- [Implementing SLOs](https://sre.google/workbook/implementing-slos/)
- [Error Budgets](https://sre.google/sre-book/embracing-risk/)

---

**Last Updated**: 2024-01-15
**Version**: 1.0
**Owner**: SRE Team
**Review Cycle**: Quarterly
