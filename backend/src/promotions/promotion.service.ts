import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Promotion, PromotionConditions } from './entities/promotion.entity';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { QueryPromotionDto } from './dto/query-promotion.dto';
import { DiscountType } from 'src/common/enums/discount-type.enum';
import { PromotionStatus } from 'src/common/enums/promotion-status.enum';
import { RoomTypeService } from 'src/room-types/room-type.service';

// Ngữ cảnh của đơn đang được tính giá — đủ dữ liệu để xét mọi điều kiện trong
// PromotionConditions. Trước đây hàm validate chỉ nhận mỗi tổng tiền nên không thể
// kiểm tra số đêm, số ngày đặt trước hay loại phòng.
export interface PromotionContext {
  roomTypeId: string;
  checkIn: string; // 'YYYY-MM-DD'
  checkOut: string; // 'YYYY-MM-DD' — ngày trả phòng, KHÔNG phải đêm cuối
  roomAmount: number;
  serviceAmount: number;
  // Ngày đặt, mặc định hôm nay. Tách ra để test được và để đơn tạo tại quầy cho
  // ngày khác vẫn tính đúng số ngày đặt trước.
  bookingDate?: string;
}

// Kết quả trả ra ngoài: giống entity nhưng `status` đã được thay bằng trạng thái suy
// ra lúc đọc (có thể là EXPIRED).
export type PromotionView = Omit<Promotion, 'status'> & {
  status: PromotionStatus;
};

function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Nơi gọi có thể đưa vào 'YYYY-MM-DD' (form admin) hoặc chuỗi ISO đầy đủ
// ('2026-11-23T17:00:00.000Z' — DatePicker ở frontend gửi startDate.toISOString()).
// Quy hết về 'YYYY-MM-DD' TRƯỚC khi đụng tới diffDays/addDays, vì hai hàm đó tự ghép
// thêm 'T00:00:00Z' nên gặp chuỗi ISO đầy đủ sẽ tạo ra Date không hợp lệ và ném
// RangeError: Invalid time value.
//
// Quy đổi theo đúng cách BookingService.getStayDates() làm (new Date(...) rồi lấy 10
// ký tự đầu của ISO) để số đêm tính ở đây khớp tuyệt đối với số đêm lưu của đơn —
// dùng cách khác sẽ có lúc lệch 1 ngày so với booking.
function toDateKey(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`Ngày không hợp lệ: ${value}`);
  }
  return parsed.toISOString().slice(0, 10);
}

// Dùng mốc UTC để phép trừ không bị lệch 1 ngày vào các mốc đổi giờ.
function diffDays(fromKey: string, toKey: string): number {
  const from = Date.parse(`${fromKey}T00:00:00Z`);
  const to = Date.parse(`${toKey}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

function addDays(key: string, amount: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}

function formatDate(key: string): string {
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

function formatVnd(amount: number): string {
  return `${amount.toLocaleString('vi-VN')}đ`;
}

@Injectable()
export class PromotionService {
  constructor(
    @InjectRepository(Promotion)
    private readonly promotionRepo: Repository<Promotion>,
    // Cùng bounded context "Đặt phòng" (ReservationsModule) nên gọi thẳng service này
    // được — dùng để tự tính tiền phòng khi khách kiểm tra mã trước lúc đặt.
    private readonly roomTypeService: RoomTypeService,
  ) {}

  // ------------------------------------------------------------------
  // Đọc
  // ------------------------------------------------------------------

  // Lọc ACTIVE ở tầng ứng dụng thay vì trong SQL, để trạng thái trả ra luôn khớp với
  // trạng thái suy ra ở effectiveStatus() — chỉ có một chỗ định nghĩa "thế nào là còn
  // dùng được". Bảng khuyến mãi rất nhỏ nên không đáng lo về hiệu năng.
  async findAll(query: QueryPromotionDto): Promise<PromotionView[]> {
    const promotions = await this.promotionRepo.find({
      order: { createdAt: 'DESC' },
    });
    const views = promotions.map((p) => this.toView(p));
    if (!query.active) return views;
    return views.filter((p) => p.status === PromotionStatus.ACTIVE);
  }

  async findByIdForAdmin(promotionId: string): Promise<Promotion> {
    const promotion = await this.promotionRepo.findOne({
      where: { promotionId },
    });
    if (!promotion) {
      throw new NotFoundException('Không tìm thấy mã khuyến mãi');
    }
    return promotion;
  }

  // ------------------------------------------------------------------
  // Áp dụng mã
  // ------------------------------------------------------------------

  // Kiểm tra mã theo ngữ cảnh đơn và trả về số tiền được giảm. Ném lỗi với thông báo
  // CỤ THỂ cho từng điều kiện không thoả, để khách biết phải làm gì (ở thêm 1 đêm,
  // đổi loại phòng...) thay vì chỉ thấy "mã không hợp lệ".
  async validateCode(code: string, ctx: PromotionContext) {
    const promotion = await this.promotionRepo.findOne({
      where: { code: this.normalizeCode(code) },
    });
    if (!promotion) {
      throw new NotFoundException('Mã khuyến mãi không tồn tại');
    }

    // Chuẩn hoá ngày ngay tại cửa ngõ: cả BookingService lẫn controller đều truyền
    // thẳng chuỗi ngày của client vào đây, không nơi nào bảo đảm sẵn định dạng.
    const normalized: PromotionContext = {
      ...ctx,
      checkIn: toDateKey(ctx.checkIn),
      checkOut: toDateKey(ctx.checkOut),
      bookingDate: ctx.bookingDate ? toDateKey(ctx.bookingDate) : undefined,
    };

    this.assertApplicable(promotion, normalized);
    const discountAmount = this.calcDiscount(promotion, normalized.roomAmount);

    return { valid: true, discountAmount, promotion: this.toView(promotion) };
  }

  // Bản dùng cho khách kiểm tra mã TRƯỚC khi đặt: tự tính tiền phòng từ loại phòng và
  // số đêm nên không tin số tiền client gửi lên.
  async previewCode(
    code: string,
    input: {
      roomTypeId: string;
      checkIn: string;
      checkOut: string;
      serviceAmount?: number;
    },
  ) {
    const checkIn = toDateKey(input.checkIn);
    const checkOut = toDateKey(input.checkOut);
    const nights = diffDays(checkIn, checkOut);
    if (nights <= 0) {
      throw new BadRequestException('Ngày trả phòng phải sau ngày nhận phòng');
    }
    const roomType = await this.roomTypeService.findActiveById(
      input.roomTypeId,
    );

    return this.validateCode(code, {
      roomTypeId: input.roomTypeId,
      checkIn,
      checkOut,
      roomAmount: roomType.basePrice * nights,
      serviceAmount: input.serviceAmount ?? 0,
    });
  }

  async incrementUsage(promotionId: string): Promise<void> {
    await this.promotionRepo.increment({ promotionId }, 'usedCount', 1);
  }

  // ------------------------------------------------------------------
  // CRUD cho admin
  // ------------------------------------------------------------------

  async create(dto: CreatePromotionDto): Promise<PromotionView> {
    this.assertValidDates(dto.startDate, dto.endDate);
    this.assertValidDiscount(dto.discountType, dto.discountValue);
    this.assertValidConditions(dto.conditions);

    const code = this.normalizeCode(dto.code);
    const existed = await this.promotionRepo.findOne({ where: { code } });
    if (existed) {
      throw new ConflictException('Mã khuyến mãi đã tồn tại');
    }

    const promotion = this.promotionRepo.create({
      ...dto,
      code,
      maxUsage: dto.maxUsage ?? null,
      conditions: this.cleanConditions(dto.conditions),
      status: PromotionStatus.ACTIVE,
    });
    return this.toView(await this.promotionRepo.save(promotion));
  }

  async update(
    promotionId: string,
    dto: UpdatePromotionDto,
  ): Promise<PromotionView> {
    const promotion = await this.findByIdForAdmin(promotionId);

    this.assertValidDiscount(
      dto.discountType ?? promotion.discountType,
      dto.discountValue ?? promotion.discountValue,
    );
    this.assertValidDates(
      dto.startDate ?? promotion.startDate,
      dto.endDate ?? promotion.endDate,
    );
    if (dto.conditions !== undefined) {
      this.assertValidConditions(dto.conditions);
    }

    Object.assign(promotion, dto);
    // `conditions: null` từ client nghĩa là xoá hết điều kiện; Object.assign ở trên đã
    // gán null, chỉ cần dọn lại các khoá rỗng khi client gửi object.
    if (dto.conditions) {
      promotion.conditions = this.cleanConditions(dto.conditions);
    }
    return this.toView(await this.promotionRepo.save(promotion));
  }

  // Bật/tắt nhanh từ danh sách. Không đụng tới EXPIRED: mã đã hết hạn thì bật lại cũng
  // vẫn hết hạn cho tới khi admin sửa endDate.
  async toggle(promotionId: string): Promise<PromotionView> {
    const promotion = await this.findByIdForAdmin(promotionId);
    promotion.status =
      promotion.status === PromotionStatus.ACTIVE
        ? PromotionStatus.PAUSED
        : PromotionStatus.ACTIVE;
    return this.toView(await this.promotionRepo.save(promotion));
  }

  async remove(promotionId: string): Promise<{ message: string }> {
    const promotion = await this.findByIdForAdmin(promotionId);
    if (promotion.usedCount > 0) {
      throw new ConflictException(
        'Mã khuyến mãi đã được sử dụng trong booking, không thể xoá',
      );
    }
    await this.promotionRepo.remove(promotion);
    return { message: 'Đã xoá mã khuyến mãi' };
  }

  // ------------------------------------------------------------------
  // Nội bộ
  // ------------------------------------------------------------------

  private normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  // Số tiền giảm CHỈ tính trên tiền phòng, và không bao giờ vượt quá tiền phòng.
  // Lý do: công thức tính đơn là `netRoomAmount = roomAmount + phụ thu - discountAmount`
  // rồi mới nhân VAT. Nếu để số giảm lớn hơn tiền phòng (vd. mã giảm 500k áp lên đơn
  // phòng 300k + dịch vụ 400k) thì netRoomAmount âm -> VAT âm và doanh thu âm theo.
  private calcDiscount(promotion: Promotion, roomAmount: number): number {
    const raw =
      promotion.discountType === DiscountType.PERCENTAGE
        ? Math.floor((roomAmount * promotion.discountValue) / 100)
        : promotion.discountValue;
    return Math.min(raw, roomAmount);
  }

  private assertApplicable(promotion: Promotion, ctx: PromotionContext): void {
    const bookingDate = ctx.bookingDate ?? todayKey();

    if (promotion.status === PromotionStatus.PAUSED) {
      throw new BadRequestException('Mã khuyến mãi đang tạm ngưng');
    }
    if (bookingDate < promotion.startDate) {
      throw new BadRequestException(
        `Mã khuyến mãi chỉ có hiệu lực từ ngày ${formatDate(promotion.startDate)}`,
      );
    }
    if (bookingDate > promotion.endDate) {
      throw new BadRequestException('Mã khuyến mãi đã hết hạn');
    }
    if (promotion.maxUsage !== null && promotion.usedCount >= promotion.maxUsage) {
      throw new BadRequestException('Mã khuyến mãi đã hết lượt sử dụng');
    }

    const conditions = promotion.conditions;
    if (!conditions) return;

    const nights = diffDays(ctx.checkIn, ctx.checkOut);
    if (conditions.minNights && nights < conditions.minNights) {
      throw new BadRequestException(
        `Mã này chỉ áp dụng cho đơn từ ${conditions.minNights} đêm trở lên`,
      );
    }

    const advanceDays = diffDays(bookingDate, ctx.checkIn);
    if (
      conditions.minAdvanceDays !== undefined &&
      advanceDays < conditions.minAdvanceDays
    ) {
      throw new BadRequestException(
        `Mã này chỉ áp dụng khi đặt trước ngày nhận phòng ít nhất ${conditions.minAdvanceDays} ngày`,
      );
    }
    if (
      conditions.maxAdvanceDays !== undefined &&
      advanceDays > conditions.maxAdvanceDays
    ) {
      throw new BadRequestException(
        `Mã này chỉ áp dụng khi đặt trong vòng ${conditions.maxAdvanceDays} ngày trước ngày nhận phòng`,
      );
    }

    if (
      conditions.minAmount &&
      ctx.roomAmount + ctx.serviceAmount < conditions.minAmount
    ) {
      throw new BadRequestException(
        `Mã này chỉ áp dụng cho đơn từ ${formatVnd(conditions.minAmount)} trở lên`,
      );
    }

    if (
      conditions.roomTypeIds?.length &&
      !conditions.roomTypeIds.includes(ctx.roomTypeId)
    ) {
      throw new BadRequestException(
        'Mã này không áp dụng cho loại phòng đã chọn',
      );
    }

    // So bằng ĐÊM CUỐI (= ngày trả phòng trừ 1), không phải ngày trả phòng: khách trả
    // phòng sáng 21/02 thì đêm cuối là 20/02, vẫn nằm trong kỳ khuyến mãi kết thúc 20/02.
    const lastNight = addDays(ctx.checkOut, -1);
    if (conditions.stayFrom && ctx.checkIn < conditions.stayFrom) {
      throw new BadRequestException(
        `Mã này chỉ áp dụng cho kỳ lưu trú từ ${formatDate(conditions.stayFrom)}`,
      );
    }
    if (conditions.stayTo && lastNight > conditions.stayTo) {
      throw new BadRequestException(
        `Mã này chỉ áp dụng cho kỳ lưu trú đến hết ${formatDate(conditions.stayTo)}`,
      );
    }
  }

  private assertValidDates(startDate: string, endDate: string): void {
    if (new Date(startDate) > new Date(endDate)) {
      throw new BadRequestException('Ngày bắt đầu phải trước ngày kết thúc');
    }
  }

  private assertValidDiscount(
    discountType: DiscountType,
    discountValue: number,
  ): void {
    if (discountType === DiscountType.PERCENTAGE && discountValue > 100) {
      throw new BadRequestException(
        'Giá trị giảm giá theo phần trăm không được vượt quá 100',
      );
    }
  }

  private assertValidConditions(
    conditions?: PromotionConditions | null,
  ): void {
    if (!conditions) return;

    const { minAdvanceDays, maxAdvanceDays, stayFrom, stayTo } = conditions;
    if (
      minAdvanceDays !== undefined &&
      maxAdvanceDays !== undefined &&
      minAdvanceDays > maxAdvanceDays
    ) {
      throw new BadRequestException(
        'Số ngày đặt trước tối thiểu phải nhỏ hơn hoặc bằng số ngày tối đa',
      );
    }
    if (stayFrom && stayTo && stayFrom > stayTo) {
      throw new BadRequestException(
        'Kỳ lưu trú áp dụng: ngày bắt đầu phải trước ngày kết thúc',
      );
    }
  }

  // Bỏ các khoá không được khai báo để cột JSON chỉ chứa đúng điều kiện có ý nghĩa —
  // form ở admin luôn gửi đủ mọi ô, ô trống về undefined. Không còn điều kiện nào thì
  // lưu null cho gọn.
  private cleanConditions(
    conditions?: PromotionConditions | null,
  ): PromotionConditions | null {
    if (!conditions) return null;
    const cleaned: PromotionConditions = {};
    if (conditions.minNights) cleaned.minNights = conditions.minNights;
    if (conditions.minAdvanceDays) {
      cleaned.minAdvanceDays = conditions.minAdvanceDays;
    }
    if (conditions.maxAdvanceDays !== undefined) {
      cleaned.maxAdvanceDays = conditions.maxAdvanceDays;
    }
    if (conditions.minAmount) cleaned.minAmount = conditions.minAmount;
    if (conditions.roomTypeIds?.length) {
      cleaned.roomTypeIds = conditions.roomTypeIds;
    }
    if (conditions.stayFrom) cleaned.stayFrom = conditions.stayFrom;
    if (conditions.stayTo) cleaned.stayTo = conditions.stayTo;
    return Object.keys(cleaned).length > 0 ? cleaned : null;
  }

  // Gắn trạng thái suy ra lúc đọc. Cột trong DB chỉ có ACTIVE/PAUSED; EXPIRED tính ở
  // đây để danh sách của admin và điều kiện áp mã luôn nói cùng một chuyện.
  private toView(promotion: Promotion): PromotionView {
    return { ...promotion, status: this.effectiveStatus(promotion) };
  }

  private effectiveStatus(promotion: Promotion): PromotionStatus {
    if (promotion.status === PromotionStatus.PAUSED) {
      return PromotionStatus.PAUSED;
    }
    // Hết lượt dùng cũng coi là EXPIRED: diagram chỉ có 3 trạng thái, và với người dùng
    // thì "hết lượt" và "hết hạn" đều là không dùng được nữa. Danh sách ở admin vẫn hiện
    // số lượt đã dùng nên phân biệt được lý do.
    const isUsedUp =
      promotion.maxUsage !== null && promotion.usedCount >= promotion.maxUsage;
    if (promotion.endDate < todayKey() || isUsedUp) {
      return PromotionStatus.EXPIRED;
    }
    return PromotionStatus.ACTIVE;
  }
}
