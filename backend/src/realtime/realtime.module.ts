import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { RealtimeGateway } from './realtime.gateway';
import { WsAuthService } from './ws-auth.service';

@Module({
  imports: [RedisModule],
  providers: [RealtimeGateway, WsAuthService],
  // WsAuthService chỉ RealtimeGateway dùng nội bộ — module khác chỉ cần
  // RealtimeGateway (emitRoomStatusChanged, emitBookingCreated...).
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
