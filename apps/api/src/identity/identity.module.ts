import { Module } from '@nestjs/common';
import { IdentityDocumentsService } from './identity.service';
import { IdentityDocumentsController } from './identity.controller';
import { EncryptionService } from '../common/services/encryption.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [IdentityDocumentsController],
  providers: [IdentityDocumentsService, EncryptionService, AuditLogService],
  exports: [IdentityDocumentsService],
})
export class IdentityDocumentsModule {}
