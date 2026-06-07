import { IncidentEvent, Severity, IncidentStatus } from '../types/incident';
import crypto from 'crypto';

export interface OpsgeniePayload {
  action: string;
  alert: {
    alertId: string;
    message: string;
    alias: string;
    description?: string;
    source?: string;
    tags?: string[];
    priority: string;
    entity?: string;
    createdAt: number;
    updatedAt: number;
    username?: string;
    responders?: string[];
  };
}

function mapPriorityToSeverity(priority: string): Severity {
  switch (priority.toUpperCase()) {
    case 'P1':
      return 'CRITICAL';
    case 'P2':
      return 'HIGH';
    case 'P3':
      return 'MEDIUM';
    default:
      return 'LOW';
  }
}

function mapOpsgenieAction(action: string): IncidentStatus {
  switch (action.toLowerCase()) {
    case 'create':
      return 'triggered';
    case 'acknowledge':
      return 'acknowledged';
    case 'close':
      return 'resolved';
    default:
      return 'triggered';
  }
}

export function normalizeOpsgenie(payload: OpsgeniePayload): IncidentEvent {
  const dedupKey = crypto
    .createHash('sha256')
    .update(`opsgenie:${payload.alert.alertId}`)
    .digest('hex');

  return {
    id: payload.alert.alertId,
    source: 'opsgenie',
    alertName: payload.alert.message,
    service: payload.alert.entity ?? payload.alert.source ?? 'unknown',
    severity: mapPriorityToSeverity(payload.alert.priority),
    status: mapOpsgenieAction(payload.action),
    summary: payload.alert.message,
    description: payload.alert.description ?? payload.alert.message,
    timestamp: new Date(payload.alert.createdAt).toISOString(),
    rawPayload: payload,
    dedupKey,
  };
}
