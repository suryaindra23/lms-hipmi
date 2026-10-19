import { Module } from '@nestjs/common';
import { AccessController } from './access.controller';
import { AccessService } from './access.service';
import { EntitlementCacheService } from './entitlement-cache.service';

@Module({
  controllers: [AccessController],
  providers: [AccessService, EntitlementCacheService],
  exports: [AccessService],
})
export class AccessModule {}
