import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LocalPlaceSource } from 'src/common/enums/local-place-source.enum';
import { LocalPlaceStatus } from 'src/common/enums/local-place-status.enum';

// TypeORM trả cột 'decimal' về string theo mặc định (driver pg không tự ép kiểu số để
// tránh mất độ chính xác) — cùng transformer như HotelConfig.latitude/longitude (xem
// hotel-config.entity.ts) để tầng ứng dụng luôn thấy number | null, không phải tự
// parseFloat() ở mọi nơi dùng tới.
const nullableDecimalTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : parseFloat(value)),
};

// Địa điểm tham quan/vui chơi/ăn uống do admin quản lý thủ công HOẶC do AI trích xuất từ
// link/text (LocalPlaceExtractionService) — nguồn dữ liệu RIÊNG, tách biệt hoàn toàn với
// PlacesService (Google Places API theo bán kính quanh HotelConfig). Agent dùng 2 nguồn
// này song song (get_nearby_places + get_local_highlights) và trình bày tách biệt, không
// gộp chung — xem system-prompt.constant.ts.
@Entity('LocalPlace')
export class LocalPlace {
  @PrimaryGeneratedColumn('uuid', { name: 'placeId' })
  placeId!: string;

  @Column({ name: 'name', length: 200 })
  name!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  // null cho tới khi admin tự chọn địa chỉ chính xác qua Vietmap Autocomplete (ở cả dòng
  // AI đề xuất lẫn dòng tạo thủ công còn đang nhập dở) — KHÔNG tự geocode addressHint của
  // AI thành toạ độ, tránh geocode sai mà không ai kiểm tra lại (xem
  // LocalPlaceExtractionService).
  // Phải khai báo type tường minh: cột nullable kiểu "string | null" là union type,
  // reflect-metadata trả design:type là Object (không phải String) cho union, khiến
  // TypeORM không suy ra được kiểu cột Postgres (DataTypeNotSupportedError) — cùng lý do
  // với HotelConfig.googlePlaceId (xem hotel-config.entity.ts).
  @Column({ name: 'address', type: 'varchar', length: 255, nullable: true })
  address!: string | null;

  @Column({
    name: 'latitude',
    type: 'decimal',
    precision: 10,
    scale: 7,
    nullable: true,
    transformer: nullableDecimalTransformer,
  })
  latitude!: number | null;

  @Column({
    name: 'longitude',
    type: 'decimal',
    precision: 10,
    scale: 7,
    nullable: true,
    transformer: nullableDecimalTransformer,
  })
  longitude!: number | null;

  // Địa chỉ/khu vực dạng chữ thô mà Gemini đọc được từ văn bản nguồn (chưa xác nhận qua
  // bản đồ) — chỉ hiển thị cho admin tham khảo ở card "Chờ duyệt" dưới dạng gợi ý màu xám,
  // KHÔNG dùng để tính toán hay hiển thị cho khách. null với dòng tạo thủ công (admin tự
  // nhập address thật ngay từ đầu). Tách riêng khỏi cột address (địa chỉ đã xác nhận) để 2
  // khái niệm "gợi ý chưa kiểm chứng" và "đã duyệt, dùng được" không lẫn vào nhau.
  @Column({ name: 'addressHint', type: 'varchar', length: 255, nullable: true })
  addressHint!: string | null;

  // 'MANUAL' = tạo trực tiếp qua form CRUD admin. 'AI_SUGGESTED' = do
  // LocalPlaceExtractionService tạo ra từ URL/text admin cung cấp — luôn đi kèm
  // status = PENDING cho tới khi admin bổ sung địa chỉ và duyệt.
  @Column({
    name: 'source',
    type: 'enum',
    enum: LocalPlaceSource,
    default: LocalPlaceSource.MANUAL,
  })
  source!: LocalPlaceSource;

  // Cổng chặn cho LocalPlaceService.findApproved (nơi DUY NHẤT get_local_highlights đọc
  // dữ liệu) — dòng PENDING không bao giờ được trả về cho khách. LocalPlaceService.approve()
  // từ chối duyệt khi address/latitude/longitude còn null, nên 1 dòng APPROVED luôn có đủ
  // toạ độ để agent trả lời được, kể cả khi nguồn gốc là AI_SUGGESTED.
  @Column({
    name: 'status',
    type: 'enum',
    enum: LocalPlaceStatus,
    default: LocalPlaceStatus.APPROVED,
  })
  status!: LocalPlaceStatus;

  // URL gốc hoặc đoạn text admin đã dán vào để AI trích xuất ra dòng này — null với dòng
  // tạo thủ công. Được LocalPlaceExtractionService cắt bớt trước khi lưu, cùng giới hạn độ
  // dài với LocalEvent.sourceRef.
  @Column({ name: 'sourceRef', type: 'text', nullable: true })
  sourceRef!: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
