import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';

export enum NotificationType {
  BOOKING_CREATED = 'BOOKING_CREATED',
  BOOKING_CONFIRMED = 'BOOKING_CONFIRMED',
  BOOKING_CHECKED_IN = 'BOOKING_CHECKED_IN',
  BOOKING_CHECKED_OUT = 'BOOKING_CHECKED_OUT',
  BOOKING_CANCELLED = 'BOOKING_CANCELLED',
  PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  REVIEW_REPLIED = 'REVIEW_REPLIED',
}

// Các loại phát sinh từ vòng đời đơn đặt phòng — nội dung soạn sẵn theo tên loại phòng.
// REVIEW_REPLIED không nằm ở đây vì nội dung của nó là câu trả lời của khách sạn, phải
// truyền vào lúc gọi (xem notifyReviewReplied).
type BookingNotificationType = Exclude<
  NotificationType,
  NotificationType.REVIEW_REPLIED
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

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    // Đẩy thông báo mới tới khách ngay khi đang mở web/app, không phải chờ F5.
    private readonly realtimeGateway: RealtimeGateway,
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
