import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from './entities/room.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { RoomService } from './room.service';
import { RoomController } from './room.controller';
import { RoomTypeModule } from '../room-types/room-type.module';

@Module({
  imports: [TypeOrmModule.forFeature([Room, Booking]), RoomTypeModule],
  controllers: [RoomController],
  providers: [RoomService],
  exports: [RoomService],
})
export class RoomModule {}
