import { Module } from '@nestjs/common';
import { RubricsController } from './rubrics.controller';
import { RubricsService } from './rubrics.service';
import { AccessModule } from '../access/access.module';

@Module({ imports: [AccessModule], controllers: [RubricsController], providers: [RubricsService] })
export class RubricsModule {}
