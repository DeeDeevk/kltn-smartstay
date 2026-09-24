import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';

// Các gateway (RealtimeGateway, ChatGateway) không tự khai báo CORS: trước đây đặt
// `cors: true` nên bất kỳ website nào cũng mở được kết nối socket. Adapter này áp cùng
// danh sách origin (CORS_ORIGIN) với REST cho mọi gateway, đọc lúc chạy từ ConfigService
// — decorator @WebSocketGateway được đánh giá khi import, chưa kịp nạp file .env.
export class SocketIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly allowedOrigins: string[],
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): unknown {
    return super.createIOServer(port, {
      ...options,
      cors: { origin: this.allowedOrigins },
    });
  }
}
