import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { PaymentTransactionService } from './payment-transaction.service';

// Sổ thu tiền — không phụ thuộc module nào, để Reservations (ghi), Shift (chốt két)
// và Revenue (báo cáo) cùng dùng mà không tạo vòng phụ thuộc giữa các module đó.
@Module({
  imports: [TypeOrmModule.forFeature([PaymentTransaction])],
  providers: [PaymentTransactionService],
  exports: [PaymentTransactionService],
})
export class CashLedgerModule {}
