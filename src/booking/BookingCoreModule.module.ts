// booking-core.module.ts

import { Module } from "@nestjs/common"
import { BookingService } from "./booking.service"
import { BookingQueue } from "./booking.queue"
import { PrismaModule } from "prisma/prisma.module"
import { MemoryModule } from "src/memory/memory.module"

@Module({
    imports: [PrismaModule, MemoryModule],
  providers: [BookingService, BookingQueue],
  exports: [BookingService, BookingQueue],
})
export class BookingCoreModule {}