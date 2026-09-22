import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EventRecurrence } from 'src/common/enums/event-recurrence.enum';
import { LocalEventSource } from 'src/common/enums/local-event-source.enum';
import { LocalEventStatus } from 'src/common/enums/local-event-status.enum';

@Entity('LocalEvent')
export class LocalEvent {
  @PrimaryGeneratedColumn('uuid', { name: 'eventId' })
  eventId!: string;

  @Column({ name: 'title', length: 200 })
  title!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({
    name: 'recurrence',
    type: 'enum',
    enum: EventRecurrence,
  })
  recurrence!: EventRecurrence;

  // 0 = Chủ Nhật ... 6 = Thứ Bảy, chỉ có ý nghĩa khi recurrence = WEEKLY.
  @Column({ name: 'dayOfWeek', type: 'int', nullable: true })
  dayOfWeek!: number | null;

  // Định dạng YYYY-MM-DD, chỉ có ý nghĩa khi recurrence = ONCE.
  @Column({ name: 'specificDate', type: 'date', nullable: true })
  specificDate!: string | null;

  // 'manual' = tạo trực tiếp qua form CRUD admin (LocalEventService.create).
  // 'ai_suggested' = do LocalEventExtractionService tạo ra từ URL/text admin cung cấp —
  // luôn đi kèm status = PENDING cho tới khi admin duyệt.
  @Column({
    name: 'source',
    type: 'enum',
    enum: LocalEventSource,
    default: LocalEventSource.MANUAL,
  })
  source!: LocalEventSource;

  // Cổng chặn cho LocalEventService.findForDate (nơi DUY NHẤT get_local_events đọc dữ
  // liệu) — dòng PENDING không bao giờ được trả về cho khách. Dòng tạo thủ công mặc định
  // luôn là APPROVED ngay (giống hệt hành vi trước khi có cột này); chỉ dòng do AI đề
  // xuất mới bắt đầu ở trạng thái PENDING.
  @Column({
    name: 'status',
    type: 'enum',
    enum: LocalEventStatus,
    default: LocalEventStatus.APPROVED,
  })
  status!: LocalEventStatus;

  // URL gốc hoặc đoạn text admin đã dán vào để AI trích xuất ra dòng này, giúp admin đối
  // chiếu lại đề xuất khi duyệt — null với dòng tạo thủ công. Được
  // LocalEventExtractionService cắt bớt trước khi lưu (xem MAX_SOURCE_REF_LENGTH).
  @Column({ name: 'sourceRef', type: 'text', nullable: true })
  sourceRef!: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
