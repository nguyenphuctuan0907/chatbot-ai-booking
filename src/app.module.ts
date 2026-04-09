import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MessengerModule } from './messenger/messenger.module';
import { QueueModule } from './queue/queue.module';
import { IntentModule } from './intent/intent.module';
import { R2Module } from './r2/r2.module';
import { BookingModule } from './booking/booking.module';

@Module({
  imports: [PrismaModule, MessengerModule, QueueModule, IntentModule, R2Module, BookingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
