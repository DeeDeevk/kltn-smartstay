import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// Tạo thủ công qua form CRUD admin luôn là status=APPROVED ngay (xem LocalPlace entity) —
// nên bắt buộc đủ địa chỉ/toạ độ ngay từ lúc tạo, khác với luồng AI trích xuất (address/
// latitude/longitude để null, chờ admin bổ sung rồi mới duyệt).
export class CreateLocalPlaceDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @MaxLength(255)
  address!: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;
}
