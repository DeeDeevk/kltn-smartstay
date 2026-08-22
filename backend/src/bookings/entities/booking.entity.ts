import { BookingStatus } from 'src/common/enums/booking-status.enum';
import { Promotion } from 'src/promotions/entities/promotion.entity';
import { Room } from 'src/rooms/entities/room.entity';
import { RoomType } from 'src/room-types/entities/room-type.entity';
import { User } from 'src/users/entities/user.entity';
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
import { BookingServiceItem } from './booking-service-item.entity';

export interface GuestInfo {
  fullName: string;
  phone: string;
  email?: string;
}

@Entity('Booking')
export class Booking {
  @PrimaryGeneratedColumn('uuid', { name: 'bookingId' })
  bookingId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne(() => RoomType, { onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'roomTypeId' })
  roomType!: RoomType;

  // Chỉ gán khi lễ tân check-in, trước đó booking chỉ giữ chỗ theo roomType
  @ManyToOne(() => Room, { nullable: true, eager: true })
  @JoinColumn({ name: 'roomId' })
  room!: Room | null;

  @Column({ name: 'checkInDate', type: 'date' })
  checkInDate!: string;

  @Column({ name: 'checkOutDate', type: 'date' })
  checkOutDate!: string;

  @Column({ name: 'guestInfo', type: 'jsonb' })
  guestInfo!: GuestInfo;

  @ManyToOne(() => Promotion, { nullable: true, eager: true })
  @JoinColumn({ name: 'promotionId' })
  promotion!: Promotion | null;

  @Column({ name: 'discountAmount', type: 'int', default: 0 })
  discountAmount!: number;

  // Giá phòng snapshot tại thời điểm đặt (basePrice * số đêm) — không đổi
  // theo biến động giá loại phòng về sau
  @Column({ name: 'roomAmount', type: 'int' })
  roomAmount!: number;

  @Column({
    name: 'status',
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.PENDING,
  })
  status!: BookingStatus;

  @Column({ name: 'cancelReason', type: 'text', nullable: true })
  cancelReason!: string | null;

  @OneToMany(() => BookingServiceItem, (item) => item.booking, {
    eager: true,
  })
  serviceItems!: BookingServiceItem[];

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
