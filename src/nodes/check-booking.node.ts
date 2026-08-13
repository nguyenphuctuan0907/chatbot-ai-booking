// src/nodes/check-booking.node.ts
import {
  KaraokeSessionState,
  NodeResult,
  SessionStatus,
  SubSessionStatus,
} from 'src/queue/message/message.interfaces';
import { PrismaService } from 'prisma/prisma.service';
import { BookingQueue } from 'src/queue/booking/booking.queue';
import { parseBookingTime } from 'src/common';
import { checkAndBook } from 'src/booking/common';

// Map số người → danh sách phòng có thể đặt
const MAP_ROOM_COUNT: Record<number, number[]> = {
  12: [4],
  // 3: [1, 2, 3],  // mở rộng sau
};

function getRoomsForPeople(people: number): number[] {
  const rooms: number[] = [];
  for (const [capacity, roomIds] of Object.entries(MAP_ROOM_COUNT)) {
    if (Number(capacity) >= people) {
      rooms.push(...roomIds);
    }
  }
  return rooms;
}

/**
 * NODE 4: check_booking
 * Input:  session (missingFields === [] → đủ info để check)
 * Output: { status, subStatus, suggestedSlots }
 */
export async function checkBookingNode(
  session: KaraokeSessionState,
  prisma: PrismaService,
  bookingQueue: BookingQueue,
): Promise<NodeResult> {
  // Nếu còn thiếu field → chưa check được
  if (session.missingFields.length > 0) {
    return {
      status: 'COLLECTING_INFO',
      subStatus: 'ASKING_MISSING',
    };
  }

  const entity = session.bookingData;
  if (!entity.checkIn) {
    return { status: 'COLLECTING_INFO', subStatus: 'ASKING_MISSING' };
  }

  // Parse thời gian
  const parsedResult = parseBookingTime(
    entity.checkIn,
    entity.duration ?? undefined,
  );
  if (!parsedResult.time || !parsedResult.endTime) {
    return { status: 'COLLECTING_INFO', subStatus: 'ASKING_MISSING' };
  }

  // Lấy booking trong ngày (trừ booking của chính user này)
  const existingUser = await prisma.user.findUnique({
    where: { platformId: session.sessionId },
  });

  const bookings = await prisma.booking.findMany({
    where: {
      day: parsedResult.date,
      NOT: { userId: existingUser?.id },
    },
  });

  // Group by room
  const bookingsByRoom = Object.values(
    bookings.reduce(
      (acc, b) => {
        if (!acc[b.room]) acc[b.room] = { room: b.room, orders: [] };
        acc[b.room].orders.push({ startTime: b.checkIn, endTime: b.checkOut });
        return acc;
      },
      {} as Record<number, any>,
    ),
  );

  const roomCanBook = getRoomsForPeople(entity.people ?? 0);

  const check = checkAndBook(
    bookingsByRoom,
    parsedResult.time,
    parsedResult.endTime,
    parsedResult.date,
    roomCanBook,
  );

  if (check.success) {
    // Đủ điều kiện → đẩy job booking
    const user = await prisma.user.upsert({
      where: { platformId: session.sessionId },
      update: {
        username: entity.name ?? undefined,
        phone: entity.phone ?? undefined,
      },
      create: {
        platformId: session.sessionId,
        username: entity.name ?? undefined,
        phone: entity.phone ?? undefined,
      },
    });

    await bookingQueue.addCreateBookingJob({
      userId: user.id,
      peopleCount: entity.people!,
      startTime: parsedResult.time,
      endTime: parsedResult.endTime,
      roundedStartTime: parsedResult.roundedTime,
      roundedEndTime: parsedResult.roundedEndTime,
      name: entity.name!,
      phone: entity.phone!,
      day: parsedResult.date,
      room: check.roomId!,
      tenantId: session.tenantId,
    });

    return { status: 'COMPLETED', subStatus: null };
  }

  // Hết phòng
  if (!check.nearestAvailable?.length) {
    return { status: 'COLLECTING_INFO', subStatus: 'FULL_BOOKED' };
  }

  // Còn slot khác → gợi ý
  return {
    status: 'COLLECTING_INFO',
    subStatus: 'AWAITING_CONFIRM_SUGGESTED_SLOT',
    suggestedSlots: check.nearestAvailable.map((s) => s.startTime),
  };
}
