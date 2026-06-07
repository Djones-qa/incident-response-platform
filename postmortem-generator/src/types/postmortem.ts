export interface TimelineEntry {
  timestamp: string;
  type: 'incident' | 'action' | 'acknowledgement' | 'resolution';
  actor: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface PostmortemMetrics {
  timeToDetect: string;
  timeToAcknowledge: string;
  timeToResolve: string;
  totalDuration: string;
  actionsExecuted: number;
  servicesAffected: string[];
}

export interface PostmortemDocument {
  incidentId: string;
  generatedAt: string;
  summary: string;
  severity: string;
  service: string;
  timeline: TimelineEntry[];
  impact: string;
  rootCause: string;
  actionItems: string[];
  metrics: PostmortemMetrics;
}
