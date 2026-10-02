import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { DiscountType } from 'src/common/enums/discount-type.enum';
import { PromotionStatus } from 'src/common/enums/promotion-status.enum';
import { PromotionConditionsDto } from './promotion-conditions.dto';

export class UpdatePromotionDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(DiscountType)
  discountType?: DiscountType;

  @IsOptional()
  @IsInt()
  @Min(1)
  discountValue?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  // null = bỏ giới hạn số lượt dùng (@IsOptional bỏ qua kiểm tra khi giá trị là null).
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsage?: number | null;

  // null = xoá hết điều kiện, mã áp cho mọi đơn.
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PromotionConditionsDto)
  conditions?: PromotionConditionsDto | null;

  // Chỉ nhận 2 giá trị admin được phép đặt — EXPIRED là trạng thái suy ra lúc đọc,
  // không cho ghi thẳng vào DB.
  @IsOptional()
  @IsIn([PromotionStatus.ACTIVE, PromotionStatus.PAUSED])
  status?: PromotionStatus.ACTIVE | PromotionStatus.PAUSED;
}
