import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { BookingStatus } from 'src/common/enums/booking-status.enum';

export class QueryBookingDto {
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  // Danh sách trạng thái (CSV) — dùng khi cần lọc nhiều trạng thái cùng lúc,
  // vd tab "Lịch đặt" gộp cả PENDING lẫn CONFIRMED.
  @IsOptional()
  @IsString()
  @MaxLength(120)
  statuses?: string;

  // Lọc lịch sử check-in/check-out theo 1 phòng vật lý cụ thể.
  @IsOptional()
  @IsUUID()
  roomId?: string;

  // Trang chi tiết phòng: trả về đơn ĐÃ gán phòng này + đơn cùng loại phòng
  // CHƯA gán phòng nào (PENDING/CONFIRMED) để lễ tân nhận phòng thẳng vào đây.
  @IsOptional()
  @IsUUID()
  assignableRoomId?: string;

  // Tìm nhanh theo mã đơn (8 ký tự đầu), tên khách hoặc email trong guestInfo.
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsDateString()
  checkIn?: string;

  @IsOptional()
  @IsDateString()
  checkOut?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}
