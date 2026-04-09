import { forwardRef, Module } from "@nestjs/common"
import { BullModule } from "@nestjs/bullmq"
import { MessageProcessor } from "./processor"
import { MessageQueueService } from "./queue.service"
import { PrismaModule } from "../../prisma/prisma.module"
import { ConversationModule } from "src/conversation/conversation.module"
import { AIModule } from "src/ai/ai.module"
import { EventService } from "./event.service"
import { BookingModule } from "src/booking/booking.module"

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || "localhost",
        port: Number(process.env.REDIS_PORT) || 6379,
      },
    }),

    BullModule.registerQueue({
      name: "message-queue",
    }),
    PrismaModule,
    AIModule,
    forwardRef(() => ConversationModule),
    
  ],
  providers: [MessageProcessor, MessageQueueService, EventService],
  exports: [MessageQueueService, EventService],
})
export class QueueModule {}