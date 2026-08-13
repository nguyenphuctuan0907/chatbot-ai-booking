import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { MessageQueueService } from '../queue/message/message.queue.service';

@Injectable()
export class MessengerService {
  constructor(
    private prisma: PrismaService,
    private queue: MessageQueueService,
  ) {}
  async handleMessage(body: any) {
    for (const entry of body.entry || []) {
      const logsToInsert: any[] = [];
      for (const event of entry.messaging || []) {
        if (event.message?.text) {
          console.log(event.message);
          const payload = {
            platform: 'facebook',
            channelId: event.recipient.id, // 🔥 Rất quan trọng: Đây chính là page_id
            userId: event.sender.id, // PSID của khách hàng
            text: event.message.text,
            platformSenderId: event.sender.id,
            timestamp_ms: event.timestamp,
            from: 'MESSENGER',
            role: event.message?.is_echo ? 'ASSISTANT' : 'USER', // "user" for user messages, "assistant" for bot replies
          };
          if (event.message?.is_echo) {
            payload.platformSenderId = event.recipient.id; // ID của bot
          }

          logsToInsert.push({
            ...payload,
            type: event.message?.is_echo
              ? event.message?.app_id != process.env.YOUR_APP_ID
                ? 'ADMIN_REPLY'
                : 'BOT_REPLY'
              : 'USER_MESSAGE',
            createdAt: new Date(),
          });
        }
      }
      console.log(logsToInsert);
      for (const log of logsToInsert) {
        if (log.type === 'USER_MESSAGE') {
          await this.queue.enqueue(log);
        }
      }
    }
  }

  async getOrCreateUser(psid: string) {
    const existingUser = await this.prisma.user.findFirst({
      where: { platformId: psid },
    });

    let user: any = existingUser;

    if (!existingUser) {
      user = await this.prisma.user.create({
        data: {
          platformId: psid,
        },
      });
    }

    return user;
  }

  async sendMessage(psid: string, message: any) {
    try {
      await axios.post(
        `https://graph.facebook.com/v19.0/me/messages?access_token=${process.env.PAGE_ACCESS_TOKEN}`,
        {
          recipient: { id: psid },
          message,
        },
      );

      return {
        textReply: message,
        type: 'ASSISTANT',
      };
    } catch (e) {
      console.error('Error sending message:', e);
    }
  }
}
