import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UserRole } from '../common/enums/user-role.enum';
import { WsAuthService } from './ws-auth.service';

// Tên room là chi tiết triển khai nội bộ của RealtimeGateway — các module khác
// (Reservations, Chat) không import trực tiếp các hằng số này, chỉ gọi qua các
// hàm emitXxx()/emitToXxx() public bên dưới, để RealtimeModule là nơi duy nhất
// biết "ai đang ở room nào" (đúng ranh giới module trong modular monolith).

// Room chứa mọi socket của nhân viên/quản trị đang online — Sơ đồ phòng và các
// thông báo đặt phòng/thanh toán chỉ cần bắn vào đây, không cần biết từng userId.
const STAFF_ROOM = 'staff';

// Chat với khách chỉ dành cho lễ tân (STAFF) — Admin không có trang trả lời chat
// nên không cần nhận thông báo "khách mới nhắn".
const CHAT_STAFF_ROOM = 'chat-staff';

// Room riêng cho từng user — mọi socket đã xác thực (không phân biệt role) đều
// join room này của chính họ khi connect.
const userRoom = (userId: string) => `user:${userId}`;

// Namespace mặc định ('/'): ChatGateway cũng gắn vào cùng namespace này nên dùng
// chung 1 kết nối socket phía FE và chung client.data.user do handleConnection ở
// đây gán — không cần xác thực lại trong ChatGateway.
@WebSocketGateway({ cors: true })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly wsAuth: WsAuthService) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        (client.handshake.headers.authorization?.startsWith('Bearer ')
          ? client.handshake.headers.authorization.slice(7)
          : undefined);
      const user = await this.wsAuth.verifyToken(token);
      client.data.user = user;

      if (user.role === UserRole.ADMIN || user.role === UserRole.STAFF) {
        await client.join(STAFF_ROOM);
      }
      if (user.role === UserRole.STAFF) {
        await client.join(CHAT_STAFF_ROOM);
      }
      // Room riêng theo userId — dùng để báo cho đúng 1 khách hàng biết đơn của họ
      // vừa đổi trạng thái (lễ tân xác nhận/check-in/check-out ở máy khác), thay vì
      // bắt khách F5 lại trang Lịch sử đặt phòng mới thấy.
      await client.join(userRoom(user.userId));
    } catch (error) {
      this.logger.warn(`Socket ${client.id} bị từ chối: ${(error as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Socket ${client.id} disconnected`);
  }

  emitRoomStatusChanged(payload: { roomId: string; status: string }) {
    this.server.to(STAFF_ROOM).emit('room:status-changed', payload);
  }

  emitBookingCreated(payload: unknown) {
    this.server.to(STAFF_ROOM).emit('booking:created', payload);
  }

  emitBookingPaid(payload: unknown) {
    this.server.to(STAFF_ROOM).emit('booking:paid', payload);
  }

  // Báo cho đúng khách hàng sở hữu đơn biết đơn của họ vừa đổi trạng thái/thanh
  // toán (xác nhận, check-in, check-out, huỷ, thanh toán...).
  emitBookingUpdatedForCustomer(userId: string, payload: unknown) {
    this.server.to(userRoom(userId)).emit('booking:updated', payload);
  }

  // ChatModule gọi hàm này thay vì tự biết tên room "chat-staff" — RealtimeModule
  // giữ độc quyền quyết định socket nào thuộc nhóm lễ tân trực chat.
  emitToChatStaff(event: string, payload: unknown) {
    this.server.to(CHAT_STAFF_ROOM).emit(event, payload);
  }
}
