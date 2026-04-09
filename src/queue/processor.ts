import axios from "axios";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { PrismaService } from "../../prisma/prisma.service";
import { MESSAGE_QUEUE, MessageStatus } from "./constants";
import { AIService, ParsedIntent } from "src/ai/ai.service";
import { ConversationService } from "src/conversation/conversation.service";

@Processor(MESSAGE_QUEUE)
export class MessageProcessor extends WorkerHost {

  constructor(
    private prisma: PrismaService,
    private ai: AIService,
    private conversation: ConversationService
  ) {
    super();
    console.log("Worker started");
  }

  handleGreeting = async (_, msg) => {

    await axios.post(
      `https://graph.facebook.com/v19.0/me/messages`,
      {
        recipient: { id: msg.platformSenderId },
        message: { text: "68 MUSIC BOX chào bạn ạ! Bạn có muốn đặt phòng trước không ạ?" },
      },
      {
        params: {
          access_token: process.env.PAGE_ACCESS_TOKEN,
        },
      },
    );
  };

  handleAskPrice = async (_, msg) => {

    const { textReply, name } = await this.conversation.handleAskPrice(_, msg)

    if (textReply) {
      await axios.post(
        `https://graph.facebook.com/v19.0/me/messages`,
        {
          recipient: { id: msg.platformSenderId },
          message: { text: textReply },
        },
        {
          params: {
            access_token: process.env.PAGE_ACCESS_TOKEN,
          },
        });
    } else {
      this.handleSendMessage({ name, senderId: msg.platformSenderId, conversationId: msg.conversationId })
    }

  };

  handleBooking = async (_, msg) => {
    const { textReply, name, closeConversation } = await this.conversation.handleBooking(_, msg);
    console.log({ textReply, name, msg });

    await axios.post(
      `https://graph.facebook.com/v19.0/me/messages`,
      {
        recipient: { id: msg.platformSenderId },
        message: { text: textReply },
      },
      {
        params: {
          access_token: process.env.PAGE_ACCESS_TOKEN,
        },
      });


    if (closeConversation) {
      await this.prisma.conversation.update({
        where: { id: msg.conversationId },
        data: { state: "CONFIRM_BOOKING", status: "CLOSED" }
      })
      return;
    }


  }

  private INTENT_MAP = {
    greeting: this.handleGreeting,
    booking: this.handleBooking,
    ask_price: this.handleAskPrice,
    // other: handleOther,
    // promotion: handlePromotion,
    // ask_services_genneral: handleAskServicesGeneral,
    // ask_services_other: handleAskServiceOther,
    // ask_menu: handleAskMenu,
    // ask_opening_time: handleAskOpeningTime,
    // live_support: handleLiveSupport,
    // ask_location: handleAskLocation,
    // thank_you: handleThankYou,
  };

  async handleSendMessage({ name, senderId, conversationId }: { name: string, senderId: string, conversationId: number }) {
    const intent = await this.prisma.intent.findFirst({
      where: { name },
      include: { images: true },
    })

    if (!intent) {
      console.warn("Intent ask_price not found in DB");
      return;
    }

    if (intent.images && intent.images.length > 0) {
      // Do something with the images, e.g., send them to the user
      for (const img of intent.images) {
        try {
          await axios.post(
            `https://graph.facebook.com/v19.0/me/messages`,
            {
              recipient: { id: senderId },
              message: {
                "attachment": {
                  type: 'image',
                  payload: { url: img.url, "is_reusable": true }
                }
              },
            },
            {
              params: {
                access_token: process.env.PAGE_ACCESS_TOKEN,
              },
            },
          );
        } catch (e) {
          console.error("Error sending image:", e);
        }
      }
    }

    await axios.post(
      `https://graph.facebook.com/v19.0/me/messages`,
      {
        recipient: { id: senderId },
        message: { text: intent.replyText },
      },
      {
        params: {
          access_token: process.env.PAGE_ACCESS_TOKEN,
        },
      },
    );

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { state: "CONFIRM_ASK_PRICE", status: "CLOSED" }
    })

  }

  async process(job: any) {
    const { messageId } = job.data;
    console.log(`Processing message with ID: ${messageId}`);

    // claim atomic
    const result = await this.prisma.message.updateMany({
      where: {
        id: messageId,
        status: MessageStatus.PENDING
      },
      data: {
        status: MessageStatus.PROCESSING,
        processingBy: "worker"
      }
    })

    if (result.count === 0) return; // admin đã xử lý

    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!msg || !msg.userId) return;

    /* ---------- load context ---------- */
    const context = await this.getContext(msg.conversationId);
    console.log("Loaded context:", context);
    let ai: ParsedIntent;
    try {
      ai = await this.ai.parse(context);
    } catch (e) {
      console.error("Error parsing AI context:", e);
      await this.fail(messageId);
      return;
    }

    console.log("AI parsed result:", ai);


    try {
      const handler = this.INTENT_MAP[ai.intent];
      if (handler) {
        await handler(ai, msg);


      } else {
        console.warn("No handler for intent:", ai.intent);
      }

      await this.prisma.message.update({
        where: { id: messageId },
        data: { status: MessageStatus.REPLIED },
      });
    } catch (e) {
      console.error("Error handling intent:", e);
      return;
    }

  }

  async getContext(conversationId: number) {
    const msgs = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: 20
    })

    return msgs.map(m => ({
      role: m.role.toLowerCase(),
      content: m.message
    }))
  }

  async done(id: number) {
    await this.prisma.message.update({
      where: { id },
      data: { status: MessageStatus.REPLIED },
    });
  }

  async fail(id: number) {
    await this.prisma.message.update({
      where: { id },
      data: { status: MessageStatus.FAILED },
    });
  }
}