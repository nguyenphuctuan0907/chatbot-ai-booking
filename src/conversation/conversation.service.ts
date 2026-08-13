import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MemoryService } from 'src/memory/memory.service';
import { parseBookingTime } from 'src/common';
import { BookingQueue } from 'src/queue/booking/booking.queue';
import { platform } from 'os';
import { checkAndBook } from 'src/booking/common';
import dayjs from 'dayjs';
import { SessionState } from 'http2';
import {
  BookingData,
  KaraokeSessionState,
  PrimaryFlow,
  SessionStatus,
} from 'src/queue/message/message.interfaces';
import { AIParseResult } from 'src/ai/ai.service';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PriceRule {
  id: number;
  name: string;
  price_per_hour: number;
  start_time: string;
  end_time: string;
  day_type: 'NORMAL' | 'WEEKEND';
  min_people: number;
  max_people: number;
}

export interface ConversationReply {
  textReply: string | null;
  name: string;
  isConfirm: boolean;
  resetSession: boolean;
  closeConversation?: boolean;
}

export interface Entity {
  time?: string | null;
  people?: number | null;
  name?: string | null;
  phone?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  day?: string | null;
  parsedTime?: ParsedTime | null;
  isWeekend?: boolean;
  requestedTime?: string | null; // user nói
  suggestedTime?: string | null; // hệ thống gợi ý
  confirmedTime?: string | null; // chốt cuối
  roundedEndTime?: string | null; // làm tròn thời gian chốt cuối theo rule giá
  roundedStartTime?: string | null; // làm tròn thời gian user nói theo rule giá
  duration?: number | null;
  outTime?: string | null;
}

export interface ParsedTime {
  startTime: string;
  endTime: string;
  date: string;
  start: string;
  isWeekend: boolean;
  roundedStartTime?: string;
  roundedEndTime?: string;
}

export interface Memory {
  entity: Entity;
  history: { role: string; content: string }[];
}

export type StepResult =
  | { name: 'ASK_OTHER_INFO'; data: string[] }
  | { name: 'CONFIRM_BOOKING'; data: null }
  | { name: 'CONFIRM_ASK_PRICE'; data: null };

export type MapEntity = Record<string, string>;

export const FLOW_REQUIRED_FIELDS = {
  BOOKING: ['name', 'phone', 'people', 'checkIn'],

  PRICE_QUOTE: ['checkIn', 'people'],

  CHECK_AVAILABILITY: ['checkIn', 'people'],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isTimeInRange(time: string, start: string, end: string): boolean {
  if (start <= end) return time >= start && time <= end;
  return time >= start || time <= end;
}

export function findPriceRule(
  rules: PriceRule[],
  startTime: string,
  people: number,
  isWeekend: boolean,
): PriceRule | null {
  const dayType = isWeekend ? 'WEEKEND' : 'NORMAL';
  return (
    rules.find((r) => {
      if (r.day_type !== dayType) return false;
      if (people < r.min_people) return false;
      if (people > r.max_people) return false;
      if (!isTimeInRange(startTime, r.start_time, r.end_time)) return false;
      return true;
    }) || null
  );
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class ConversationService {
  constructor(
    // private memory: MemoryService,
    private prisma: PrismaService,
    private bookingQueue: BookingQueue,
  ) {}

  async getOrCreateUser(psid: string, bookingData: BookingData) {
    const existingUser = await this.prisma.user.findFirst({
      where: { platformId: psid },
    });

    let user: any = existingUser;

    if (!existingUser) {
      user = await this.prisma.user.create({
        data: {
          platformId: psid,
          username: bookingData.name ?? undefined,
          phone: bookingData.phone ?? undefined,
        },
      });
    }

    return user;
  }

  resolveBehavior(ai) {
    if (ai.intent === 'cancel') {
      return 'TERMINATE';
    }

    if (['ask_price', 'check_availability'].includes(ai.intent)) {
      return 'INTERRUPT';
    }

    if (['booking', 'update_booking'].includes(ai.intent)) {
      return 'FLOW';
    }

    return 'FALLBACK';
  }

  async intentRouter(ai, session, channelConfig, jobPayload) {
    const behavior = this.resolveBehavior(ai);

    switch (behavior) {
      case 'FLOW':
        return this.handleBooking(ai, session, jobPayload.userId);

      case 'INTERRUPT':
      // return this.interruptHandler.handle(
      //    ai,
      //    session
      // );

      case 'TERMINATE':
      // return this.cancelHandler.handle(
      //    session
      // );

      default:
      // return fallbackReply();
    }
  }

  // async handleAskPrice(aiResult: ParsedIntent, msg: { userId: string; conversationId: number }) {
  //   // const memory: Memory = await this.memory.get(msg.userId)
  //   // const entity: Entity = this.merge(memory.entity, ai.entity)
  //   // console.log("handleAskPrice with entity:", entity)

  //   // if (!entity.time && !entity.people) {
  //   //   return { textReply: null, name: ai.intent, isConfirm: true, resetSession: true }
  //   // }

  //   // let parsedTime: ParsedTime | undefined
  //   // if (entity.time) {
  //   //   const parsedResult = parseBookingTime(entity.time);
  //   //   console.log("Parsed time result:", parsedResult)
  //   //   if (parsedResult && parsedResult.time && parsedResult.endTime) {
  //   //     entity.startTime = parsedResult.time
  //   //     entity.endTime = parsedResult.endTime
  //   //     entity.day = parsedResult.date
  //   //     entity.isWeekend = parsedResult.isWeekend
  //   //     parsedTime = {
  //   //       startTime: parsedResult.time,
  //   //       endTime: parsedResult.endTime,
  //   //       date: parsedResult.date,
  //   //       start: parsedResult.time,
  //   //       isWeekend: parsedResult.isWeekend
  //   //     }
  //   //   }
  //   // }
  //   // console.log("handleAskPrice with parsed time:", parsedTime)
  //   // memory.entity = entity
  //   // await this.memory.save(msg.userId, memory)

  //   // const mapEntity: MapEntity = { people: "số lượng người", startTime: "giờ đặt" }
  //   // const step: StepResult = this.nextStep(entity, mapEntity, "CONFIRM_ASK_PRICE")

  //   // if (step.name === "CONFIRM_ASK_PRICE") {
  //   //   await this.prisma.conversation.update({
  //   //     where: { id: msg.conversationId },
  //   //     data: { state: "CONFIRM_ASK_PRICE", status: "CLOSED" }
  //   //   })

  //   //   if (!entity.time) {
  //   //     return {
  //   //       textReply: "Không thể xác định thời gian, vui lòng nhập lại.",
  //   //       name: ai.intent,
  //   //       isConfirm: false,
  //   //       resetSession: false
  //   //     }
  //   //   }

  //   //   const rawRules = await this.prisma.boxPriceInterval.findMany()
  //   //   const priceRules: PriceRule[] = rawRules
  //   //     .filter(r => r.dayType === "NORMAL" || r.dayType === "WEEKEND")
  //   //     .map(r => ({
  //   //       id: r.id,
  //   //       name: r.name ?? "",
  //   //       price_per_hour: r.pricePerHour,
  //   //       start_time: r.startTime,
  //   //       end_time: r.endTime,
  //   //       day_type: r.dayType as "NORMAL" | "WEEKEND",
  //   //       min_people: r.minPeople ?? 0,
  //   //       max_people: r.maxPeople ?? 9999
  //   //     }))

  //   //   const rule = findPriceRule(
  //   //     priceRules,
  //   //     entity.startTime ?? "",
  //   //     entity.people!,
  //   //     entity.isWeekend ?? false
  //   //   )

  //   //   if (!rule) {
  //   //     return {
  //   //       textReply: "Không thể xác định thời gian, vui lòng nhập lại.",
  //   //       name: ai.intent,
  //   //       isConfirm: false,
  //   //       resetSession: false
  //   //     }
  //   //   }

  //   //   return {
  //   //     textReply: `Giá phòng ${entity.people} người lúc ${entity.startTime} là ${rule.price_per_hour.toLocaleString()}/h ạ.`,
  //   //     name: ai.intent,
  //   //     isConfirm: true,
  //   //     resetSession: true
  //   //   }
  //   // }

  //   // return this.reply(step, ai.intent, msg.conversationId, mapEntity)
  // }

  isSwitchFlow(aiResult, session) {
    return aiResult.intent === 'booking' && session.primaryFlow !== 'BOOKING';
  }

  switchFlow(aiResult, session) {
    session.primaryFlow = 'BOOKING';

    session.bookingData = {};

    session.missingFields = [];

    return {
      type: 'SWITCH_FLOW',
    };
  }

  isInterrupt(aiResult, session) {
    return (
      session.primaryFlow === 'BOOKING' &&
      (aiResult.intent === 'ask_price' ||
        aiResult.intent === 'check_availability')
    );
  }

  interrupt(aiResult, session) {
    return {
      type: 'INTERRUPT',
      interruptIntent: aiResult.intent,
    };
  }

  confirm(session) {
    if (session.status !== 'CONFIRMING') {
      return {
        type: 'INVALID_CONFIRM',
      };
    }

    session.status = 'COMPLETED';

    return {
      type: 'COMPLETE',
    };
  }

  mergeUpdates(session, aiResult: AIParseResult) {
    Object.assign(session.bookingData, aiResult.updates);

    session.primaryFlow = 'BOOKING';
    session.lastIntent = aiResult.intent;
    session.confidence = aiResult.confidence;
  }

  decideNextAction(session) {
    if (session.status === 'COMPLETED') {
      return {
        type: 'COMPLETE',
      };
    } else if (session.status === 'COLLECTING_INFO') {
      if (session.subStatus === 'AWAITING_CONFIRM_SUGGESTED_SLOT') {
        return {
          type: 'CONFIRM_SUGGESTED_SLOT',
        };
      } else if (session.subStatus === 'FULL_BOOKED') {
        return {
          type: 'FULL_BOOKED',
        };
      } else if (session.subStatus === 'ASKING_MISSING') {
        return { type: 'ASK_MISSING' };
      }

      return {
        type: 'SUGGEST_SLOT',
      };
    }

    return {
      type: 'ASK_MISSING',
    };
  }

  async updateStatus(session: KaraokeSessionState) {
    if (session.missingFields.length === 0) {
      const { check, parsedResult } = await this.checkBooking(session);

      console.log('Check booking result:', check, parsedResult);

      if (check.success) {
        const user = await this.getOrCreateUser(
          session.sessionId,
          session.bookingData,
        );

        await this.bookingQueue.addCreateBookingJob({
          userId: Number(user.id),
          peopleCount: session.bookingData.people!,
          startTime: parsedResult.time,
          endTime: parsedResult.endTime,
          roundedStartTime: parsedResult.roundedTime,
          roundedEndTime: parsedResult.roundedEndTime,
          name: session.bookingData.name!,
          phone: session.bookingData.phone!,
          day: parsedResult.date,
          room: check.roomId!,
          tenantId: session.tenantId,
        });

        session.status = 'COMPLETED';
        session.subStatus = null;
      } else {
        if ((check.nearestAvailable ?? []).length <= 0) {
          session.status = 'COLLECTING_INFO';
          session.subStatus = 'FULL_BOOKED';
        } else {
          session.status = 'COLLECTING_INFO';
          session.subStatus = 'AWAITING_CONFIRM_SUGGESTED_SLOT';
          session.suggestedSlots =
            check.nearestAvailable?.map((s) => s.startTime) || [];
        }
      }
    } else {
      session.status = 'COLLECTING_INFO';
      session.subStatus = 'ASKING_MISSING';
    }
  }

  recalculateMissing(
    session: KaraokeSessionState,
    aiResult: AIParseResult,
  ): string[] {
    const intentFlow = session.primaryFlow || '';

    const requiredFields = [...FLOW_REQUIRED_FIELDS[intentFlow]];

    // if (session.requireBranch) {
    //   requiredFields.push("branch");
    // }

    session.missingFields = requiredFields.filter((field) => {
      const value = session.bookingData[field];

      return value === undefined || value === null || value === '';
    });

    return session.missingFields;
  }

  async resolveBookingSource(
    session: KaraokeSessionState,
    userId: string,
  ): Promise<'REDIS' | 'DATABASE' | 'NEW'> {
    if (session && session.primaryFlow === 'BOOKING') {
      return 'REDIS';
    }
    //  const dbBooking = await this.findNearestBooking(userId);

    //  if(dbBooking){
    //     return "DATABASE";
    //  }

    return 'NEW';
  }

  async prepareSessionBySource(source, session, userId) {
    switch (source) {
      case 'REDIS':
        return session;

      case 'DATABASE':
      // return this.hydrateFromDB(
      //   userId
      // );

      case 'NEW':
        return session;
    }
  }

  async handleBooking(
    aiResult: AIParseResult,
    session: KaraokeSessionState,
    userId: string,
  ) {
    let workingSession = session;
    const source = await this.resolveBookingSource(session, userId);

    workingSession = await this.prepareSessionBySource(
      source,
      workingSession,
      userId,
    );

    this.mergeUpdates(workingSession, aiResult);

    workingSession.missingFields = this.recalculateMissing(
      workingSession,
      aiResult,
    );

    await this.updateStatus(workingSession);

    return this.decideNextAction(workingSession);

    // if (step.name === "CONFIRM_BOOKING") {

    // return this.reply(step, ai.intent, msg.conversationId, mapEntity)
  }

  handleUpdateBooking(aiResult: AIParseResult, session: KaraokeSessionState) {}

  async checkBooking(session: KaraokeSessionState): Promise<{
    check: {
      success: boolean;
      nearestAvailable?: { startTime: string }[];
      roomId?: number;
    };
    parsedResult: any;
  }> {
    const entity = session.bookingData;
    if (!entity.checkIn)
      return { check: { success: false }, parsedResult: null };

    let parsedTime: string = entity.checkIn;

    const parsedResult = parseBookingTime(
      parsedTime,
      entity.duration ?? undefined,
    );

    const user = await this.prisma.user.findUnique({
      where: { platformId: session.sessionId },
    });

    const bookings = await this.prisma.booking.findMany({
      where: {
        day: parsedResult.date,
        NOT: { userId: user?.id },
      },
    });

    const bookingsByRoom = Object.values(
      bookings.reduce(
        (acc, b) => {
          if (!acc[b.room]) {
            acc[b.room] = {
              room: b.room,
              orders: [],
            };
          }

          acc[b.room].orders.push({
            startTime: b.checkIn,
            endTime: b.checkOut,
          });

          return acc;
        },
        {} as Record<number, any>,
      ),
    );

    const mapRoomCount = {
      // 3: [1, 2, 3],
      12: [4],
    };

    const roomCanBook: number[] = [];

    for (const c of Object.keys(mapRoomCount)) {
      if (Number(c) >= Number(entity.people)) {
        roomCanBook.push(...mapRoomCount[c]);
      }
    }
    console.log({ bookingsByRoom, roomCanBook, entity });

    if (!parsedResult.time || !parsedResult.endTime) {
      return {
        check: { success: false },
        parsedResult: null,
      };
    }

    const check = checkAndBook(
      bookingsByRoom,
      parsedResult.time,
      parsedResult.endTime,
      parsedResult.date,
      roomCanBook,
    );

    return { check, parsedResult };

    if (check.success) {
      // await this.memory.clear(msg.userId)
      // await this.prisma.user.update({ // check tạo hoặc update user
      //   where: { id: Number(msg.userId) },
      //   data: {
      //     username: entity.name!,
      //     phone: entity.phone!,
      //   }
      // })
      // await this.bookingQueue.addCreateBookingJob({
      //   userId: Number(msg.userId),
      //   peopleCount: entity.people!,
      //   startTime: parsedResult.time,
      //   endTime: parsedResult.endTime,
      //   name: entity.name!,
      //   phone: entity.phone!,
      //   day: parsedResult.date,
      //   platformSenderId: msg.platformSenderId,
      //   room: check.roomId!,
      //   roundedStartTime: entity.roundedStartTime,
      //   roundedEndTime: entity.roundedEndTime,
      // })
      // return {
      //   textReply: `✅ ĐẶT PHÒNG THÀNH CÔNG \n - Tên: ${entity.name} \n - SĐT: ${entity.phone} \n - Số người: ${entity.people} \n - Phòng: ${check.roomId} \n - Thời gian đặt: từ ${parsedResult.time} đến ${parsedResult.endTime} \n - Ngày: ${parsedResult.date} \nMình gửi lại bạn thông tin đặt phòng ạ, bạn kiểm tra lại giúp mình nhé! \nNếu cần hỗ trợ thêm bạn cứ nhắn tin cho mình nha!❤️`,
      //   name: ai.intent,
      //   isConfirm: true,
      //   resetSession: true
      // }
    } else {
      // if (check.nearestAvailable?.length === 0) {
      //   return {
      //     textReply: "😓 Rất tiếc hiện tại không còn phòng trống nào phù hợp với yêu cầu của bạn ạ. Bạn có thể gọi điện trực tiếp hootline để được hỗ trợ chính xác hơn nhé: 0123456789",
      //     name: ai.intent,
      //     isConfirm: false,
      //     resetSession: false
      //   }
      // }
      // memory.entity = {
      //   ...entity,
      //   suggestedTime: check.nearestAvailable?.[0]?.startTime
      // }
      // await this.memory.save(msg.userId, memory)
      // return {
      //   textReply: `😓 Đã hết mất phòng trống, hiện tại phải đợi đến ${check.nearestAvailable?.[0]?.startTime} mới có phòng trống ạ. Bạn có muốn đặt phòng vào khung giờ đó không ạ?`,
      //   name: ai.intent,
      //   isConfirm: false,
      //   resetSession: false
      // }
    }
  }

  merge(oldState: Entity, newState: Partial<Entity>): Entity {
    return {
      ...oldState,
      ...Object.fromEntries(
        Object.entries(newState).filter(([_, v]) => v !== null),
      ),
    };
  }

  nextStep(
    state: Entity,
    mapEntity: MapEntity,
    confirmText: string,
  ): StepResult {
    const missingFields = Object.keys(mapEntity).filter((key) => {
      return !state[key as keyof Entity];
    });
    if (missingFields.length > 0) {
      return { name: 'ASK_OTHER_INFO', data: missingFields };
    }
    return {
      name: confirmText as 'CONFIRM_BOOKING' | 'CONFIRM_ASK_PRICE',
      data: null,
    };
  }

  async reply(
    step: StepResult,
    intentName: string,
    conversationId: number,
    mapEntity: MapEntity,
  ): Promise<ConversationReply> {
    switch (step.name) {
      case 'ASK_OTHER_INFO':
        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: { state: 'ASK_OTHER_INFO' },
        });
        return {
          textReply: `Bạn cho mình xin thêm thông tin cụ thể: ${step.data.map((key) => mapEntity[key]).join(', ')} ạ. Bạn cung cấp thêm để mình ${intentName === 'ask_price' ? 'check giá cho bạn nhé' : 'đặt phòng cho bạn nhé'}!`,
          name: intentName,
          isConfirm: false,
          resetSession: false,
        };

      default:
        throw new Error(`Unhandled step: ${step.name}`);
    }
  }
}

export function generateTimes(datePicked: Date = new Date()): string[] {
  const times: string[] = [];
  for (let day = 0; day <= 1; day++) {
    const currentDatePicked = new Date(datePicked);
    currentDatePicked.setDate(currentDatePicked.getDate() + day);
    if (day === 0) {
      for (let h = 6; h < 24; h++) {
        for (let m of [0, 30]) {
          const hh = h.toString().padStart(2, '0');
          const mm = m.toString().padStart(2, '0');
          times.push(`${hh}:${mm}`);
        }
      }
    } else {
      for (let h = 0; h < 6; h++) {
        for (let m of [0, 30]) {
          const hh = h.toString().padStart(2, '0');
          const mm = m.toString().padStart(2, '0');
          times.push(`${hh}:${mm}`);
        }
      }
    }
  }
  return times;
}
