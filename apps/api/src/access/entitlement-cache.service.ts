import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class EntitlementCacheService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly local = new Map<string, { expiresAt: number; value: string }>();

  constructor(config: ConfigService) {
    this.redis = new Redis(config.get('REDIS_URL', 'redis://localhost:6379'), {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
    this.redis.on('error', () => undefined);
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      const value = await this.redis.get(key);
      if (value) return JSON.parse(value) as T;
    } catch {
      const cached = this.local.get(key);
      if (cached && cached.expiresAt > Date.now()) return JSON.parse(cached.value) as T;
      this.local.delete(key);
    }
    return null;
  }

  async set(organizationId: string, key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    const serialized = JSON.stringify(value);
    this.local.set(key, { value: serialized, expiresAt: Date.now() + ttlSeconds * 1_000 });
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      const registryKey = this.registryKey(organizationId);
      await this.redis.multi()
        .set(key, serialized, 'EX', ttlSeconds)
        .sadd(registryKey, key)
        .expire(registryKey, Math.max(ttlSeconds * 2, 300))
        .exec();
    } catch {
      // Database remains the source of truth when Redis is unavailable.
    }
  }

  async invalidateOrganization(organizationId: string): Promise<void> {
    const prefix = `entitlement:${organizationId}:`;
    for (const key of this.local.keys()) {
      if (key.startsWith(prefix)) this.local.delete(key);
    }
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      const registryKey = this.registryKey(organizationId);
      const keys = await this.redis.smembers(registryKey);
      if (keys.length > 0) await this.redis.del(...keys);
      await this.redis.del(registryKey);
    } catch {
      // A short TTL limits stale access if Redis cannot be invalidated.
    }
  }

  async onModuleDestroy() {
    if (this.redis.status !== 'end') await this.redis.quit().catch(() => undefined);
  }

  private registryKey(organizationId: string) {
    return `entitlement:${organizationId}:keys`;
  }
}
