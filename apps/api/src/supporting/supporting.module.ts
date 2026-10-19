import { Module } from '@nestjs/common';
import { PublicSupportingController, SupportingController } from './supporting.controller';
import { SupportingService } from './supporting.service';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [AccessModule],
  controllers: [SupportingController, PublicSupportingController],
  providers: [SupportingService],
  exports: [SupportingService],
})
export class SupportingModule {}
