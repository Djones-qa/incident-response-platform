import { findRunbook } from '../runbooks/registry';

describe('Runbook Registry', () => {
  it('finds a runbook by exact alert name', () => {
    const runbook = findRunbook('High CPU on prod-api', 'prod-api');
    expect(runbook).not.toBeNull();
    expect(runbook?.action).toBe('restart-pod');
    expect(runbook?.target).toBe('prod-api');
  });

  it('finds a runbook for disk usage alert', () => {
    const runbook = findRunbook('Disk usage critical on node-1', 'node-1');
    expect(runbook).not.toBeNull();
    expect(runbook?.action).toBe('drain-node');
    expect(runbook?.target).toBe('node-1');
  });

  it('finds a runbook for memory pressure', () => {
    const runbook = findRunbook('Memory pressure on worker', 'worker');
    expect(runbook).not.toBeNull();
    expect(runbook?.action).toBe('scale-deployment');
    expect(runbook?.parameters?.['replicas']).toBe(5);
  });

  it('finds a runbook for rollback', () => {
    const runbook = findRunbook('Deployment rollback required', 'prod-api');
    expect(runbook).not.toBeNull();
    expect(runbook?.action).toBe('rollback-deployment');
  });

  it('falls back to service name when alert name has no match', () => {
    const runbook = findRunbook('Unknown alert XYZ', 'prod-api');
    expect(runbook).not.toBeNull();
    expect(runbook?.action).toBe('restart-pod');
  });

  it('returns null when neither alert name nor service matches', () => {
    const runbook = findRunbook('Unknown alert', 'unknown-service');
    expect(runbook).toBeNull();
  });

  it('prefers alert name match over service name match', () => {
    const runbook = findRunbook('High CPU on prod-api', 'prod-api');
    expect(runbook?.name).toBe('restart-prod-api');
  });

  it('returns correct namespace', () => {
    const runbook = findRunbook('High CPU on prod-api', 'prod-api');
    expect(runbook?.namespace).toBe('production');
  });
});
