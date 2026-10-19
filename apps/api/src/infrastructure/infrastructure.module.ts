import { Global, Module } from '@nestjs/common';
import { ObjectStorageService } from './object-storage.service';
import { QueueService } from './queue.service';

@Global()
@Module({
  providers: [QueueService, ObjectStorageService],
  exports: [QueueService, ObjectStorageService],
})
export class InfrastructureModule {}
