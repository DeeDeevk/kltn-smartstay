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
import { RealtimeGateway } from '../realtime/realtime.gateway';

// Gắn vào cùng namespace mặc định với RealtimeGateway (không khai `namespace`) nên
// dùng chung 1 kết nối socket phía FE và chung `client.data.user` mà
// RealtimeGateway.handleConnection đã xác thực/gán — không xác thực lại ở đây.
// Việc bắn sự kiện tới nhóm "lễ tân trực chat" vẫn đi qua RealtimeGateway (xem
// emitToChatStaff) thay vì ChatModule tự biết tên room — giữ đúng ranh giới module.
@WebSocketGateway({ cors: true })
export class ChatGateway {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  private requireUser(client: Socket) {
    const user = client.data.user;
    if (!user) {
      throw new WsException('Chưa xác thực');
    }
    return user as { userId: string; email: string; role: string };
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
    @MessageBody() body: { conversationId: string; content: string },
  ) {
    const user = this.requireUser(client);
    const conversation = await this.chatService.findConversationById(
      body.conversationId,
    );
    this.chatService.assertCanAccess(conversation, user);

    const message = await this.chatService.saveMessage(
      body.conversationId,
      user.userId,
      body.content,
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
