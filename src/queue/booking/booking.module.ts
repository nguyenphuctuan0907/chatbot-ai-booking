import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { BookingQueue } from './booking.queue';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'booking',
    }),
  ],

  providers: [BookingQueue],

  exports: [BookingQueue],
})
export class BookingQueueModule {}
