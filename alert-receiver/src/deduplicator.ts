import Redis from 'ioredis';

const DEDUP_TTL_SECONDS = 300; // 5 minutes

export class Deduplicator {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Returns true if this dedupKey has NOT been seen before (i.e., it's new).
   * Sets the key with TTL so duplicate events within the window are suppressed.
   */
  async isNew(dedupKey: string): Promise<boolean> {
    const result = await this.redis.set(
      `dedup:${dedupKey}`,
      '1',
      'EX',
      DEDUP_TTL_SECONDS,
      'NX'
    );
    return result === 'OK';
  }
}
