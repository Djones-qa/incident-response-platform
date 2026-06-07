export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IncidentStatus = 'triggered' | 'acknowledged' | 'resolved';
export type AlertSource = 'pagerduty' | 'opsgenie';

export interface IncidentEvent {
  id: string;
  source: AlertSource;
  alertName: string;
  service: string;
  severity: Severity;
  status: IncidentStatus;
  summary: string;
  description: string;
  timestamp: string;
  rawPayload: unknown;
  dedupKey: string;
}
