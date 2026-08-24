import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Booking } from 'src/bookings/entities/booking.entity';
import { Room } from 'src/rooms/entities/room.entity';
import { RoomType } from 'src/room-types/entities/room-type.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, Booking, Room, RoomType])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
