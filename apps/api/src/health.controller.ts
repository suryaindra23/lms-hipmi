import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { QueueService } from './infrastructure/queue.service';
import { ObjectStorageService } from './infrastructure/object-storage.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly storage: ObjectStorageService,
  ) {}

  @Get()
  async health() {
    return this.readiness();
  }

  @Get('live')
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async readiness() {
    await this.prisma.$queryRaw`SELECT 1`;
    const [redis, objectStorage] = await Promise.all([
      this.queue.getHealth(),
      this.storage.getHealth(),
    ]);
    return {
      status: 'ok',
      database: 'reachable',
      redis: redis === 'PONG' ? 'reachable' : redis,
      objectStorage,
      timestamp: new Date().toISOString(),
    };
  }
}
