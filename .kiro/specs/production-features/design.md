# Production Features - Design Document

## Overview

This design document outlines the technical architecture for implementing production-ready features including critical notifications, FDA-compliant digital signatures, comprehensive export capabilities, and secure session management. The design ensures FDA 21 CFR Part 11 compliance, HIPAA security, and operational excellence.

## Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend Application                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Notification │  │   Signature  │  │    Export    │         │
│  │    Panel     │  │    Modal     │  │     Menu     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Session    │  │   WebSocket  │  │    Audit     │         │
│  │  Management  │  │   Client     │  │    Viewer    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
├─────────────────────────────────────────────────────────────────┤
│                     Backend Services                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Notification │  │   Signature  │  │    Export    │         │
│  │   Service    │  │   Service    │  │   Service    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Session    │  │   WebSocket  │  │    Audit     │         │
│  │   Service    │  │   Server     │  │   Service    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
├─────────────────────────────────────────────────────────────────┤
│                  External Services                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   SendGrid   │  │    Twilio    │  │    Redis     │         │
│  │   (Email)    │  │    (SMS)     │  │   (Cache)    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

### Component Structure

```
viewer/src/
├── components/
│   ├── notifications/
│   │   ├── NotificationBell.tsx
│   │   ├── NotificationPanel.tsx
│   │   └── NotificationSettings.tsx
│   ├── signatures/
│   │   ├── SignatureModal.tsx
│   │   ├── SignatureVerificationBadge.tsx
│   │   └── AuditTrailViewer.tsx
│   ├── export/
│   │   ├── ExportMenu.tsx
│   │   ├── ExportProgress.tsx
│   │   └── ExportHistory.tsx
│   └── session/
│       ├── SessionTimeoutWarning.tsx
│       └── SessionMonitor.tsx
├── hooks/
│   ├── useNotifications.ts
│   ├── useSignature.ts
│   ├── useExport.ts
│   └── useSessionManagement.ts (already created)
├── services/
│   ├── notificationService.ts
│   ├── signatureService.ts
│   ├── exportService.ts
│   └── sessionService.ts
└── utils/
    ├── criticalNotifications.ts (already created)
    ├── fdaSignature.ts (already created)
    └── dicomSRExport.ts (already created)

server/src/
├── routes/
│   ├── notifications.js
│   ├── signatures.js
│   ├── export.js
│   └── session.js
├── models/
│   ├── CriticalNotification.js
│   ├── DigitalSignature.js
│   └── ExportSession.js
├── services/
│   ├── notification-service.js
│   ├── email-service.js
│   ├── sms-service.js
│   ├── signature-service.js
│   ├── crypto-service.js
│   ├── dicom-sr-service.js
│   ├── fhir-service.js
│   └── audit-service.js
└── middleware/
    ├── session-middleware.js
    └── signature-middleware.js
```

## Module Designs

### 1. Critical Notification System


#### Data Models

```typescript
interface CriticalNotification {
  id: string;
  type: 'critical_finding' | 'urgent_review' | 'system_alert';
  severity: 'critical' | 'high' | 'medium';
  title: string;
  message: string;
  patientId: string;
  studyId: string;
  findingDetails: {
    location: string;
    description: string;
    urgency: string;
  };
  recipients: NotificationRecipient[];
  channels: ('email' | 'sms' | 'in_app' | 'push')[];
  status: 'pending' | 'delivered' | 'acknowledged' | 'escalated' | 'failed';
  createdAt: Date;
  deliveredAt?: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  escalationLevel: number;
  escalationHistory: EscalationEvent[];
  metadata: Record<string, any>;
}

interface NotificationRecipient {
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  priority: number;
}

interface EscalationEvent {
  level: number;
  recipientId: string;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
}

interface NotificationDeliveryStatus {
  channel: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  attempts: number;
  lastAttempt: Date;
  error?: string;
}
```

#### Notification Service Architecture

```typescript
class NotificationService {
  private emailService: EmailService;
  private smsService: SMSService;
  private websocketService: WebSocketService;
  private escalationService: EscalationService;

  async sendCriticalNotification(notification: CriticalNotification): Promise<void> {
    // 1. Validate notification data
    this.validateNotification(notification);
    
    // 2. Determine recipients based on rules
    const recipients = await this.determineRecipients(notification);
    
    // 3. Send via all configured channels
    const deliveryPromises = notification.channels.map(channel => {
      switch (channel) {
        case 'email':
          return this.emailService.send(notification, recipients);
        case 'sms':
          return this.smsService.send(notification, recipients);
        case 'in_app':
          return this.websocketService.broadcast(notification, recipients);
        case 'push':
          return this.pushService.send(notification, recipients);
      }
    });
    
    // 4. Wait for all deliveries
    await Promise.allSettled(deliveryPromises);
    
    // 5. Start escalation timer
    this.escalationService.startTimer(notification);
    
    // 6. Log notification event
    await this.auditService.logNotification(notification);
  }

  async acknowledgeNotification(notificationId: string, userId: string): Promise<void> {
    // 1. Update notification status
    await this.updateStatus(notificationId, 'acknowledged', userId);
    
    // 2. Cancel escalation timer
    this.escalationService.cancelTimer(notificationId);
    
    // 3. Notify all parties of acknowledgment
    await this.notifyAcknowledgment(notificationId, userId);
    
    // 4. Log acknowledgment
    await this.auditService.logAcknowledgment(notificationId, userId);
  }
}
```

#### Escalation Workflow

```typescript
class EscalationService {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  
  startTimer(notification: CriticalNotification): void {
    const escalationDelay = this.getEscalationDelay(notification.severity);
    
    const timer = setTimeout(async () => {
      await this.escalate(notification);
    }, escalationDelay);
    
    this.timers.set(notification.id, timer);
  }
  
  async escalate(notification: CriticalNotification): Promise<void> {
    const nextLevel = notification.escalationLevel + 1;
    const nextRecipients = await this.getEscalationRecipients(nextLevel);
    
    if (nextRecipients.length === 0) {
      // Escalation chain exhausted
      await this.alertAdministrators(notification);
      return;
    }
    
    // Send to next level
    const escalatedNotification = {
      ...notification,
      escalationLevel: nextLevel,
      recipients: nextRecipients,
      escalationHistory: [
        ...notification.escalationHistory,
        {
          level: nextLevel,
          recipientId: nextRecipients[0].userId,
          timestamp: new Date(),
          acknowledged: false
        }
      ]
    };
    
    await this.notificationService.sendCriticalNotification(escalatedNotification);
  }
  
  private getEscalationDelay(severity: string): number {
    switch (severity) {
      case 'critical': return 5 * 60 * 1000;  // 5 minutes
      case 'high': return 15 * 60 * 1000;     // 15 minutes
      case 'medium': return 30 * 60 * 1000;   // 30 minutes
      default: return 15 * 60 * 1000;
    }
  }
}
```

#### Frontend Integration

```typescript
// Hook for notifications
function useNotifications() {
  const [notifications, setNotifications] = useState<CriticalNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { socket } = useWebSocket();
  
  useEffect(() => {
    // Listen for real-time notifications
    socket.on('critical_notification', (notification: CriticalNotification) => {
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      // Play sound alert
      playNotificationSound();
      
      // Show browser notification
      if (Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/critical-icon.png',
          tag: notification.id
        });
      }
    });
    
    return () => {
      socket.off('critical_notification');
    };
  }, [socket]);
  
  const acknowledgeNotification = async (notificationId: string) => {
    await notificationService.acknowledge(notificationId);
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, status: 'acknowledged' } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };
  
  return { notifications, unreadCount, acknowledgeNotification };
}

// Notification Bell Component
function NotificationBell() {
  const { notifications, unreadCount, acknowledgeNotification } = useNotifications();
  const [open, setOpen] = useState(false);
  
  return (
    <>
      <IconButton onClick={() => setOpen(true)}>
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>
      
      <NotificationPanel
        open={open}
        onClose={() => setOpen(false)}
        notifications={notifications}
        onAcknowledge={acknowledgeNotification}
      />
    </>
  );
}
```

### 2. FDA Digital Signature System


#### Data Models

```typescript
interface DigitalSignature {
  id: string;
  reportId: string;
  signerId: string;
  signerName: string;
  signerRole: string;
  signatureHash: string;
  algorithm: 'RSA-SHA256';
  keySize: 2048;
  timestamp: Date;
  meaning: 'author' | 'reviewer' | 'approver';
  status: 'valid' | 'invalid' | 'revoked';
  revocationReason?: string;
  revokedBy?: string;
  revokedAt?: Date;
  metadata: {
    ipAddress: string;
    userAgent: string;
    location?: string;
  };
  auditTrail: SignatureAuditEvent[];
}

interface SignatureAuditEvent {
  action: 'created' | 'verified' | 'revoked' | 'validation_failed';
  userId: string;
  timestamp: Date;
  ipAddress: string;
  result: 'success' | 'failure';
  details: string;
}

interface SignatureVerificationResult {
  valid: boolean;
  signature: DigitalSignature;
  reportHash: string;
  verifiedAt: Date;
  errors?: string[];
}
```

#### Cryptographic Service

```typescript
class CryptoService {
  private privateKey: string;
  private publicKey: string;
  
  constructor() {
    this.privateKey = fs.readFileSync(process.env.SIGNATURE_PRIVATE_KEY_PATH, 'utf8');
    this.publicKey = fs.readFileSync(process.env.SIGNATURE_PUBLIC_KEY_PATH, 'utf8');
  }
  
  generateSignature(data: string): string {
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(data);
    sign.end();
    return sign.sign(this.privateKey, 'base64');
  }
  
  verifySignature(data: string, signature: string): boolean {
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(data);
    verify.end();
    return verify.verify(this.publicKey, signature, 'base64');
  }
  
  hashData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}
```

#### Signature Service

```typescript
class SignatureService {
  private cryptoService: CryptoService;
  private auditService: AuditService;
  
  async signReport(reportId: string, userId: string, meaning: string): Promise<DigitalSignature> {
    // 1. Fetch report data
    const report = await this.reportService.getReport(reportId);
    
    // 2. Validate report is ready for signing
    this.validateReportForSigning(report);
    
    // 3. Generate report hash
    const reportData = this.serializeReport(report);
    const reportHash = this.cryptoService.hashData(reportData);
    
    // 4. Generate signature
    const signatureHash = this.cryptoService.generateSignature(reportHash);
    
    // 5. Create signature record
    const signature: DigitalSignature = {
      id: uuidv4(),
      reportId,
      signerId: userId,
      signerName: await this.getUserName(userId),
      signerRole: await this.getUserRole(userId),
      signatureHash,
      algorithm: 'RSA-SHA256',
      keySize: 2048,
      timestamp: new Date(),
      meaning,
      status: 'valid',
      metadata: {
        ipAddress: this.getClientIP(),
        userAgent: this.getUserAgent()
      },
      auditTrail: [{
        action: 'created',
        userId,
        timestamp: new Date(),
        ipAddress: this.getClientIP(),
        result: 'success',
        details: `Report signed by ${await this.getUserName(userId)}`
      }]
    };
    
    // 6. Save signature
    await this.saveSignature(signature);
    
    // 7. Update report status
    await this.reportService.updateStatus(reportId, 'signed');
    
    // 8. Log audit event
    await this.auditService.logSignature(signature);
    
    return signature;
  }
  
  async verifySignature(signatureId: string): Promise<SignatureVerificationResult> {
    // 1. Fetch signature
    const signature = await this.getSignature(signatureId);
    
    // 2. Fetch report
    const report = await this.reportService.getReport(signature.reportId);
    
    // 3. Generate current report hash
    const reportData = this.serializeReport(report);
    const currentHash = this.cryptoService.hashData(reportData);
    
    // 4. Verify signature
    const valid = this.cryptoService.verifySignature(currentHash, signature.signatureHash);
    
    // 5. Log verification attempt
    await this.auditService.logVerification(signature.id, valid);
    
    // 6. Update signature audit trail
    signature.auditTrail.push({
      action: 'verified',
      userId: this.getCurrentUserId(),
      timestamp: new Date(),
      ipAddress: this.getClientIP(),
      result: valid ? 'success' : 'failure',
      details: valid ? 'Signature verified successfully' : 'Signature verification failed'
    });
    
    await this.updateSignature(signature);
    
    return {
      valid,
      signature,
      reportHash: currentHash,
      verifiedAt: new Date(),
      errors: valid ? undefined : ['Signature verification failed - report may have been modified']
    };
  }
  
  async revokeSignature(signatureId: string, reason: string, userId: string): Promise<void> {
    const signature = await this.getSignature(signatureId);
    
    signature.status = 'revoked';
    signature.revocationReason = reason;
    signature.revokedBy = userId;
    signature.revokedAt = new Date();
    
    signature.auditTrail.push({
      action: 'revoked',
      userId,
      timestamp: new Date(),
      ipAddress: this.getClientIP(),
      result: 'success',
      details: `Signature revoked: ${reason}`
    });
    
    await this.updateSignature(signature);
    await this.auditService.logRevocation(signature);
  }
}
```

#### Frontend Integration

```typescript
// Signature Modal Component
function SignatureModal({ reportId, open, onClose, onSigned }: SignatureModalProps) {
  const [meaning, setMeaning] = useState<'author' | 'reviewer' | 'approver'>('author');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  
  const handleSign = async () => {
    setLoading(true);
    try {
      // 1. Verify password
      await authService.verifyPassword(password);
      
      // 2. Sign report
      const signature = await signatureService.signReport(reportId, user.id, meaning);
      
      // 3. Show success
      toast.success('Report signed successfully');
      onSigned(signature);
      onClose();
    } catch (error) {
      toast.error('Failed to sign report: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Sign Report</DialogTitle>
      <DialogContent>
        <Typography variant="body2" gutterBottom>
          By signing this report, you certify that the information is accurate and complete.
        </Typography>
        
        <FormControl fullWidth margin="normal">
          <InputLabel>Signature Meaning</InputLabel>
          <Select value={meaning} onChange={(e) => setMeaning(e.target.value)}>
            <MenuItem value="author">Author</MenuItem>
            <MenuItem value="reviewer">Reviewer</MenuItem>
            <MenuItem value="approver">Approver</MenuItem>
          </Select>
        </FormControl>
        
        <TextField
          fullWidth
          type="password"
          label="Confirm Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          margin="normal"
        />
        
        <Alert severity="info" sx={{ mt: 2 }}>
          This signature is legally binding and complies with FDA 21 CFR Part 11.
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSign}
          variant="contained"
          disabled={!password || loading}
        >
          {loading ? 'Signing...' : 'Sign Report'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Signature Verification Badge
function SignatureVerificationBadge({ signatureId }: { signatureId: string }) {
  const [verification, setVerification] = useState<SignatureVerificationResult | null>(null);
  
  useEffect(() => {
    signatureService.verifySignature(signatureId).then(setVerification);
  }, [signatureId]);
  
  if (!verification) return <CircularProgress size={20} />;
  
  return (
    <Chip
      icon={verification.valid ? <VerifiedIcon /> : <ErrorIcon />}
      label={verification.valid ? 'Signature Valid' : 'Signature Invalid'}
      color={verification.valid ? 'success' : 'error'}
      size="small"
    />
  );
}
```

### 3. Export System


#### Data Models

```typescript
interface ExportSession {
  id: string;
  reportId: string;
  userId: string;
  format: 'dicom-sr' | 'fhir' | 'pdf';
  status: 'initiated' | 'processing' | 'completed' | 'failed';
  progress: number;
  fileUrl?: string;
  fileSize?: number;
  error?: string;
  metadata: {
    recipient?: string;
    purpose?: string;
    ipAddress: string;
  };
  createdAt: Date;
  completedAt?: Date;
}

interface DICOMSRExport {
  sopInstanceUID: string;
  sopClassUID: string;
  studyInstanceUID: string;
  seriesInstanceUID: string;
  patientInfo: PatientInfo;
  reportContent: string;
  structuredFindings: Finding[];
  measurements: Measurement[];
  signature?: DigitalSignature;
}

interface FHIRExport {
  resourceType: 'DiagnosticReport';
  id: string;
  status: 'preliminary' | 'final' | 'amended';
  code: CodeableConcept;
  subject: Reference;
  performer: Reference[];
  conclusion: string;
  presentedForm?: Attachment[];
}
```

#### DICOM SR Service

```typescript
class DICOMSRService {
  async exportReport(reportId: string): Promise<Buffer> {
    // 1. Fetch report data
    const report = await this.reportService.getReport(reportId);
    
    // 2. Validate report completeness
    this.validateReportForExport(report);
    
    // 3. Generate DICOM SR structure
    const dicomSR = this.generateDICOMSR(report);
    
    // 4. Validate DICOM structure
    this.validateDICOMStructure(dicomSR);
    
    // 5. Encode to DICOM format
    const buffer = await this.encodeDICOM(dicomSR);
    
    // 6. Log export
    await this.auditService.logExport(reportId, 'dicom-sr');
    
    return buffer;
  }
  
  private generateDICOMSR(report: Report): DICOMSRExport {
    return {
      sopInstanceUID: this.generateUID(),
      sopClassUID: '1.2.840.10008.5.1.4.1.1.88.11', // Basic Text SR
      studyInstanceUID: report.studyInstanceUID,
      seriesInstanceUID: this.generateUID(),
      patientInfo: report.patientInfo,
      reportContent: this.formatReportContent(report),
      structuredFindings: report.structuredFindings || [],
      measurements: report.measurements || [],
      signature: report.signature
    };
  }
  
  private async encodeDICOM(dicomSR: DICOMSRExport): Promise<Buffer> {
    // Use DICOM toolkit to encode
    const dataset = {
      // Patient Module
      '00100010': { vr: 'PN', Value: [dicomSR.patientInfo.name] },
      '00100020': { vr: 'LO', Value: [dicomSR.patientInfo.id] },
      '00100030': { vr: 'DA', Value: [dicomSR.patientInfo.birthDate] },
      '00100040': { vr: 'CS', Value: [dicomSR.patientInfo.sex] },
      
      // Study Module
      '0020000D': { vr: 'UI', Value: [dicomSR.studyInstanceUID] },
      '00080020': { vr: 'DA', Value: [new Date().toISOString().split('T')[0]] },
      '00080030': { vr: 'TM', Value: [new Date().toISOString().split('T')[1]] },
      
      // SR Document Module
      '00080018': { vr: 'UI', Value: [dicomSR.sopInstanceUID] },
      '00080016': { vr: 'UI', Value: [dicomSR.sopClassUID] },
      '0020000E': { vr: 'UI', Value: [dicomSR.seriesInstanceUID] },
      
      // SR Document Content
      '0040A730': { vr: 'SQ', Value: this.encodeContentSequence(dicomSR) }
    };
    
    return dicomWriter.write(dataset);
  }
}
```

#### FHIR Service

```typescript
class FHIRService {
  async exportReport(reportId: string): Promise<FHIRExport> {
    const report = await this.reportService.getReport(reportId);
    
    const fhirReport: FHIRExport = {
      resourceType: 'DiagnosticReport',
      id: reportId,
      status: this.mapStatus(report.status),
      code: {
        coding: [{
          system: 'http://loinc.org',
          code: '18748-4',
          display: 'Diagnostic imaging study'
        }]
      },
      subject: {
        reference: `Patient/${report.patientInfo.id}`,
        display: report.patientInfo.name
      },
      performer: [{
        reference: `Practitioner/${report.authorId}`,
        display: report.authorName
      }],
      conclusion: report.impression,
      presentedForm: [{
        contentType: 'text/plain',
        data: Buffer.from(this.formatReportText(report)).toString('base64')
      }]
    };
    
    // Validate against FHIR specification
    await this.validateFHIR(fhirReport);
    
    return fhirReport;
  }
  
  async validateFHIR(resource: any): Promise<void> {
    // Use FHIR validator library
    const validator = new FHIRValidator();
    const result = await validator.validate(resource, 'R4');
    
    if (!result.valid) {
      throw new Error(`FHIR validation failed: ${result.errors.join(', ')}`);
    }
  }
}
```

#### PDF Service

```typescript
class PDFService {
  async exportReport(reportId: string): Promise<Buffer> {
    const report = await this.reportService.getReport(reportId);
    const template = await this.getTemplate(report.modality);
    
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });
    
    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(chunk));
    
    // Header
    doc.image('hospital-logo.png', 50, 45, { width: 100 });
    doc.fontSize(20).text('Medical Imaging Report', 200, 50);
    
    // Patient Information
    doc.fontSize(12).text(`Patient: ${report.patientInfo.name}`, 50, 120);
    doc.text(`MRN: ${report.patientInfo.id}`, 50, 140);
    doc.text(`DOB: ${report.patientInfo.birthDate}`, 50, 160);
    
    // Study Information
    doc.text(`Study Date: ${report.studyDate}`, 350, 120);
    doc.text(`Modality: ${report.modality}`, 350, 140);
    doc.text(`Accession: ${report.accessionNumber}`, 350, 160);
    
    // Report Content
    doc.moveDown(2);
    doc.fontSize(14).text('Clinical History', { underline: true });
    doc.fontSize(11).text(report.clinicalHistory || 'Not provided');
    
    doc.moveDown();
    doc.fontSize(14).text('Findings', { underline: true });
    doc.fontSize(11).text(report.findings);
    
    doc.moveDown();
    doc.fontSize(14).text('Impression', { underline: true });
    doc.fontSize(11).text(report.impression);
    
    // Signature
    if (report.signature) {
      doc.moveDown(2);
      doc.fontSize(10).text(`Electronically signed by ${report.signature.signerName}`);
      doc.text(`Date: ${report.signature.timestamp.toLocaleString()}`);
      doc.text(`Signature ID: ${report.signature.id}`);
    }
    
    // Watermark for preliminary reports
    if (report.status === 'draft') {
      doc.fontSize(60).fillColor('red', 0.3)
        .text('PRELIMINARY', 100, 400, { rotate: 45 });
    }
    
    doc.end();
    
    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
}
```

#### Frontend Export Menu

```typescript
function ExportMenu({ reportId }: { reportId: string }) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const handleExport = async (format: 'dicom-sr' | 'fhir' | 'pdf') => {
    setExporting(true);
    setProgress(0);
    
    try {
      const exportSession = await exportService.initiateExport(reportId, format);
      
      // Poll for progress
      const interval = setInterval(async () => {
        const status = await exportService.getExportStatus(exportSession.id);
        setProgress(status.progress);
        
        if (status.status === 'completed') {
          clearInterval(interval);
          // Download file
          window.open(status.fileUrl, '_blank');
          toast.success(`Report exported as ${format.toUpperCase()}`);
          setExporting(false);
        } else if (status.status === 'failed') {
          clearInterval(interval);
          toast.error(`Export failed: ${status.error}`);
          setExporting(false);
        }
      }, 1000);
    } catch (error) {
      toast.error('Failed to initiate export');
      setExporting(false);
    }
  };
  
  return (
    <>
      <Button
        startIcon={<DownloadIcon />}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        disabled={exporting}
      >
        {exporting ? `Exporting... ${progress}%` : 'Export'}
      </Button>
      
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={() => handleExport('pdf')}>
          <ListItemIcon><PictureAsPdfIcon /></ListItemIcon>
          <ListItemText>Export as PDF</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleExport('dicom-sr')}>
          <ListItemIcon><MedicalServicesIcon /></ListItemIcon>
          <ListItemText>Export as DICOM SR</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleExport('fhir')}>
          <ListItemIcon><CloudIcon /></ListItemIcon>
          <ListItemText>Export as FHIR</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
```

### 4. Session Management System


#### Session Architecture

```typescript
interface Session {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  deviceInfo: {
    userAgent: string;
    ipAddress: string;
    deviceId: string;
    location?: string;
  };
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  status: 'active' | 'expired' | 'revoked';
}

interface TokenPayload {
  userId: string;
  sessionId: string;
  roles: string[];
  iat: number;
  exp: number;
}
```

#### Session Service

```typescript
class SessionService {
  private readonly ACCESS_TOKEN_EXPIRY = 30 * 60; // 30 minutes
  private readonly REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly WARNING_TIME = 5 * 60 * 1000; // 5 minutes
  
  async createSession(userId: string, deviceInfo: any): Promise<Session> {
    // 1. Check concurrent session limit
    await this.enforceSessionLimit(userId);
    
    // 2. Generate tokens
    const sessionId = uuidv4();
    const accessToken = this.generateAccessToken(userId, sessionId);
    const refreshToken = this.generateRefreshToken(userId, sessionId);
    
    // 3. Create session record
    const session: Session = {
      id: sessionId,
      userId,
      accessToken,
      refreshToken,
      deviceInfo,
      createdAt: new Date(),
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + this.REFRESH_TOKEN_EXPIRY * 1000),
      status: 'active'
    };
    
    // 4. Store session
    await this.storeSession(session);
    
    // 5. Log session creation
    await this.auditService.logSessionCreated(session);
    
    return session;
  }
  
  async refreshAccessToken(refreshToken: string): Promise<string> {
    // 1. Verify refresh token
    const payload = this.verifyToken(refreshToken);
    
    // 2. Get session
    const session = await this.getSession(payload.sessionId);
    
    // 3. Validate session
    if (session.status !== 'active') {
      throw new Error('Session is not active');
    }
    
    if (session.expiresAt < new Date()) {
      throw new Error('Session has expired');
    }
    
    // 4. Generate new access token
    const newAccessToken = this.generateAccessToken(payload.userId, payload.sessionId);
    
    // 5. Update session
    session.accessToken = newAccessToken;
    session.lastActivity = new Date();
    await this.updateSession(session);
    
    // 6. Log token refresh
    await this.auditService.logTokenRefresh(session.id);
    
    return newAccessToken;
  }
  
  async validateSession(accessToken: string): Promise<boolean> {
    try {
      // 1. Verify token
      const payload = this.verifyToken(accessToken);
      
      // 2. Get session
      const session = await this.getSession(payload.sessionId);
      
      // 3. Check session status
      if (session.status !== 'active') return false;
      
      // 4. Check expiration
      if (session.expiresAt < new Date()) {
        await this.expireSession(session.id);
        return false;
      }
      
      // 5. Check inactivity timeout
      const inactiveTime = Date.now() - session.lastActivity.getTime();
      if (inactiveTime > this.SESSION_TIMEOUT) {
        await this.expireSession(session.id);
        return false;
      }
      
      // 6. Update last activity
      session.lastActivity = new Date();
      await this.updateSession(session);
      
      return true;
    } catch (error) {
      return false;
    }
  }
  
  async revokeSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    session.status = 'revoked';
    await this.updateSession(session);
    await this.auditService.logSessionRevoked(sessionId);
  }
  
  private generateAccessToken(userId: string, sessionId: string): string {
    return jwt.sign(
      { userId, sessionId, type: 'access' },
      process.env.JWT_SECRET,
      { expiresIn: this.ACCESS_TOKEN_EXPIRY }
    );
  }
  
  private generateRefreshToken(userId: string, sessionId: string): string {
    return jwt.sign(
      { userId, sessionId, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: this.REFRESH_TOKEN_EXPIRY }
    );
  }
  
  private verifyToken(token: string): TokenPayload {
    return jwt.verify(token, process.env.JWT_SECRET) as TokenPayload;
  }
}
```

#### Frontend Session Management Hook

```typescript
// useSessionManagement.ts (already created, enhance it)
function useSessionManagement() {
  const [sessionStatus, setSessionStatus] = useState<'active' | 'warning' | 'expired'>('active');
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const { logout } = useAuth();
  
  useEffect(() => {
    // Monitor session activity
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    
    const updateActivity = () => {
      sessionService.updateActivity();
      setSessionStatus('active');
    };
    
    activityEvents.forEach(event => {
      window.addEventListener(event, updateActivity);
    });
    
    // Check session status periodically
    const interval = setInterval(async () => {
      const status = await sessionService.getSessionStatus();
      
      if (status.expiresIn < 5 * 60 * 1000) { // 5 minutes
        setSessionStatus('warning');
        setTimeRemaining(status.expiresIn);
      }
      
      if (status.expiresIn <= 0) {
        setSessionStatus('expired');
        logout();
      }
    }, 10000); // Check every 10 seconds
    
    // Auto-refresh token
    const refreshInterval = setInterval(async () => {
      try {
        await sessionService.refreshToken();
      } catch (error) {
        console.error('Token refresh failed:', error);
      }
    }, 10 * 60 * 1000); // Refresh every 10 minutes
    
    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
      clearInterval(interval);
      clearInterval(refreshInterval);
    };
  }, [logout]);
  
  const extendSession = async () => {
    await sessionService.extendSession();
    setSessionStatus('active');
  };
  
  return { sessionStatus, timeRemaining, extendSession };
}

// Session Timeout Warning Component
function SessionTimeoutWarning() {
  const { sessionStatus, timeRemaining, extendSession } = useSessionManagement();
  const [open, setOpen] = useState(false);
  
  useEffect(() => {
    setOpen(sessionStatus === 'warning');
  }, [sessionStatus]);
  
  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  return (
    <Dialog open={open} onClose={() => {}}>
      <DialogTitle>
        <WarningIcon color="warning" sx={{ mr: 1 }} />
        Session Expiring Soon
      </DialogTitle>
      <DialogContent>
        <Typography>
          Your session will expire in {formatTime(timeRemaining)}.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Click "Stay Logged In" to continue your session, or you will be automatically logged out.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => window.location.href = '/login'}>
          Logout Now
        </Button>
        <Button onClick={extendSession} variant="contained" autoFocus>
          Stay Logged In
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

## API Endpoints

### Notification Endpoints

```
POST   /api/notifications/critical
       Body: { type, severity, title, message, patientId, studyId, findingDetails, recipients, channels }
       Response: CriticalNotification

GET    /api/notifications/critical/:id
       Response: CriticalNotification

POST   /api/notifications/critical/:id/acknowledge
       Body: { userId }
       Response: { success: boolean }

POST   /api/notifications/critical/:id/escalate
       Response: { success: boolean }

GET    /api/notifications/settings
       Response: NotificationSettings

PUT    /api/notifications/settings
       Body: NotificationSettings
       Response: NotificationSettings

GET    /api/notifications/history
       Query: ?userId=xxx&startDate=xxx&endDate=xxx
       Response: CriticalNotification[]
```

### Signature Endpoints

```
POST   /api/signatures/sign
       Body: { reportId, meaning, password }
       Response: DigitalSignature

GET    /api/signatures/verify/:signatureId
       Response: SignatureVerificationResult

GET    /api/signatures/audit-trail/:reportId
       Response: SignatureAuditEvent[]

POST   /api/signatures/revoke/:signatureId
       Body: { reason, password }
       Response: { success: boolean }

POST   /api/signatures/validate
       Body: { reportId }
       Response: SignatureVerificationResult
```

### Export Endpoints

```
POST   /api/reports/:id/export/dicom-sr
       Response: { exportId, status }

POST   /api/reports/:id/export/fhir
       Response: { exportId, status }

POST   /api/reports/:id/export/pdf
       Response: { exportId, status }

GET    /api/reports/export/status/:exportId
       Response: ExportSession

GET    /api/reports/export/download/:exportId
       Response: File download

GET    /api/reports/export/history
       Query: ?userId=xxx&format=xxx
       Response: ExportSession[]
```

### Session Endpoints

```
POST   /api/auth/refresh-token
       Body: { refreshToken }
       Response: { accessToken }

POST   /api/auth/logout
       Response: { success: boolean }

GET    /api/auth/session-status
       Response: { status, expiresIn, lastActivity }

POST   /api/auth/extend-session
       Response: { success: boolean, newExpiry }

GET    /api/auth/sessions
       Response: Session[]

DELETE /api/auth/sessions/:sessionId
       Response: { success: boolean }
```

## Database Schema

### MongoDB Collections

```javascript
// Critical Notifications
db.criticalnotifications.createIndex({ patientId: 1, createdAt: -1 });
db.criticalnotifications.createIndex({ status: 1, createdAt: -1 });
db.criticalnotifications.createIndex({ 'recipients.userId': 1 });

// Digital Signatures
db.digitalsignatures.createIndex({ reportId: 1 });
db.digitalsignatures.createIndex({ signerId: 1, timestamp: -1 });
db.digitalsignatures.createIndex({ status: 1 });

// Export Sessions
db.exportsessions.createIndex({ reportId: 1, createdAt: -1 });
db.exportsessions.createIndex({ userId: 1, format: 1 });
db.exportsessions.createIndex({ status: 1 });

// Sessions
db.sessions.createIndex({ userId: 1, status: 1 });
db.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
db.sessions.createIndex({ 'deviceInfo.deviceId': 1 });
```

## Security Considerations

### Encryption
- All PHI encrypted at rest using AES-256
- All network traffic over TLS 1.3
- Signature keys stored in hardware security module (HSM) or encrypted key store
- Session tokens encrypted with HTTP-only secure cookies

### Authentication
- Multi-factor authentication for signature operations
- Password verification required for signing
- IP address validation for sessions
- Device fingerprinting for anomaly detection

### Authorization
- Role-based access control for all operations
- Audit logging for all sensitive operations
- Rate limiting on authentication endpoints
- CSRF protection on all state-changing operations

### Compliance
- FDA 21 CFR Part 11 compliance for signatures
- HIPAA Security Rule compliance
- SOC 2 Type II compliance
- Regular security audits and penetration testing

## Performance Optimization

### Caching Strategy
- Redis cache for active sessions
- In-memory cache for notification rules
- CDN for static assets
- Database query optimization with indexes

### Asynchronous Processing
- Queue-based notification delivery
- Background export processing
- Async audit logging
- Batch processing for bulk operations

### Monitoring
- Real-time performance metrics
- Error tracking and alerting
- Usage analytics
- Compliance monitoring

## Testing Strategy

### Unit Tests
- Test all service methods
- Test cryptographic operations
- Test validation logic
- Test error handling

### Integration Tests
- Test API endpoints
- Test database operations
- Test external service integrations
- Test WebSocket connections

### End-to-End Tests
- Test complete notification workflow
- Test signature creation and verification
- Test export generation and download
- Test session lifecycle

### Security Tests
- Penetration testing
- Vulnerability scanning
- Compliance validation
- Load testing

## Deployment Strategy

### Environment Configuration
- Separate configs for dev/staging/prod
- Secure secret management
- Environment-specific feature flags
- Automated configuration validation

### Database Migration
- Schema migration scripts
- Data migration procedures
- Rollback procedures
- Backup and recovery

### Monitoring and Alerting
- Application performance monitoring
- Error tracking
- Security event monitoring
- Compliance monitoring

### Rollout Plan
- Phased rollout by user group
- Feature flags for gradual enablement
- Monitoring and feedback collection
- Rollback procedures if needed
