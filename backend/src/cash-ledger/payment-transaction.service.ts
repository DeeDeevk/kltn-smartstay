import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, EntityManager, Repository } from 'typeorm';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { PaymentMethod } from '../common/enums/payment-method.enum';

export interface RecordPaymentInput {
  bookingId: string;
  amount: number;
  method: PaymentMethod;
  collectedByUserId: string | null;
}

export interface CollectionTotals {
  cash: number;
  transfer: number;
  total: number;
}

function totalsOf(transactions: PaymentTransaction[]): CollectionTotals {
  const cash = transactions
    .filter((t) => t.method === PaymentMethod.CASH)
    .reduce((sum, t) => sum + t.amount, 0);
  const transfer = transactions
    .filter((t) => t.method !== PaymentMethod.CASH)
    .reduce((sum, t) => sum + t.amount, 0);
  return { cash, transfer, total: cash + transfer };
}

@Injectable()
export class PaymentTransactionService {
  constructor(
    @InjectRepository(PaymentTransaction)
    private readonly transactionRepo: Repository<PaymentTransaction>,
  ) {}

  // manager: truyền vào khi cần ghi chung transaction với thao tác của module gọi
  // (vd. check-out), để đơn đã đánh dấu trả tiền thì luôn có dòng giao dịch đi kèm.
  async record(input: RecordPaymentInput, manager?: EntityManager) {
    if (input.amount <= 0) return null;
    const repo = manager
      ? manager.getRepository(PaymentTransaction)
      : this.transactionRepo;
    return repo.save(
      repo.create({
        booking: { bookingId: input.bookingId },
        amount: input.amount,
        method: input.method,
        collectedBy: input.collectedByUserId
          ? { userId: input.collectedByUserId }
          : null,
      }),
    );
  }

  async findCollectedByStaff(staffId: string, from: Date, to: Date) {
    const transactions = await this.transactionRepo.find({
      where: {
        collectedBy: { userId: staffId },
        collectedAt: Between(from, to),
      },
      relations: { booking: true },
      order: { collectedAt: 'ASC' },
    });
    return { transactions, totals: totalsOf(transactions) };
  }

  async sumByMethod(from: Date, to: Date): Promise<CollectionTotals> {
    const transactions = await this.transactionRepo.find({
      where: { collectedAt: Between(from, to) },
    });
    return totalsOf(transactions);
  }
}
