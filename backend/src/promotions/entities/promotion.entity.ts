import { DiscountType } from 'src/common/enums/discount-type.enum';
import { PromotionStatus } from 'src/common/enums/promotion-status.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

// Điều kiện áp dụng của 1 khuyến mãi — gói TẤT CẢ vào 1 cột JSON thay vì mỗi điều
// kiện một cột. Thêm loại khuyến mãi mới về sau chỉ là thêm 1 khoá ở đây, không phải
// đổi schema bảng.
//
// Mọi trường đều tuỳ chọn; không khai báo gì (hoặc conditions = null) nghĩa là mã áp
// cho mọi đơn. Các loại khuyến mãi dựng được từ đúng bộ trường này:
//   Đặt sớm (Early Bird)  -> { minAdvanceDays: 14 }
//   Phút chót (Last Minute) -> { maxAdvanceDays: 2 }
//   Ở dài ngày (Long Stay)  -> { minNights: 3 }
//   Theo loại phòng          -> { roomTypeIds: [...] }
//   Theo mùa/dịp lễ          -> { stayFrom: '2027-02-06', stayTo: '2027-02-20' }
export interface PromotionConditions {
  // Đơn phải có ít nhất bấy nhiêu đêm lưu trú.
  minNights?: number;
  // Phải đặt trước ngày nhận phòng ít nhất bấy nhiêu ngày.
  minAdvanceDays?: number;
  // Chỉ áp khi đặt trong vòng bấy nhiêu ngày trước ngày nhận phòng.
  maxAdvanceDays?: number;
  // Tổng đơn (tiền phòng + dịch vụ) tối thiểu, đơn vị VNĐ.
  minAmount?: number;
  // Chỉ áp cho các loại phòng này. Mảng rỗng/không khai báo = mọi loại phòng.
  roomTypeIds?: string[];
  // Kỳ lưu trú được áp dụng, dạng 'YYYY-MM-DD'. Toàn bộ các đêm của đơn phải nằm
  // trong khoảng này.
  stayFrom?: string;
  stayTo?: string;
}

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
  @Column({ name: 'maxUsage', type: 'int', nullable: true })
  maxUsage!: number | null;

  @Column({ name: 'usedCount', type: 'int', default: 0 })
  usedCount!: number;

  // jsonb (không phải text): TypeORM tự parse ra object nên không phải JSON.parse thủ
  // công mỗi lần đọc, và sau này lọc được bằng SQL nếu cần.
  @Column({ name: 'conditions', type: 'jsonb', nullable: true })
  conditions!: PromotionConditions | null;

  // Chỉ chứa ACTIVE hoặc PAUSED — xem chú thích ở PromotionStatus.
  @Column({
    name: 'status',
    type: 'enum',
    enum: PromotionStatus,
    default: PromotionStatus.ACTIVE,
  })
  status!: PromotionStatus;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
