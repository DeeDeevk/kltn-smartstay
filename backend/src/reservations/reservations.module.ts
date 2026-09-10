import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Room } from '../rooms/entities/room.entity';
import { RoomType } from '../room-types/entities/room-type.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingServiceItem } from '../bookings/entities/booking-service-item.entity';

import { RoomService } from '../rooms/room.service';
import { RoomTypeService } from '../room-types/room-type.service';
import { BookingService } from '../bookings/booking.service';

import { RoomController } from '../rooms/room.controller';
import { RoomTypeController } from '../room-types/room-type.controller';
import { BookingController } from '../bookings/booking.controller';

import { ServiceModule } from '../services/service.module';
import { PromotionModule } from '../promotions/promotion.module';
import { UserModule } from '../users/user.module';
import { RedisModule } from '../redis/redis.module';

// Bounded context "Đặt phòng": Room, RoomType, Booking (+ BookingServiceItem) là
// các aggregate của cùng một nghiệp vụ và tham chiếu vòng lẫn nhau (booking gắn
// với room/roomType; room map cần trạng thái booking; ngưng roomType cần kiểm
// booking...). Gom vào 1 module để việc chia sẻ repository giữa chúng là
// trong-cùng-module — đúng với modular monolith, không cần forwardRef.
@Module({
  imports: [
    TypeOrmModule.forFeature([Room, RoomType, Booking, BookingServiceItem]),
    ServiceModule,
    PromotionModule,
    UserModule,
    RedisModule,
  ],
  controllers: [RoomController, RoomTypeController, BookingController],
  providers: [RoomService, RoomTypeService, BookingService],
  exports: [RoomService, RoomTypeService, BookingService],
})
export class ReservationsModule {}
