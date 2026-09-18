import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// TypeORM trả cột 'decimal' về dạng string theo mặc định (driver pg không tự ép kiểu
// số để tránh mất độ chính xác) — dùng transformer để latitude/longitude luôn là
// number ở tầng ứng dụng, khỏi phải tự parseFloat() ở mọi nơi dùng tới (PlacesService,
// response trả cho FE để vẽ lên Google Maps).
const decimalTransformer = {
  to: (value: number) => value,
  from: (value: string | null) => (value === null ? null : parseFloat(value)),
};

// Bảng single-row: chỉ 1 bản ghi duy nhất lưu vị trí khách sạn, dùng làm tâm cho
// Google Places Nearby Search (PlacesService). HotelConfigService.getOrCreate() tự
// tạo bản ghi mặc định nếu bảng còn rỗng, không cần seed script riêng.
@Entity('HotelConfig')
export class HotelConfig {
  @PrimaryGeneratedColumn('uuid', { name: 'configId' })
  configId!: string;

  @Column({ name: 'address', length: 255 })
  address!: string;

  @Column({
    name: 'latitude',
    type: 'decimal',
    precision: 10,
    scale: 7,
    transformer: decimalTransformer,
  })
  latitude!: number;

  @Column({
    name: 'longitude',
    type: 'decimal',
    precision: 10,
    scale: 7,
    transformer: decimalTransformer,
  })
  longitude!: number;

  // Phải khai báo type tường minh: cột nullable kiểu "string | null" là union type,
  // reflect-metadata trả design:type là Object (không phải String) cho union, khiến
  // TypeORM không suy ra được kiểu cột Postgres và app không khởi động được
  // (DataTypeNotSupportedError). Xem cancelReason ở booking.entity.ts — cùng lý do.
  @Column({ name: 'googlePlaceId', type: 'varchar', length: 255, nullable: true })
  googlePlaceId!: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
