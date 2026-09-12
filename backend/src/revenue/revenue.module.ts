import { Module } from '@nestjs/common';
import { RevenueController } from './revenue.controller';
import { RevenueService } from './revenue.service';
import { ReservationsModule } from '../reservations/reservations.module';

// Module báo cáo doanh thu — gộp cả doanh thu tổng lẫn doanh thu theo nhân viên.
// Không sở hữu entity nào: mọi dữ liệu lấy qua service công khai của
// ReservationsModule (BookingService, RoomService), đúng ranh giới modular monolith.
@Module({
  imports: [ReservationsModule],
  controllers: [RevenueController],
  providers: [RevenueService],
})
export class RevenueModule {}
