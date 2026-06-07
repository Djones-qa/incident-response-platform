import express, { Request, Response } from 'express';
import Redis from 'ioredis';
import { normalizePagerDuty, PagerDutyPayload } from './normalizers/pagerduty';
import { normalizeOpsgenie, OpsgeniePayload } from './normalizers/opsgenie';
import { Deduplicator } from './deduplicator';
import { EventBus } from './eventBus';
import { notifySlack } from './slack';
import { routeToRunbook } from './router';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

const app = express();
app.use(express.json());

const redis = new Redis(REDIS_URL);
const deduplicator = new Deduplicator(redis);
const eventBus = new EventBus(redis);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'alert-receiver' });
});

// PagerDuty webhook
app.post('/webhook/pagerduty', async (req: Request, res: Response) => {
  try {
    const payload = req.body as PagerDutyPayload;
    const events = normalizePagerDuty(payload);

    for (const event of events) {
      const isNew = await deduplicator.isNew(event.dedupKey);
      if (!isNew) {
        console.log(`[PagerDuty] Duplicate event suppressed: ${event.id}`);
        continue;
      }

      await eventBus.publish(event);
      await notifySlack(event);
      await routeToRunbook(event);
    }

    res.status(200).json({ received: events.length });
  } catch (err) {
    console.error('[PagerDuty] Webhook processing error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Opsgenie webhook
app.post('/webhook/opsgenie', async (req: Request, res: Response) => {
  try {
    const payload = req.body as OpsgeniePayload;
    const event = normalizeOpsgenie(payload);

    const isNew = await deduplicator.isNew(event.dedupKey);
    if (!isNew) {
      console.log(`[Opsgenie] Duplicate event suppressed: ${event.id}`);
      res.status(200).json({ received: 0, reason: 'duplicate' });
      return;
    }

    await eventBus.publish(event);
    await notifySlack(event);
    await routeToRunbook(event);

    res.status(200).json({ received: 1 });
  } catch (err) {
    console.error('[Opsgenie] Webhook processing error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`[alert-receiver] Listening on port ${PORT}`);
});

export { app };
