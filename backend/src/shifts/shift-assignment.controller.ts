import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ShiftAssignmentService } from './shift-assignment.service';
import { CreateShiftAssignmentDto } from './dto/create-shift-assignment.dto';
import { CopyWeekDto } from './dto/copy-week.dto';
import { QueryShiftAssignmentDto } from './dto/query-shift-assignment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/role.decorator';
import { UserRole } from '../common/enums/user-role.enum';

interface AuthenticatedRequest extends Request {
  user: { userId: string; email: string; role: string };
}

@Controller('shift-assignments')
export class ShiftAssignmentController {
  constructor(
    private readonly shiftAssignmentService: ShiftAssignmentService,
  ) {}

  // Lịch của chính mình (Staff lẫn Admin đều xem được của bản thân). Đặt trước
  // route gốc để không phụ thuộc thứ tự — không trùng path nên không lo conflict.
  @Get('me')
  @UseGuards(JwtAuthGuard)
  findMine(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryShiftAssignmentDto,
  ) {
    return this.shiftAssignmentService.findForStaff(req.user.userId, query);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findAll(@Query() query: QueryShiftAssignmentDto) {
    return this.shiftAssignmentService.findForAdmin(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateShiftAssignmentDto) {
    return this.shiftAssignmentService.create(dto);
  }

  // Sao chép lịch phân ca của 1 tuần sang tuần khác (thường là tuần trước -> tuần
  // đang xem) để không phải phân lại từng ô.
  @Post('copy-week')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  copyWeek(@Body() dto: CopyWeekDto) {
    return this.shiftAssignmentService.copyWeek(
      dto.sourceWeekStart,
      dto.targetWeekStart,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.shiftAssignmentService.remove(id);
  }

  // Vô ca / kết ca: không giới hạn theo role (STAFF lẫn ADMIN đều có thể được
  // phân ca) — quyền thao tác được service kiểm tra theo đúng chủ sở hữu ca,
  // không dựa vào role.
  @Post(':id/check-in')
  @UseGuards(JwtAuthGuard)
  checkIn(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.shiftAssignmentService.checkIn(id, req.user.userId);
  }

  @Post(':id/check-out')
  @UseGuards(JwtAuthGuard)
  checkOut(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.shiftAssignmentService.checkOut(id, req.user.userId);
  }
}
