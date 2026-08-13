import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class BookingQueue {
  constructor(
    @InjectQueue('booking')
    private readonly queue: Queue,
  ) {}

  async addCreateBookingJob(data: any) {
    return this.queue.add('create-booking', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }
}
