import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CompleteRefundRequestDto {
  // Không bắt buộc: admin có thể đánh dấu đã hoàn tiền mà không ghi chú gì thêm, nhưng nên
  // ghi lại số tham chiếu giao dịch chuyển khoản thủ công để tiện tra soát sau này.
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNote?: string;

  // URL ảnh biên lai/QR chuyển khoản (đã upload trước qua POST /refund-requests/attachments)
  // — BẮT BUỘC (trước đây optional, đổi theo yêu cầu mới: mọi lần đánh dấu hoàn tiền phải
  // có bằng chứng ảnh). Chỉ validate ở tầng ứng dụng, KHÔNG đổi cột DB (vẫn nullable) để
  // không phá dữ liệu COMPLETED cũ chưa có ảnh.
  @IsNotEmpty({ message: 'Vui lòng đính kèm ảnh biên lai trước khi xác nhận' })
  @IsString()
  proofImageUrl!: string;
}
