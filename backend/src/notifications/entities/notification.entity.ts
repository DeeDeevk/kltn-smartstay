import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Booking } from '../../bookings/entities/booking.entity';
import { NotificationType } from '../../common/enums/notification-type.enum';

// Thông báo gửi tới 1 khách cụ thể. Ghi xuống DB chứ không chỉ bắn socket: khách
// không mở web lúc lễ tân xác nhận đơn thì vẫn phải thấy được thông báo khi quay lại.
@Entity('Notification')
// Truy vấn luôn là "thông báo của tôi, mới nhất trước" nên đánh index đúng cặp cột đó.
@Index(['user', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid', { name: 'notificationId' })
  notificationId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ name: 'type', type: 'enum', enum: NotificationType })
  type!: NotificationType;

  @Column({ name: 'title', length: 200 })
  title!: string;

  @Column({ name: 'message', type: 'text' })
  message!: string;

  // Đơn liên quan, để bấm vào thông báo là mở đúng đơn đó. Nullable để sau này còn
  // dùng được cho thông báo không gắn đơn nào (khuyến mãi, thông báo chung...).
  @ManyToOne(() => Booking, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'bookingId' })
  booking!: Booking | null;

  @Column({ name: 'isRead', type: 'boolean', default: false })
  isRead!: boolean;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;
}
