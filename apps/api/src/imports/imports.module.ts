import { Module } from '@nestjs/common';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { EncryptionService } from '../common/services/encryption.service';

@Module({ controllers: [ImportsController], providers: [ImportsService, EncryptionService] })
export class ImportsModule {}
