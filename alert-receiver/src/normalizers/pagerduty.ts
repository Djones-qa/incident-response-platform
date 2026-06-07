import { IncidentEvent, Severity, IncidentStatus } from '../types/incident';
import crypto from 'crypto';

interface PagerDutyMessage {
  event: string;
  log_entries?: Array<{
    type: string;
  }>;
  incident: {
    id: string;
    title: string;
    service: { name: string };
    urgency: string;
    status: string;
    body?: { details?: string };
    created_at: string;
  };
}

export interface PagerDutyPayload {
  messages: PagerDutyMessage[];
}

function mapUrgencyToSeverity(urgency: string): Severity {
  switch (urgency.toLowerCase()) {
    case 'high':
      return 'HIGH';
    case 'low':
      return 'MEDIUM';
    default:
      return 'LOW';
  }
}

function mapPDStatus(status: string): IncidentStatus {
  switch (status.toLowerCase()) {
    case 'triggered':
      return 'triggered';
    case 'acknowledged':
      return 'acknowledged';
    case 'resolved':
      return 'resolved';
    default:
      return 'triggered';
  }
}

export function normalizePagerDuty(payload: PagerDutyPayload): IncidentEvent[] {
  return payload.messages.map((msg) => {
    const incident = msg.incident;
    const dedupKey = crypto
      .createHash('sha256')
      .update(`pagerduty:${incident.id}`)
      .digest('hex');

    return {
      id: incident.id,
      source: 'pagerduty',
      alertName: incident.title,
      service: incident.service.name,
      severity: mapUrgencyToSeverity(incident.urgency),
      status: mapPDStatus(incident.status),
      summary: incident.title,
      description: incident.body?.details ?? incident.title,
      timestamp: incident.created_at,
      rawPayload: payload,
      dedupKey,
    };
  });
}
