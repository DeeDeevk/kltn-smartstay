import { RoomTypeStatus } from 'src/common/enums/room-type-status.enum';
import { RoomTypeReviewSummary } from '../room-type-review-summary.types';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('RoomType')
export class RoomType {
  @PrimaryGeneratedColumn('uuid', { name: 'roomTypeId' })
  roomTypeId!: string;

  @Column({ name: 'name', length: 100 })
  name!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'basePrice', type: 'int' })
  basePrice!: number;

  @Column({ name: 'capacity', type: 'int' })
  capacity!: number;

  @Column({ name: 'amenities', type: 'jsonb', default: () => "'[]'" })
  amenities!: string[];

  @Column({ name: 'images', type: 'jsonb', default: () => "'[]'" })
  images!: string[];

  @Column({
    name: 'status',
    type: 'enum',
    enum: RoomTypeStatus,
    default: RoomTypeStatus.ACTIVE,
  })
  status!: RoomTypeStatus;

  // Cache kết quả AI tổng hợp đánh giá (xem RoomTypeReviewSummaryService) — null = chưa
  // từng tổng hợp (loại phòng mới, hoặc chưa đủ đánh giá). Tính LẠI (lazy, lúc khách tải
  // trang chi tiết phòng) khi reviewCount lưu trong đây khác với tổng số đánh giá hiện tại,
  // không cần cron/job riêng.
  @Column({ name: 'reviewSummary', type: 'jsonb', nullable: true })
  reviewSummary!: RoomTypeReviewSummary | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
