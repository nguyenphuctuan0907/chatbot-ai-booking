import { forwardRef, Module } from '@nestjs/common';
import { ConversationService } from "./conversation.service";
import { PrismaModule } from '../../prisma/prisma.module';
import { MessengerModule } from 'src/messenger/messenger.module';
import { MemoryModule } from 'src/memory/memory.module';
import { AIModule } from 'src/ai/ai.module';
import { ConversationSessionService } from './conversation-session.service';
import { BookingCoreModule } from 'src/booking/BookingCoreModule.module';

@Module({
    imports: [
        PrismaModule,
        MemoryModule,
        AIModule,
        BookingCoreModule,
        forwardRef(() => MessengerModule)
    ],
    providers: [ConversationService, ConversationSessionService],
    exports: [ConversationService, ConversationSessionService],
})
export class ConversationModule { }

