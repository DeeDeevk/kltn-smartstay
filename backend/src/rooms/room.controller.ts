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

@Controller('rooms')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Get('availability')
  checkAvailability(@Query() query: QueryAvailabilityDto) {
    return this.roomService.checkAvailability(query);
  }

  @Get('map')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  getRoomMap(@Query() query: QueryRoomMapDto) {
    return this.roomService.getRoomMap(query);
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
