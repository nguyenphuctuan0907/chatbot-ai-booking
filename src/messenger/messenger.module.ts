import { forwardRef, Module } from '@nestjs/common';

import { MessengerController } from './messenger.controller';
import { MessengerService } from './messenger.service';
import { MessengerProcessor } from '../queue/message/messenger.processor';

import { MessageQueueModule } from 'src/queue/message/message.module';
// import { BookingQueueModule } from 'src/queue/booking/booking.module';
import { AIModule } from 'src/ai/ai.module';

// import { ConversationModule } from 'src/conversation/conversation.module';

@Module({
  imports: [
    // AIModule,
    MessageQueueModule,
    // BookingQueueModule,
    // forwardRef(() => ConversationModule),
  ],

  controllers: [MessengerController],

  providers: [MessengerService],

  exports: [MessengerService],
})
export class MessengerModule {}
