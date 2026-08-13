// src/nodes/merge-updates.node.ts
import {
  KaraokeSessionState,
  NodeResult,
  PrimaryFlow,
} from 'src/queue/message/message.interfaces';

const INTENT_TO_FLOW: Record<string, PrimaryFlow> = {
  booking: 'BOOKING',
  update_booking: 'BOOKING',
  ask_price: 'PRICE_QUOTE',
  check_availability: 'CHECK_AVAILABILITY',
};

/**
 * NODE 2: merge_updates
 * Input:  session + aiUpdates từ node trước
 * Output: { bookingData (merged), primaryFlow }
 *
 */
export function mergeUpdatesNode(
  session: KaraokeSessionState,
  aiUpdates: Record<string, any>,
): NodeResult {
  // Chỉ merge field có giá trị (không ghi đè bằng null)
  const cleanUpdates = Object.fromEntries(
    Object.entries(aiUpdates).filter(([_, v]) => v !== null && v !== undefined),
  );

  const newBookingData = {
    ...session.bookingData,
    ...cleanUpdates,
  };

  // Tự động resolve primaryFlow từ intent
  const newFlow: PrimaryFlow =
    INTENT_TO_FLOW[session.lastIntent ?? ''] ?? session.primaryFlow;

  return {
    bookingData: newBookingData,
    primaryFlow: newFlow,
  };
}
