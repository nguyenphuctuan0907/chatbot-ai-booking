import dayjs from "dayjs"
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from "dayjs/plugin/customParseFormat"

dayjs.extend(customParseFormat)
dayjs.extend(utc);
dayjs.extend(timezone);
// Thiết lập múi giờ mặc định (Asia/Ho_Chi_Minh ~ GMT+7)
dayjs.tz.setDefault("Asia/Ho_Chi_Minh");

interface Order {
    startTime: string
    endTime: string
}

interface RoomBooking {
    room: number
    orders: Order[]
}

interface BookingResult {
    success: boolean
    roomId?: number
    message: string
    nearestAvailable?: NearestAvailable[]
}

interface NearestAvailable {
    roomId: number
    startTime: string // ISO string
    endTime: string   // ISO string
    day: string       // "DD/MM/YYYY"
    _ts: number       // timestamp để sort
}


// ───────────────────────────── Main ─────────────────────────────

const NIGHT_CUTOFF = 6 // 6h sáng

function normalizeToBusinessDay(baseDay: string, time: string): dayjs.Dayjs {
    let dt = dayjs(`${baseDay} ${time}`, "DD/MM/YYYY HH:mm")

    if (dt.hour() < NIGHT_CUTOFF) {
        dt = dt.add(1, "day")
    }

    return dt
}

function parseDateTime(day: string, time: string): dayjs.Dayjs {
    // day: DD/MM/YYYY
    // time: HH:mm
    return dayjs(`${day} ${time}`, "DD/MM/YYYY HH:mm")
}

function checkAndBook(
    existingBookings: RoomBooking[],
    requestedStart: string, // "HH:mm"
    requestedEnd: string,   // "HH:mm"
    day: string,            // "DD/MM/YYYY"
    roomIds: number[]
): BookingResult {

    const reqStart = normalizeToBusinessDay(day, requestedStart)
    let reqEnd = normalizeToBusinessDay(day, requestedEnd)

    // xử lý qua đêm (vd 23:00 → 02:00)
    if (reqEnd.isBefore(reqStart)) {
        reqEnd = reqEnd.add(1, "day")
    }

    const duration = reqEnd.diff(reqStart, "minute")

    const targetRooms = existingBookings.map(room => ({
        ...room,
        orders: room.orders.map(order => {
            let start = normalizeToBusinessDay(day, order.startTime)
            let end = normalizeToBusinessDay(day, order.endTime)

            if (end.isBefore(start)) {
                end = end.add(1, "day")
            }

            return {
                startTime: start.toISOString(),
                endTime: end.toISOString()
            }
        })
    })).filter((r) => roomIds.includes(r.room))

    const bookedRoomIds = targetRooms.map((r) => r.room)
    const emptyRoomIds = roomIds.filter((id) => !bookedRoomIds.includes(id))

    // check phòng có slot
    for (const roomBooking of targetRooms) {
        if (isRoomAvailable(roomBooking.orders, reqStart, reqEnd)) {
            return {
                success: true,
                roomId: roomBooking.room,
                message: `Đặt phòng thành công! Phòng ${roomBooking.room} từ ${reqStart.format("HH:mm DD/MM/YYYY")} đến ${reqEnd.format("HH:mm DD/MM/YYYY")}`,
            }
        }
    }

    // phòng chưa có booking
    if (emptyRoomIds.length > 0) {
        return {
            success: true,
            roomId: emptyRoomIds[0],
            message: `Đặt phòng thành công! Phòng ${emptyRoomIds[0]} từ ${reqStart.format("HH:mm DD/MM/YYYY")} đến ${reqEnd.format("HH:mm DD/MM/YYYY")}`,
        }
    }

    // tìm nearest
    const nearestAvailable = targetRooms
        .map((roomBooking) => findNearestAvailable(roomBooking, reqStart, duration))
        .filter((result): result is NearestAvailable => result !== null)
        .sort((a, b) => a._ts - b._ts)

    return {
        success: false,
        message: "Không còn phòng trống trong khung giờ này.",
        nearestAvailable,
    }
}

// ───────────────────────────── Availability Check ─────────────────────────────

function isRoomAvailable(
    orders: Order[],
    newStart: dayjs.Dayjs,
    newEnd: dayjs.Dayjs
): boolean {
    return orders.every((order) => {
        const existStart = dayjs(order.startTime)
        const existEnd = dayjs(order.endTime)

        // Không conflict khi: newEnd <= existStart || newStart >= existEnd
        return newEnd.isBefore(existStart) || newEnd.isSame(existStart)
            || newStart.isAfter(existEnd) || newStart.isSame(existEnd)
    })
}

// ───────────────────────────── Find Nearest ─────────────────────────────

function findNearestAvailable(
    roomBooking: RoomBooking,
    requestedStart: dayjs.Dayjs,
    duration: number
): NearestAvailable | null {

    const candidates: dayjs.Dayjs[] = [
        requestedStart,
        ...roomBooking.orders.map((o) => snapToSlot(dayjs(o.endTime))),
    ]

    const sortedCandidates = candidates
        .filter((c) => !c.isBefore(requestedStart))
        .sort((a, b) => a.diff(b))

    for (const candidateStart of sortedCandidates) {
        const candidateEnd = candidateStart.add(duration, "minute")

        if (isRoomAvailable(roomBooking.orders, candidateStart, candidateEnd)) {
            return {
                roomId: roomBooking.room,
                startTime: candidateStart.format("HH:mm"),
                endTime: candidateEnd.format("HH:mm"),
                day: candidateStart.format("DD/MM/YYYY"),
                _ts: candidateStart.valueOf()
            }
        }
    }

    return null
}

// ───────────────────────────── Helpers ─────────────────────────────

// Làm tròn lên slot 30 phút gần nhất
function snapToSlot(d: dayjs.Dayjs): dayjs.Dayjs {
    const minutes = d.minute()

    if (minutes === 0 || minutes === 30) return d.second(0).millisecond(0)
    if (minutes < 30) return d.minute(30).second(0).millisecond(0)
    return d.add(1, "hour").minute(0).second(0).millisecond(0)
}

export { checkAndBook }