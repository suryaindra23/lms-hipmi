import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  OnModuleDestroy,
  SetMetadata,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import Redis from 'ioredis';

const RATE_LIMIT_KEY = 'rate_limit_rule';

export interface RateLimitRule {
  limit: number;
  windowSeconds: number;
}

export const RateLimit = (limit: number, windowSeconds: number) =>
  SetMetadata(RATE_LIMIT_KEY, { limit, windowSeconds } satisfies RateLimitRule);

interface MemoryCounter {
  count: number;
  expiresAt: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate, OnModuleDestroy {
  private readonly redis: Redis;
  private readonly fallback = new Map<string, MemoryCounter>();
  private warned = false;

  constructor(
    private readonly reflector: Reflector,
    config: ConfigService,
  ) {
    this.redis = new Redis(config.get('REDIS_URL', 'redis://localhost:6379'), {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 750,
    });
    this.redis.on('error', () => undefined);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rule =
      this.reflector.getAllAndOverride<RateLimitRule>(RATE_LIMIT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? { limit: 120, windowSeconds: 60 };

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const identity = request.user?.userId || request.ip || request.socket?.remoteAddress || 'unknown';
    const route = `${request.method}:${request.route?.path || request.path || 'unknown'}`;
    const key = `sunrise:ratelimit:${route}:${identity}`;

    const { count, ttl } = await this.increment(key, rule.windowSeconds);
    response.setHeader('RateLimit-Limit', String(rule.limit));
    response.setHeader('RateLimit-Remaining', String(Math.max(0, rule.limit - count)));
    response.setHeader('RateLimit-Reset', String(Math.max(1, ttl)));

    if (count > rule.limit) {
      response.setHeader('Retry-After', String(Math.max(1, ttl)));
      throw new HttpException(
        'Terlalu banyak permintaan. Silakan coba kembali nanti.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  async onModuleDestroy() {
    if (this.redis.status !== 'end') await this.redis.quit().catch(() => undefined);
  }

  private async increment(key: string, windowSeconds: number) {
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      const result = (await this.redis.eval(
        "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; return {n,redis.call('TTL',KEYS[1])}",
        1,
        key,
        windowSeconds,
      )) as [number, number];
      return { count: Number(result[0]), ttl: Number(result[1]) };
    } catch {
      if (!this.warned) {
        this.warned = true;
        console.warn('Redis rate limiter unavailable; using process-local fallback');
      }
      return this.incrementMemory(key, windowSeconds);
    }
  }

  private incrementMemory(key: string, windowSeconds: number) {
    const now = Date.now();
    const current = this.fallback.get(key);
    if (!current || current.expiresAt <= now) {
      const next = { count: 1, expiresAt: now + windowSeconds * 1000 };
      this.fallback.set(key, next);
      return { count: next.count, ttl: windowSeconds };
    }
    current.count += 1;
    return {
      count: current.count,
      ttl: Math.ceil((current.expiresAt - now) / 1000),
    };
  }
}
