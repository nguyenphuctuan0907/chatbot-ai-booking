import { Injectable } from "@nestjs/common"
import { Queue } from "bullmq"

@Injectable()
export class BookingQueue {
  private queue: Queue

  constructor() {
    this.queue = new Queue("booking", {
      connection: {
        host: "localhost",
        port: 6379,
      },
    })
  }

  async addCreateBookingJob(data: any) {
    try{

        await this.queue.add(
          "create-booking", // 👈 job name
          data,
          {
            attempts: 3, // retry nếu fail
            backoff: {
              type: "exponential",
              delay: 2000, 
            },
            removeOnComplete: false,
            removeOnFail: false,
            
          }
        )
    }catch(err) {
        return console.error('Error adding job to queue:', err) // Debug log
    }
  }
}