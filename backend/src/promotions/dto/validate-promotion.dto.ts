import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

// Khách kiểm tra mã TRƯỚC khi bấm đặt phòng. Không nhận `bookingAmount` do client gửi
// nữa: tiền phòng được tính lại ở server từ loại phòng + số đêm, nên client không thể
// khai khống số tiền để qua mặt điều kiện "đơn tối thiểu".
export class ValidatePromotionDto {
  @IsUUID()
  roomTypeId!: string;

  @IsDateString()
  checkIn!: string;

  @IsDateString()
  checkOut!: string;

  // Tiền dịch vụ đi kèm khách đang chọn — chỉ dùng để xét điều kiện "đơn tối thiểu",
  // không được giảm giá (giảm giá chỉ áp trên tiền phòng).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  serviceAmount?: number;
}
