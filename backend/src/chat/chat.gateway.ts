import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { UserRole } from '../common/enums/user-role.enum';
import { MessageAttachmentType } from '../common/enums/message-attachment-type.enum';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { WsUser } from '../realtime/ws-auth.service';
import { UploadService } from '../uploads/upload.service';

// Giới hạn chiều dài tối đa chấp nhận cho 1 URL đính kèm — chỉ để chặn payload rác/quá
// khổ gửi qua socket, không phải giới hạn nghiệp vụ.
const MAX_ATTACHMENT_URL_LENGTH = 2048;

// Gắn vào cùng namespace mặc định với RealtimeGateway (không khai `namespace`) nên
// dùng chung 1 kết nối socket phía FE và chung `client.data.user` mà
// RealtimeGateway.handleConnection đã xác thực/gán — không xác thực lại ở đây.
// Việc bắn sự kiện tới nhóm "lễ tân trực chat" vẫn đi qua RealtimeGateway (xem
// emitToChatStaff) thay vì ChatModule tự biết tên room — giữ đúng ranh giới module.
@WebSocketGateway()
export class ChatGateway {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly uploadService: UploadService,
  ) {}

  // body.attachmentUrl đi thẳng từ payload socket do client gửi lên, không qua DTO/
  // ValidationPipe như REST — nếu tin thẳng giá trị này thì một client tự viết (không
  // phải FE gốc) có thể gửi content rỗng + attachmentUrl tuỳ ý để lách hoàn toàn whitelist
  // loại file/giới hạn 5MB mà ChatController.uploadAttachment() áp dụng. Chỉ chấp nhận URL
  // thực sự nằm trong đúng bucket R2 công khai của hệ thống (nghĩa là bắt buộc phải đi qua
  // POST /chat/attachments trước), kèm attachmentType hợp lệ.
  private sanitizeAttachment(
    attachmentUrl?: string,
    attachmentType?: MessageAttachmentType,
  ): { attachmentUrl: string | null; attachmentType: MessageAttachmentType | null } {
    if (!attachmentUrl) return { attachmentUrl: null, attachmentType: null };
    const validType = Object.values(MessageAttachmentType).includes(
      attachmentType as MessageAttachmentType,
    );
    const validUrl =
      typeof attachmentUrl === 'string' &&
      attachmentUrl.length <= MAX_ATTACHMENT_URL_LENGTH &&
      attachmentUrl.startsWith(this.uploadService.getPublicBaseUrl());
    if (!validType || !validUrl) {
      throw new WsException('Ảnh đính kèm không hợp lệ');
    }
    return { attachmentUrl, attachmentType: attachmentType ?? null };
  }

  private requireUser(client: Socket) {
    // client.data là `any` (Socket ở đây không tham số hoá kiểu data) — ép kiểu chính
    // client.data trước khi đọc .user, giống cách RealtimeGateway.handleConnection gán nó.
    const user = (client.data as { user?: WsUser }).user;
    if (!user) {
      throw new WsException('Chưa xác thực');
    }
    return user;
  }

  @SubscribeMessage('chat:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string },
  ) {
    const user = this.requireUser(client);
    const conversation = await this.chatService.findConversationById(
      body.conversationId,
    );
    this.chatService.assertCanAccess(conversation, user);
    await client.join(`conversation:${body.conversationId}`);
  }

  @SubscribeMessage('chat:message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: {
      conversationId: string;
      content: string;
      attachmentUrl?: string;
      attachmentType?: MessageAttachmentType;
    },
  ) {
    const user = this.requireUser(client);
    const conversation = await this.chatService.findConversationById(
      body.conversationId,
    );
    this.chatService.assertCanAccess(conversation, user);

    const { attachmentUrl, attachmentType } = this.sanitizeAttachment(
      body.attachmentUrl,
      body.attachmentType,
    );
    const message = await this.chatService.saveMessage(
      body.conversationId,
      user.userId,
      body.content,
      attachmentUrl,
      attachmentType,
    );

    this.server
      .to(`conversation:${body.conversationId}`)
      .emit(
        'chat:message',
        this.chatService.toMessageResponse(body.conversationId, message),
      );

    // Hội thoại chưa có lễ tân nào nhận -> báo cho mọi lễ tân (STAFF) online biết có
    // khách đang chờ. Admin không có trang trả lời chat nên không nhận thông báo này.
    if (!conversation.staff && user.role === UserRole.CUSTOMER) {
      this.realtimeGateway.emitToChatStaff('chat:new-conversation', {
        conversationId: body.conversationId,
        customerName: conversation.customer.fullName,
      });
    }
  }
}
