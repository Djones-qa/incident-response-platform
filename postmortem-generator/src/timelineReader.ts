import Redis from 'ioredis';

export interface RawTimelineEntry {
  score: number;
  value: string;
}

export class TimelineReader {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async getTimeline(incidentId: string): Promise<RawTimelineEntry[]> {
    // ZRANGE with scores returns alternating [value, score, value, score, ...]
    const raw = await this.redis.zrange(
      `timeline:${incidentId}`,
      0,
      -1,
      'WITHSCORES'
    );

    const entries: RawTimelineEntry[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      const value = raw[i];
      const scoreStr = raw[i + 1];
      if (value && scoreStr) {
        entries.push({
          value,
          score: parseFloat(scoreStr),
        });
      }
    }

    return entries.sort((a, b) => a.score - b.score);
  }
}
