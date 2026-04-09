// src/conversation/conversation-session.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const CONVERSATION_TIMEOUT = 12 * 60 * 60 * 1000 // 12 giờ

@Injectable()
export class ConversationSessionService {
  constructor(private prisma: PrismaService) { }

  async getOrCreate(userId: number) {

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        userId,
        status: "OPEN"
      },
      orderBy: {
        createdAt: "desc"
      }
    })

    if (!conversation) {
      return this.createConversation(userId)
    }

    const now = new Date().getTime()
    const last = new Date(conversation.lastMessageAt).getTime()

    const expired = now - last > CONVERSATION_TIMEOUT

    if (expired) {

      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { status: "CLOSED" }
      })

      return this.createConversation(userId)
    }

    return conversation
  }

  async createConversation(userId: number) {

    return this.prisma.conversation.create({
      data: {
        userId,
        state: "START",
        status: "OPEN",
        lastMessageAt: new Date()
      }
    })
  }

  async touchConversation(conversationId: number) {

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() }
    })
  }
}