# Smoke Test Matrix - Unified Reporting System

## Overview

This document defines the smoke test matrix for validating the Unified Reporting System across different browsers, network conditions, user roles, and modes.

## Test Matrix

### Browsers

| Browser | Version | Platform | Priority |
|---------|---------|----------|----------|
| Chrome | Latest | Windows/Mac/Linux | P0 |
| Firefox | Latest | Windows/Mac/Linux | P0 |
| Safari | Latest | Mac | P0 |
| Edge | Latest | Windows | P1 |
| Chrome Mobile | Latest | Android | P1 |
| Safari Mobile | Latest | iOS | P1 |

### User Roles

| Role | Permissions | Test Priority |
|------|-------------|---------------|
| Radiologist | Create, Edit, Finalize, Sign | P0 |
| Admin | All permissions | P0 |
| Technician | Create, Edit (no sign) | P1 |
| Resident | Create, Edit, Finalize (no sign) | P1 |
| Viewer | Read-only | P2 |

### Network Conditions

| Condition | Latency | Bandwidth | Packet Loss | Priority |
|-----------|---------|-----------|-------------|----------|
| Fast 4G | 50ms | 10 Mbps | 0% | P0 |
| Slow 3G | 400ms | 400 Kbps | 1% | P1 |
| Offline | N/A | 0 | 100% | P0 |
| Intermittent | Variable | Variable | 5% | P1 |

### Report Modes

| Mode | Description | Priority |
|------|-------------|----------|
| Manual | User types all content | P0 |
| AI-Assisted | AI findings applied | P0 |
| Template | Pre-filled template | P1 |
| Quick | Minimal fields | P1 |
| Voice | Voice dictation | P2 |

## Smoke Test Scenarios

### Scenario 1: Create Draft Report (P0)

**Prerequisites**: User logged in as Radiologist

**Steps**:
1. Navigate to Reports page
2. Click "Create New Report"
3. Select template (Chest X-Ray)
4. Fill in Clinical Indication
5. Add at least one finding
6. Fill in Impression
7. Verify autosave works

**Expected Results**:
- Report created successfully
- All fields saved
- Status shows "Draft"
- Autosave indicator shows "Saved"

**Test Matrix**:
- ✅ Chrome + Fast 4G + Manual
- ✅ Firefox + Fast 4G + Manual
- ✅ Safari + Fast 4G + Manual
- ✅ Chrome + Slow 3G + Manual
- ✅ Chrome Mobile + Fast 4G + Manual

### Scenario 2: Finalize Report (P0)

**Prerequisites**: Draft report exists

**Steps**:
1. Open draft report
2. Verify all required fields filled
3. Click "Finalize"
4. Confirm finalization
5. Verify status changed to "Preliminary"

**Expected Results**:
- Report finalized successfully
- Status shows "Preliminary"
- Edit controls still enabled
- Sign button now visible

**Test Matrix**:
- ✅ Chrome + Fast 4G + Radiologist
- ✅ Firefox + Fast 4G + Radiologist
- ✅ Safari + Fast 4G + Radiologist

### Scenario 3: Sign Report (P0)

**Prerequisites**: Preliminary report exists, user has sign permission

**Steps**:
1. Open preliminary report
2. Click "Sign"
3. Draw signature
4. Confirm signature
5. Verify status changed to "Final"

**Expected Results**:
- Report signed successfully
- Status shows "Final"
- All edit controls disabled
- Addendum button visible

**Test Matrix**:
- ✅ Chrome + Fast 4G + Radiologist
- ✅ Firefox + Fast 4G + Radiologist
- ✅ Safari + Fast 4G + Radiologist
- ✅ Chrome + Fast 4G + Admin

### Scenario 4: Offline Editing (P0)

**Prerequisites**: Draft report open

**Steps**:
1. Open draft report
2. Disconnect network
3. Edit report content
4. Verify offline indicator shows
5. Reconnect network
6. Verify autosave resumes

**Expected Results**:
- Edits preserved during offline
- Offline indicator visible
- Autosave resumes when online
- No data loss

**Test Matrix**:
- ✅ Chrome + Offline → Online
- ✅ Firefox + Offline → Online
- ✅ Safari + Offline → Online

### Scenario 5: AI-Assisted Report (P0)

**Prerequisites**: AI analysis available

**Steps**:
1. Create new report with AI analysis
2. Click "Apply AI"
3. Verify AI findings added
4. Edit/modify findings
5. Complete and finalize report

**Expected Results**:
- AI findings applied successfully
- Findings marked as AI-detected
- User can edit AI findings
- Report completes normally

**Test Matrix**:
- ✅ Chrome + Fast 4G + AI-Assisted
- ✅ Firefox + Fast 4G + AI-Assisted

### Scenario 6: Export Report (P1)

**Prerequisites**: Final report exists

**Steps**:
1. Open final report
2. Select "Export" → "PDF"
3. Verify download starts
4. Open downloaded PDF
5. Verify content matches report

**Expected Results**:
- PDF downloads successfully
- Content is complete and formatted
- Signature visible (if signed)
- No data corruption

**Test Matrix**:
- ✅ Chrome + Fast 4G + PDF
- ✅ Chrome + Fast 4G + DOCX
- ✅ Firefox + Fast 4G + PDF

### Scenario 7: Add Addendum (P1)

**Prerequisites**: Final report exists

**Steps**:
1. Open final report
2. Click "Add Addendum"
3. Enter addendum text
4. Submit addendum
5. Verify addendum appears

**Expected Results**:
- Addendum added successfully
- Timestamp and author recorded
- Original report unchanged
- Addendum clearly marked

**Test Matrix**:
- ✅ Chrome + Fast 4G + Radiologist
- ✅ Firefox + Fast 4G + Radiologist

### Scenario 8: Version Conflict (P1)

**Prerequisites**: Two users editing same report

**Steps**:
1. User A opens report
2. User B opens same report
3. User A saves changes
4. User B saves changes
5. Verify conflict detected
6. Resolve conflict

**Expected Results**:
- Conflict detected
- Conflict modal shown
- User can choose resolution
- No data loss

**Test Matrix**:
- ✅ Chrome + Fast 4G + Manual

### Scenario 9: Slow Network (P1)

**Prerequisites**: Draft report open

**Steps**:
1. Simulate slow 3G network
2. Edit report content
3. Verify autosave works
4. Verify UI remains responsive

**Expected Results**:
- Autosave completes (may be slow)
- UI remains responsive
- No timeouts or errors
- User can continue working

**Test Matrix**:
- ✅ Chrome + Slow 3G + Manual
- ✅ Firefox + Slow 3G + Manual

### Scenario 10: Permission Enforcement (P1)

**Prerequisites**: User logged in as Technician

**Steps**:
1. Create draft report
2. Finalize report
3. Verify Sign button not visible
4. Verify cannot sign report

**Expected Results**:
- Can create and edit
- Can finalize
- Cannot sign (button hidden)
- Appropriate error if attempted

**Test Matrix**:
- ✅ Chrome + Fast 4G + Technician
- ✅ Chrome + Fast 4G + Resident

## Execution Schedule

### Pre-Release

Run full matrix (P0 + P1 scenarios) on:
- All P0 browsers
- All user roles
- Fast 4G and Offline conditions

### Post-Release (Daily)

Run P0 scenarios on:
- Chrome (latest)
- Fast 4G
- Radiologist role

### Weekly

Run full matrix (P0 + P1 + P2) on:
- All browsers
- All conditions
- All roles

## Automation

### Automated Tests

Scenarios 1-7 are automated in:
- `e2e/reporting.spec.ts`
- `e2e/chaos.spec.ts`

Run with:
```bash
npm run test:e2e
```

### Manual Tests

Scenarios 8-10 require manual testing due to:
- Multi-user coordination
- Network simulation complexity
- Permission verification

## Pass/Fail Criteria

### Pass

- All P0 scenarios pass on P0 browsers
- ≥90% of P1 scenarios pass
- No critical bugs
- No data loss
- Performance within SLOs

### Fail

- Any P0 scenario fails
- Data loss detected
- Security vulnerability found
- Performance SLO violated
- Critical accessibility issue

## Reporting

### Test Results

Record results in:
- Test management system
- CI/CD pipeline
- Smoke test dashboard

### Format

| Scenario | Browser | Network | Role | Mode | Status | Notes |
|----------|---------|---------|------|------|--------|-------|
| Create Draft | Chrome | Fast 4G | Radiologist | Manual | ✅ Pass | - |
| Finalize | Firefox | Fast 4G | Radiologist | Manual | ✅ Pass | - |
| Sign | Safari | Fast 4G | Radiologist | Manual | ❌ Fail | Signature not saving |

## Troubleshooting

### Common Issues

**Autosave not working**:
- Check network connectivity
- Verify API endpoint reachable
- Check browser console for errors

**Sign button not visible**:
- Verify user has sign permission
- Check report status (must be preliminary)
- Verify role-based access control

**Export fails**:
- Check report is finalized
- Verify export service running
- Check file size limits

## Contact

- **Test Lead**: [Name]
- **On-Call**: [PagerDuty]
- **Slack**: #qa-reporting

---

**Last Updated**: 2024-01-15
**Version**: 1.0
**Owner**: QA Team
