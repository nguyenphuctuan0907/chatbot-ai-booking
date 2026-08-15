// booking-worker.module.ts

import { Module } from '@nestjs/common';
import { AIModule } from './ai/ai.module';
import { MessengerProcessor } from './queue/message/messenger.processor';
import { QueueModule } from './queue/queue.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [PrismaModule, AIModule, QueueModule, RedisModule],

  providers: [MessengerProcessor],
})
export class MessengerWorkerModule {}
