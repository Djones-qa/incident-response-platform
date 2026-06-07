import Redis from 'ioredis';
import { RunbookDefinition, ExecutionLog } from './types/runbook';
import {
  restartPod,
  scaleDeployment,
  drainNode,
  rollbackDeployment,
} from './k8s/actions';

const TIMELINE_TTL_SECONDS = 86400 * 7;
const DRY_RUN = process.env['DRY_RUN'] === 'true';

export class RunbookExecutor {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async execute(
    runbook: RunbookDefinition,
    incidentId: string
  ): Promise<ExecutionLog> {
    const log: ExecutionLog = {
      runbookName: runbook.name,
      action: runbook.action,
      incidentId,
      namespace: runbook.namespace,
      target: runbook.target,
      status: DRY_RUN ? 'dry-run' : 'success',
      beforeState: null,
      afterState: null,
      executedAt: new Date().toISOString(),
      dryRun: DRY_RUN,
    };

    if (DRY_RUN) {
      console.log(
        `[Executor] DRY-RUN: would execute ${runbook.action} on ${runbook.target}`
      );
      log.beforeState = { dryRun: true };
      log.afterState = { dryRun: true };
      await this.storeLog(incidentId, log);
      return log;
    }

    try {
      const result = await this.runAction(runbook);
      log.beforeState = result.beforeState;
      log.afterState = result.afterState;
      log.status = 'success';

      console.log(
        `[Executor] Successfully executed ${runbook.action} on ${runbook.target}`
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      log.status = 'failure';
      log.error = errorMessage;
      console.error(
        `[Executor] Failed to execute ${runbook.action} on ${runbook.target}:`,
        err
      );
    }

    await this.storeLog(incidentId, log);
    return log;
  }

  private async runAction(
    runbook: RunbookDefinition
  ): Promise<{ beforeState: unknown; afterState: unknown }> {
    switch (runbook.action) {
      case 'restart-pod':
        return restartPod(
          runbook.namespace,
          `app=${runbook.target}`
        );

      case 'scale-deployment': {
        const replicas = Number(runbook.parameters?.['replicas'] ?? 3);
        return scaleDeployment(runbook.namespace, runbook.target, replicas);
      }

      case 'drain-node':
        return drainNode(runbook.target);

      case 'rollback-deployment':
        return rollbackDeployment(runbook.namespace, runbook.target);

      default:
        throw new Error(`Unknown runbook action: ${runbook.action}`);
    }
  }

  private async storeLog(incidentId: string, log: ExecutionLog): Promise<void> {
    const payload = JSON.stringify(log);
    await this.redis.zadd(
      `timeline:${incidentId}`,
      Date.now(),
      payload
    );
    await this.redis.expire(`timeline:${incidentId}`, TIMELINE_TTL_SECONDS);
  }
}
