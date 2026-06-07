import { RunbookDefinition } from '../types/runbook';

/**
 * Maps alert names and services to runbook definitions.
 * Keys can be alert names (exact match) or service names (prefix match).
 */
const RUNBOOK_REGISTRY: Record<string, RunbookDefinition> = {
  // Alert name matches
  'High CPU on prod-api': {
    name: 'restart-prod-api',
    action: 'restart-pod',
    namespace: 'production',
    target: 'prod-api',
  },
  'Disk usage critical on node-1': {
    name: 'drain-node-1',
    action: 'drain-node',
    namespace: 'production',
    target: 'node-1',
  },
  'Memory pressure on worker': {
    name: 'scale-worker',
    action: 'scale-deployment',
    namespace: 'production',
    target: 'worker',
    parameters: { replicas: 5 },
  },
  'Deployment rollback required': {
    name: 'rollback-deployment',
    action: 'rollback-deployment',
    namespace: 'production',
    target: 'prod-api',
  },
  // Service-based fallbacks
  'prod-api': {
    name: 'restart-prod-api-fallback',
    action: 'restart-pod',
    namespace: 'production',
    target: 'prod-api',
  },
  'worker': {
    name: 'scale-worker-fallback',
    action: 'scale-deployment',
    namespace: 'production',
    target: 'worker',
    parameters: { replicas: 3 },
  },
};

export function findRunbook(
  alertName: string,
  service: string
): RunbookDefinition | null {
  // Try exact alert name match first
  if (RUNBOOK_REGISTRY[alertName]) {
    return RUNBOOK_REGISTRY[alertName]!;
  }

  // Fall back to service name match
  if (RUNBOOK_REGISTRY[service]) {
    return RUNBOOK_REGISTRY[service]!;
  }

  return null;
}

export { RUNBOOK_REGISTRY };
