import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { NotificationType } from '../common/enums/notification-type.enum';
import { RealtimeGateway } from '../realtime/realtime.gateway';

// Mặc định trả chừng này thông báo mỗi trang (chuông trên header chỉ lấy trang đầu).
// Có trần để client không xin một lần cả nghìn dòng.
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  // Tạo thông báo rồi đẩy real-time. KHÔNG ném lỗi ra ngoài: đây là tác vụ phụ đi kèm
  // các nghiệp vụ chính (xác nhận đơn, check-in, thanh toán...) — lỗi ghi thông báo mà
  // làm hỏng cả việc check-in thì thiệt hơn nhiều so với việc mất một dòng thông báo.
  async notify(input: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    booking?: Booking | null;
  }): Promise<void> {
    try {
      const saved = await this.notificationRepo.save(
        this.notificationRepo.create({
          user: { userId: input.userId } as never,
          type: input.type,
          title: input.title,
          message: input.message,
          booking: input.booking ?? null,
        }),
      );
      this.realtimeGateway.emitNotification(input.userId, {
        notificationId: saved.notificationId,
        type: saved.type,
        title: saved.title,
        message: saved.message,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Không tạo được thông báo: ${message}`);
    }
  }

  async findMine(userId: string, page = 1, limit = DEFAULT_LIMIT) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), MAX_LIMIT);

    const [[items, total], unreadCount] = await Promise.all([
      this.notificationRepo.findAndCount({
        where: { user: { userId } },
        relations: { booking: { roomType: true } },
        order: { createdAt: 'DESC' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.notificationRepo.count({ where: { user: { userId }, isRead: false } }),
    ]);

    return {
      unreadCount,
      total,
      page: safePage,
      limit: safeLimit,
      items: items.map((item) => ({
        notificationId: item.notificationId,
        type: item.type,
        title: item.title,
        message: item.message,
        isRead: item.isRead,
        createdAt: item.createdAt,
        bookingId: item.booking?.bookingId ?? null,
        roomTypeId: item.booking?.roomType?.roomTypeId ?? null,
      })),
    };
  }

  // Lọc kèm userId chứ không chỉ theo id: nếu không, khách đoán được id là đánh dấu
  // đọc được thông báo của người khác.
  async markRead(userId: string, notificationId: string) {
    const result = await this.notificationRepo.update(
      { notificationId, user: { userId } },
      { isRead: true },
    );
    if (!result.affected) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }
    return { message: 'Đã đánh dấu đã đọc' };
  }

  async markAllRead(userId: string) {
    await this.notificationRepo.update(
      { user: { userId }, isRead: false },
      { isRead: true },
    );
    return { message: 'Đã đánh dấu tất cả là đã đọc' };
  }
}
