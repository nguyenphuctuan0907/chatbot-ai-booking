import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { BookingService } from '../../booking/booking.service';
import { Inject } from '@nestjs/common';

@Processor('booking')
export class BookingProcessor extends WorkerHost {
  constructor(
    @Inject(BookingService) private readonly bookingService: BookingService,
  ) {
    super();
  }

  async process(job: Job) {
    console.log(`[BookingProcessor] ${job.name}`, job.id, job.data);

    switch (job.name) {
      case 'create-booking':
        try {
          return this.bookingService.saveBooking(job.data);
        } catch (error) {
          console.error('Error processing create-booking job:', error);
          throw error;
        }
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
