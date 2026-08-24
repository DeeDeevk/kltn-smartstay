import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { BookingModule } from '../bookings/booking.module';

@Module({
  imports: [BookingModule],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}
