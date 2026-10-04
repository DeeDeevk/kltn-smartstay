import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseFilePipeBuilder,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ChatService } from './chat.service';
import { UploadService } from '../uploads/upload.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/role.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { MessageAttachmentType } from '../common/enums/message-attachment-type.enum';

interface AuthenticatedRequest extends Request {
  user: { userId: string; email: string; role: string };
}

// Ảnh chat lưu riêng khỏi "room-types" (xem UploadService.uploadImage keyPrefix).
const CHAT_ATTACHMENT_KEY_PREFIX = 'vikahotel/chat';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly uploadService: UploadService,
  ) {}

  // Khách HOẶC lễ tân chọn ảnh -> upload trước lấy URL (cùng pattern ảnh phòng), rồi FE tự
  // gửi tin nhắn kèm attachmentUrl qua socket 'chat:message' — ảnh không gửi trực tiếp qua
  // socket vì multipart cần HTTP. Không giới hạn @Roles: JwtAuthGuard ở class-level đã đủ,
  // CUSTOMER và STAFF đều phải gửi được (khác POST /uploads/image vốn ADMIN-only).
  @Post('attachments')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadAttachment(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ })
        .addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    file: Express.Multer.File,
  ) {
    const result = await this.uploadService.uploadImage(
      file,
      CHAT_ATTACHMENT_KEY_PREFIX,
    );
    return { url: result.url, type: MessageAttachmentType.IMAGE };
  }

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
  async getMessages(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const conversation = await this.chatService.findConversationById(id);
    this.chatService.assertCanAccess(conversation, req.user);
    return this.chatService.getMessages(id);
  }
}
