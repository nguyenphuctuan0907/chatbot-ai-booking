import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

@Injectable()
export class MessageQueueService {
  constructor(
    @InjectQueue("message-queue") private queue: Queue,
  ) {}

  async enqueue(messageId: number) {
    await this.queue.add(
      "process-message",
      { messageId },
      {
        delay: 1000, // ưu tiên admin 20s
        attempts: 3,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }
}