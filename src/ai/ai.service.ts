import { Injectable } from '@nestjs/common';
import {
  BookingData,
  PrimaryFlow,
  SessionStatus,
  SubSessionStatus,
} from 'src/queue/interfaces';

export interface AIContext {
  tenantName: string;
  status: SessionStatus;
  subStatus: SubSessionStatus;
  primaryFlow: PrimaryFlow; // "booking" | "price" | ...
  lastAskedFields?: string[]; // Những trường vừa hỏi khách (VD: ['phone', 'checkIn'])
  lastIntent: string | null; // Ý định của tin nhắn trước đó (VD: "ask_price", "check_availability")
  bookingData: BookingData;
  suggestedSlots: string[];
}

export interface AIParseResult {
  intent: string;

  updates: Partial<BookingData>;

  confidence: number;
}

function normalizeMessage(message: string): string {
  return message
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,!?]/g, '');
}

const CONFIRM_KEYWORDS = [
  'ok',
  'oke',
  'ok luôn',
  'được',
  'đc',
  'dc',
  'có',
  'ừ',
  'ừm',
  'uh',
  'ừ ok',
  'vâng',
  'vg',
  'dạ',
  'yes',
  'chốt',
  'triển',
  'đặt đi',
  'đặt luôn',
  'ok đặt',
  'ok đặt đi',
];

function isUserConfirm(message: string): boolean {
  const msg = normalizeMessage(message);

  return CONFIRM_KEYWORDS.some((k) => msg === k || msg.includes(k));
}

const REJECT_KEYWORDS = [
  'không',
  'ko',
  'không nhé',
  'ko nhé',
  'không được',
  'để xem lại',
  'thôi',
  'không đặt nữa',
];

function isUserReject(message: string): boolean {
  const msg = normalizeMessage(message);

  return REJECT_KEYWORDS.some((k) => msg.includes(k));
}

@Injectable()
export class AIService {
  private PRIMARY_MODEL = 'gpt-4o-mini';
  private FALLBACK_MODEL = 'gpt-3.5-turbo';
  private TIMEOUT = 10000;
  private MAX_RETRY = 2;

  async parse(context: AIContext, message: string): Promise<AIParseResult> {
    // Tách riêng System Prompt (Luật) và User Message (Câu chat)
    const systemPrompt = this.buildSystemPrompt(context);

    try {
      return await this.callModel(
        this.PRIMARY_MODEL,
        systemPrompt,
        message,
        context,
      );
    } catch (err: any) {
      console.warn('Primary model failed → fallback:', err?.message);
      return await this.callModel(
        this.FALLBACK_MODEL,
        systemPrompt,
        message,
        context,
      );
    }
  }

  private async callModel(
    model: string,
    systemPrompt: string,
    message: string,
    context: AIContext,
    retry = 0,
  ): Promise<AIParseResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.TIMEOUT);

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          // 🔥 THAY ĐỔI QUAN TRỌNG: Tách biệt rõ ràng System và User
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
          ],
          temperature: 0,
          max_tokens: 300,
          response_format: { type: 'json_object' },
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          `OpenAI HTTP ${res.status}: ${JSON.stringify(errorData)}`,
        );
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;

      if (!text) throw new Error('Empty AI response');

      return this.safeJSONParse(text, context, message);
    } catch (err: any) {
      if (retry < this.MAX_RETRY) {
        console.warn(`Retry AI call (${retry + 1}) - Error: ${err.message}`);
        return this.callModel(model, systemPrompt, message, context, retry + 1);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  private safeJSONParse(
    text: string,
    context: AIContext,
    message: string,
  ): AIParseResult {
    console.log('Raw AI response:', text, context);

    try {
      const obj = JSON.parse(text);

      if (context.subStatus === 'AWAITING_CONFIRM_SUGGESTED_SLOT') {
        if (isUserConfirm(message)) {
          return {
            intent: 'update_booking',
            updates: {
              ...obj.updates,
              checkIn: context['suggestedSlots']?.[0] || obj.updates.checkIn, // Ưu tiên slot gợi ý nếu có
            },
            confidence: 1,
          };
        } else if (isUserReject(message)) {
          return {
            intent: 'cancel',
            updates: obj.updates ?? {},
            confidence: 1,
          };
        }
      }

      return {
        intent: obj.intent ?? 'other',
        updates: obj.updates ?? {},
        confidence: obj.confidence ?? 0,
      };
    } catch (e) {
      console.error('JSON parse fail:', text);
      return { intent: 'other', updates: {}, confidence: 0 };
    }
  }

  // 🔥 XÂY DỰNG LẠI SYSTEM PROMPT (Thêm ví dụ Few-shot)
  private buildSystemPrompt(context: AIContext): string {
    // Lọc bỏ các trường null để tiết kiệm token
    const compactData = Object.fromEntries(
      Object.entries(context.bookingData).filter(([_, v]) => v != null),
    );

    return `Role: Karaoke Booking Intent Parser.
Task: Output JSON {"intent": string, "updates": object, "confidence": number}.

CONTEXT:
Status: ${context.status}
PrimaryFlow: ${context.primaryFlow}
LastIntent: ${context.lastIntent || 'none'}
LastAsked: ${context.lastAskedFields?.join(',') || 'none'}
Data: ${JSON.stringify(compactData)}

INTENTS:
- ask_price: asking price/promo.
- check_availability: checking room status.
- booking: requesting to book.
- update_booking: providing booking info.
- cancel: cancelling booking.
- other: irrelevant.

RULES:
1. Extract ONLY if clear:
- name: proper name (not pronouns)
- phone: 9-11 digits
- people: number (not from "1 phòng")
- branch: location
- checkIn/checkOut: raw time text

2. TIME RULES (CRITICAL):
- Contains "nữa" → checkIn
- Has ["hát","chơi","thuê"] → duration
- "7h","7r","7h30","19h" → checkIn
- Only 1 time → checkIn
- NEVER treat "7r","7h30" as duration

3. RAW DATA:
If only data:
- follow LastIntent
- else → update_booking

4. VAGUE:
Map to LastAsked if valid

5. CONFIDENCE:
clear=0.9+, unsure<0.7

EXAMPLES:

"7h hát 2 tiếng"
→ {"intent":"update_booking","updates":{"checkIn":"7h","duration":"2 tiếng"},"confidence":0.95}

"2 tiếng nữa"
→ {"intent":"update_booking","updates":{"checkIn":"2 tiếng nữa"},"confidence":0.9}

"3 người"
→ {"intent":"update_booking","updates":{"people":3},"confidence":0.95}

JSON ONLY.`;
  }
}
