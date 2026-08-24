import { DiscountType } from 'src/common/enums/discount-type.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('Promotion')
@Unique(['code'])
export class Promotion {
  @PrimaryGeneratedColumn('uuid', { name: 'promotionId' })
  promotionId!: string;

  @Column({ name: 'code', length: 30 })
  code!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({
    name: 'discountType',
    type: 'enum',
    enum: DiscountType,
  })
  discountType!: DiscountType;

  // PERCENTAGE: 0-100 (%); FIXED: số tiền VND
  @Column({ name: 'discountValue', type: 'int' })
  discountValue!: number;

  @Column({ name: 'startDate', type: 'date' })
  startDate!: string;

  @Column({ name: 'endDate', type: 'date' })
  endDate!: string;

  // null = không giới hạn số lần sử dụng
  @Column({ name: 'usageLimit', type: 'int', nullable: true })
  usageLimit!: number | null;

  @Column({ name: 'usedCount', type: 'int', default: 0 })
  usedCount!: number;

  @Column({ name: 'isActive', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
