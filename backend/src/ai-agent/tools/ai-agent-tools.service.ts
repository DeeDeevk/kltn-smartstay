import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { HttpException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomTypeService } from 'src/room-types/room-type.service';
import { BookingService, VAT_RATE } from 'src/bookings/booking.service';
import { PromotionService } from 'src/promotions/promotion.service';
import { ServiceService } from 'src/services/service.service';
import { PaymentService } from 'src/payments/payment.service';
import { CreateBookingDto } from 'src/bookings/dto/create-booking.dto';
import { PaymentMethod } from 'src/common/enums/payment-method.enum';
import { FaqEmbeddingService } from '../rag/faq-embedding.service';
import {
  AiConversation,
  PendingBookingSummary,
} from '../entities/ai-conversation.entity';

export interface ToolExecutionContext {
  userId: string;
  conversation: AiConversation;
  currentUserMessage: { text: string; createdAt: Date };
}

export type ToolExecutionResult =
  { success: true; data: unknown } | { success: false; error: string };

const AFFIRMATIVE_PATTERNS = [
  'đồng ý',
  'dong y',
  'xác nhận',
  'xac nhan',
  'chốt',
  'chot',
  'oke',
  'okie',
  'ok',
  'được',
  'duoc',
  'yes',
  'confirm',
];

// Bắt các câu phủ định đứng trước 1 từ đồng ý (VD "không đồng ý", "chưa xác nhận") —
// nếu chỉ so khớp includes() đơn thuần thì "không đồng ý" vẫn chứa chuỗi con "đồng ý"
// và sẽ bị hiểu nhầm thành lời xác nhận, dẫn tới tạo booking mà khách không hề muốn.
const NEGATION_BEFORE_AFFIRMATIVE =
  /(không|khong|chưa|chua|đừng|dung)\s*(đồng ý|dong y|xác nhận|xac nhan|\bok\b|oke|okie|được|duoc|chốt|chot|yes|confirm)/;

@Injectable()
export class AiAgentToolsService {
  private readonly logger = new Logger(AiAgentToolsService.name);

  constructor(
    @InjectRepository(AiConversation)
    private readonly conversationRepo: Repository<AiConversation>,
    private readonly roomTypeService: RoomTypeService,
    private readonly bookingService: BookingService,
    private readonly promotionService: PromotionService,
    private readonly serviceService: ServiceService,
    private readonly paymentService: PaymentService,
    private readonly faqEmbeddingService: FaqEmbeddingService,
  ) {}

  async execute(
    name: string,
    args: Record<string, unknown>,
    ctx: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    try {
      const data = await this.dispatch(name, args, ctx);
      return { success: true, data };
    } catch (err) {
      const message =
        err instanceof HttpException
          ? ((err.getResponse() as { message?: string })?.message ??
            err.message)
          : 'Đã có lỗi xảy ra khi thực hiện thao tác này';
      this.logger.warn(`Tool "${name}" failed: ${message}`);
      return { success: false, error: String(message) };
    }
  }

  private dispatch(
    name: string,
    args: Record<string, unknown>,
    ctx: ToolExecutionContext,
  ): Promise<unknown> {
    switch (name) {
      case 'search_rooms':
        return this.searchRooms(args);
      case 'check_availability':
        return this.checkAvailability(args);
      case 'get_promotions':
        return this.getPromotions();
      case 'get_policy':
        return this.getPolicy(args);
      case 'request_booking_form':
        // Tool này không thao tác dữ liệu gì — chỉ là tín hiệu để backend trả kèm
        // "bookingFormRequest" trong response cho frontend hiển thị biểu mẫu.
        return Promise.resolve(args);
      case 'propose_booking':
        return this.proposeBooking(args, ctx);
      case 'create_booking':
        return this.createBooking(ctx);
      default:
        throw new BadRequestException(`Tool không tồn tại: ${name}`);
    }
  }

  private async searchRooms(args: Record<string, unknown>) {
    const checkIn = String(args.checkIn);
    const checkOut = String(args.checkOut);
    const guests = args.guests !== undefined ? Number(args.guests) : undefined;
    const roomTypeName =
      typeof args.roomTypeName === 'string' ? args.roomTypeName.trim() : '';
    const maxPrice =
      args.maxPrice !== undefined ? Number(args.maxPrice) : undefined;
    const minPrice =
      args.minPrice !== undefined ? Number(args.minPrice) : undefined;

    let results = await this.bookingService.findAvailableRoomTypes(
      checkIn,
      checkOut,
      guests,
    );
    if (roomTypeName) {
      const needle = roomTypeName.toLowerCase();
      results = results.filter((rt) => rt.name.toLowerCase().includes(needle));
    }
    // Lọc giá ngay ở server thay vì để model chỉ lọc bằng lời trong câu trả lời — nếu
    // không, danh sách card phòng hiển thị cho khách (lấy nguyên kết quả tool này) sẽ
    // vẫn chứa cả những phòng ngoài ngân sách mà model đã "âm thầm" bỏ qua khi trả lời.
    if (maxPrice !== undefined) {
      results = results.filter((rt) => rt.basePrice <= maxPrice);
    }
    if (minPrice !== undefined) {
      results = results.filter((rt) => rt.basePrice >= minPrice);
    }

    return results.map((rt) => ({
      roomTypeId: rt.roomTypeId,
      name: rt.name,
      description: rt.description,
      basePrice: rt.basePrice,
      capacity: rt.capacity,
      amenities: rt.amenities,
      images: rt.images,
      availableCount: rt.availableCount,
    }));
  }

  private async checkAvailability(args: Record<string, unknown>) {
    const roomTypeId = String(args.roomTypeId);
    const checkIn = String(args.checkIn);
    const checkOut = String(args.checkOut);

    const result = await this.bookingService.getRoomTypeAvailability(
      roomTypeId,
      checkIn,
      checkOut,
    );
    return {
      roomTypeId: result.roomType.roomTypeId,
      name: result.roomType.name,
      description: result.roomType.description,
      basePrice: result.roomType.basePrice,
      capacity: result.roomType.capacity,
      images: result.roomType.images,
      availableCount: result.availableCount,
      available: result.available,
    };
  }

  private async getPromotions() {
    const promotions = await this.promotionService.findAll({ active: true });
    return promotions.map((p) => ({
      code: p.code,
      discountType: p.discountType,
      discountValue: p.discountValue,
      startDate: p.startDate,
      endDate: p.endDate,
    }));
  }

  // Lightweight RAG: embed the guest's free-text query and return the closest FAQ
  // entries by cosine similarity, instead of requiring the model to pick from a fixed
  // topic enum. Each result carries its own similarity score and lowConfidence flag so
  // the model can hedge ("mời liên hệ lễ tân") rather than present a weak match as fact.
  private async getPolicy(args: Record<string, unknown>) {
    const query = typeof args.query === 'string' ? args.query.trim() : '';
    if (!query) {
      throw new BadRequestException(
        'Thiếu nội dung câu hỏi cần tra cứu chính sách.',
      );
    }

    const results = await this.faqEmbeddingService.search(query);
    return {
      query,
      results: results.map((r) => ({
        content: r.entry.content,
        similarity: r.similarity,
        lowConfidence: r.lowConfidence,
      })),
    };
  }

  // Tính giá xem trước (không ghi DB) và lưu lại thành pendingBooking gắn với cuộc hội
  // thoại — đây là dữ liệu "chốt" mà create_booking sẽ dùng lại nguyên vẹn, thay vì tin
  // vào tham số model tự truyền lúc gọi create_booking.
  private async proposeBooking(
    args: Record<string, unknown>,
    ctx: ToolExecutionContext,
  ) {
    const roomTypeId = String(args.roomTypeId);
    const checkIn = String(args.checkIn);
    const checkOut = String(args.checkOut);
    const guestFullName = String(args.guestFullName);
    const guestPhone = String(args.guestPhone);
    const guestEmail =
      typeof args.guestEmail === 'string' && args.guestEmail
        ? args.guestEmail
        : undefined;
    const promotionCode =
      typeof args.promotionCode === 'string' && args.promotionCode
        ? args.promotionCode
        : undefined;
    if (
      args.paymentMethod !== PaymentMethod.CASH &&
      args.paymentMethod !== PaymentMethod.PAYOS
    ) {
      throw new BadRequestException(
        'Chưa xác định phương thức thanh toán. Hãy hỏi khách muốn thanh toán tiền mặt tại quầy hay chuyển khoản (PayOS) trước khi tóm tắt đặt phòng.',
      );
    }
    const paymentMethod = args.paymentMethod;
    const extraServiceIds = Array.isArray(args.extraServiceIds)
      ? (args.extraServiceIds as unknown[]).map(String)
      : [];

    const availability = await this.bookingService.getRoomTypeAvailability(
      roomTypeId,
      checkIn,
      checkOut,
    );
    if (!availability.available) {
      throw new BadRequestException(
        'Loại phòng đã hết trong khoảng ngày đã chọn',
      );
    }
    const roomType = availability.roomType;

    const extraServices = extraServiceIds.length
      ? await this.serviceService.findActiveByIds(extraServiceIds)
      : [];
    if (extraServices.length !== extraServiceIds.length) {
      throw new BadRequestException(
        'Một số dịch vụ đi kèm không tồn tại hoặc đã ngưng cung cấp',
      );
    }

    const nights = Math.round(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) /
        (24 * 60 * 60 * 1000),
    );
    const roomAmount = roomType.basePrice * nights;
    const serviceAmount = extraServices.reduce((sum, s) => sum + s.price, 0);

    let discountAmount = 0;
    if (promotionCode) {
      const result = await this.promotionService.validateCode(
        promotionCode,
        roomAmount + serviceAmount,
      );
      discountAmount = result.discountAmount;
    }
    const netRoomAmount = roomAmount - discountAmount;
    const vatAmount = Math.round(netRoomAmount * VAT_RATE);
    const totalAmount = netRoomAmount + serviceAmount + vatAmount;

    const summary: PendingBookingSummary = {
      roomTypeId,
      roomTypeName: roomType.name,
      checkIn,
      checkOut,
      nights,
      guestInfo: {
        fullName: guestFullName,
        phone: guestPhone,
        email: guestEmail,
      },
      extraServiceIds,
      promotionCode,
      paymentMethod,
      roomAmount,
      serviceAmount,
      discountAmount,
      vatAmount,
      totalAmount,
    };

    ctx.conversation.pendingBooking = summary;
    ctx.conversation.pendingBookingProposedAt = new Date();
    await this.conversationRepo.save(ctx.conversation);

    return summary;
  }

  private async createBooking(ctx: ToolExecutionContext) {
    const { pendingBooking, pendingBookingProposedAt } = ctx.conversation;
    if (!pendingBooking || !pendingBookingProposedAt) {
      throw new BadRequestException(
        'Chưa có đề xuất đặt phòng nào đang chờ xác nhận. Hãy gọi propose_booking và tóm tắt cho khách trước.',
      );
    }
    // Đề xuất phải được tạo ở một lượt TRƯỚC tin nhắn hiện tại của khách — tức là khách
    // đã thấy bản tóm tắt và đang phản hồi ở lượt kế tiếp, không phải model tự đề xuất
    // rồi tự chốt trong cùng 1 lượt xử lý.
    if (pendingBookingProposedAt >= ctx.currentUserMessage.createdAt) {
      throw new BadRequestException(
        'Chưa thể tạo booking ngay: phải trình bày tóm tắt cho khách và chờ khách xác nhận ở lượt hội thoại kế tiếp.',
      );
    }
    if (!this.isAffirmative(ctx.currentUserMessage.text)) {
      throw new BadRequestException(
        'Tin nhắn gần nhất của khách không phải là một lời đồng ý rõ ràng. Hãy hỏi lại khách có đồng ý đặt phòng theo thông tin đã tóm tắt hay không.',
      );
    }

    const dto: CreateBookingDto = {
      roomTypeId: pendingBooking.roomTypeId,
      checkIn: pendingBooking.checkIn,
      checkOut: pendingBooking.checkOut,
      guestInfo: pendingBooking.guestInfo,
      extraServiceIds: pendingBooking.extraServiceIds.length
        ? pendingBooking.extraServiceIds
        : undefined,
      promotionCode: pendingBooking.promotionCode,
      paymentMethod: pendingBooking.paymentMethod,
    };
    const booking = await this.bookingService.create(ctx.userId, dto);

    ctx.conversation.pendingBooking = null;
    ctx.conversation.pendingBookingProposedAt = null;
    await this.conversationRepo.save(ctx.conversation);

    const result: Record<string, unknown> = {
      bookingId: booking.bookingId,
      status: booking.status,
      totalAmount: booking.totalAmount,
      paymentMethod: pendingBooking.paymentMethod,
    };

    // Đơn chuyển khoản -> tạo sẵn link/QR PayOS luôn để khách thanh toán ngay trong
    // khung chat, khỏi phải qua lại trang đặt phòng để lấy mã QR riêng. Lỗi ở bước này
    // (VD PayOS tạm gián đoạn) không nên làm hỏng việc booking đã tạo thành công —
    // chỉ log cảnh báo, model vẫn báo đặt phòng thành công và hướng khách thanh toán sau.
    if (pendingBooking.paymentMethod === PaymentMethod.PAYOS) {
      try {
        const link = await this.paymentService.createLinkForBooking(
          booking.bookingId,
          { userId: ctx.userId, role: 'CUSTOMER' },
        );
        result.checkoutUrl = link.checkoutUrl;
        result.qrCode = link.qrCode;
        result.expiredAt = link.expiredAt;
      } catch (err) {
        this.logger.warn(
          `Tạo link thanh toán PayOS thất bại cho booking ${booking.bookingId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return result;
  }

  private isAffirmative(text: string): boolean {
    const normalized = text.toLowerCase().trim();
    if (NEGATION_BEFORE_AFFIRMATIVE.test(normalized)) return false;
    return AFFIRMATIVE_PATTERNS.some((p) => normalized.includes(p));
  }
}
