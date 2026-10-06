import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CompleteRefundRequestDto {
  // Không bắt buộc: admin có thể đánh dấu đã hoàn tiền mà không ghi chú gì thêm, nhưng nên
  // ghi lại số tham chiếu giao dịch chuyển khoản thủ công để tiện tra soát sau này.
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNote?: string;

  // URL ảnh biên lai/QR chuyển khoản (đã upload trước qua POST /refund-requests/attachments)
  // — KHÔNG bắt buộc, không validate định dạng ngoài là string.
  @IsOptional()
  @IsString()
  proofImageUrl?: string;
}
