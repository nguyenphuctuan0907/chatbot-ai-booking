// Các trạng thái của một vòng đời đặt phòng
export type SessionStatus = 
    | 'INIT'              // Vừa khởi tạo, chưa hỏi được gì
    | 'COLLECTING_INFO'   // Đang trong quá trình hỏi các trường còn thiếu
    | 'COMPLETED'         // Đã lưu Database thành công
    | 'CANCELLED'         // Khách hủy giữa chừng hoặc session hết hạn
    | 'TRANSFER_TO_AGENT';// Khách đòi gặp nhân viên thật

export type SubSessionStatus = 
    | 'ASKING_MISSING'                     // Đang hỏi các trường còn thiếu
    | 'AWAITING_CONFIRM_SUGGESTED_SLOT'    // Đang chờ xác nhận slot gợi ý
    | 'FULL_BOOKED'                        // Đã đầy phòng
    | null;                                // Không có trạng thái phụ

export type PrimaryFlow =
    | "BOOKING"
    | "PRICE_QUOTE"
    | "CHECK_AVAILABILITY"
    | null;    

// Dữ liệu cốt lõi (Phần DUY NHẤT được đưa vào Prompt cho AI đọc)
export interface BookingData {
    name: string | null;
    phone: string | null;
    people: number | null;
    branch: string | null;    // Tên cơ sở (VD: "Cầu Giấy", "Hà Đông")
    checkIn: string | null;   // Giờ đến thô (VD: "8h tối nay")
    checkOut: string | null;  // Giờ về thô (VD: "đến 23h")
    duration: number | null;  // Số giờ hát (VD: 2)
    day: string | null;      // Ngày hát (VD: "2024-12-31")
}

// Cấu trúc Session hoàn chỉnh (Lưu trong Redis)
export interface KaraokeSessionState {
    // ==========================================
    // NHÓM 1: ĐỊNH DANH (ROUTING)
    // ==========================================
    sessionId: string;        // ID người dùng (PSID Facebook, Zalo User ID)
    platform: string;         // 'facebook' | 'zalo' | 'tiktok'
    channelId: string;        // ID của Page nhận tin nhắn (Để biết chat vào page nào)

    // ==========================================
    // NHÓM 2: NGỮ CẢNH CỦA QUÁN (TENANT CONTEXT)
    // ==========================================
    tenantId: string;         // ID của Quán (VD: "T001")
    tenantName: string;       // Tên thương hiệu (VD: "Music Box")
    requireBranch: boolean;   // Quán này có bắt buộc chọn cơ sở không?
    availableBranches: Array<{ id: string; name: string; aliases: string | null }>; // Danh sách cơ sở để Validate
    primaryFlow: PrimaryFlow;     // Luồng chính của khách (VD: "booking", "ask_price", "update_booking")

    // ==========================================
    // NHÓM 3: DỮ LIỆU ĐẶT PHÒNG & AI (NLU STATE)
    // ==========================================
    bookingData: BookingData; // Data AI liên tục cập nhật vào
    lastIntent: string | null;// Ý định của tin nhắn gần nhất (VD: "update_booking", "ask_price")
    
    // ==========================================
    // NHÓM 4: ĐIỀU KHIỂN LUỒNG (FLOW CONTROL)
    // ==========================================
    status: SessionStatus;    // Trạng thái hiện tại của phiên chat
    subStatus: SubSessionStatus;   // Trạng thái phụ để điều khiển chi tiết hơn
    missingFields: string[];  // Mảng các trường đang bị thiếu (VD: ['phone', 'checkIn'])
    stepCount: number;        // Đếm số lượt chat
    suggestedSlots: string[];   // Các slot AI gợi ý khách có thể cung cấp (VD: ['checkIn', 'people'])

    // ==========================================
    // NHÓM 5: SIÊU DỮ LIỆU (METADATA)
    // ==========================================
    createdAt: number;        // Timestamp lúc phiên bắt đầu
    updatedAt: number;        // Timestamp tin nhắn cuối (Dùng để gia hạn TTL Redis)
}