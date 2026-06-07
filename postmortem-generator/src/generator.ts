import {
  PostmortemDocument,
  TimelineEntry,
  PostmortemMetrics,
} from './types/postmortem';
import { RawTimelineEntry } from './timelineReader';

interface IncidentEventEntry {
  id: string;
  alertName: string;
  service: string;
  severity: string;
  status: string;
  summary: string;
  description: string;
  timestamp: string;
  source: string;
}

interface ExecutionLogEntry {
  runbookName: string;
  action: string;
  incidentId: string;
  status: string;
  target: string;
  executedAt: string;
  dryRun: boolean;
  error?: string;
}

function isIncidentEvent(obj: unknown): obj is IncidentEventEntry {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'alertName' in obj &&
    'severity' in obj &&
    'status' in obj
  );
}

function isExecutionLog(obj: unknown): obj is ExecutionLogEntry {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'runbookName' in obj &&
    'action' in obj &&
    'executedAt' in obj
  );
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function generatePostmortem(
  incidentId: string,
  rawEntries: RawTimelineEntry[]
): PostmortemDocument {
  const parsedEntries: Array<{ score: number; data: unknown }> = rawEntries.map(
    (e) => {
      try {
        return { score: e.score, data: JSON.parse(e.value) };
      } catch {
        return { score: e.score, data: { raw: e.value } };
      }
    }
  );

  const timeline: TimelineEntry[] = [];
  const services = new Set<string>();
  let firstEventTime: number | null = null;
  let acknowledgedTime: number | null = null;
  let resolvedTime: number | null = null;
  let primaryIncident: IncidentEventEntry | null = null;
  let actionsExecuted = 0;

  for (const { score, data } of parsedEntries) {
    if (isIncidentEvent(data)) {
      if (!firstEventTime) firstEventTime = score;
      services.add(data.service);

      if (!primaryIncident) {
        primaryIncident = data;
      }

      if (data.status === 'acknowledged' && !acknowledgedTime) {
        acknowledgedTime = score;
      }
      if (data.status === 'resolved' && !resolvedTime) {
        resolvedTime = score;
      }

      let type: TimelineEntry['type'] = 'incident';
      if (data.status === 'acknowledged') type = 'acknowledgement';
      if (data.status === 'resolved') type = 'resolution';

      timeline.push({
        timestamp: data.timestamp,
        type,
        actor: data.source,
        description: `[${data.status.toUpperCase()}] ${data.summary}`,
        metadata: { severity: data.severity, service: data.service },
      });
    } else if (isExecutionLog(data)) {
      actionsExecuted++;
      timeline.push({
        timestamp: data.executedAt,
        type: 'action',
        actor: 'runbook-executor',
        description: `Runbook "${data.runbookName}" executed action: ${data.action} on ${data.target} [${data.status}]${data.error ? ` — ERROR: ${data.error}` : ''}`,
        metadata: { dryRun: data.dryRun, status: data.status },
      });
    }
  }

  // Sort timeline by timestamp
  timeline.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const now = Date.now();
  const ttd = firstEventTime
    ? formatDuration(firstEventTime - (firstEventTime - 0))
    : 'N/A';
  const tta =
    firstEventTime && acknowledgedTime
      ? formatDuration(acknowledgedTime - firstEventTime)
      : 'N/A';
  const ttr =
    firstEventTime && resolvedTime
      ? formatDuration(resolvedTime - firstEventTime)
      : 'N/A';
  const totalDuration =
    firstEventTime && resolvedTime
      ? formatDuration(resolvedTime - firstEventTime)
      : firstEventTime
      ? formatDuration(now - firstEventTime)
      : 'N/A';

  const metrics: PostmortemMetrics = {
    timeToDetect: ttd,
    timeToAcknowledge: tta,
    timeToResolve: ttr,
    totalDuration,
    actionsExecuted,
    servicesAffected: Array.from(services),
  };

  const severity = primaryIncident?.severity ?? 'UNKNOWN';
  const service = primaryIncident?.service ?? 'unknown';
  const alertName = primaryIncident?.alertName ?? 'Unknown Alert';
  const description = primaryIncident?.description ?? '';

  return {
    incidentId,
    generatedAt: new Date().toISOString(),
    summary: `${severity} incident: ${alertName} affecting ${service}`,
    severity,
    service,
    timeline,
    impact: `${severity} incident on service "${service}". ${description}`,
    rootCause:
      'Root cause analysis pending. Review the timeline and metrics for contributing factors.',
    actionItems: [
      'Conduct a full root cause analysis within 48 hours',
      'Review and update runbook coverage for affected alert patterns',
      'Validate monitoring thresholds for affected services',
      'Schedule post-incident review meeting with stakeholders',
    ],
    metrics,
  };
}

export function generateMarkdown(doc: PostmortemDocument): string {
  const timelineSection = doc.timeline
    .map(
      (e) =>
        `| ${e.timestamp} | ${e.type} | ${e.actor} | ${e.description} |`
    )
    .join('\n');

  return `# Post-Mortem: ${doc.incidentId}

**Generated:** ${doc.generatedAt}  
**Severity:** ${doc.severity}  
**Service:** ${doc.service}

---

## Summary

${doc.summary}

---

## Impact

${doc.impact}

---

## Timeline

| Timestamp | Type | Actor | Description |
|-----------|------|-------|-------------|
${timelineSection}

---

## Root Cause

${doc.rootCause}

---

## Metrics

| Metric | Value |
|--------|-------|
| Time to Detect | ${doc.metrics.timeToDetect} |
| Time to Acknowledge | ${doc.metrics.timeToAcknowledge} |
| Time to Resolve | ${doc.metrics.timeToResolve} |
| Total Duration | ${doc.metrics.totalDuration} |
| Automated Actions Executed | ${doc.metrics.actionsExecuted} |
| Services Affected | ${doc.metrics.servicesAffected.join(', ')} |

---

## Action Items

${doc.actionItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}
`;
}
