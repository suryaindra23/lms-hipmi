import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, JobsOptions, Queue } from 'bullmq';

export interface TenantJob<T> {
  organizationId?: string;
  schoolId?: string;
  requestedBy?: string;
  payload: T;
}

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly queues = new Map<string, Queue>();
  private readonly connection: {
    host: string;
    port: number;
    username?: string;
    password?: string;
    db?: number;
    tls?: Record<string, never>;
  };

  constructor(config: ConfigService) {
    const url = new URL(config.get<string>('REDIS_URL') || 'redis://localhost:6379');
    this.connection = {
      host: url.hostname,
      port: Number(url.port || 6379),
      username: url.username || undefined,
      password: url.password || undefined,
      db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : undefined,
      ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
    };
  }

  async add<T>(
    queueName: string,
    jobName: string,
    data: TenantJob<T>,
    options: JobsOptions = {},
  ): Promise<Job<TenantJob<T>>> {
    return this.queue(queueName).add(jobName, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1_000 },
      removeOnComplete: { age: 24 * 60 * 60, count: 1_000 },
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 5_000 },
      ...options,
    });
  }

  async getHealth() {
    const queue = this.queue('system');
    await queue.waitUntilReady();
    return 'PONG';
  }

  async getStats(names: string[]) {
    return Promise.all(names.map(async (name) => {
      const counts = await this.queue(name).getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed');
      return {
        name,
        waiting: counts.waiting || 0,
        active: counts.active || 0,
        delayed: counts.delayed || 0,
        failed: counts.failed || 0,
        completed: counts.completed || 0,
      };
    }));
  }

  async onModuleDestroy() {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
  }

  private queue(name: string) {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, { connection: this.connection });
      this.queues.set(name, queue);
    }
    return queue;
  }
}
