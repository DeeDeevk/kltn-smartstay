import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class QueryRoomMapDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  floorId?: number;
}
