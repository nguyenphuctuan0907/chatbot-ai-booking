import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Ho_Chi_Minh';

type TimeIntent = {
    hour?: number;
    minute?: number;
    dayOffset?: number;
    date?: number;
    month?: number;
    year?: number;
    dayOfWeek?: number;
    nextWeek?: boolean;
    isWeekendTarget?: boolean;
    period?: "morning" | "afternoon" | "evening";
    absoluteTime?: dayjs.Dayjs;
};

const DAY_MAP: Record<string, number> = {
    "chu nhat": 0, "cn": 0,
    "thu 2": 1, "thu hai": 1, "th2": 1, "th 2": 1,
    "thu 3": 2, "thu ba": 2, "th3": 2, "th 3": 2,
    "thu 4": 3, "thu tu": 3, "th4": 3, "th 4": 3,
    "thu 5": 4, "thu nam": 4, "th5": 4, "th 5": 4,
    "thu 6": 5, "thu sau": 5, "th6": 5, "th 6": 5,
    "thu 7": 6, "thu bay": 6, "th7": 6, "th 7": 6
};

function extractIntent(text: string, now: dayjs.Dayjs): TimeIntent {
    let t = text
        .toLowerCase()
        .replace(/giowf/g, "h")
        .replace(/giờ/g, "h")
        .replace(/thuws/g, "thu")
        .replace(/tieengs/g, "tieng")
        .replace(/phuts/g, "phut")
        .replace(/toois/g, "toi")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/(?:h|g)?\s*(ruoi|r|ruoiwx|ruoiw|ruowi|ruow)/g, "h30")
        .replace(/\s+/g, " ")
        .trim();

    const intent: TimeIntent = {};

    // 0. Cụm "nữa"
    const relativeFutureMatch = t.match(/(\d+)\s*(phut|tieng|h)\s*nua/);
    if (relativeFutureMatch) {
        const amount = parseInt(relativeFutureMatch[1]!);
        const unit = relativeFutureMatch[2];
        let targetTime = now;
        if (unit === "phut") targetTime = targetTime.add(amount, "minute");
        else targetTime = targetTime.add(amount, "hour");
        intent.absoluteTime = targetTime;
        intent.hour = targetTime.hour();
        intent.minute = targetTime.minute();
        t = t.split(relativeFutureMatch[0]).join(" ");
    }

    // 1. Cụm "kém"
    const kemMatch = t.match(/(\d{1,2})\s*(?:h|g)?\s*kem\s*(\d{1,2})/);
    if (kemMatch) {
        let h = parseInt(kemMatch[1]!);
        let m = parseInt(kemMatch[2]!);
        intent.hour = h - 1;
        if (intent.hour === 0) intent.hour = 12; 
        if (intent.hour < 0) intent.hour = 23;
        intent.minute = 60 - m;
        t = t.split(kemMatch[0]).join(" ");
    }

    // Ngày tháng cụ thể
    const dateMatchFull = t.match(/(?:(?:ngay|mung)\s+)?(\d{1,2})\s*(?:[\/\-\.]|\s+thang\s+)\s*(\d{1,2})(?:\s*(?:[\/\-\.]|\s+nam\s+)\s*(\d{4}))?/);
    if (dateMatchFull) {
        intent.date = parseInt(dateMatchFull[1]!);
        intent.month = parseInt(dateMatchFull[2]!);
        if (dateMatchFull[3]) intent.year = parseInt(dateMatchFull[3]!);
        t = t.split(dateMatchFull[0]).join(" "); 
    } else {
        const dayMatch = t.match(/(?:ngay|mung)\s+(\d{1,2})/);
        if (dayMatch) {
            intent.date = parseInt(dayMatch[1]!);
            t = t.split(dayMatch[0]).join(" ");
        }
    }

    // 2. Giờ phút (Fix: Chấp nhận bắt số trơn nều nằm giữa biên từ, VD: "trưa 10")
    if (intent.hour === undefined && !intent.absoluteTime) {
        const timeMatch = t.match(/\b(\d{1,2})\s*(h|g|:|)\s*(\d{1,2})?\b/);
        if (timeMatch && timeMatch[1]) {
            const val = parseInt(timeMatch[1]);
            const suffix = timeMatch[2];
            if (suffix || (val > 0 && val <= 24)) {
                intent.hour = val;
                intent.minute = timeMatch[3] ? parseInt(timeMatch[3]) : 0;
                t = t.split(timeMatch[0]).join(" ");
            }
        }
    }

    // 4. Các Keywords 
    if (t.includes("tuan sau")) intent.nextWeek = true;
    if (t.includes("cuoi tuan")) intent.isWeekendTarget = true;

    // Fix: Dùng regex boundary chặn bắt nhầm ngày trong tuần
    for (const [key, val] of Object.entries(DAY_MAP)) {
        const regex = new RegExp(`\\b${key}\\b`);
        if (regex.test(t)) {
            intent.dayOfWeek = val;
            break;
        }
    }

    // Fix: Dùng regex boundary
    if (/\bmai\b/.test(t)) intent.dayOffset = 1;
    if (/\b(mot|kia)\b/.test(t)) intent.dayOffset = 2;

    if (/\bsang\b/.test(t)) intent.period = "morning";
    if (/\btrua\b/.test(t)) {
        intent.period = "morning";
        // Fix: Trưa không có số thì auto 12:00
        if (intent.hour === undefined) {
            intent.hour = 12;
            intent.minute = 0;
        }
    }
    if (/\bchieu\b/.test(t)) intent.period = "afternoon";
    if (/\btoi\b/.test(t)) intent.period = "evening";

    return intent;
}

function resolveDate(intent: TimeIntent, businessNow: dayjs.Dayjs) {
    if (intent.date) {
        let targetMonth = intent.month ? intent.month - 1 : businessNow.month();
        let targetYear = intent.year ? intent.year : businessNow.year();
        let d = businessNow.year(targetYear).month(targetMonth).date(intent.date);

        if (!intent.year && d.isBefore(businessNow, "day")) {
            if (intent.month) d = d.add(1, "year");
            else d = d.add(1, "month");
        }
        return d;
    }

    if (intent.isWeekendTarget) {
        let currentDayOfWeek = businessNow.day();
        let daysToAdd = currentDayOfWeek === 0 ? 0 : 6 - currentDayOfWeek;
        if (intent.nextWeek) daysToAdd += 7;
        return businessNow.add(daysToAdd, "day");
    }

    if (intent.dayOfWeek !== undefined) {
        // Việt hóa: Đổi Chủ nhật (0) thành ngày số 7 trong tuần
        let currentDayOfWeek = businessNow.day() === 0 ? 7 : businessNow.day();
        let targetDayOfWeek = intent.dayOfWeek === 0 ? 7 : intent.dayOfWeek;

        let daysToAdd = targetDayOfWeek - currentDayOfWeek;

        // Nếu thứ đó đã qua rồi -> Mặc định là của tuần sau (+7 ngày)
        if (daysToAdd <= 0) {
            daysToAdd += 7;
        }

        // Nếu khách gõ chữ "tuần sau"
        if (intent.nextWeek) {
            // Chỉ cộng thêm 7 NẾU thứ đó vẫn chưa diễn ra trong tuần này.
            // (Ví dụ: Thứ 6 đặt Chủ Nhật (7 > 5) -> Cộng thêm 7.
            // Nhưng Thứ 6 đặt Thứ 2 tuần sau (1 > 5 = false) -> daysToAdd ở trên đã tự thành 3 ngày rồi, không cộng 7 nữa để tránh nhảy sang 10 ngày).
            if (targetDayOfWeek > currentDayOfWeek) {
                daysToAdd += 7;
            }
        }

        return businessNow.add(daysToAdd, "day");
    }

    if (intent.dayOffset) {
        return businessNow.add(intent.dayOffset, "day");
    }

    return businessNow;
}

function resolveTime(
    intent: TimeIntent,
    baseBusinessDate: dayjs.Dayjs,
    now: dayjs.Dayjs
) {
    if (intent.absoluteTime) return intent.absoluteTime;
    if (intent.hour === undefined) return null;

    let hour = intent.hour;
    let minute = intent.minute ?? 0;

    if (hour === 24) hour = 0;
    
    if (hour === 12) {
        if (intent.period === "evening") {
            hour = 0; 
        } else if (intent.period === "morning") {
            hour = 12; 
        } else {
            hour = now.hour() >= 12 ? 0 : 12;
        }
    }

    if (intent.period === "afternoon" || intent.period === "evening") {
        if (hour < 12) hour += 12;
    }

    if (!intent.period && hour >= 1 && hour <= 6) {
        let pmHour = hour + 12;
        // Chỉ tự động chuyển sang giờ chiều nếu thời điểm hiện tại CHƯA VƯỢT QUÁ giờ chiều đó.
        // VD: 12h trưa khách đặt "3h" -> hiểu là 15h.
        // NHƯNG 17h chiều khách đặt "3h" -> hiểu là 3h sáng đêm nay (vì 15h đã qua rồi).
        if (now.hour() >= 6 && now.hour() <= pmHour) {
            hour = pmHour;
        }
    }

    let result = baseBusinessDate;
    
    if (hour < 6) {
        result = result.add(1, "day");
    }
    result = result.hour(hour).minute(minute).second(0).millisecond(0);

    // ===== LUẬT NIGHTLIFE (7h - 11h) =====
    if (!intent.period && hour >= 7 && hour <= 11) {
        if (now.hour() >= 0 && now.hour() < 6) {
            result = result.year(now.year()).month(now.month()).date(now.date());
        } 
        else {
            // Nếu bản AM (sáng) đã trôi qua ở hiện tại
            if (result.isBefore(now) || result.isSame(now)) {
                let pmTime = result.add(12, "hour");
                
                // Kiểm tra xem bản PM (tối) đã diễn ra chưa?
                // Nếu chưa (pmTime nằm ở tương lai) -> Khách đang muốn đặt tối nay!
                if (!pmTime.isBefore(now)) {
                    result = pmTime;
                }
            }
        }
    }

    const hasExplicitDate = intent.dayOffset !== undefined || intent.date !== undefined || intent.dayOfWeek !== undefined || intent.isWeekendTarget !== undefined;

    if (!hasExplicitDate) {
        if (result.isBefore(now) || result.isSame(now)) {
            result = result.add(1, "day");
        }
    }

    return result; 
}

export function parseBookingTime(text: string, duration: number = 1) {
    const now = dayjs().tz(TZ);
    const intent = extractIntent(text, now.clone());

    const businessNow = now.hour() < 6 ? now.clone().subtract(1, 'day') : now.clone();
    const baseBusinessDate = resolveDate(intent, businessNow.clone());
    const finalCalendarTime = resolveTime(intent, baseBusinessDate.clone(), now.clone());

    // Xử lý trường hợp không có giờ
    if (!finalCalendarTime) {
        return {
            date: baseBusinessDate.format("DD/MM/YYYY"),
            time: null,
            roundedTime: null, // Thêm dòng này
            endDate: baseBusinessDate.format("DD/MM/YYYY"),
            endTime: null,
            roundedEndTime: null, // Thêm dòng này
            isWeekend: [0, 5, 6].includes(baseBusinessDate.day()),
            debug: intent
        };
    }

    // ===== HÀM HELPER: LÀM TRÒN 30 PHÚT =====
    const roundToNearest30 = (timeObj: dayjs.Dayjs) => {
        const m = timeObj.minute();
        if (m < 15) {
            return timeObj.clone().minute(0).second(0).millisecond(0);
        } else if (m < 45) {
            return timeObj.clone().minute(30).second(0).millisecond(0);
        } else {
            return timeObj.clone().add(1, 'hour').minute(0).second(0).millisecond(0);
        }
    };

    // TÍNH TOÁN GIỜ BẮT ĐẦU
    let finalBusinessDate = finalCalendarTime.clone();
    if (finalCalendarTime.hour() < 6) {
        finalBusinessDate = finalCalendarTime.subtract(1, "day");
    }
    const roundedStart = roundToNearest30(finalCalendarTime);

    // TÍNH TOÁN GIỜ KẾT THÚC (+duration h)
    const endCalendarTime = finalCalendarTime.add(duration * 60, "minute");
    let endBusinessDate = endCalendarTime.clone();
    if (endCalendarTime.hour() < 6) {
        endBusinessDate = endCalendarTime.subtract(1, "day");
    }
    const roundedEnd = roundToNearest30(endCalendarTime);

    return {
        date: finalBusinessDate.format("DD/MM/YYYY"),
        time: finalCalendarTime.format("HH:mm"),
        roundedTime: roundedStart.format("HH:mm"),       // Trả về Giờ bắt đầu đã làm tròn

        endDate: endBusinessDate.format("DD/MM/YYYY"),
        endTime: endCalendarTime.format("HH:mm"),
        roundedEndTime: roundedEnd.format("HH:mm"),      // Trả về Giờ kết thúc đã làm tròn

        isWeekend: [0, 5, 6].includes(finalBusinessDate.day()),
        debug: intent
    };
}