import { normalizePagerDuty } from '../normalizers/pagerduty';
import { normalizeOpsgenie } from '../normalizers/opsgenie';

describe('PagerDuty normalizer', () => {
  const pdPayload = {
    messages: [
      {
        event: 'incident.trigger',
        incident: {
          id: 'PD-001',
          title: 'High CPU on prod-api',
          service: { name: 'prod-api' },
          urgency: 'high',
          status: 'triggered',
          body: { details: 'CPU usage exceeded 90%' },
          created_at: '2024-01-15T10:00:00Z',
        },
      },
    ],
  };

  it('normalizes a PagerDuty payload into IncidentEvents', () => {
    const events = normalizePagerDuty(pdPayload);
    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event).toBeDefined();
    if (!event) return;
    expect(event.source).toBe('pagerduty');
    expect(event.id).toBe('PD-001');
    expect(event.alertName).toBe('High CPU on prod-api');
    expect(event.service).toBe('prod-api');
    expect(event.severity).toBe('HIGH');
    expect(event.status).toBe('triggered');
    expect(event.description).toBe('CPU usage exceeded 90%');
  });

  it('maps high urgency to HIGH severity', () => {
    const events = normalizePagerDuty(pdPayload);
    expect(events[0]?.severity).toBe('HIGH');
  });

  it('maps low urgency to MEDIUM severity', () => {
    const lowPayload = {
      messages: [
        {
          ...pdPayload.messages[0]!,
          incident: { ...pdPayload.messages[0]!.incident, urgency: 'low' },
        },
      ],
    };
    const events = normalizePagerDuty(lowPayload);
    expect(events[0]?.severity).toBe('MEDIUM');
  });

  it('generates a consistent dedupKey', () => {
    const events1 = normalizePagerDuty(pdPayload);
    const events2 = normalizePagerDuty(pdPayload);
    expect(events1[0]?.dedupKey).toBe(events2[0]?.dedupKey);
  });

  it('generates unique dedupKeys for different incidents', () => {
    const payload2 = {
      messages: [
        {
          ...pdPayload.messages[0]!,
          incident: { ...pdPayload.messages[0]!.incident, id: 'PD-002' },
        },
      ],
    };
    const events1 = normalizePagerDuty(pdPayload);
    const events2 = normalizePagerDuty(payload2);
    expect(events1[0]?.dedupKey).not.toBe(events2[0]?.dedupKey);
  });

  it('handles missing body details gracefully', () => {
    const noBody = {
      messages: [
        {
          ...pdPayload.messages[0]!,
          incident: { ...pdPayload.messages[0]!.incident, body: undefined },
        },
      ],
    };
    const events = normalizePagerDuty(noBody);
    expect(events[0]?.description).toBe('High CPU on prod-api');
  });

  it('maps resolved status correctly', () => {
    const resolvedPayload = {
      messages: [
        {
          ...pdPayload.messages[0]!,
          incident: { ...pdPayload.messages[0]!.incident, status: 'resolved' },
        },
      ],
    };
    const events = normalizePagerDuty(resolvedPayload);
    expect(events[0]?.status).toBe('resolved');
  });
});

describe('Opsgenie normalizer', () => {
  const ogPayload = {
    action: 'create',
    alert: {
      alertId: 'OG-001',
      message: 'Disk usage critical on node-1',
      alias: 'disk-critical-node-1',
      description: 'Disk usage has exceeded 95% on node-1',
      source: 'node-1',
      priority: 'P1',
      entity: 'node-1',
      createdAt: 1705312800000,
      updatedAt: 1705312800000,
    },
  };

  it('normalizes an Opsgenie payload into an IncidentEvent', () => {
    const event = normalizeOpsgenie(ogPayload);
    expect(event.source).toBe('opsgenie');
    expect(event.id).toBe('OG-001');
    expect(event.alertName).toBe('Disk usage critical on node-1');
    expect(event.service).toBe('node-1');
    expect(event.severity).toBe('CRITICAL');
    expect(event.status).toBe('triggered');
  });

  it('maps P1 to CRITICAL', () => {
    const event = normalizeOpsgenie(ogPayload);
    expect(event.severity).toBe('CRITICAL');
  });

  it('maps P2 to HIGH', () => {
    const event = normalizeOpsgenie({ ...ogPayload, alert: { ...ogPayload.alert, priority: 'P2' } });
    expect(event.severity).toBe('HIGH');
  });

  it('maps P3 to MEDIUM', () => {
    const event = normalizeOpsgenie({ ...ogPayload, alert: { ...ogPayload.alert, priority: 'P3' } });
    expect(event.severity).toBe('MEDIUM');
  });

  it('maps P4/unknown to LOW', () => {
    const event = normalizeOpsgenie({ ...ogPayload, alert: { ...ogPayload.alert, priority: 'P4' } });
    expect(event.severity).toBe('LOW');
  });

  it('maps close action to resolved status', () => {
    const event = normalizeOpsgenie({ ...ogPayload, action: 'close' });
    expect(event.status).toBe('resolved');
  });

  it('maps acknowledge action to acknowledged status', () => {
    const event = normalizeOpsgenie({ ...ogPayload, action: 'acknowledge' });
    expect(event.status).toBe('acknowledged');
  });

  it('falls back to source when entity is missing', () => {
    const noEntity = {
      ...ogPayload,
      alert: { ...ogPayload.alert, entity: undefined },
    };
    const event = normalizeOpsgenie(noEntity);
    expect(event.service).toBe('node-1');
  });

  it('generates a consistent dedupKey', () => {
    const event1 = normalizeOpsgenie(ogPayload);
    const event2 = normalizeOpsgenie(ogPayload);
    expect(event1.dedupKey).toBe(event2.dedupKey);
  });
});
