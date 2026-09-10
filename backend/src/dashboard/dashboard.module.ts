import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { UserModule } from '../users/user.module';
import { ReservationsModule } from '../reservations/reservations.module';

@Module({
  imports: [UserModule, ReservationsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
