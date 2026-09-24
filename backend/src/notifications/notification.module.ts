import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  controllers: [NotificationController],
  providers: [NotificationService],
  // ReservationsModule gọi NotificationService.notifyBooking() khi đơn đổi trạng thái.
  exports: [NotificationService],
})
export class NotificationModule {}
