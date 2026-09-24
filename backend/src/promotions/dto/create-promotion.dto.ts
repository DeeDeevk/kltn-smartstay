import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { DiscountType } from 'src/common/enums/discount-type.enum';
import { PromotionConditionsDto } from './promotion-conditions.dto';

export class CreatePromotionDto {
  // Mã khách gõ vào ô "Mã khuyến mãi" — chỉ cho chữ/số/gạch nối để khỏi lẫn dấu cách
  // hay ký tự khó gõ trên điện thoại. Service tự chuyển thành CHỮ HOA.
  @IsString()
  @Length(3, 30)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Mã khuyến mãi chỉ gồm chữ, số, dấu gạch ngang hoặc gạch dưới',
  })
  code!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(DiscountType)
  discountType!: DiscountType;

  @IsInt()
  @Min(1)
  discountValue!: number;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsage?: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PromotionConditionsDto)
  conditions?: PromotionConditionsDto;
}
