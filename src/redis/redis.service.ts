import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { KaraokeSessionState } from 'src/queue/interfaces';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private redisClient!: Redis;
    
    // Tiền tố để phân biệt key của Chatbot với các hệ thống khác dùng chung Redis
    private readonly PREFIX = 'karaoke_session:'; 
    
    // Thời gian sống của 1 phiên chat: 30 phút (tính bằng giây)
    private readonly TTL_SECONDS = 1800; 

    // Khởi tạo kết nối Redis khi NestJS chạy
    onModuleInit() {
        this.redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
        
        this.redisClient.on('connect', () => console.log('✅ Redis connected successfully.'));
        this.redisClient.on('error', (err) => console.error('❌ Redis error:', err));
    }

    // Đóng kết nối khi tắt server
    onModuleDestroy() {
        this.redisClient.disconnect();
    }

    /**
     * LẤY SESSION (GET)
     * @param userId ID của khách hàng (PSID, Zalo ID)
     * @returns Object SessionState hoặc null nếu không có/đã hết hạn
     */
    async getSession(userId: string): Promise<KaraokeSessionState | null> {
        const key = `${this.PREFIX}${userId}`;
        const data = await this.redisClient.get(key);

        if (!data) {
            return null; // Khách mới hoặc phiên chat đã hết hạn
        }

        try {
            // Redis chỉ lưu string, nên lấy ra phải parse về JSON
            return JSON.parse(data) as KaraokeSessionState;
        } catch (error) {
            console.error(`[Redis] Lỗi parse JSON cho key ${key}:`, error);
            return null;
        }
    }

    /**
     * LƯU SESSION (SET)
     * @param userId ID của khách hàng
     * @param state Toàn bộ object trạng thái hiện tại
     */
    async saveSession(userId: string, state: KaraokeSessionState): Promise<void> {
        const key = `${this.PREFIX}${userId}`;
        
        // Cập nhật lại thời gian tương tác cuối cùng
        state.updatedAt = Date.now();

        // Chuyển Object thành String và lưu vào Redis kèm theo TTL
        // 'EX' có nghĩa là Expire (hết hạn) tính bằng giây
        await this.redisClient.set(
            key, 
            JSON.stringify(state), 
            'EX', 
            this.TTL_SECONDS
        );
    }

    /**
     * XÓA SESSION (DELETE)
     * Dùng khi khách đã chốt đơn thành công hoặc chủ động hủy
     */
    async deleteSession(userId: string): Promise<void> {
        const key = `${this.PREFIX}${userId}`;
        await this.redisClient.del(key);
    }

    createDefault(payload: any, channelConfig: any):KaraokeSessionState{
      return {
      // 1. Định danh khách hàng & Nền tảng
      sessionId: payload.userId,
      platform: payload.platform,
      channelId: payload.channelId,

      // 2. Bơm cấu hình của Quán (Tenant) vào State
      tenantId: channelConfig.tenant.id,
      tenantName: channelConfig.tenant.name,
      requireBranch: channelConfig.tenant.requireBranchSelection,
      // (Lưu ý: Lúc query channelConfig ở trên, bạn nhớ join thêm bảng branches)
      availableBranches: channelConfig.tenant.branches || [],
      primaryFlow: null,

      // 3. Khởi tạo giỏ hàng (Booking Data) rỗng
      bookingData: {
        name: null,
        phone: null,
        people: null,
        branch: channelConfig.defaultBranch ? channelConfig.defaultBranch.name : null,
        checkIn: null,
        checkOut: null,
        duration: null,
        day: null
      },
      lastIntent: null,

      // 4. Các biến điều khiển luồng
      status: 'INIT',     // Trạng thái mới bắt đầu
      subStatus: null,
      missingFields: [],  // Chưa thiếu gì vì chưa kiểm tra
      stepCount: 0,       // Đếm số câu chat = 0
      suggestedSlots: [], // Chưa gợi ý gì vì chưa phân tích

      // 5. Metadata thời gian
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
   }
}