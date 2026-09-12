import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from 'src/common/enums/payment-method.enum';

class WalkInGuestInfoDto {
  @IsString()
  @MaxLength(120)
  fullName!: string;

  @IsString()
  @MaxLength(20)
  phone!: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

// Lễ tân đặt phòng hộ khách vãng lai ngay tại quầy cho 1 phòng vật lý cụ thể.
// Khác CreateBookingDto (khách tự đặt theo loại phòng): ở đây chọn thẳng roomId,
// đơn được tạo ở trạng thái CONFIRMED và đã gán phòng.
export class CreateWalkInBookingDto {
  @IsUUID()
  roomId!: string;

  @IsDateString()
  checkIn!: string;

  @IsDateString()
  checkOut!: string;

  @ValidateNested()
  @Type(() => WalkInGuestInfoDto)
  guestInfo!: WalkInGuestInfoDto;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  extraServiceIds?: string[];

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}
