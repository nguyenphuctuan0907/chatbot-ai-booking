// booking-core.module.ts

import { Module } from '@nestjs/common';

import { BookingService } from './booking.service';
import { PrismaModule } from 'prisma/prisma.module';
import { MemoryModule } from 'src/memory/memory.module';
import { BookingProcessor } from '../queue/booking/booking.processor';

@Module({
  imports: [PrismaModule, MemoryModule],

  providers: [BookingService, BookingProcessor],

  exports: [BookingService],
})
export class BookingCoreModule {}
