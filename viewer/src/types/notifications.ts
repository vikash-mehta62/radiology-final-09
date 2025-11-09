/**
 * Notification Types
 * Types for critical notification system
 */

export interface NotificationRecipient {
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  priority: number;
}

export interface EscalationEvent {
  level: number;
  recipientId: string;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
}

export interface FindingDetails {
  location: string;
  description: string;
  urgency: string;
}

export interface CriticalNotification {
  id: string;
  type: 'critical_finding' | 'urgent_review' | 'system_alert';
  severity: 'critical' | 'high' | 'medium';
  title: string;
  message: string;
  patientId: string;
  studyId: string;
  findingDetails: FindingDetails;
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

export interface NotificationSettings {
  userId: string;
  channels: {
    email: boolean;
    sms: boolean;
    inApp: boolean;
    push: boolean;
  };
  soundEnabled: boolean;
  doNotDisturb: {
    enabled: boolean;
    startTime?: string;
    endTime?: string;
  };
  severityFilters: {
    critical: boolean;
    high: boolean;
    medium: boolean;
  };
}
