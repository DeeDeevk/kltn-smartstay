import { IsOptional, IsUUID } from 'class-validator';

export class QueryReviewDto {
  // Lọc theo loại phòng (suy qua booking.roomType). Bỏ trống = lấy tất cả.
  @IsOptional()
  @IsUUID()
  roomTypeId?: string;
}
