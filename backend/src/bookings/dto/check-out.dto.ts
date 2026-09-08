import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from 'src/common/enums/payment-method.enum';

class CheckoutServiceItemDto {
  @IsUUID()
  serviceId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

// Body cho POST /bookings/:id/check-out. Tất cả đều tuỳ chọn: không truyền gì = trả
// phòng đơn thuần (giữ hành vi cũ).
export class CheckOutDto {
  // Dịch vụ / minibar khách tiêu dùng thêm, ghi nhận ngay khi trả phòng.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutServiceItemDto)
  extraServices?: CheckoutServiceItemDto[];

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  // true = ghi nhận khách đã thanh toán đủ phần còn lại tại quầy khi trả phòng.
  @IsOptional()
  @IsBoolean()
  markPaid?: boolean;
}
