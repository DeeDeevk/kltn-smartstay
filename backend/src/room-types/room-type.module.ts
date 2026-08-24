import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomType } from './entities/room-type.entity';
import { Room } from '../rooms/entities/room.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { RoomTypeService } from './room-type.service';
import { RoomTypeController } from './room-type.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RoomType, Room, Booking])],
  controllers: [RoomTypeController],
  providers: [RoomTypeService],
  exports: [RoomTypeService],
})
export class RoomTypeModule {}
