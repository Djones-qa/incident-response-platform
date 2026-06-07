import express, { Request, Response } from 'express';
import Redis from 'ioredis';
import { findRunbook } from './runbooks/registry';
import { RunbookExecutor } from './executor';

const PORT = parseInt(process.env['PORT'] ?? '3001', 10);
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

const app = express();
app.use(express.json());

const redis = new Redis(REDIS_URL);
const executor = new RunbookExecutor(redis);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'runbook-executor' });
});

// Execute runbook for an incident
app.post('/execute', async (req: Request, res: Response) => {
  try {
    const event = req.body as {
      id: string;
      alertName: string;
      service: string;
      severity: string;
    };

    if (!event.id || !event.alertName) {
      res.status(400).json({ error: 'Missing required fields: id, alertName' });
      return;
    }

    const runbook = findRunbook(event.alertName, event.service);

    if (!runbook) {
      console.log(
        `[Executor] No runbook found for alert="${event.alertName}" service="${event.service}"`
      );
      res.status(404).json({
        message: 'No runbook found for this alert',
        alertName: event.alertName,
        service: event.service,
      });
      return;
    }

    console.log(
      `[Executor] Matched runbook "${runbook.name}" for incident ${event.id}`
    );

    const log = await executor.execute(runbook, event.id);

    res.status(200).json({ executed: true, log });
  } catch (err) {
    console.error('[Executor] Error processing execute request:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`[runbook-executor] Listening on port ${PORT}`);
});

export { app };
