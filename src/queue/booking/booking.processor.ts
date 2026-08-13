import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { BookingService } from '../../booking/booking.service';

@Processor('booking')
export class BookingProcessor extends WorkerHost {
  constructor(private readonly bookingService: BookingService) {
    super();
  }

  async process(job: Job) {
    console.log(`[BookingProcessor] ${job.name}`, job.id);

    switch (job.name) {
      case 'create-booking':
        return this.bookingService.saveBooking(job.data);

      case 'update-booking':
        return this.bookingService.updateBooking(
          job.data.bookingId,
          job.data.data,
        );

      default:
        throw new Error(`Unknown booking job: ${job.name}`);
    }
  }
}
