import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Promotion } from './entities/promotion.entity';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { QueryPromotionDto } from './dto/query-promotion.dto';
import { DiscountType } from 'src/common/enums/discount-type.enum';

@Injectable()
export class PromotionService {
  constructor(
    @InjectRepository(Promotion)
    private readonly promotionRepo: Repository<Promotion>,
  ) {}

  async findAll(query: QueryPromotionDto): Promise<Promotion[]> {
    if (!query.active) {
      return this.promotionRepo.find({ order: { createdAt: 'DESC' } });
    }

    const today = new Date().toISOString().slice(0, 10);
    return this.promotionRepo
      .createQueryBuilder('promotion')
      .where('promotion.isActive = true')
      .andWhere('promotion.startDate <= :today', { today })
      .andWhere('promotion.endDate >= :today', { today })
      .orderBy('promotion.createdAt', 'DESC')
      .getMany();
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

  async validateCode(code: string, bookingAmount: number) {
    const promotion = await this.promotionRepo.findOne({ where: { code } });
    if (!promotion) {
      throw new NotFoundException('Mã khuyến mãi không tồn tại');
    }

    const today = new Date().toISOString().slice(0, 10);
    const isWithinDateRange =
      promotion.startDate <= today && promotion.endDate >= today;
    const isUnderUsageLimit =
      promotion.usageLimit === null ||
      promotion.usedCount < promotion.usageLimit;

    if (!promotion.isActive || !isWithinDateRange || !isUnderUsageLimit) {
      throw new BadRequestException(
        'Mã khuyến mãi đã hết hạn hoặc không đủ điều kiện áp dụng',
      );
    }

    const discountAmount =
      promotion.discountType === DiscountType.PERCENTAGE
        ? Math.floor((bookingAmount * promotion.discountValue) / 100)
        : Math.min(promotion.discountValue, bookingAmount);

    return { valid: true, discountAmount, promotion };
  }

  private assertValidDiscount(
    discountType: DiscountType,
    discountValue: number,
  ) {
    if (discountType === DiscountType.PERCENTAGE && discountValue > 100) {
      throw new BadRequestException(
        'Giá trị giảm giá theo phần trăm không được vượt quá 100',
      );
    }
  }

  async create(dto: CreatePromotionDto): Promise<Promotion> {
    if (new Date(dto.startDate) >= new Date(dto.endDate)) {
      throw new BadRequestException('Ngày bắt đầu phải trước ngày kết thúc');
    }
    this.assertValidDiscount(dto.discountType, dto.discountValue);

    const existed = await this.promotionRepo.findOne({
      where: { code: dto.code },
    });
    if (existed) {
      throw new ConflictException('Mã khuyến mãi đã tồn tại');
    }

    const promotion = this.promotionRepo.create({
      ...dto,
      usageLimit: dto.usageLimit ?? null,
    });
    return this.promotionRepo.save(promotion);
  }

  async update(
    promotionId: string,
    dto: UpdatePromotionDto,
  ): Promise<Promotion> {
    const promotion = await this.findByIdForAdmin(promotionId);

    const nextDiscountType = dto.discountType ?? promotion.discountType;
    const nextDiscountValue = dto.discountValue ?? promotion.discountValue;
    this.assertValidDiscount(nextDiscountType, nextDiscountValue);

    const nextStartDate = dto.startDate ?? promotion.startDate;
    const nextEndDate = dto.endDate ?? promotion.endDate;
    if (new Date(nextStartDate) >= new Date(nextEndDate)) {
      throw new BadRequestException('Ngày bắt đầu phải trước ngày kết thúc');
    }

    Object.assign(promotion, dto);
    return this.promotionRepo.save(promotion);
  }

  async toggle(promotionId: string): Promise<Promotion> {
    const promotion = await this.findByIdForAdmin(promotionId);
    promotion.isActive = !promotion.isActive;
    return this.promotionRepo.save(promotion);
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
}
