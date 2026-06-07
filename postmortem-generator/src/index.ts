import express, { Request, Response } from 'express';
import Redis from 'ioredis';
import { TimelineReader } from './timelineReader';
import { generatePostmortem, generateMarkdown } from './generator';

const PORT = parseInt(process.env['PORT'] ?? '3002', 10);
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

const app = express();
app.use(express.json());

const redis = new Redis(REDIS_URL);
const timelineReader = new TimelineReader(redis);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'postmortem-generator' });
});

// Generate post-mortem for a resolved incident (JSON)
app.get('/postmortem/:incidentId', async (req: Request, res: Response) => {
  const { incidentId } = req.params;

  if (!incidentId) {
    res.status(400).json({ error: 'incidentId is required' });
    return;
  }

  try {
    const rawEntries = await timelineReader.getTimeline(incidentId);

    if (rawEntries.length === 0) {
      res.status(404).json({
        error: 'No timeline data found for this incident',
        incidentId,
      });
      return;
    }

    const postmortem = generatePostmortem(incidentId, rawEntries);
    res.status(200).json(postmortem);
  } catch (err) {
    console.error(`[PostmortemGenerator] Error generating postmortem:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate post-mortem as Markdown
app.get('/postmortem/:incidentId/markdown', async (req: Request, res: Response) => {
  const { incidentId } = req.params;

  if (!incidentId) {
    res.status(400).json({ error: 'incidentId is required' });
    return;
  }

  try {
    const rawEntries = await timelineReader.getTimeline(incidentId);

    if (rawEntries.length === 0) {
      res.status(404).json({
        error: 'No timeline data found for this incident',
        incidentId,
      });
      return;
    }

    const postmortem = generatePostmortem(incidentId, rawEntries);
    const markdown = generateMarkdown(postmortem);

    res.setHeader('Content-Type', 'text/markdown');
    res.status(200).send(markdown);
  } catch (err) {
    console.error(`[PostmortemGenerator] Error generating markdown:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`[postmortem-generator] Listening on port ${PORT}`);
});

export { app };
