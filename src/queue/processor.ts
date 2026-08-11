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
import {
  classifyIntentNode,
  preClassifyNode,
} from 'src/nodes/classify-intent.node';
import { mergeUpdatesNode } from 'src/nodes/merge-updates.node';
import { recalculateMissingNode } from 'src/nodes/recalculate-missing.node';
import { checkBookingNode } from 'src/nodes/check-booking.node';
import { BookingQueue } from 'src/booking/booking.queue';
import { respondNode } from 'src/nodes/respond.node';

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
    private bookingQueue: BookingQueue,
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
      let session =
        (await this.redis.getSession(jobPayload.userId)) ??
        this.redis.createDefault(jobPayload, channelConfig);

      const preResult: any = await preClassifyNode(
        session,
        jobPayload.text,
        this.ai,
      );
      let aiUpdates: any;
      if (preResult.matched) {
        // ── Pre-classify hit → skip AI hoàn toàn ──────────────────────
        console.log('[Process] Pre-classify hit:', preResult.aiResult!.intent);

        session = this.applyUpdate(session, {
          lastIntent: preResult.aiResult!.intent,
        });
        aiUpdates = preResult.aiResult!.updates;
      } else {
        const intentResult = await classifyIntentNode(
          session,
          jobPayload.text,
          this.ai,
        );

        session = this.applyUpdate(session, intentResult);
        aiUpdates = intentResult._aiUpdates ?? {};
      }

      // ROUTER: Quyết định chạy pipeline nào
      const reply = await this.router(session, aiUpdates, jobPayload);

      session.updatedAt = Date.now();
      await this.redis.saveSession(jobPayload.userId, session);
      await this.sendToFacebook(jobPayload.platformSenderId, reply);
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

  /**
   * Merge Partial<session> vào session hiện tại
   * KHÔNG mutate session gốc → tạo object mới
   */
  private applyUpdate(
    session: KaraokeSessionState,
    update: Partial<KaraokeSessionState>,
  ): KaraokeSessionState {
    // Lọc bỏ _aiUpdates (field nội bộ, không lưu vào session)
    const { _aiUpdates, ...cleanUpdate } = update as any;
    return { ...session, ...cleanUpdate };
  }

  private async sendToFacebook(psid: string, text: string) {
    await axios.post(
      `https://graph.facebook.com/v19.0/me/messages`,
      { recipient: { id: psid }, message: { text } },
      { params: { access_token: process.env.PAGE_ACCESS_TOKEN } },
    );
  }

  private async router(
    session: KaraokeSessionState,
    aiUpdates: any,
    jobPayload: any,
  ): Promise<string> {
    const intent = session.lastIntent;

    // Cancel → dừng ngay, không cần check gì thêm
    // if (intent === 'cancel') {
    //   return this.runCancelPipeline(session);
    // }

    // // Hỏi giá → pipeline riêng
    // if (intent === 'ask_price') {
    //   return this.runAskPricePipeline(session, aiUpdates);
    // }

    // // Check availability → pipeline riêng
    // if (intent === 'check_availability') {
    //   return this.runCheckAvailabilityPipeline(session, aiUpdates);
    // }

    // Booking / update_booking → pipeline chính
    if (['booking', 'update_booking'].includes(intent ?? '')) {
      return this.runBookingPipeline(session, aiUpdates);
    }

    // Đang giữa chừng booking mà user hỏi ngoài lề
    if (session.primaryFlow === 'BOOKING' && intent === 'other') {
      return this.runBookingPipeline(session, {}); // không merge gì thêm
    }

    return 'Dạ em chưa hiểu ý bạn lắm, bạn nhắn lại giúp em nhé ❤️';
  }

  // BOOKING PIPELINE
  private async runBookingPipeline(session, aiUpdates): Promise<string> {
    let s = session;
    s = this.applyUpdate(s, mergeUpdatesNode(s, aiUpdates));
    s = this.applyUpdate(s, recalculateMissingNode(s));
    s = this.applyUpdate(
      s,
      await checkBookingNode(s, this.prisma, this.bookingQueue),
    );
    Object.assign(session, s); // cập nhật lại session gốc để save
    return respondNode(s);
  }
}
