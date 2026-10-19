import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MonitoringController, PublicStatisticsController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [PrismaModule, InfrastructureModule, AccessModule],
  controllers: [MonitoringController, PublicStatisticsController],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
