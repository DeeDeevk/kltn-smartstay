import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RoomService } from './room.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto';
import { QueryAvailabilityDto } from './dto/query-availability.dto';
import { QueryRoomMapDto } from './dto/query-room-map.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/role.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { BookingService } from 'src/bookings/booking.service';

@Controller('rooms')
export class RoomController {
  constructor(
    private readonly roomService: RoomService,
    private readonly bookingService: BookingService,
  ) {}

  // Dùng chung cách đếm với luồng tạo đơn (tính cả đơn online chưa gắn phòng), để
  // khách không thấy "còn phòng" rồi bị từ chối ở bước đặt.
  @Get('availability')
  async checkAvailability(@Query() query: QueryAvailabilityDto) {
    const roomTypes = await this.bookingService.findAvailableRoomTypes(
      query.checkIn,
      query.checkOut,
      query.guests,
    );
    return query.roomTypeId
      ? roomTypes.filter((rt) => rt.roomTypeId === query.roomTypeId)
      : roomTypes;
  }

  @Get('map')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  getRoomMap(@Query() query: QueryRoomMapDto) {
    return this.roomService.getRoomMap(query);
  }

  @Get('map/summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  getRoomMapSummary(@Query() query: QueryRoomMapDto) {
    return this.bookingService.getRoomMapSummary(query.checkIn, query.checkOut);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  findOne(@Param('id') id: string) {
    return this.roomService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateRoomDto) {
    return this.roomService.create(dto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateRoomStatusDto) {
    return this.roomService.updateStatus(id, dto);
  }
}
