import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './entities/booking.entity';
import { BookingServiceItem } from './entities/booking-service-item.entity';
import { Room } from '../rooms/entities/room.entity';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { RoomTypeModule } from '../room-types/room-type.module';
import { ServiceModule } from '../services/service.module';
import { PromotionModule } from '../promotions/promotion.module';
import { UserModule } from '../users/user.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, BookingServiceItem, Room]),
    RoomTypeModule,
    ServiceModule,
    PromotionModule,
    UserModule,
    RedisModule,
  ],
  controllers: [BookingController],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule {}
