import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { MessageQueueService } from './message.queue.service';
import { EventService } from './message.event.service';
import { PrismaModule } from 'prisma/prisma.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'message-queue',
    }),
    PrismaModule,
  ],

  providers: [MessageQueueService, EventService],

  exports: [MessageQueueService, EventService],
})
export class MessageQueueModule {}
