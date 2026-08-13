// src/nodes/classify-intent.node.ts
import { AIService, AIContext } from 'src/ai/ai.service';
import {
  KaraokeSessionState,
  NodeResult,
} from 'src/queue/message/message.interfaces';

/**
 * NODE 1: classify_intent
 * Input:  session + tin nhắn của user
 * Output: { lastIntent, confidence, _aiUpdates }
 */
export async function classifyIntentNode(
  session: KaraokeSessionState,
  message: string,
  aiService: AIService,
): Promise<NodeResult & { _aiUpdates: any }> {
  const aiContext: AIContext = {
    tenantName: session.tenantName,
    status: session.status,
    subStatus: session.subStatus,
    primaryFlow: session.primaryFlow,
    lastIntent: session.lastIntent,
    lastAskedFields: session.missingFields,
    suggestedSlots: session.suggestedSlots,
    bookingData: session.bookingData,
  };

  const aiResult = await aiService.parse(aiContext, message);

  // Trả về Partial<session> — không động vào session gốc
  return {
    lastIntent: aiResult.intent,
    confidence: aiResult.confidence, // nếu muốn lưu vào state
    _aiUpdates: aiResult.updates, // dùng nội bộ trong pipeline
  } as any;
}

export async function preClassifyNode(
  session: KaraokeSessionState,
  message: string,
  aiService: AIService,
): Promise<NodeResult & { _aiUpdates: any }> {
  const aiContext: Partial<AIContext> = {
    suggestedSlots: session.suggestedSlots,
  };

  const aiResult = await aiService.prevParse(aiContext, message);

  // Trả về Partial<session> — không động vào session gốc
  return aiResult as any;
}
