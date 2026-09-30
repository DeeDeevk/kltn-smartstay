import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Thông báo in-app cho khách hàng (app mobile / trang "Thông báo"). Chỉ lưu userId
// dạng cột thường (không ManyToOne) để module Notifications không phụ thuộc entity
// User — đúng ranh giới module, và xoá/khoá user không kéo theo cascade ở đây.
@Entity('Notification')
@Index(['userId', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid', { name: 'notificationId' })
  notificationId!: string;

  @Column({ name: 'userId', type: 'uuid' })
  userId!: string;

  // Loại sự kiện (xem NotificationType) — FE dùng để chọn icon.
  @Column({ name: 'type', length: 40 })
  type!: string;

  @Column({ name: 'title', length: 200 })
  title!: string;

  @Column({ name: 'body', type: 'text' })
  body!: string;

  // Đơn liên quan (nếu có) — FE bấm vào thông báo để mở chi tiết đơn.
  @Column({ name: 'bookingId', type: 'uuid', nullable: true })
  bookingId!: string | null;

  @Column({ name: 'isRead', type: 'boolean', default: false })
  isRead!: boolean;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;
}
