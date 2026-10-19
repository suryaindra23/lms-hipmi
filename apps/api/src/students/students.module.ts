import { Module } from '@nestjs/common';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { AuthModule } from '../auth/auth.module';
import { EncryptionService } from '../common/services/encryption.service';

@Module({
  imports: [AuthModule],
  controllers: [StudentsController],
  providers: [StudentsService, EncryptionService],
  exports: [StudentsService],
})
export class StudentsModule {}
