import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Room } from '../rooms/entities/room.entity';
import { RoomType } from '../room-types/entities/room-type.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingServiceItem } from '../bookings/entities/booking-service-item.entity';
import { Promotion } from '../promotions/entities/promotion.entity';
import { Review } from '../reviews/entities/review.entity';

import { RoomService } from '../rooms/room.service';
import { RoomTypeService } from '../room-types/room-type.service';
import { BookingService } from '../bookings/booking.service';
import { PromotionService } from '../promotions/promotion.service';
import { ReviewService } from '../reviews/review.service';

import { RoomController } from '../rooms/room.controller';
import { RoomTypeController } from '../room-types/room-type.controller';
import { BookingController } from '../bookings/booking.controller';
import { PromotionController } from '../promotions/promotion.controller';
import { ReviewController } from '../reviews/review.controller';

import { ServiceModule } from '../services/service.module';
import { UserModule } from '../users/user.module';
import { RedisModule } from '../redis/redis.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ShiftModule } from '../shifts/shift.module';
import { CashLedgerModule } from '../cash-ledger/cash-ledger.module';

// Bounded context "Đặt phòng": Room, RoomType, Booking (+ BookingServiceItem) và
// Promotion là các aggregate của cùng một nghiệp vụ và tham chiếu vòng lẫn nhau
// (booking gắn với room/roomType và với promotion; khuyến mãi cần giá loại phòng để
// tính tiền giảm; room map cần trạng thái booking; ngưng roomType cần kiểm
// booking...). Gom vào 1 module để việc chia sẻ repository giữa chúng là
// trong-cùng-module — đúng với modular monolith, không cần forwardRef.
//
// Promotion trước đây là PromotionModule riêng, nhưng nó không đứng độc lập được:
// Booking có khoá ngoại tới nó và BookingService phải gọi nó ở mọi lần tạo đơn.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Room,
      RoomType,
      Booking,
      BookingServiceItem,
      Promotion,
      Review,
    ]),
    ServiceModule,
    UserModule,
    RedisModule,
    RealtimeModule,
    ShiftModule,
    CashLedgerModule,
  ],
  controllers: [
    RoomController,
    RoomTypeController,
    BookingController,
    PromotionController,
    ReviewController,
  ],
  providers: [
    RoomService,
    RoomTypeService,
    BookingService,
    PromotionService,
    ReviewService,
  ],
  exports: [
    RoomService,
    RoomTypeService,
    BookingService,
    PromotionService,
  ],
})
export class ReservationsModule {}
