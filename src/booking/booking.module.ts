import { Module } from '@nestjs/common';

import { BookingController } from './booking.controller';
import { BookingGateway } from './booking.gateway';
import { BookingCoreModule } from './BookingCoreModule.module';
import { BookingQueueModule } from 'src/queue/booking/booking.module';

@Module({
  imports: [BookingCoreModule, BookingQueueModule],

  controllers: [BookingController],

  providers: [BookingGateway],
})
export class BookingModule {}
