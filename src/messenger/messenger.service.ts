import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { MessageQueueService } from '../queue/queue.service';
import { ConversationSessionService } from 'src/conversation/conversation-session.service';

@Injectable()
export class MessengerService {
    constructor(
        private prisma: PrismaService,
        private queue: MessageQueueService,
        private conversation: ConversationSessionService,
    ) { }
    async handleMessage(body: any) {
        for (const entry of body.entry || []) {
            const logsToInsert: any[] = [];
            for (const event of entry.messaging || []) {
                if (event.message?.text) {

                    const payload = {
                        platformSenderId: event.sender.id,
                        message: event.message?.text || "",
                        timestamp_ms: event.timestamp,
                        messageId: event.message?.mid || null,
                        from: "MESSENGER",
                        role: event.message?.is_echo ? "ASSISTANT" : "USER", // "user" for user messages, "assistant" for bot replies
                    };
                    if (event.message?.is_echo) {
                        payload.platformSenderId = event.recipient.id; // ID của bot
                    }

                    logsToInsert.push({
                        ...payload,
                        type: event.message?.is_echo
                            ? event.message?.app_id != process.env.YOUR_APP_ID
                                ? "ADMIN_REPLY"
                                : "BOT_REPLY"
                            : "USER_MESSAGE",
                        createdAt: new Date(),
                    });

                }

            }
            console.log(logsToInsert);

            for (const log of logsToInsert) {
                const user = await this.getOrCreateUser(log.platformSenderId);

                if (log.type === "USER_MESSAGE") {
                    const session = await this.conversation.getOrCreate(user.id);
                    const message = await this.prisma.message.create({
                        data: {
                            ...log,
                            timestamp_ms: BigInt(log.timestamp_ms),
                            direction: "INCOMING",
                            status: "PENDING",
                            userId: user.id,
                            conversationId: session.id,
                        }
                    })
                    // 3. update activity
                    await this.conversation.touchConversation(session.id)
                    await this.queue.enqueue(message.id);
                } else {
                    const lastUserMessage = await this.prisma.message.findFirst({
                        where: {
                            platformSenderId: log.platformSenderId,
                            direction: "INCOMING",
                        },
                        orderBy: {
                            createdAt: "desc"
                        },
                        select: {
                            conversationId: true
                        }
                    })
                    await this.prisma.message.create({
                        data: {
                            ...log,
                            timestamp_ms: BigInt(log.timestamp_ms),
                            direction: "OUTGOING",
                            status: "SENT",
                            userId: user.id,
                            conversationId: lastUserMessage?.conversationId,
                        },
                    });

                    // mark pending user messages → replied
                    await this.prisma.message.updateMany({
                        where: {
                            platformSenderId: log.platformSenderId,
                            direction: "INCOMING",
                            status: { in: ["PROCESSING", "PENDING"] },
                        },
                        data: { status: "REPLIED" },
                    });

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
                    platformId: psid
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
                type: "ASSISTANT"
            }
        } catch (e) {
            console.error("Error sending message:", e);
        }
    }
}