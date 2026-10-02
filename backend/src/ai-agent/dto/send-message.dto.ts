import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class SendMessageDto {
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;

  // Chỉ gửi khi khách bấm nút "Xác nhận" trên thẻ đề xuất đặt phòng — là proposalId
  // của đúng bản đề xuất đó. Có trường này thì create_booking không phải đoán ý khách
  // qua câu chữ nữa.
  @IsOptional()
  @IsUUID()
  confirmProposalId?: string;
}
