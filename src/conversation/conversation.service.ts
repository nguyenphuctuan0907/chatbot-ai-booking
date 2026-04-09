import { Injectable } from '@nestjs/common';
import { PrismaService } from "../../prisma/prisma.service"
import { ParsedIntent } from "src/ai/ai.service"
import { MemoryService } from "src/memory/memory.service"
import { parseBookingTime } from "src/common";
import { BookingQueue } from 'src/booking/booking.queue';
import { platform } from 'os';
import { checkAndBook } from 'src/booking/common';
import dayjs from 'dayjs';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PriceRule {
  id: number
  name: string
  price_per_hour: number
  start_time: string
  end_time: string
  day_type: "NORMAL" | "WEEKEND"
  min_people: number
  max_people: number
}

export interface ConversationReply {
  textReply: string | null
  name: string
  isConfirm: boolean
  resetSession: boolean
  closeConversation?: boolean
}

export interface Entity {
  time?: string | null
  people?: number | null
  name?: string | null
  phone?: string | null
  startTime?: string | null
  endTime?: string | null
  day?: string | null
  parsedTime?: ParsedTime | null
  isWeekend?: boolean
  requestedTime?: string | null     // user nói
  suggestedTime?: string | null     // hệ thống gợi ý
  confirmedTime?: string | null     // chốt cuối
  roundedEndTime?: string | null     // làm tròn thời gian chốt cuối theo rule giá
  roundedStartTime?: string | null     // làm tròn thời gian user nói theo rule giá
  duration?: number | null
  outTime?: string | null
}

export interface ParsedTime {
  startTime: string
  endTime: string
  date: string
  start: string
  isWeekend: boolean
  roundedStartTime?: string
  roundedEndTime?: string
}

export interface Memory {
  entity: Entity
  history: { role: string; content: string }[]
}

export type StepResult =
  | { name: "ASK_OTHER_INFO"; data: string[] }
  | { name: "CONFIRM_BOOKING"; data: null }
  | { name: "CONFIRM_ASK_PRICE"; data: null }

export type MapEntity = Record<string, string>

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isTimeInRange(time: string, start: string, end: string): boolean {
  if (start <= end) return time >= start && time <= end
  return time >= start || time <= end
}

export function findPriceRule(
  rules: PriceRule[],
  startTime: string,
  people: number,
  isWeekend: boolean
): PriceRule | null {
  const dayType = isWeekend ? "WEEKEND" : "NORMAL"
  return rules.find((r) => {
    if (r.day_type !== dayType) return false
    if (people < r.min_people) return false
    if (people > r.max_people) return false
    if (!isTimeInRange(startTime, r.start_time, r.end_time)) return false
    return true
  }) || null
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class ConversationService {

  constructor(
    private memory: MemoryService,
    private prisma: PrismaService,
    private bookingQueue: BookingQueue
  ) { }

  async handleAskPrice(ai: ParsedIntent, msg: { userId: string; conversationId: number }): Promise<ConversationReply> {
    const memory: Memory = await this.memory.get(msg.userId)
    const entity: Entity = this.merge(memory.entity, ai.entity)
    console.log("handleAskPrice with entity:", entity)

    if (!entity.time && !entity.people) {
      return { textReply: null, name: ai.intent, isConfirm: true, resetSession: true }
    }

    let parsedTime: ParsedTime | undefined
    if (entity.time) {
      const parsedResult = parseBookingTime(entity.time);
      console.log("Parsed time result:", parsedResult)
      if (parsedResult && parsedResult.time && parsedResult.endTime) {
        entity.startTime = parsedResult.time
        entity.endTime = parsedResult.endTime
        entity.day = parsedResult.date
        entity.isWeekend = parsedResult.isWeekend
        parsedTime = {
          startTime: parsedResult.time,
          endTime: parsedResult.endTime,
          date: parsedResult.date,
          start: parsedResult.time,
          isWeekend: parsedResult.isWeekend
        }
      }
    }
    console.log("handleAskPrice with parsed time:", parsedTime)
    memory.entity = entity
    await this.memory.save(msg.userId, memory)

    const mapEntity: MapEntity = { people: "số lượng người", startTime: "giờ đặt" }
    const step: StepResult = this.nextStep(entity, mapEntity, "CONFIRM_ASK_PRICE")

    if (step.name === "CONFIRM_ASK_PRICE") {
      await this.prisma.conversation.update({
        where: { id: msg.conversationId },
        data: { state: "CONFIRM_ASK_PRICE", status: "CLOSED" }
      })

      if (!entity.time) {
        return {
          textReply: "Không thể xác định thời gian, vui lòng nhập lại.",
          name: ai.intent,
          isConfirm: false,
          resetSession: false
        }
      }

      const rawRules = await this.prisma.boxPriceInterval.findMany()
      const priceRules: PriceRule[] = rawRules
        .filter(r => r.dayType === "NORMAL" || r.dayType === "WEEKEND")
        .map(r => ({
          id: r.id,
          name: r.name ?? "",
          price_per_hour: r.pricePerHour,
          start_time: r.startTime,
          end_time: r.endTime,
          day_type: r.dayType as "NORMAL" | "WEEKEND",
          min_people: r.minPeople ?? 0,
          max_people: r.maxPeople ?? 9999
        }))

      const rule = findPriceRule(
        priceRules,
        entity.startTime ?? "",
        entity.people!,
        entity.isWeekend ?? false
      )

      if (!rule) {
        return {
          textReply: "Không thể xác định thời gian, vui lòng nhập lại.",
          name: ai.intent,
          isConfirm: false,
          resetSession: false
        }
      }

      return {
        textReply: `Giá phòng ${entity.people} người lúc ${entity.startTime} là ${rule.price_per_hour.toLocaleString()}/h ạ.`,
        name: ai.intent,
        isConfirm: true,
        resetSession: true
      }
    }

    return this.reply(step, ai.intent, msg.conversationId, mapEntity)
  }

  async handleBooking(ai: ParsedIntent, msg: { userId: string; conversationId: number, platformSenderId: string }): Promise<ConversationReply> {
    const memory: Memory = await this.memory.get(msg.userId)
    const entity: Entity = this.merge(memory.entity, ai.entity)

    if (entity.time) {
      let parsedTime: string = entity.time;

      if (ai.action === "CONFIRM" && memory.entity.time && entity.time !== memory.entity.time) { // user cung cấp time mới khi đã có time cũ, ưu tiên time mới
        parsedTime = entity.time;
        entity.confirmedTime = entity.time
      } else if (ai.action === "CONFIRM" && memory.entity.suggestedTime && !memory.entity.confirmedTime) {
        parsedTime = memory.entity.suggestedTime
      } else if (ai.action === "REJECT") {
        await this.memory.clear(msg.userId)
        return {
          textReply: "Dạ vâng ạ. 68 Music box rất hân hạnh được phục vụ bạn. Nếu cần hỗ trợ gì thêm bạn cứ nhắn tin cho mình nhé!",
          name: ai.intent,
          isConfirm: true,
          resetSession: true,
          closeConversation: true,
        }
      }

      let endTime: string | null = null
      let roundedEndTime: string | null = null
      if (entity.outTime) {
        const parsed = parseBookingTime(entity.outTime)
        endTime = parsed.time ?? null
        roundedEndTime = parsed.roundedTime ?? null
      }

      const parsedResult = parseBookingTime(parsedTime, entity.duration ?? undefined);
      let pTime: ParsedTime | null = null

      if (parsedResult && parsedResult.time && parsedResult.endTime) {
        let startTime;
        let roundedStartTime;
        if (parsedResult.roundedTime) { // check nếu inTime > outTime thì cập nhật lại outTime = inTime
          const timeIndex = generateTimes().findIndex(t => t === parsedResult.roundedTime);
          const timeOutIndex = generateTimes().findIndex(t => t === memory.entity.roundedEndTime);
          console.log({ timeIndex, timeOutIndex, roundedTime: parsedResult.roundedTime, endTime: memory.entity.roundedEndTime, parsedResult })
          if(timeIndex !== -1 && timeOutIndex !== -1 && timeIndex > timeOutIndex) {
            endTime = parsedResult.time
            roundedEndTime = parsedResult.roundedTime;
            startTime = memory.entity.startTime;
            roundedStartTime = memory.entity.roundedStartTime
            entity.outTime = parsedResult.time
          }
        }

        pTime = {
          startTime: startTime || parsedResult.time,
          endTime: endTime || parsedResult.endTime,
          date: parsedResult.date,
          start: startTime || parsedResult.time,
          isWeekend: parsedResult.isWeekend,
          roundedStartTime: roundedStartTime || parsedResult.roundedTime,
          roundedEndTime: roundedEndTime || parsedResult.roundedEndTime

        }
        entity.startTime = pTime.startTime
        entity.endTime = pTime.endTime
        entity.day = pTime.date
        entity.isWeekend = pTime.isWeekend
        entity.roundedStartTime = pTime.roundedStartTime
        entity.roundedEndTime = pTime.roundedEndTime
      }
    }

    memory.entity = entity
    await this.memory.save(msg.userId, memory)
    const mapEntity: MapEntity = {
      name: "tên",
      phone: "số điện thoại",
      people: "số lượng người",
      startTime: "giờ đặt",
    }

    console.log("Booking confirmed with entity:", entity)
    const step: StepResult = this.nextStep(entity, mapEntity, "CONFIRM_BOOKING")

    if (step.name === "CONFIRM_BOOKING") {
      const bookings = await this.prisma.booking.findMany({
        where: {
          day: entity.day!,
          NOT: { userId: Number(msg.userId) },
        },
      })

      const bookingsByRoom = Object.values(
        bookings.reduce((acc, b) => {
          if (!acc[b.room]) {
            acc[b.room] = {
              room: b.room,
              orders: [],
            }
          }

          acc[b.room].orders.push({
            startTime: b.startTime,
            endTime: b.endTime,
          })

          return acc
        }, {} as Record<number, any>)
      )

      const mapRoomCount = {
        // 3: [1, 2, 3],
        12: [4],
      }

      const roomCanBook: number[] = []

      for (const c of Object.keys(mapRoomCount)) {
        if (Number(c) >= Number(entity.people)) {
          roomCanBook.push(...mapRoomCount[c])
        }
      }
      console.log({ bookingsByRoom, roomCanBook, entity })
      if (!entity.startTime || !entity.endTime || !entity.day) {
        return {
          textReply: "Không thể xác định thời gian, vui lòng nhập lại.",
          name: ai.intent,
          isConfirm: false,
          resetSession: true
        };
      }
      const check = checkAndBook(bookingsByRoom, entity.startTime, entity.endTime, entity.day, roomCanBook);
      console.log("Check and book result:", check)
      if (check.success) {

        // await this.memory.clear(msg.userId)

        await this.prisma.user.update({
          where: { id: Number(msg.userId) },
          data: {
            username: entity.name!,
            phone: entity.phone!,
          }
        })

        // await this.prisma.conversation.update({
        //   where: { id: msg.conversationId },
        //   data: { state: "CONFIRM_BOOKING", status: "CLOSED" }
        // })

        await this.bookingQueue.addCreateBookingJob({
          userId: Number(msg.userId),
          peopleCount: entity.people!,
          startTime: entity.startTime!,
          endTime: entity.endTime!,
          name: entity.name!,
          phone: entity.phone!,
          day: entity.day!,
          platformSenderId: msg.platformSenderId,
          room: check.roomId!,
          roundedStartTime: entity.roundedStartTime,
          roundedEndTime: entity.roundedEndTime,
        })

        return {
          textReply: `✅ ĐẶT PHÒNG THÀNH CÔNG \n - Tên: ${entity.name} \n - SĐT: ${entity.phone} \n - Số người: ${entity.people} \n - Phòng: ${check.roomId} \n - Thời gian đặt: từ ${entity.startTime} đến ${entity.endTime} \n - Ngày: ${entity.day} \nMình gửi lại bạn thông tin đặt phòng ạ, bạn kiểm tra lại giúp mình nhé! \nNếu cần hỗ trợ thêm bạn cứ nhắn tin cho mình nha!❤️`,
          name: ai.intent,
          isConfirm: true,
          resetSession: true
        }

      } else {
        if (check.nearestAvailable?.length === 0) {
          return {
            textReply: "😓 Rất tiếc hiện tại không còn phòng trống nào phù hợp với yêu cầu của bạn ạ. Bạn có thể gọi điện trực tiếp hootline để được hỗ trợ chính xác hơn nhé: 0123456789",
            name: ai.intent,
            isConfirm: false,
            resetSession: false
          }
        }
        memory.entity = {
          ...entity,
          suggestedTime: check.nearestAvailable?.[0]?.startTime
        }
        await this.memory.save(msg.userId, memory)

        return {
          textReply: `😓 Đã hết mất phòng trống, hiện tại phải đợi đến ${check.nearestAvailable?.[0]?.startTime} mới có phòng trống ạ. Bạn có muốn đặt phòng vào khung giờ đó không ạ?`,
          name: ai.intent,
          isConfirm: false,
          resetSession: false
        }
      }
    }

    return this.reply(step, ai.intent, msg.conversationId, mapEntity)
  }

  merge(oldState: Entity, newState: Partial<Entity>): Entity {
    return {
      ...oldState,
      ...Object.fromEntries(
        Object.entries(newState).filter(([_, v]) => v !== null)
      )
    }
  }

  nextStep(state: Entity, mapEntity: MapEntity, confirmText: string): StepResult {
    const missingFields = Object.keys(mapEntity).filter(key => {
      return !state[key as keyof Entity]
    })
    if (missingFields.length > 0) {
      return { name: "ASK_OTHER_INFO", data: missingFields }
    }
    return { name: confirmText as "CONFIRM_BOOKING" | "CONFIRM_ASK_PRICE", data: null }
  }

  async reply(step: StepResult, intentName: string, conversationId: number, mapEntity: MapEntity): Promise<ConversationReply> {
    switch (step.name) {
      case "ASK_OTHER_INFO":
        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: { state: "ASK_OTHER_INFO" }
        })
        return {
          textReply: `Bạn cho mình xin thêm thông tin cụ thể: ${step.data.map(key => mapEntity[key]).join(", ")} ạ. Bạn cung cấp thêm để mình ${intentName === "ask_price" ? "check giá cho bạn nhé" : "đặt phòng cho bạn nhé"}!`,
          name: intentName,
          isConfirm: false,
          resetSession: false
        }

      default:
        throw new Error(`Unhandled step: ${step.name}`)
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
          const hh = h.toString().padStart(2, "0");
          const mm = m.toString().padStart(2, "0");
          times.push(`${hh}:${mm}`);
        }
      }
    } else {
      for (let h = 0; h < 6; h++) {
        for (let m of [0, 30]) {
          const hh = h.toString().padStart(2, "0");
          const mm = m.toString().padStart(2, "0");
          times.push(`${hh}:${mm}`);
        }
      }
    }
  }
  return times;
}