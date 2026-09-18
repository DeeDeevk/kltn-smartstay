import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { PaymentMethod } from 'src/common/enums/payment-method.enum';
import { AiMessage } from './ai-message.entity';

// Bản tóm tắt đặt phòng mà agent đã trình bày cho khách qua tool propose_booking,
// đang chờ khách xác nhận "đồng ý" ở lượt hội thoại kế tiếp mới được phép tạo booking
// thật (tool create_booking). Đây là nguồn dữ liệu duy nhất được dùng để tạo booking —
// không lấy lại tham số do model tự sinh ra lúc gọi create_booking, tránh model "nhớ nhầm"
// khác với con số đã tóm tắt cho khách.
export interface PendingBookingSummary {
  // Mã riêng của từng lần đề xuất — nút "Xác nhận" ở frontend gửi kèm mã này để chắc
  // chắn khách đang đồng ý đúng bản tóm tắt họ vừa xem, không phải một bản đề xuất
  // khác đã thay thế nó (VD model vừa đề xuất lại với giá mới).
  proposalId: string;
  roomTypeId: string;
  roomTypeName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guestInfo: { fullName: string; phone: string; email?: string };
  extraServiceIds: string[];
  promotionCode?: string;
  paymentMethod: PaymentMethod;
  roomAmount: number;
  serviceAmount: number;
  discountAmount: number;
  vatAmount: number;
  totalAmount: number;
}

@Entity('AiConversation')
export class AiConversation {
  @PrimaryGeneratedColumn('uuid', { name: 'conversationId' })
  conversationId!: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ name: 'pendingBooking', type: 'jsonb', nullable: true })
  pendingBooking!: PendingBookingSummary | null;

  @Column({
    name: 'pendingBookingProposedAt',
    type: 'timestamptz',
    nullable: true,
  })
  pendingBookingProposedAt!: Date | null;

  @OneToMany(() => AiMessage, (message) => message.conversation)
  messages!: AiMessage[];

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
