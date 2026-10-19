import { Module } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { SupportingModule } from '../supporting/supporting.module';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [PrismaModule, SupportingModule, AccessModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
