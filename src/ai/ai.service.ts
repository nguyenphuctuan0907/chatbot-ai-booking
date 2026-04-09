import { Injectable } from "@nestjs/common";

export type ParsedIntent = {
    intent: string;
    entity: {
        name: string | null;
        phone: string | null;
        people: number | null;
        time: string | null;
        birthday: string | null;
        day?: string | null;
        startTime?: string | null;
        outTime?: string | null;
        duration?: number | null;
    },
    action: "CONFIRM" | "REJECT" | "PROVIDE_INFO" | null
};

@Injectable()
export class AIService {
    private PRIMARY_MODEL = "gpt-4o-mini";
    private FALLBACK_MODEL = "gpt-4.1-mini";
    private TIMEOUT = 10000;
    private MAX_RETRY = 2;

    async parse(messages: any[]): Promise<ParsedIntent> {
        const prompt = this.buildPrompt(messages);

        try {
            return await this.callModel(this.PRIMARY_MODEL, prompt, messages);
        } catch (err) {
            console.warn("Primary model failed → fallback:", err.message);

            return await this.callModel(this.FALLBACK_MODEL, prompt, messages);
        }
    }

    private async callModel(model: string, prompt: string, messages: any[], retry = 0): Promise<ParsedIntent> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.TIMEOUT);

        try {
            const res = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                signal: controller.signal,
                headers: {
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: model,
                    // Cấu trúc chuẩn của OpenAI là mảng messages
                    messages: [
                        { role: "user", content: prompt }
                    ],
                    temperature: 0,
                    max_tokens: 300, // Đổi từ max_output_tokens sang max_tokens
                    response_format: { type: "json_object" } // 🔥 Ép OpenAI chỉ trả về JSON
                }),
            });

            if (!res.ok) {
                // Log thêm chi tiết lỗi từ OpenAI để dễ debug
                const errorData = await res.json().catch(() => ({}));
                throw new Error(`OpenAI HTTP ${res.status}: ${JSON.stringify(errorData)}`);
            }

            const data = await res.json();

            // Lấy kết quả text từ đường dẫn chuẩn của Chat Completions API
            const text = data?.choices?.[0]?.message?.content;

            if (!text) throw new Error("Empty AI response");

            // Text lúc này chắc chắn là JSON hợp lệ nhờ JSON Mode
            // Vẫn gọi safeJSONParse để map dữ liệu phòng trường hợp AI trả thiếu key
            return this.safeJSONParse(text, messages);

        } catch (err: any) {
            if (retry < this.MAX_RETRY) {
                console.warn(`Retry AI call (${retry + 1}) - Error: ${err.message}`);
                return this.callModel(model, prompt, messages, retry + 1);
            }

            throw err;
        } finally {
            clearTimeout(timeout);
        }
    }

    normalizeText(text: string): string {
        if (!text) return '';
        return text
            .normalize('NFD') // Chuyển sang dạng phân tổ hợp (tách dấu ra khỏi chữ)
            .replace(/[\u0300-\u036f]/g, '') // Loại bỏ các ký tự dấu
            .replace(/đ/g, 'd').replace(/Đ/g, 'D') // Xử lý riêng chữ đ/Đ
            .toLowerCase() // Đưa về chữ thường
            .replace(/[^a-z0-9\s]/g, ' ') // Xóa ký tự đặc biệt, chỉ giữ a-z, số và khoảng trắng
            .replace(/\s+/g, ' ') // Gộp khoảng trắng thừa
            .trim();
    }

    private safeJSONParse(text: string, messages: any[]): ParsedIntent {

        try {
            const confirmRegex = /\b(ok[ei]?|uh?|u|da|vang|co|chot|tien hanh|dong y|duyet|duoc|y[eu]p|yes|xac nhan)\b/i;
            const rejectRegex = /\b(khong|k[ho]?|thoi|huy|bo|ngung|cancel|no|nope|dung)\b/i;
            const lastUserMessage = [...messages].reverse().find(m => m.role === "user")?.content || "";

            const cleanText = this.normalizeText(lastUserMessage);
            const obj = JSON.parse(text);

            console.log("AI raw response obj:", obj);

            let action = obj.action

            if (rejectRegex.test(cleanText)) {
                action = 'REJECT';
            }

            if (confirmRegex.test(cleanText)) {
                action = 'CONFIRM';
            }


            return {
                intent: obj.intent ?? "other",
                entity: {
                    name: obj.entity.name ?? null,
                    phone: obj.entity.phone ?? null,
                    people: obj.entity.people ?? null,
                    time: obj.entity.check_in ?? null,
                    birthday: obj.entity.birthday ?? null,
                    day: obj.entity.day ?? null,
                    startTime: obj.entity.check_in ?? null,
                    outTime: obj.entity.check_out ?? null,
                    duration: obj.entity.duration ?? null,
                },
                action: obj.action ?? null
            };
        } catch (e) {
            console.error("JSON parse fail:", text);

            return {
                intent: "other",
                entity: {
                    name: null,
                    phone: null,
                    people: null,
                    time: null,
                    birthday: null,
                    day: null,
                    startTime: null,
                    outTime: null,
                    duration: null,
                },
                action: null
            };
        }
    }

    private buildPrompt(messages: any[]) {
        const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || "";
        return `Bạn là AI phân tích hội thoại đặt phòng karaoke. Nhiệm vụ: Trích xuất thông tin thành một object JSON duy nhất. KHÔNG giải thích.
🔥 QUY TẮC TỐI THƯỢNG: 
- Luôn dựa vào Ý ĐỊNH CUỐI CÙNG của người dùng. 
- BỎ QUA các mốc thời gian khách đã đổi ý trong quá khứ. Thông tin mới nhất PHẢI ghi đè thông tin cũ.
- Câu nói chốt cuối cùng của khách là: "${lastUserMessage}" -> Phải ưu tiên trích xuất check_in, check_out, duration từ câu này nếu có!

SCHEMA & RULES:
{
  "intent": "1 trong các giá trị: booking, check_availability, ask_price, ask_opening_time, ask_location, ask_services_genneral, ask_services_other, promotion, ask_menu, live_support, check_my_booking, cancel_booking, greeting, thank_you, other. (Luật ưu tiên nếu có nhiều ý: booking > check_availability > ask_price)",
  "entity": {
    "name": "Tên khách hàng (string | null)",
    "phone": "Số điện thoại, giữ nguyên chuỗi số (string | null)",
    "people": "Số người đi hát (number | null)",
    "check_in": "Giờ bắt đầu/giờ vào. GIỮ NGUYÊN cụm từ user nói (VD: '8h tối nay', 'bây giờ', 'mai 8h', 'hôm nay'). Nếu không đề cập trả null (string | null)",
    "check_out": "Mốc giờ kết thúc/giờ ra cụ thể. GIỮ NGUYÊN cụm từ user nói (VD: 'đến 23h', '11h đêm nghỉ'). ĐỂ NULL nếu khách nói khoảng thời lượng (VD: 'hát 2 tiếng'). (string | null)",
    "duration": "Thời lượng hát tính theo GIỜ (number | null). VD: 'hát 2 tiếng' -> 2, 'hát 1 tiếng rưỡi' -> 1.5, '30 phút' -> 0.5. ĐỂ NULL nếu khách chỉ nói mốc giờ ra.",
    "birthday": "Ngày sinh. Chuyển sang format '____-MM-DD' (VD: '12/05' -> '____-05-12'). (string | null)"
  },
  "action": "CONFIRM (đồng ý), REJECT (từ chối), hoặc PROVIDE_INFO (khi user cung cấp thông tin: time, name, phone, people, birthday). Luật ưu tiên: PROVIDE_INFO > CONFIRM > REJECT. (string | null)"
}

HỘI THOẠI:
${messages.map(m => `${m.role}: ${m.content}`).join("\n")}

JSON:`;
    }

    //     private buildPrompt(messages: any[]) {
    //         return `
    // Bạn là hệ thống NLP dùng để phân tích hội thoại đặt phòng karaoke.

    // NHIỆM VỤ:
    // Phân tích toàn bộ hội thoại và trích xuất DUY NHẤT một JSON hợp lệ theo schema bên dưới.

    // CHỈ TRẢ VỀ JSON. KHÔNG giải thích. KHÔNG được tự suy luận dữ liệu, KHÔNG được thay đổi định dạng dữ liệu.

    // ======================
    // SCHEMA
    // {
    //     "intent": "booking" | "check_availability" | "ask_price" | "ask_opening_time" | "ask_location" | "ask_services_genneral" | "ask_services_other" | "promotion" | "ask_menu" | "live_support" | "check_my_booking" | "rebook_previous" | "change_booking_time" | "cancel_booking" | "update_booking_info" | "greeting" | "thank_you" | "other",
    //     "entity": {
    //         "name": string | null,
    //         "phone": string | null,
    //         "people": number | null,
    //         "time": string | null (raw text thời gian người dùng nói, giữ nguyên từ trong câu),
    //         "birthday": string | null,
    //     },
    //     "action": "CONFIRM" | "REJECT" | "PROVIDE_INFO" | null
    // }

    // ======================
    // GIẢI THÍCH ENTITY

    // name
    // → tên khách hàng

    // phone
    // → số điện thoại (chuỗi số, không format)

    // people
    // → số người đi hát

    // time
    // → giờ đến (raw text thời gian người dùng nói, giữ nguyên từ trong câu)

    // birthday
    // → ngày sinh nếu khách nói sinh nhật

    // ========================
    // Xác định action:
    // → CONFIRM: nếu người dùng đồng ý (ok, được, có, xác nhận, đồng ý...)
    // → REJECT: nếu người dùng từ chối (không, thôi, không đặt...)
    // → PROVIDE_INFO: nếu người dùng cung cấp thông tin (giờ, số người, tên...)
    // Nếu người dùng cung cấp bất kỳ thông tin mới nào (time, name, phone, people, birthday) so với thông tin trước đó trong hội thoại
    // → action = PROVIDE_INFO

    // QUAN TRỌNG:
    // PROVIDE_INFO có độ ưu tiên cao hơn CONFIRM và REJECT

    // ======================
    // QUY TẮC PHÂN LOẠI INTENT

    // Chỉ chọn 1 intent duy nhất.

    // greeting
    // → chào hỏi (chào, hi, alo)

    // booking
    // → người dùng xác nhận đặt phòng

    // check_availability
    // → hỏi còn phòng không

    // ask_price
    // → hỏi giá

    // ask_opening_time
    // → hỏi giờ mở cửa

    // ask_location
    // → hỏi địa chỉ

    // ask_services_genneral
    // → hỏi cơ sở vật chất (loa, mic, phòng vip, máy lạnh...)

    // ask_services_other
    // → hỏi dịch vụ khác (PS5, Netflix, boardgame...)

    // promotion
    // → hỏi khuyến mãi

    // ask_menu
    // → hỏi đồ ăn / nước

    // live_support
    // → muốn gặp nhân viên thật

    // check_my_booking
    // → kiểm tra booking

    // rebook_previous
    // → đặt lại như lần trước

    // change_booking_time
    // → đổi giờ đặt

    // cancel_booking
    // → hủy phòng

    // update_booking_info
    // → cập nhật tên / số điện thoại / số người

    // thank_you
    // → cảm ơn

    // other
    // → không thuộc các loại trên

    // ======================
    // LUẬT ƯU TIÊN INTENT

    // Nếu câu chứa nhiều ý định:

    // booking
    // > check_availability
    // > ask_price

    // Ví dụ:
    // "8h còn phòng không giá bao nhiêu"

    // → intent = check_availability

    // ======================
    // QUY TẮC ĐẶC BIỆT:

    // - Nếu câu chứa thời gian mới:
    //   Ví dụ:
    //     "không, cho tôi 22h"
    //     "không 21h, 22h đi"
    //   → action = PROVIDE_INFO
    //   → time = thời gian mới

    // ======================
    // QUY TẮC TRÍCH XUẤT

    // 1. Nếu thấy số người:
    //    "2 người" → people = 2

    // 2. Nếu thấy số điện thoại
    // → giữ nguyên chuỗi số

    // 3. Nếu thấy sinh nhật:

    // "12/05"

    // → birthday = "____-05-12"

    // 4. Nếu không có dữ liệu
    // → trả null

    // 5. Nếu hội thoại có nhiều tin nhắn
    // → dùng Ý ĐỊNH CUỐI CÙNG của người dùng

    // 6. Trường "time" phải giữ NGUYÊN CỤM TỪ THỜI GIAN người dùng nói, nếu có nhiều cụm thời gian → chọn cụm liên quan tới việc đặt phòng

    // KHÔNG được:
    // - chuyển sang ISO time
    // - tính giờ
    // - thêm từ
    // - sửa câu

    // Ví dụ:
    // User: hôm nay
    // → "time": "hôm nay"

    // User: mai 8h
    // → "time": "mai 8h"

    // User: 8h tối mai
    // → "time": "8h tối mai"

    // User: thứ 7 lúc 7h
    // → "time": "thứ 7 lúc 7h"
    // Nếu không có cụm thời gian → null.
    // ======================

    // ======================
    // HỘI THOẠI

    // ${messages.map(m => `${m.role}: ${m.content}`).join("\n")}

    // ======================

    // Trả về JSON:
    // `;
    //     }

}

