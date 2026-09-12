import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RevenueService } from './revenue.service';
import { QueryRevenueDto } from './dto/query-revenue.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/role.decorator';
import { UserRole } from '../common/enums/user-role.enum';

// Báo cáo doanh thu chỉ dành cho Admin.
@Controller('revenue')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class RevenueController {
  constructor(private readonly revenueService: RevenueService) {}

  // Doanh thu tổng: tổng quan + chuỗi thời gian + cơ cấu theo loại phòng.
  @Get('summary')
  getSummary(@Query() query: QueryRevenueDto) {
    return this.revenueService.getSummary(query);
  }

  // Doanh thu theo từng nhân viên, kèm chuỗi thời gian để vẽ biểu đồ cột.
  @Get('by-staff')
  getByStaff(@Query() query: QueryRevenueDto) {
    return this.revenueService.getByStaff(query);
  }
}
