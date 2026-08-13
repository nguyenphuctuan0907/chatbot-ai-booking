// booking-worker.module.ts

import { Module } from '@nestjs/common';
import { QueueModule } from './queue/queue.module';
import { BookingCoreModule } from './booking/BookingCoreModule.module';

@Module({
  imports: [QueueModule, BookingCoreModule],
})
export class BookingWorkerModule {}
