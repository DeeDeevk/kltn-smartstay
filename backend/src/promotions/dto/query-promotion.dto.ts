import { Transform } from 'class-transformer';
import { IsOptional } from 'class-validator';

export class QueryPromotionDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  active?: boolean;
}
