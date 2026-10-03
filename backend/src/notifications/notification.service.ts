import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { UserService } from '../users/user.service';

export enum NotificationType {
  BOOKING_CREATED = 'BOOKING_CREATED',
  BOOKING_CONFIRMED = 'BOOKING_CONFIRMED',
  BOOKING_CHECKED_IN = 'BOOKING_CHECKED_IN',
  BOOKING_CHECKED_OUT = 'BOOKING_CHECKED_OUT',
  BOOKING_CANCELLED = 'BOOKING_CANCELLED',
  PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  REVIEW_REPLIED = 'REVIEW_REPLIED',
  // Gửi cho nhân viên lễ tân (không gửi admin, không gửi khách): có khách vừa đặt phòng.
  STAFF_NEW_BOOKING = 'STAFF_NEW_BOOKING',
  // --- Chỉ gửi ADMIN: việc cần quyền quản lý mới xử lý được ---
  ADMIN_CASH_MISMATCH = 'ADMIN_CASH_MISMATCH',
  ADMIN_SHIFT_ABSENT = 'ADMIN_SHIFT_ABSENT',
  ADMIN_SHIFT_AUTO_CLOSED = 'ADMIN_SHIFT_AUTO_CLOSED',
  ADMIN_PAID_BOOKING_CANCELLED = 'ADMIN_PAID_BOOKING_CANCELLED',
  ADMIN_NEGATIVE_REVIEW = 'ADMIN_NEGATIVE_REVIEW',
}

export type AdminNotificationType =
  | NotificationType.ADMIN_CASH_MISMATCH
  | NotificationType.ADMIN_SHIFT_ABSENT
  | NotificationType.ADMIN_SHIFT_AUTO_CLOSED
  | NotificationType.ADMIN_PAID_BOOKING_CANCELLED
  | NotificationType.ADMIN_NEGATIVE_REVIEW;

// Các loại phát sinh từ vòng đời đơn đặt phòng — nội dung soạn sẵn theo tên loại phòng.
// REVIEW_REPLIED không nằm ở đây vì nội dung của nó là câu trả lời của khách sạn, phải
// truyền vào lúc gọi (xem notifyReviewReplied).
type BookingNotificationType = Exclude<
  NotificationType,
  | NotificationType.REVIEW_REPLIED
  | NotificationType.STAFF_NEW_BOOKING
  | AdminNotificationType
>;

const PAGE_SIZE = 20;

// Nội dung thông báo theo từng sự kiện của đơn đặt phòng.
const BOOKING_MESSAGES: Record<
  BookingNotificationType,
  (roomTypeName: string) => { title: string; body: string }
> = {
  [NotificationType.BOOKING_CREATED]: (room) => ({
    title: 'Đặt phòng thành công',
    body: `Đơn ${room} đã được ghi nhận. Chúng tôi sẽ sớm xác nhận cho bạn.`,
  }),
  [NotificationType.BOOKING_CONFIRMED]: (room) => ({
    title: 'Đơn đặt phòng đã được xác nhận',
    body: `Đơn ${room} đã được khách sạn xác nhận. Hẹn gặp bạn ngày nhận phòng!`,
  }),
  [NotificationType.BOOKING_CHECKED_IN]: (room) => ({
    title: 'Chào mừng bạn đến SmartStay',
    body: `Bạn đã nhận phòng ${room}. Chúc bạn có kỳ nghỉ thật trọn vẹn.`,
  }),
  [NotificationType.BOOKING_CHECKED_OUT]: (room) => ({
    title: 'Cảm ơn bạn đã lưu trú',
    body: `Bạn đã trả phòng ${room}. Hãy dành chút thời gian đánh giá kỳ nghỉ nhé.`,
  }),
  [NotificationType.BOOKING_CANCELLED]: (room) => ({
    title: 'Đơn đặt phòng đã bị huỷ',
    body: `Đơn ${room} đã được huỷ.`,
  }),
  [NotificationType.PAYMENT_SUCCESS]: (room) => ({
    title: 'Thanh toán thành công',
    body: `Đã nhận thanh toán cho đơn ${room}. Cảm ơn bạn!`,
  }),
  [NotificationType.PAYMENT_FAILED]: (room) => ({
    title: 'Thanh toán chưa thành công',
    body: `Giao dịch cho đơn ${room} chưa hoàn tất. Bạn có thể thử thanh toán lại trong chi tiết đơn.`,
  }),
};

// Ngày nhận/trả phòng client gửi lên có thể là 'YYYY-MM-DD' hoặc ISO đầy đủ
// ('2026-10-08T00:00:00.000Z'). Ghi thẳng vào nội dung thì khách/nhân viên đọc phải chuỗi
// ISO khó hiểu — quy về 'dd/MM/yyyy'. Lấy ngày theo cùng cách BookingService.getStayDates()
// (toISOString) để ngày hiện ra khớp đúng ngày của đơn.
function formatDay(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const [y, m, d] = parsed.toISOString().slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    // Đẩy thông báo mới tới khách ngay khi đang mở web/app, không phải chờ F5.
    private readonly realtimeGateway: RealtimeGateway,
    private readonly userService: UserService,
  ) {}

  // Gọi từ các nghiệp vụ đặt phòng — đây là tác vụ phụ, giống realtime emit: lỗi ghi
  // thông báo không được làm hỏng nghiệp vụ chính (xác nhận/huỷ/thanh toán...).
  async notifyBooking(
    userId: string,
    type: BookingNotificationType,
    booking: { bookingId: string; roomTypeName?: string | null },
  ): Promise<void> {
    const { title, body } = BOOKING_MESSAGES[type](
      booking.roomTypeName ?? 'của bạn',
    );
    await this.create(userId, type, title, body, booking.bookingId);
  }

  // Khách sạn trả lời đánh giá của khách. Gắn bookingId của đơn được đánh giá để phía
  // client bấm vào mở được đúng phòng đó.
  async notifyReviewReplied(
    userId: string,
    review: { bookingId: string; roomTypeName?: string | null; reply: string },
  ): Promise<void> {
    const reply =
      review.reply.length > 120
        ? `${review.reply.slice(0, 120).trimEnd()}…`
        : review.reply;
    await this.create(
      userId,
      NotificationType.REVIEW_REPLIED,
      'Khách sạn đã phản hồi đánh giá của bạn',
      `Về đánh giá ${review.roomTypeName ?? 'kỳ nghỉ'} của bạn: "${reply}"`,
      review.bookingId,
    );
  }

  // Báo cho TỪNG nhân viên lễ tân là có đơn mới. Mỗi người một dòng riêng để trạng thái
  // đã đọc tách bạch — lễ tân A đọc rồi thì lễ tân B vẫn thấy chưa đọc.
  async notifyStaffNewBooking(
    staffIds: string[],
    booking: {
      bookingId: string;
      guestName?: string | null;
      roomTypeName?: string | null;
      checkIn: string;
      checkOut: string;
    },
  ): Promise<void> {
    const title = 'Có đơn đặt phòng mới';
    const body = `${booking.guestName ?? 'Khách hàng'} vừa đặt ${booking.roomTypeName ?? 'phòng'}, ${formatDay(booking.checkIn)} → ${formatDay(booking.checkOut)}. Đơn đang chờ xác nhận.`;
    await Promise.all(
      staffIds.map((staffId) =>
        this.create(
          staffId,
          NotificationType.STAFF_NEW_BOOKING,
          title,
          body,
          booking.bookingId,
        ),
      ),
    );
  }

  // Báo cho TỪNG admin đang hoạt động. Chỉ dùng cho loại ADMIN_* — admin không nhận
  // các thông báo vận hành hằng ngày của lễ tân. Không ném lỗi ra ngoài: nơi gọi là
  // nghiệp vụ chính (kết ca, huỷ đơn, gửi đánh giá), không được hỏng vì thông báo.
  async notifyAdmins(
    type: AdminNotificationType,
    title: string,
    body: string,
    bookingId: string | null = null,
  ): Promise<void> {
    try {
      const adminIds = await this.userService.findActiveAdminIds();
      await Promise.all(
        adminIds.map((adminId) =>
          this.create(adminId, type, title, body, bookingId),
        ),
      );
    } catch (error) {
      this.logger.warn(
        `Không gửi được thông báo ${type} cho admin: ${(error as Error).message}`,
      );
    }
  }

  // Lưu rồi đẩy real-time. Không ném lỗi ra ngoài: lỗi ghi thông báo không được làm
  // hỏng nghiệp vụ chính gọi nó (xác nhận/huỷ/thanh toán/trả lời đánh giá...).
  private async create(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    bookingId: string | null,
  ): Promise<void> {
    try {
      const saved = await this.notificationRepo.save(
        this.notificationRepo.create({ userId, type, title, body, bookingId }),
      );
      this.realtimeGateway.emitNotification(userId, this.toResponse(saved));
    } catch (error) {
      this.logger.warn(
        `Không tạo được thông báo ${type}${bookingId ? ` cho booking ${bookingId}` : ''}: ${(error as Error).message}`,
      );
    }
  }

  async findMine(userId: string, isRead?: boolean, page = 1) {
    const [items, total] = await this.notificationRepo.findAndCount({
      where: { userId, ...(isRead === undefined ? {} : { isRead }) },
      order: { createdAt: 'DESC' },
      skip: (Math.max(page, 1) - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });
    return { data: items.map((n) => this.toResponse(n)), total };
  }

  async unreadCount(userId: string) {
    const count = await this.notificationRepo.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  async markRead(userId: string, notificationId: string) {
    const result = await this.notificationRepo.update(
      { notificationId, userId },
      { isRead: true },
    );
    if (!result.affected) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }
    return { message: 'Đã đánh dấu đã đọc' };
  }

  async markAllRead(userId: string) {
    await this.notificationRepo.update(
      { userId, isRead: false },
      { isRead: true },
    );
    return { message: 'Đã đánh dấu tất cả là đã đọc' };
  }

  private toResponse(n: Notification) {
    return {
      id: n.notificationId,
      type: n.type,
      title: n.title,
      body: n.body,
      bookingId: n.bookingId,
      isRead: n.isRead,
      createdAt: n.createdAt,
    };
  }
}
