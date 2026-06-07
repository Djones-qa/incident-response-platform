import { generatePostmortem, generateMarkdown } from '../generator';
import { RawTimelineEntry } from '../timelineReader';

const baseTime = 1705312800000;

const mockIncidentEvent = {
  id: 'INC-001',
  alertName: 'High CPU on prod-api',
  service: 'prod-api',
  severity: 'HIGH',
  status: 'triggered',
  summary: 'High CPU on prod-api',
  description: 'CPU exceeded 90%',
  timestamp: new Date(baseTime).toISOString(),
  source: 'pagerduty',
  dedupKey: 'abc',
};

const mockResolvedEvent = {
  ...mockIncidentEvent,
  status: 'resolved',
  timestamp: new Date(baseTime + 600_000).toISOString(),
};

const mockExecutionLog = {
  runbookName: 'restart-prod-api',
  action: 'restart-pod',
  incidentId: 'INC-001',
  status: 'success',
  target: 'prod-api',
  executedAt: new Date(baseTime + 60_000).toISOString(),
  dryRun: false,
  namespace: 'production',
  beforeState: {},
  afterState: {},
};

function makeEntries(data: unknown[]): RawTimelineEntry[] {
  return data.map((d, i) => ({
    value: JSON.stringify(d),
    score: baseTime + i * 60_000,
  }));
}

describe('generatePostmortem', () => {
  it('generates a postmortem with correct incidentId', () => {
    const entries = makeEntries([mockIncidentEvent]);
    const doc = generatePostmortem('INC-001', entries);
    expect(doc.incidentId).toBe('INC-001');
  });

  it('extracts severity and service from incident event', () => {
    const entries = makeEntries([mockIncidentEvent]);
    const doc = generatePostmortem('INC-001', entries);
    expect(doc.severity).toBe('HIGH');
    expect(doc.service).toBe('prod-api');
  });

  it('builds a timeline with incident entries', () => {
    const entries = makeEntries([mockIncidentEvent]);
    const doc = generatePostmortem('INC-001', entries);
    expect(doc.timeline.length).toBeGreaterThan(0);
    expect(doc.timeline[0]?.type).toBe('incident');
  });

  it('includes action entries for execution logs', () => {
    const entries = makeEntries([mockIncidentEvent, mockExecutionLog]);
    const doc = generatePostmortem('INC-001', entries);
    const actions = doc.timeline.filter((e) => e.type === 'action');
    expect(actions.length).toBe(1);
    expect(actions[0]?.description).toContain('restart-prod-api');
  });

  it('counts actionsExecuted correctly', () => {
    const entries = makeEntries([
      mockIncidentEvent,
      mockExecutionLog,
      { ...mockExecutionLog, runbookName: 'scale-worker' },
    ]);
    const doc = generatePostmortem('INC-001', entries);
    expect(doc.metrics.actionsExecuted).toBe(2);
  });

  it('includes affected services', () => {
    const entries = makeEntries([mockIncidentEvent]);
    const doc = generatePostmortem('INC-001', entries);
    expect(doc.metrics.servicesAffected).toContain('prod-api');
  });

  it('resolves time to resolve when resolved event is present', () => {
    const entries = makeEntries([mockIncidentEvent, mockResolvedEvent]);
    const doc = generatePostmortem('INC-001', entries);
    expect(doc.metrics.timeToResolve).not.toBe('N/A');
  });

  it('includes required action items', () => {
    const entries = makeEntries([mockIncidentEvent]);
    const doc = generatePostmortem('INC-001', entries);
    expect(doc.actionItems.length).toBeGreaterThan(0);
  });

  it('handles empty timeline gracefully', () => {
    const doc = generatePostmortem('INC-EMPTY', []);
    expect(doc.incidentId).toBe('INC-EMPTY');
    expect(doc.severity).toBe('UNKNOWN');
    expect(doc.timeline).toHaveLength(0);
  });

  it('handles malformed timeline entries without crashing', () => {
    const badEntry: RawTimelineEntry = {
      value: 'not-json{{{',
      score: baseTime,
    };
    expect(() => generatePostmortem('INC-001', [badEntry])).not.toThrow();
  });
});

describe('generateMarkdown', () => {
  it('produces a markdown string with required sections', () => {
    const entries = makeEntries([mockIncidentEvent, mockExecutionLog]);
    const doc = generatePostmortem('INC-001', entries);
    const md = generateMarkdown(doc);

    expect(md).toContain('# Post-Mortem: INC-001');
    expect(md).toContain('## Summary');
    expect(md).toContain('## Timeline');
    expect(md).toContain('## Impact');
    expect(md).toContain('## Root Cause');
    expect(md).toContain('## Metrics');
    expect(md).toContain('## Action Items');
  });

  it('includes the incident ID in the title', () => {
    const entries = makeEntries([mockIncidentEvent]);
    const doc = generatePostmortem('INC-TEST-99', entries);
    const md = generateMarkdown(doc);
    expect(md).toContain('INC-TEST-99');
  });
});
