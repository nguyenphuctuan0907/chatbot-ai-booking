import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { MessengerService } from './messenger.service';

@Controller('webhook')
export class MessengerController {
  constructor(private readonly service: MessengerService) {}

  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
      return challenge;
    }
    return 'Forbidden';
  }

  @Post()
  async receive(@Body() body: any) {
    await this.service.handleMessage(body);
    return 'EVENT_RECEIVED';
  }
}