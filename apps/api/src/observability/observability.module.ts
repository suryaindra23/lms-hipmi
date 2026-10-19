import { Global, Module } from '@nestjs/common';
import { OperationsController } from './operations.controller';
import { ObservabilityService } from './observability.service';

@Global()
@Module({
  controllers: [OperationsController],
  providers: [ObservabilityService],
  exports: [ObservabilityService],
})
export class ObservabilityModule {}
