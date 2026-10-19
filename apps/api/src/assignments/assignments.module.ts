import { Module } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { AssignmentsController } from './assignments.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { SupportingModule } from '../supporting/supporting.module';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [PrismaModule, SupportingModule, AccessModule],
  controllers: [AssignmentsController],
  providers: [AssignmentsService],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
