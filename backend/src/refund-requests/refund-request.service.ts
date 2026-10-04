import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefundRequest } from './entities/refund-request.entity';
import { Booking } from '../bookings/entities/booking.entity';
import {
  Conversation,
  ConversationStatus,
} from '../chat/entities/conversation.entity';
import { QueryRefundRequestDto } from './dto/query-refund-request.dto';
import { CompleteRefundRequestDto } from './dto/complete-refund-request.dto';
import { RejectRefundRequestDto } from './dto/reject-refund-request.dto';
import { LinkConversationDto } from './dto/link-conversation.dto';
import { RefundRequestStatus } from '../common/enums/refund-request-status.enum';
import {
  NotificationService,
  NotificationType,
} from '../notifications/notification.service';

@Injectable()
export class RefundRequestService {
  private readonly logger = new Logger(RefundRequestService.name);

  constructor(
    @InjectRepository(RefundRequest)
    private readonly refundRequestRepo: Repository<RefundRequest>,
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    private readonly notificationService: NotificationService,
  ) {}

  // Gọi từ BookingService.cancel() SAU khi đơn đã huỷ thành công — lỗi ở đây không được
  // làm hỏng việc huỷ đơn đã hoàn tất, nên bắt lỗi và chỉ log, không throw ra ngoài (cùng
  // triết lý "tác vụ phụ không phá nghiệp vụ chính" như NotificationService).
  async createForCancelledBooking(
    booking: Booking,
    reason: string,
  ): Promise<RefundRequest | null> {
    try {
      // Best-effort: tìm hội thoại OPEN gần nhất của khách để admin xem ảnh QR ngay —
      // không bắt buộc tìm bằng mọi giá, để null nếu khách chưa từng chat.
      const conversation = await this.conversationRepo.findOne({
        where: {
          customer: { userId: booking.user.userId },
          status: ConversationStatus.OPEN,
        },
        order: { createdAt: 'DESC' },
      });

      const refundRequest = this.refundRequestRepo.create({
        booking,
        amount: booking.paidAmount,
        payerBankInfo: null,
        conversation: conversation ?? null,
        status: RefundRequestStatus.PENDING,
        reason,
      });
      return await this.refundRequestRepo.save(refundRequest);
    } catch (error) {
      this.logger.warn(
        `Không tạo được RefundRequest cho booking ${booking.bookingId}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  // Mặc định PENDING luôn lên trước (ORDER BY status = 'PENDING' DESC trước, rồi mới tới
  // createdAt) — admin cần thấy ngay việc đang chờ xử lý, bất kể lọc theo status nào hay
  // không.
  async findAll(query: QueryRefundRequestDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.refundRequestRepo
      .createQueryBuilder('refund')
      .leftJoinAndSelect('refund.booking', 'booking')
      .leftJoinAndSelect('booking.roomType', 'roomType')
      .leftJoinAndSelect('booking.user', 'user')
      .leftJoinAndSelect('refund.conversation', 'conversation')
      .orderBy(`CASE WHEN refund.status = :pending THEN 0 ELSE 1 END`, 'ASC')
      .addOrderBy('refund.createdAt', 'DESC')
      .setParameter('pending', RefundRequestStatus.PENDING)
      .skip((page - 1) * limit)
      .take(limit);

    if (query.status) {
      qb.andWhere('refund.status = :status', { status: query.status });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async findById(refundRequestId: string): Promise<RefundRequest> {
    const refund = await this.refundRequestRepo.findOne({
      where: { refundRequestId },
    });
    if (!refund) {
      throw new NotFoundException('Không tìm thấy yêu cầu hoàn tiền');
    }
    return refund;
  }

  async complete(
    refundRequestId: string,
    dto: CompleteRefundRequestDto,
    processedByUserId: string,
  ): Promise<RefundRequest> {
    const refund = await this.assertPending(refundRequestId);
    refund.status = RefundRequestStatus.COMPLETED;
    refund.adminNote = dto.adminNote?.trim() || null;
    refund.processedByUserId = processedByUserId;
    refund.processedAt = new Date();
    const saved = await this.refundRequestRepo.save(refund);

    void this.notificationService.notifyRefund(
      refund.booking.user.userId,
      NotificationType.REFUND_COMPLETED,
      {
        bookingId: refund.booking.bookingId,
        roomTypeName: refund.booking.roomType?.name,
        adminNote: refund.adminNote,
      },
    );
    return saved;
  }

  async reject(
    refundRequestId: string,
    dto: RejectRefundRequestDto,
    processedByUserId: string,
  ): Promise<RefundRequest> {
    const refund = await this.assertPending(refundRequestId);
    refund.status = RefundRequestStatus.REJECTED;
    refund.adminNote = dto.adminNote.trim();
    refund.processedByUserId = processedByUserId;
    refund.processedAt = new Date();
    const saved = await this.refundRequestRepo.save(refund);

    void this.notificationService.notifyRefund(
      refund.booking.user.userId,
      NotificationType.REFUND_REJECTED,
      {
        bookingId: refund.booking.bookingId,
        roomTypeName: refund.booking.roomType?.name,
        adminNote: refund.adminNote,
      },
    );
    return saved;
  }

  // Admin tự gắn/đổi hội thoại liên kết — dùng khi tạo tự động không tìm được (khách chưa
  // từng chat, hoặc hội thoại không ở trạng thái OPEN lúc huỷ đơn).
  async linkConversation(
    refundRequestId: string,
    dto: LinkConversationDto,
  ): Promise<RefundRequest> {
    const refund = await this.findById(refundRequestId);
    const conversation = await this.conversationRepo.findOne({
      where: { conversationId: dto.conversationId },
    });
    if (!conversation) {
      throw new NotFoundException('Không tìm thấy hội thoại');
    }
    refund.conversation = conversation;
    return this.refundRequestRepo.save(refund);
  }

  // complete()/reject() chỉ áp dụng được cho yêu cầu đang PENDING — tránh xử lý 2 lần (VD
  // admin bấm "Đánh dấu đã hoàn tiền" rồi lại bấm "Từ chối" trên cùng 1 yêu cầu).
  private async assertPending(refundRequestId: string): Promise<RefundRequest> {
    const refund = await this.findById(refundRequestId);
    if (refund.status !== RefundRequestStatus.PENDING) {
      throw new BadRequestException(
        'Yêu cầu hoàn tiền này đã được xử lý trước đó',
      );
    }
    return refund;
  }
}
