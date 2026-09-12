import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class QueryRoomMapDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  floorId?: number;

  @IsOptional()
  @IsUUID()
  roomTypeId?: string;

  // Khi truyền đủ cả 2, sơ đồ phòng sẽ đối chiếu lịch đặt trong khoảng ngày này
  // để đánh dấu phòng đã có booking đè lịch (rangeStatus = 'BOOKED').
  @IsOptional()
  @IsDateString()
  checkIn?: string;

  @IsOptional()
  @IsDateString()
  checkOut?: string;
}
