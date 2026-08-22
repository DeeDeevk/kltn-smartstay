import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class ValidatePromotionDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bookingAmount!: number;
}
