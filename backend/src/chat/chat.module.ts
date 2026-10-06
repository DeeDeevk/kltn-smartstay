import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { UserModule } from '../users/user.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { UploadModule } from '../uploads/upload.module';
import { RefundRequestModule } from '../refund-requests/refund-request.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message]),
    UserModule,
    RealtimeModule,
    UploadModule,
    // Để lễ tân gắn yêu cầu hoàn tiền ngay trong khung chat (GET /chat/conversations/:id/
    // refund-requests) — không tạo vòng lặp vì RefundRequestModule không phụ thuộc ngược
    // lại ChatModule (chỉ dùng entity Conversation, không import ChatModule).
    RefundRequestModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
})
export class ChatModule {}
