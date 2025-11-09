# Communication Templates - Unified Reporting System

## 1. Heads-Up (Soft Launch Notice)

### Email Subject
```
Unified Reporting System - Launching [Date]
```

### Email Body
```
Hi Team,

We're excited to announce that the new Unified Reporting System will be launching on [DATE] at [TIME UTC].

What's New:
• Streamlined report creation workflow
• AI-assisted findings detection
• Real-time autosave (no more lost work!)
• Digital signature support
• Enhanced export options (PDF, DOCX, FHIR)

Rollout Plan:
We'll be rolling out gradually over 24 hours:
• Hours 0-4: 10% of users
• Hours 4-12: 25-50% of users
• Hours 12-24: 100% of users

What to Expect:
• You may see a "New" badge on the Reports page
• Your existing reports remain accessible
• Training materials: [LINK]
• Support: [EMAIL/SLACK]

Questions?
Reply to this email or reach out in #radiology-support

Thank you for your patience as we improve our reporting system!

Best regards,
[Your Name]
Product Team
```

### In-App Notification
```
🎉 New Unified Reporting System launching [DATE]!

Streamlined workflow, AI assistance, and real-time autosave.

[Learn More] [Dismiss]
```

### Slack Announcement
```
:rocket: Unified Reporting System Launch - [DATE] at [TIME UTC]

We're rolling out the new reporting system gradually over 24 hours.

*What's New:*
• Streamlined workflow
• AI-assisted findings
• Real-time autosave
• Digital signatures
• Enhanced exports

*Rollout Schedule:*
• 0-4h: 10% of users
• 4-12h: 25-50% of users
• 12-24h: 100% of users

*Resources:*
• Training: [LINK]
• FAQ: [LINK]
• Support: #radiology-support

Questions? Ask in thread :point_down:
```

---

## 2. Incident Customer Update

### Initial Notification (T+0)

#### Email Subject
```
[Action Required] Unified Reporting System - Service Disruption
```

#### Email Body
```
Hi Team,

We're currently experiencing issues with the Unified Reporting System.

Status: Investigating
Impact: <IMPACT>
Workaround: <WORKAROUND>

What We're Doing:
<ACTION>

Next Update: <NEXT_UPDATE_TIME>

We apologize for the inconvenience and are working to resolve this as quickly as possible.

For urgent reporting needs, please use: <WORKAROUND>

Updates: https://status.example.com

Best regards,
Engineering Team
```

#### Status Page Update
```
Title: Unified Reporting System - Service Disruption
Status: Investigating
Severity: Major

We are investigating reports of issues with the Unified Reporting System. 
Users may experience <IMPACT>.

Workaround: <WORKAROUND>

We will provide an update within <NEXT_UPDATE_TIME>.

Posted: [TIMESTAMP]
```

#### Slack Update
```
:warning: INCIDENT: Unified Reporting System

*Status:* Investigating
*Impact:* <IMPACT>
*Workaround:* <WORKAROUND>

*What We're Doing:*
<ACTION>

*Next Update:* <NEXT_UPDATE_TIME>

Thread for updates :point_down:
```

### 60-Minute Update (T+60)

#### Email Subject
```
[Update] Unified Reporting System - Investigation Continues
```

#### Email Body
```
Hi Team,

Update on the Unified Reporting System issue:

Status: <Investigating/Identified/Mitigating>
Impact: <IMPACT>
Workaround: <WORKAROUND>

Progress:
<WHAT_WE_FOUND>

Next Steps:
<NEXT_STEPS>

ETA: <ETA>
Next Update: <NEXT_UPDATE_TIME>

We appreciate your patience.

Best regards,
Engineering Team
```

#### Status Page Update
```
Title: Unified Reporting System - Service Disruption
Status: <Investigating/Identified/Monitoring>
Severity: Major

Update: <WHAT_WE_FOUND>

Impact: <IMPACT>
Workaround: <WORKAROUND>
ETA: <ETA>

Next update: <NEXT_UPDATE_TIME>

Updated: [TIMESTAMP]
```

#### Slack Update
```
:hourglass: UPDATE (T+60): Unified Reporting System

*Status:* <Investigating/Identified/Mitigating>
*Progress:* <WHAT_WE_FOUND>
*Next Steps:* <NEXT_STEPS>
*ETA:* <ETA>

*Workaround still available:* <WORKAROUND>

Next update: <NEXT_UPDATE_TIME>
```

### Resolution (T+Final)

#### Email Subject
```
[Resolved] Unified Reporting System - Service Restored
```

#### Email Body
```
Hi Team,

The Unified Reporting System issue has been resolved.

Status: Resolved
Duration: <DURATION>
Impact: <IMPACT>

What Happened:
<ROOT_CAUSE>

What We Did:
<RESOLUTION>

Prevention:
<PREVENTION_STEPS>

We apologize for the disruption and appreciate your patience.

If you continue to experience issues, please contact support at <EMAIL/SLACK>.

Best regards,
Engineering Team

Postmortem: <LINK> (available within 48 hours)
```

#### Status Page Update
```
Title: Unified Reporting System - Service Restored
Status: Resolved
Severity: Major

The issue with the Unified Reporting System has been resolved.

Duration: <DURATION>
Root Cause: <ROOT_CAUSE>
Resolution: <RESOLUTION>

All services are now operating normally.

If you continue to experience issues, please contact support.

Postmortem: <LINK>

Resolved: [TIMESTAMP]
```

#### Slack Update
```
:white_check_mark: RESOLVED: Unified Reporting System

*Status:* Resolved
*Duration:* <DURATION>
*Root Cause:* <ROOT_CAUSE>

*What We Did:*
<RESOLUTION>

*Prevention:*
<PREVENTION_STEPS>

All services restored. Thank you for your patience!

Postmortem: <LINK> (within 48h)
```

---

## 3. Internal Engineering Handoff Note

### Template

```
# Incident Handoff - Unified Reporting System

## Current Status
- **Severity**: [P0/P1/P2]
- **Status**: [Investigating/Mitigating/Monitoring]
- **Started**: [TIMESTAMP]
- **Duration**: [DURATION]

## Impact
- **Users Affected**: [NUMBER/PERCENTAGE]
- **Functionality**: [WHAT'S BROKEN]
- **Workaround**: [IF ANY]

## What We Know
- [FINDING 1]
- [FINDING 2]
- [FINDING 3]

## What We've Tried
- [ACTION 1] - [RESULT]
- [ACTION 2] - [RESULT]
- [ACTION 3] - [RESULT]

## Current Theory
[ROOT CAUSE HYPOTHESIS]

## Next Steps
1. [NEXT ACTION 1]
2. [NEXT ACTION 2]
3. [NEXT ACTION 3]

## Metrics to Watch
- Autosave success rate: [CURRENT VALUE]
- API error rate: [CURRENT VALUE]
- Error budget burn: [CURRENT VALUE]

## Rollback Status
- **Rollback Executed**: [YES/NO]
- **Current Rollout**: [PERCENTAGE]
- **Rollback Plan**: [IF NEEDED]

## Communication
- **Last User Update**: [TIMESTAMP]
- **Next Update Due**: [TIMESTAMP]
- **Stakeholders Notified**: [YES/NO]

## Resources
- **Grafana**: [LINK]
- **Logs**: [LINK]
- **Incident Channel**: #incident-[ID]
- **Zoom**: [LINK]

## Handoff Notes
[ANYTHING ELSE THE NEXT PERSON SHOULD KNOW]

---
**Handed off by**: [NAME]
**Handed off to**: [NAME]
**Handoff time**: [TIMESTAMP]
```

---

## Placeholder Reference

### Common Placeholders

- `<IMPACT>`: Description of user impact
  - Example: "Users may experience delays saving reports"
  - Example: "Report creation is currently unavailable"
  - Example: "Some users cannot access their reports"

- `<WORKAROUND>`: Alternative solution
  - Example: "Please use the legacy reporting system"
  - Example: "Reports can be created manually and uploaded"
  - Example: "Contact support for manual report creation"

- `<ACTION>`: What we're doing
  - Example: "Our team is investigating the root cause"
  - Example: "We've identified the issue and are deploying a fix"
  - Example: "We're rolling back to the previous version"

- `<ETA>`: Estimated resolution time
  - Example: "within 30 minutes"
  - Example: "by 3:00 PM UTC"
  - Example: "investigating, no ETA yet"

- `<NEXT_UPDATE_TIME>`: When next update will be posted
  - Example: "in 30 minutes"
  - Example: "at 2:00 PM UTC"
  - Example: "within 1 hour"

- `<ROOT_CAUSE>`: What caused the issue
  - Example: "Database connection pool exhaustion"
  - Example: "Deployment configuration error"
  - Example: "Unexpected traffic spike"

- `<RESOLUTION>`: How we fixed it
  - Example: "Increased database connection pool size"
  - Example: "Rolled back to previous version"
  - Example: "Applied hotfix to API servers"

- `<PREVENTION_STEPS>`: How we'll prevent recurrence
  - Example: "Added monitoring for connection pool usage"
  - Example: "Improved deployment validation checks"
  - Example: "Implemented rate limiting"

---

## Best Practices

### Timing
- **Initial notification**: Within 15 minutes of detection
- **Updates**: Every 30-60 minutes during active incident
- **Resolution**: Within 15 minutes of fix

### Tone
- **Be honest**: Don't minimize the issue
- **Be clear**: Use simple language
- **Be empathetic**: Acknowledge the inconvenience
- **Be proactive**: Provide workarounds

### Content
- **What happened**: Brief, factual description
- **Impact**: Who is affected and how
- **Status**: What we're doing now
- **Timeline**: When to expect updates/resolution
- **Workaround**: Alternative if available

### Channels
- **Email**: For all users, formal updates
- **Slack**: For team, real-time updates
- **Status Page**: For public, official record
- **In-App**: For active users, immediate notification

---

**Last Updated**: 2024-01-15
**Version**: 1.0
**Owner**: Communications Team
