import { forwardRef, Module } from '@nestjs/common';
import { MessengerController } from './messenger.controller';
import { MessengerService } from './messenger.service';
import { QueueModule } from 'src/queue/queue.module';
import { ConversationModule } from 'src/conversation/conversation.module';

@Module({
  imports: [forwardRef(() => QueueModule), forwardRef(() => ConversationModule)],
  controllers: [MessengerController],
  providers: [MessengerService],
  exports: [MessengerService],
})
export class MessengerModule {}
