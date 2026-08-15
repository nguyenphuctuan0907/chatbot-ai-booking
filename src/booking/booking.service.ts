import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class BookingService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async createBooking(data: any) {
    try {
      console.log('Creating booking with data:', data);
      return this.prisma.booking.create({ data });
    } catch (error) {
      console.error('Error creating booking:', error);
      throw error;
    }
  }

  async getAllBookings(day?: string) {
    return this.prisma.booking.findMany({
      where: {
        day: day,
      },
      orderBy: {
        room: 'asc',
      },
    });
  }

  async checkBookingInDay(day: string, userId: number) {
    return this.prisma.booking.findMany({
      where: {
        day: day,
        userId: userId,
      },
    });
  }

  async updateBooking(bookingId: number, data: any) {
    return this.prisma.booking.update({
      where: { id: bookingId },
      data,
    });
  }

  async updateConversationId(conversationId: number) {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { state: 'CONFIRM_BOOKING', status: 'CLOSED' },
    });
  }

  async saveBooking(data: any) {
    try {
      const user = await this.prisma.user.upsert({
        where: { platformId: data.sessionId },
        update: {
          username: data.name ?? undefined,
          phone: data.phone ?? undefined,
        },
        create: {
          platformId: data.sessionId,
          username: data.name ?? undefined,
          phone: data.phone ?? undefined,
        },
      });

      const checkBooking = await this.checkBookingInDay(data.day, user.id);

      if (checkBooking.length > 0) {
        return this.updateBooking(checkBooking[0].id, {
          ...checkBooking[0],
          peopleCount: data.peopleCount,
          checkIn: data.startTime,
          checkOut: data.endTime,
          roundedStartTime: data.roundedStartTime,
          roundedEndTime: data.roundedEndTime,
          day: data.day,
          room: data.room,
        });
      }

      return this.createBooking({
        peopleCount: data.peopleCount,
        checkIn: data.startTime,
        checkOut: data.endTime,
        roundedStartTime: data.roundedStartTime,
        roundedEndTime: data.roundedEndTime,
        day: data.day,
        room: data.room,
        user: {
          connect: {
            id: user.id,
          },
        },
        tenant: {
          connect: {
            id: data.tenantId,
          },
        },
      });
    } catch (error) {
      console.error('Error saving booking:', error);
      throw error;
    }
  }
}
