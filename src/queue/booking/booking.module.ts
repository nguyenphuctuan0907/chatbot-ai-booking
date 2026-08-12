import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { BookingQueue } from './booking.queue';
import { BookingProcessor } from './booking.processor';

import { BookingCoreModule } from '../../booking/BookingCoreModule.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'booking',
    }),

    BookingCoreModule,
  ],

  providers: [BookingQueue, BookingProcessor],

  exports: [BookingQueue],
})
export class BookingQueueModule {}
