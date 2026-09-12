import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/role.decorator';
import { UserRole } from '../common/enums/user-role.enum';

interface AuthenticatedRequest extends Request {
  user: { userId: string; email: string; role: string };
}

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // Khách hàng: lấy hội thoại đang mở của mình, tạo mới nếu chưa có.
  @Post('conversations')
  getOrCreateOwn(@Req() req: AuthenticatedRequest) {
    return this.chatService.getOrCreateOwnConversation(req.user.userId);
  }

  // Lễ tân: danh sách hội thoại đang mở để chọn trả lời (Admin không tham gia chat).
  @Get('conversations')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STAFF)
  listOpen() {
    return this.chatService.listOpenConversations();
  }

  @Get('conversations/:id/messages')
  async getMessages(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const conversation = await this.chatService.findConversationById(id);
    this.chatService.assertCanAccess(conversation, req.user);
    return this.chatService.getMessages(id);
  }
}
