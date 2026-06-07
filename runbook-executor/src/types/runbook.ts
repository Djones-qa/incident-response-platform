export type RunbookAction =
  | 'restart-pod'
  | 'scale-deployment'
  | 'drain-node'
  | 'rollback-deployment';

export interface RunbookDefinition {
  name: string;
  action: RunbookAction;
  namespace: string;
  target: string; // pod name, deployment name, or node name
  parameters?: Record<string, string | number>;
}

export interface ExecutionLog {
  runbookName: string;
  action: RunbookAction;
  incidentId: string;
  namespace: string;
  target: string;
  status: 'success' | 'failure' | 'dry-run';
  beforeState: unknown;
  afterState: unknown;
  executedAt: string;
  dryRun: boolean;
  error?: string;
}
