import { IsInt, Min } from 'class-validator';

export class CheckoutLinkDto {
  // Số tiền còn phải thu (VND) — do màn Check-out tính, gồm cả dịch vụ vừa chọn.
  @IsInt()
  @Min(1)
  amount!: number;
}
