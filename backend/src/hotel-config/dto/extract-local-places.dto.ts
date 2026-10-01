import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

// Cùng khuôn dạng với ExtractLocalEventsDto (đúng MỘT trong 2 trường url/text, kiểm tra ở
// tầng service) — tách DTO riêng theo đúng domain LocalPlace thay vì dùng chung 1 DTO đặt
// tên theo LocalEvent cho 2 tính năng khác nhau, dù phần khai báo field giống nhau.
export class ExtractLocalPlacesDto {
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url?: string;

  // Giới hạn khớp với LocalPlaceExtractionService.MAX_CONTENT_LENGTH.
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  text?: string;
}
