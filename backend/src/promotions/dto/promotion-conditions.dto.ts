import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

// Bản kiểm tra dữ liệu (class-validator) của PromotionConditions trong entity. Mọi
// trường đều tuỳ chọn — bỏ trống nghĩa là không ràng buộc theo tiêu chí đó.
export class PromotionConditionsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  minNights?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  minAdvanceDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  maxAdvanceDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minAmount?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  roomTypeIds?: string[];

  @IsOptional()
  @IsDateString()
  stayFrom?: string;

  @IsOptional()
  @IsDateString()
  stayTo?: string;
}
