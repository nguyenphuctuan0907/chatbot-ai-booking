import { Injectable } from "@nestjs/common"
import { PrismaService } from "prisma/prisma.service"

@Injectable()
export class BookingService {
  constructor(private prisma: PrismaService) {}

  async createBooking(data: any) {
    return this.prisma.booking.create({ data })
  }

  async getAllBookings(day?: string) {
    return this.prisma.booking.findMany({
        where: {
            day: day
        },
        orderBy: {
            room: 'asc'
        }
    })
  }

  async checkBookingInDay(day: string, userId: number) {
    return this.prisma.booking.findMany({
      where: {
        day: day,
        userId: userId
      }
    })
  }

  async updateBooking(bookingId: number, data: any) {
    return this.prisma.booking.update({
      where: { id: bookingId },
      data
    })
  }

  async updateConversationId( conversationId: number) {

    return this.prisma.conversation.update({
        where: { id: conversationId },
        data: { state: "CONFIRM_BOOKING", status: "CLOSED" }
      })

  }
}