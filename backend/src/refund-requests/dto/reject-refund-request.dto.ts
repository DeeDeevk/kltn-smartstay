import { IsString, MaxLength, MinLength } from 'class-validator';

export class RejectRefundRequestDto {
  // Bắt buộc khác với complete() — khách cần biết vì sao yêu cầu hoàn tiền của họ bị từ
  // chối, không thể chỉ im lặng đổi trạng thái.
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  adminNote!: string;
}
