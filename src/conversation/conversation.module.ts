import { forwardRef, Module } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { MessengerModule } from 'src/messenger/messenger.module';
import { MemoryModule } from 'src/memory/memory.module';
import { AIModule } from 'src/ai/ai.module';
import { ConversationSessionService } from './conversation-session.service';
import { BookingCoreModule } from 'src/booking/BookingCoreModule.module';
import { BookingQueueModule } from 'src/queue/booking/booking.module';

@Module({
  imports: [
    BookingCoreModule,
    PrismaModule,
    MemoryModule,
    AIModule,
    BookingQueueModule,
    forwardRef(() => MessengerModule),
  ],
  providers: [ConversationService, ConversationSessionService],
  exports: [ConversationService, ConversationSessionService],
})
export class ConversationModule {}
