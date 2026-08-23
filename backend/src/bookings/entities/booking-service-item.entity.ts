import { Service } from 'src/services/entities/service.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Booking } from './booking.entity';

@Entity('BookingServiceItem')
export class BookingServiceItem {
  @PrimaryGeneratedColumn('uuid', { name: 'bookingServiceId' })
  bookingServiceId!: string;

  @ManyToOne(() => Booking, (booking) => booking.serviceItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'bookingId' })
  booking!: Booking;

  @ManyToOne(() => Service, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'serviceId' })
  service!: Service;

  @Column({ name: 'quantity', type: 'int' })
  quantity!: number;

  // Đơn giá snapshot tại thời điểm thêm dịch vụ
  @Column({ name: 'unitPrice', type: 'int' })
  unitPrice!: number;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;
}
