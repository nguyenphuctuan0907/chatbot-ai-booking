// src/nodes/respond.node.ts
import { KaraokeSessionState } from 'src/queue/interfaces';

export const MAP_FIELD_NAME: Record<string, string> = {
  checkIn: 'giờ đến',
  people: 'số lượng người',
  phone: 'số điện thoại',
  name: 'tên',
  branch: 'chi nhánh',
};

/**
 * NODE 5: respond
 * Input:  session (đã cập nhật đầy đủ từ các node trước)
 * Output: string (text gửi về cho user)
 */
export function respondNode(session: KaraokeSessionState): string {
  // Ưu tiên 1: Đã hoàn thành booking
  if (session.status === 'COMPLETED') {
    const d = session.bookingData;
    return (
      `✅ ĐẶT PHÒNG THÀNH CÔNG!\n` +
      `• Tên: ${d.name}\n` +
      `• SĐT: ${d.phone}\n` +
      `• Số người: ${d.people}\n` +
      `• Giờ vào: ${d.checkIn}\n` +
      `Cảm ơn bạn đã đặt phòng tại ${session.tenantName} ❤️`
    );
  }

  // Ưu tiên 2: Hết phòng hoàn toàn
  if (session.subStatus === 'FULL_BOOKED') {
    return (
      `😓 Rất tiếc hiện tại không còn phòng trống phù hợp ạ.\n` +
      `Bạn có thể gọi hotline để được hỗ trợ: 0123456789`
    );
  }

  // Ưu tiên 3: Có slot gần nhất → gợi ý
  if (session.subStatus === 'AWAITING_CONFIRM_SUGGESTED_SLOT') {
    const slot = session.suggestedSlots[0];
    return (
      `😓 Khung giờ đó đã hết phòng rồi ạ.\n` +
      `Hiện tại còn phòng lúc ${slot}, bạn có muốn đặt không ạ? ❤️`
    );
  }

  // Ưu tiên 4: Đang hỏi thiếu field
  if (
    session.subStatus === 'ASKING_MISSING' &&
    session.missingFields.length > 0
  ) {
    const fieldNames = session.missingFields
      .map((f) => MAP_FIELD_NAME[f] ?? f)
      .join(', ');
    return `Cho ${session.tenantName} xin thêm thông tin: ${fieldNames} ạ ❤️`;
  }

  // Ưu tiên 5: Interrupt (hỏi giá giữa chừng)
  if (session.lastIntent === 'ask_price') {
    const missing = session.missingFields
      .map((f) => MAP_FIELD_NAME[f] ?? f)
      .join(', ');
    const missingPart = missing
      ? `\n\nMình tiếp tục booking nhé, cho em xin thêm: ${missing}`
      : '';
    return `Dạ giá bên em từ 200k/giờ ❤️${missingPart}`;
  }

  // Fallback
  return `Dạ em chưa hiểu ý bạn lắm, bạn nhắn lại giúp em nhé ❤️`;
}
