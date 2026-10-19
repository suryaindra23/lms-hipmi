import { Module } from '@nestjs/common';
import { StudentStoreController } from './student-store.controller';
import { StudentStoreService } from './student-store.service';
import { AccessModule } from '../access/access.module';

@Module({ imports: [AccessModule], controllers: [StudentStoreController], providers: [StudentStoreService] })
export class StudentStoreModule {}
