import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

// Phải có ĐÚNG MỘT trong 2 trường url/text — kiểm tra ở LocalEventExtractionService (không
// dùng decorator class-validator ở đây) để khớp đúng pattern có sẵn của codebase là xử lý
// quy tắc nghiệp vụ liên-trường ở tầng service (xem
// LocalEventService.assertRecurrenceFields) thay vì viết riêng 1 class validator.
export class ExtractLocalEventsDto {
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url?: string;

  // Giới hạn khớp với LocalEventExtractionService.MAX_CONTENT_LENGTH — nhận nhiều hơn
  // cũng vô nghĩa vì đó là phần thực sự được gửi cho Gemini.
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  text?: string;
}
