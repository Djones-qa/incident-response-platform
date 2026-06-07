import Redis from 'ioredis';
import { IncidentEvent } from './types/incident';

const TIMELINE_TTL_SECONDS = 86400 * 7; // 7 days

export class EventBus {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async publish(event: IncidentEvent): Promise<void> {
    const payload = JSON.stringify(event);

    // Store in incident timeline (sorted set by timestamp)
    await this.redis.zadd(
      `timeline:${event.id}`,
      Date.now(),
      payload
    );
    await this.redis.expire(`timeline:${event.id}`, TIMELINE_TTL_SECONDS);

    // Publish to Redis pub/sub channel for downstream consumers
    await this.redis.publish('incident-events', payload);

    console.log(
      `[EventBus] Published event: ${event.id} | ${event.alertName} | ${event.severity}`
    );
  }
}
