import { Injectable } from "@nestjs/common"
import Redis from "ioredis"

@Injectable()
export class EventService {
  private pub = new Redis()

  async publish(channel: string, payload: any) {
    await this.pub.publish(channel, JSON.stringify(payload))
  }
}