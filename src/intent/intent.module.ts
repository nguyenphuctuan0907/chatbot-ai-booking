import { Module } from '@nestjs/common';
import { IntentService } from './intent.service';
import { IntentController } from './intent.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [IntentController],
  providers: [IntentService, PrismaService],
})
export class IntentModule {}