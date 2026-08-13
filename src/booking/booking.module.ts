import { Module } from '@nestjs/common';

import { BookingController } from './booking.controller';
import { BookingGateway } from './booking.gateway';
import { BookingCoreModule } from './BookingCoreModule.module';
import { BookingProcessor } from '../queue/booking/booking.processor';
import { BookingQueueModule } from 'src/queue/booking/booking.module';

@Module({
  imports: [BookingCoreModule, BookingQueueModule],

  controllers: [BookingController],

  providers: [BookingGateway, BookingProcessor],
})
export class BookingModule {}
