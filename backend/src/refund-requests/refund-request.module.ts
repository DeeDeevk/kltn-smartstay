import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefundRequest } from './entities/refund-request.entity';
import { Conversation } from '../chat/entities/conversation.entity';
import { RefundRequestService } from './refund-request.service';
import { RefundRequestController } from './refund-request.controller';
import { NotificationModule } from '../notifications/notification.module';
import { HotelConfigModule } from '../hotel-config/hotel-config.module';

// Module độc lập, KHÔNG phụ thuộc PaymentModule/ChatModule (chỉ cần entity Conversation để
// tìm/liên kết hội thoại, không cần ChatService) — payments thuộc Khoa, bookings thuộc
// Vinh; giữ RefundRequest tách biệt để không đụng hành vi payment.service.ts hiện có, theo
// đúng ràng buộc của KAN-114.
@Module({
  imports: [
    TypeOrmModule.forFeature([RefundRequest, Conversation]),
    NotificationModule,
    HotelConfigModule,
  ],
  controllers: [RefundRequestController],
  providers: [RefundRequestService],
  // Để BookingService (ReservationsModule) gọi createForCancelledBooking() trực tiếp khi
  // huỷ đơn đã thanh toán — xem BookingService.cancel().
  exports: [RefundRequestService],
})
export class RefundRequestModule {}
