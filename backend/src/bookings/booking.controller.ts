import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { QueryBookingDto } from './dto/query-booking.dto';
import { QueryMyBookingDto } from './dto/query-my-booking.dto';
import { CheckInDto } from './dto/check-in.dto';
import { AddServiceDto } from './dto/add-service.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/role.decorator';
import { UserRole } from '../common/enums/user-role.enum';

interface AuthenticatedRequest extends Request {
  user: { userId: string; email: string; role: string };
}

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateBookingDto) {
    return this.bookingService.create(req.user.userId, dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  findAll(@Query() query: QueryBookingDto) {
    return this.bookingService.findAll(query);
  }

  @Get('my')
  findMy(@Req() req: AuthenticatedRequest, @Query() query: QueryMyBookingDto) {
    return this.bookingService.findMyBookings(req.user.userId, query);
  }

  @Get(':id')
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.bookingService.findById(id, req.user);
  }

  @Patch(':id/confirm')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  confirm(@Param('id') id: string) {
    return this.bookingService.confirm(id);
  }

  @Post(':id/check-in')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  checkIn(@Param('id') id: string, @Body() dto: CheckInDto) {
    return this.bookingService.checkIn(id, dto);
  }

  @Post(':id/check-out')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  checkOut(@Param('id') id: string) {
    return this.bookingService.checkOut(id);
  }

  @Post(':id/services')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  addService(@Param('id') id: string, @Body() dto: AddServiceDto) {
    return this.bookingService.addService(id, dto);
  }

  @Patch(':id/cancel')
  cancel(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookingService.cancel(id, req.user, dto);
  }
}
