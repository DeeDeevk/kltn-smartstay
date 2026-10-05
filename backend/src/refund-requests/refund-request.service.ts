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
import { HotelConfigService } from '../hotel-config/hotel-config.service';

// Giờ nhận phòng tiêu chuẩn (giờ Việt Nam) — mốc dùng để tính "huỷ trước giờ nhận phòng bao
// lâu" cho chính sách hoàn tiền theo thời điểm huỷ (KAN-117).
const CHECK_IN_HOUR = 14;
// Việt Nam không có giờ mùa hè, lệch cố định UTC+7 quanh năm — quy đổi giờ VN sang UTC
// tuyệt đối, độc lập với timezone server (cùng cách booking.service.ts tính giờ trả phòng).
const VIETNAM_UTC_OFFSET_HOURS = 7;

@Injectable()
export class RefundRequestService {
  private readonly logger = new Logger(RefundRequestService.name);

  constructor(
    @InjectRepository(RefundRequest)
    private readonly refundRequestRepo: Repository<RefundRequest>,
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    private readonly notificationService: NotificationService,
    private readonly hotelConfigService: HotelConfigService,
  ) {}

  // Tính số giờ còn lại tới giờ nhận phòng + % hoàn tiền áp dụng theo chính sách huỷ đơn
  // (freeCancellationHours/partialRefundPercent trong HotelConfig) — KHÔNG ghi gì vào DB,
  // dùng chung cho cả lúc tạo RefundRequest thật (createForCancelledBooking) và endpoint xem
  // trước (BookingService.getCancellationPreview).
  async computeRefundPreview(booking: Booking): Promise<{
    hoursUntilCheckIn: number;
    refundPercent: number;
    refundAmount: number;
    freeCancellationHours: number;
  }> {
    const config = await this.hotelConfigService.getOrCreate();
    const hoursUntilCheckIn = this.hoursUntilCheckIn(booking.checkInDate);
    const refundPercent =
      hoursUntilCheckIn <= 0
        ? 0
        : hoursUntilCheckIn >= config.freeCancellationHours
          ? 100
          : config.partialRefundPercent;
    const refundAmount = Math.round(
      (booking.paidAmount * refundPercent) / 100,
    );
    return {
      hoursUntilCheckIn,
      refundPercent,
      refundAmount,
      freeCancellationHours: config.freeCancellationHours,
    };
  }

  private hoursUntilCheckIn(checkInDate: string): number {
    const [year, month, day] = checkInDate.split('-').map(Number);
    const checkInMoment = new Date(
      Date.UTC(year, month - 1, day, CHECK_IN_HOUR - VIETNAM_UTC_OFFSET_HOURS),
    );
    return (checkInMoment.getTime() - Date.now()) / (60 * 60 * 1000);
  }

  // Gọi từ BookingService.cancel() SAU khi đơn đã huỷ thành công — lỗi ở đây không được
  // làm hỏng việc huỷ đơn đã hoàn tất, nên bắt lỗi và chỉ log, không throw ra ngoài (cùng
  // triết lý "tác vụ phụ không phá nghiệp vụ chính" như NotificationService).
  async createForCancelledBooking(
    booking: Booking,
    reason: string,
  ): Promise<RefundRequest | null> {
    // Toàn bộ thân hàm nằm trong 1 try/catch duy nhất (kể cả computeRefundPreview, vốn gọi
    // HotelConfigService -> có thể đụng DB) — lỗi ở ĐÂU trong lúc tạo cũng chỉ log, không
    // được ném ra ngoài làm "rớt" promise mà BookingService.cancel() gọi kiểu "void" (fire-
    // and-forget, không await/catch): throw ra khỏi hàm này sẽ thành unhandled rejection và
    // âm thầm không tạo được RefundRequest mà không ai biết.
    try {
      const { hoursUntilCheckIn, refundPercent, refundAmount } =
        await this.computeRefundPreview(booking);

      // Huỷ sau giờ nhận phòng (hoặc no-show) -> không hoàn gì, không tạo yêu cầu hoàn tiền —
      // chỉ log lại để admin tra cứu nếu cần giải thích với khách sau này.
      if (hoursUntilCheckIn <= 0) {
        this.logger.warn(
          `Không tạo RefundRequest cho booking ${booking.bookingId}: huỷ sau giờ nhận phòng ` +
            `(hoursUntilCheckIn=${hoursUntilCheckIn.toFixed(1)}), khách không được hoàn tiền.`,
        );
        return null;
      }

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
        amount: refundAmount,
        refundPercent,
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
      // orderBy() với biểu thức SQL thô (không phải tên cột/alias đã SELECT) ném lỗi
      // '"CASE WHEN refund" alias was not found' khi kết hợp với join + skip/take (TypeORM
      // dựng subquery phân trang riêng, cần mọi ORDER BY là alias đã addSelect) — phải
      // addSelect() biểu thức thành 1 cột ảo có alias rồi orderBy() theo alias đó.
      .addSelect(
        'CASE WHEN refund.status = :pending THEN 0 ELSE 1 END',
        'pendingFirst',
      )
      .orderBy('pendingFirst', 'ASC')
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

  // Khách tự xem yêu cầu hoàn tiền của MÌNH — trang "Lịch sử đặt phòng" dùng để hiện trạng
  // thái (PENDING/COMPLETED/REJECTED) cho từng đơn đã huỷ, thay vì khách chỉ biết qua
  // thông báo. Chỉ trả field cần cho khách, KHÔNG trả payerBankInfo/conversation/
  // processedByUserId (dữ liệu nội bộ cho admin/nhân viên xử lý).
  async findMine(userId: string) {
    const refunds = await this.refundRequestRepo.find({
      where: { booking: { user: { userId } } },
      relations: { booking: true },
      order: { createdAt: 'DESC' },
    });
    return refunds.map((r) => ({
      refundRequestId: r.refundRequestId,
      bookingId: r.booking.bookingId,
      amount: r.amount,
      refundPercent: r.refundPercent,
      status: r.status,
      adminNote: r.adminNote,
      createdAt: r.createdAt,
      processedAt: r.processedAt,
    }));
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
