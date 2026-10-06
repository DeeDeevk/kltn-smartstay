import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Booking } from '../../bookings/entities/booking.entity';
import { User } from '../../users/entities/user.entity';
import { PaymentMethod } from '../../common/enums/payment-method.enum';

// 1 dòng = 1 lần thu tiền thực tế của 1 đơn. Chỉ ghi thêm, không sửa/xoá — là nguồn
// để chốt két theo ca (ai thu, lúc nào, bằng gì) và báo cáo tiền thu theo phương thức.
@Entity('PaymentTransaction')
export class PaymentTransaction {
  @PrimaryGeneratedColumn('uuid', { name: 'paymentTransactionId' })
  paymentTransactionId!: string;

  @ManyToOne(() => Booking, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'bookingId' })
  booking!: Booking;

  @Column({ name: 'amount', type: 'int' })
  amount!: number;

  @Column({ name: 'method', type: 'enum', enum: PaymentMethod })
  method!: PaymentMethod;

  // Thông tin tài khoản người chuyển, trích từ PayOS webhook/sync NẾU SDK có trả (xem
  // PaymentService) — null nếu không có dữ liệu (PayOS không trả, hoặc thu tiền mặt).
  // Cột MỚI, thêm sau khi bảng đã có dữ liệu — không ảnh hưởng gì tới logic chốt ca/đối
  // soát hiện có (chỉ đọc amount/method/collectedAt/collectedBy).
  @Column({ name: 'payerBankInfo', type: 'jsonb', nullable: true })
  payerBankInfo!: Record<string, string> | null;

  // null = không có nhân viên cầm tiền (khách tự thanh toán online qua PayOS).
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'collectedBy' })
  collectedBy!: User | null;

  @CreateDateColumn({ name: 'collectedAt' })
  collectedAt!: Date;
}
