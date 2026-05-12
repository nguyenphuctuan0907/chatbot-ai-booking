import axios from 'axios';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { MESSAGE_QUEUE, MessageStatus } from './constants';
import { AIContext, AIService } from 'src/ai/ai.service';
import { RedisService } from 'src/redis/redis.service';
import { KaraokeSessionState } from './interfaces';
import { ConfidenceGuard } from 'src/guards/confidence.guard';
import { ValidatorService } from 'src/validator/booking.validator';
import { ConversationService } from 'src/conversation/conversation.service';

export const MAP_NAME_FIELD = {
  checkIn: 'giờ đến',
  people: 'số lượng người',
  phone: 'số điện thoại',
  name: 'tên',
};

@Processor(MESSAGE_QUEUE)
export class MessageProcessor extends WorkerHost {
  constructor(
    private prisma: PrismaService,
    private ai: AIService,
    private redis: RedisService,
    // private confidenceGuard: ConfidenceGuard,
    // private validator: ValidatorService,
    private conversation: ConversationService,
  ) {
    super();
    console.log('Worker started');
  }

  handleGreeting = async (_, msg) => {
    await axios.post(
      `https://graph.facebook.com/v19.0/me/messages`,
      {
        recipient: { id: msg.platformSenderId },
        message: {
          text: '68 MUSIC BOX chào bạn ạ! Bạn có muốn đặt phòng trước không ạ?',
        },
      },
      {
        params: {
          access_token: process.env.PAGE_ACCESS_TOKEN,
        },
      },
    );
  };

  handleAskPrice = async (_, msg) => {};

  handleBooking = async (aiResult, session, channelConfig, jobPayload) => {
    console.log({ aiResult, session, channelConfig });

    return this.conversation.handleBooking(
      aiResult,
      session,
      jobPayload.userId,
    );
  };

  handleUpdateBooking = async (aiResult, session, channelConfig) => {
    console.log({ aiResult, session, channelConfig });

    return this.conversation.handleUpdateBooking(aiResult, session);
  };

  private INTENT_MAP = {
    greeting: this.handleGreeting,
    booking: this.handleBooking,
    ask_price: this.handleAskPrice,
    update_booking: this.handleUpdateBooking,
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

  async handleSendMessage({
    name,
    senderId,
    conversationId,
  }: {
    name: string;
    senderId: string;
    conversationId: number;
  }) {
    const intent = await this.prisma.intent.findFirst({
      where: { name },
      include: { images: true },
    });

    if (!intent) {
      console.warn('Intent ask_price not found in DB');
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
                attachment: {
                  type: 'image',
                  payload: { url: img.url, is_reusable: true },
                },
              },
            },
            {
              params: {
                access_token: process.env.PAGE_ACCESS_TOKEN,
              },
            },
          );
        } catch (e) {
          console.error('Error sending image:', e);
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
  }

  async process(job: any) {
    const { jobPayload } = job.data;
    console.dir(jobPayload, { depth: null });

    /* ---------- load context ---------- */
    try {
      // Truy vấn xem page_id này thuộc về quán nào
      const channelConfig = await this.prisma.channel.findUnique({
        where: { id: jobPayload.channelId },
        include: { tenant: true },
      });

      console.log('channelConfig', channelConfig);

      if (!channelConfig) {
        console.error(`Unrecognized channel ID: ${jobPayload.channelId}`);
        return; // Bỏ qua nếu page chưa được kết nối
      }

      // 1. GET SESSION
      let session = await this.redis.getSession(jobPayload.userId);

      if (!session) {
        // Nếu chưa có, khởi tạo state mới tinh
        session = this.redis.createDefault(jobPayload, channelConfig);
      }
      console.log('[Worker] Loaded session from Redis:', session);
      const aiContext: AIContext = {
        tenantName: session.tenantName,
        status: session.status,
        subStatus: session.subStatus,
        primaryFlow: session.primaryFlow,
        lastIntent: session.lastIntent,
        lastAskedFields: session.missingFields,
        suggestedSlots: session.suggestedSlots,
        bookingData: session.bookingData, // Gồm giờ, tên, SĐT, số người...
      };

      const aiResult = await this.ai.parse(aiContext, jobPayload.text);
      console.log('[Worker] AI parsed result:', aiResult);

      const action = await this.conversation.intentRouter(
        aiResult,
        session,
        channelConfig,
        jobPayload,
      );

      const reply = this.responseBuilder(action, session);

      await axios.post(
        `https://graph.facebook.com/v19.0/me/messages`,
        {
          recipient: { id: jobPayload.platformSenderId },
          message: { text: reply },
        },
        {
          params: {
            access_token: process.env.PAGE_ACCESS_TOKEN,
          },
        },
      );
      console.log('session after handler:', session);
      //. CẬP NHẬT TRẠNG THÁI (State Merge)
      session.updatedAt = Date.now();
      await this.redis.saveSession(jobPayload.userId, session);

      // this.confidenceGuard.check(aiResult);

      // this.validator.validate(aiResult);
    } catch (e) {
      console.error('Error parsing AI context:', e);
      // await this.fail(jobPayload.id);
      return;
    }
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

  responseBuilder(action, session) {
    console.log('Building response for action:', action, session);
    switch (action.type) {
      case 'SWITCH_FLOW':
        return 'Dạ mình đặt phòng ạ ❤️ Cho em xin giờ, số khách và sđt nhé.';
      case 'SUGGEST_SLOT':
        return `😓 Đã hết mất phòng trống, hiện tại phải đợi đến ${session.suggestedSlots[0]} mới có phòng trống ạ. Bạn có muốn đặt phòng vào khung giờ đó không ạ?`;

      case 'FULL_BOOKED':
        return `😓 Rất tiếc hiện tại không còn phòng trống nào phù hợp với yêu cầu của bạn ạ. Bạn có thể gọi điện trực tiếp hootline để được hỗ trợ chính xác hơn nhé: 0123456789`;
      case 'INTERRUPT':
        return `
Dạ giá bên em từ 200k/giờ ❤️

Mình tiếp tục booking nhé,
cho em xin thêm:
${session.missingFields.join(', ')}
`;

      case 'INVALID_CONFIRM':
        return 'Dạ mình chưa đủ thông tin để xác nhận booking ạ ❤️';

      case 'CONFIRM_SUGGESTED_SLOT':
        return `
Dạ mình có thể đặt phòng vào khung giờ ${session.suggestedSlots[0]} ạ ❤️`;

      case 'COMPLETE':
        return 'Booking của anh/chị đã được tạo thành công ❤️';

      case 'CONFIRM':
        return `
Em xin xác nhận booking:

${JSON.stringify(session.bookingData)}

Anh/chị xác nhận giúp em nhé ❤️
`;

      case 'ASK_MISSING':
        session.lastAskedFields = session.missingFields;

        return `
Cho em xin thêm:
${session.missingFields.map((field) => MAP_NAME_FIELD[field] || field).join(', ')}
`;

      default:
        return 'Dạ em chưa hiểu ý mình lắm ạ ❤️';
    }
  }
}
