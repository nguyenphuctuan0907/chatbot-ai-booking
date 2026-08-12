import { forwardRef, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MessageProcessor } from './message.processor';
import { MessageQueueService } from './message.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AIModule } from 'src/ai/ai.module';
import { EventService } from './message.event.service';
import { RedisService } from 'src/redis/redis.service';
import { ConversationModule } from 'src/conversation/conversation.module';
import { BookingQueue } from 'src/booking/booking.queue';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
      },
    }),

    BullModule.registerQueue({
      name: 'message-queue',
    }),
    PrismaModule,
    AIModule,
    forwardRef(() => ConversationModule),
  ],
  providers: [
    MessageProcessor,
    MessageQueueService,
    EventService,
    RedisService,
    BookingQueue,
  ],
  exports: [MessageQueueService, EventService, RedisService],
})
export class QueueModule {}
