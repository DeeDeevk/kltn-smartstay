import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// Mọi trường đều optional — dùng chung cho 2 việc: admin sửa 1 dòng đã APPROVED, VÀ admin
// bổ sung address/latitude/longitude cho 1 dòng AI đề xuất đang PENDING (qua ô Vietmap
// Autocomplete trong card "Chờ duyệt") trước khi bấm duyệt riêng.
export class UpdateLocalPlaceDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
