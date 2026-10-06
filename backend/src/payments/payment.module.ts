import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { VietqrBankService } from './vietqr-bank.service';
import { ReservationsModule } from '../reservations/reservations.module';

@Module({
  imports: [ReservationsModule],
  controllers: [PaymentController],
  providers: [PaymentService, VietqrBankService],
  exports: [PaymentService],
})
export class PaymentModule {}
