// booking-worker.module.ts

import { Module } from '@nestjs/common';
import { QueueModule } from './queue/queue.module';
import { BookingCoreModule } from './booking/BookingCoreModule.module';
import { BookingProcessor } from './queue/booking/booking.processor';

@Module({
  imports: [QueueModule, BookingCoreModule],
  providers: [BookingProcessor],
})
export class BookingWorkerModule {}
