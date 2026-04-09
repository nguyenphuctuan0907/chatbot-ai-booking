import { Controller, Post, Body, Get } from "@nestjs/common"
import { BookingQueue } from "./booking.queue"
import { BookingService } from "./booking.service"

@Controller("booking")
export class BookingController {
  constructor(
    private bookingQueue: BookingQueue,
    private bookingService: BookingService
  ) {}

  @Post()
  async create(@Body() body: any) {
    await this.bookingQueue.addCreateBookingJob(body)

    return {
      status: "queued",
    }
  }

  @Get()
  async getAll() {
    return this.bookingService.getAllBookings()
  }
}