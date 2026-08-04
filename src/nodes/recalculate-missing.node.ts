// src/nodes/recalculate-missing.node.ts
import { KaraokeSessionState, NodeResult } from 'src/queue/interfaces';

// Field bắt buộc theo từng flow
export const FLOW_REQUIRED_FIELDS: Record<string, string[]> = {
  BOOKING: ['name', 'phone', 'people', 'checkIn'],
  PRICE_QUOTE: ['checkIn', 'people'],
  CHECK_AVAILABILITY: ['checkIn', 'people'],
};

/**
 * NODE 3: recalculate_missing
 * Input:  session (đã có bookingData mới từ node 2)
 * Output: { missingFields }
 */
export function recalculateMissingNode(
  session: KaraokeSessionState,
): NodeResult {
  const flow = session.primaryFlow;
  if (!flow) return { missingFields: [] };

  const required = FLOW_REQUIRED_FIELDS[flow] ?? [];

  const missing = required.filter((field) => {
    const value = (session.bookingData as any)[field];
    return value === undefined || value === null || value === '';
  });

  return { missingFields: missing };
}
