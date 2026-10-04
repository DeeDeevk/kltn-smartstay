import { IsUUID } from 'class-validator';

// Admin tự gắn/đổi hội thoại chat liên kết với 1 yêu cầu hoàn tiền — dùng khi tạo tự động
// không tìm được hội thoại OPEN nào của khách (xem RefundRequestService.
// createForCancelledBooking), hoặc admin muốn đổi sang đúng hội thoại khác.
export class LinkConversationDto {
  @IsUUID()
  conversationId!: string;
}
