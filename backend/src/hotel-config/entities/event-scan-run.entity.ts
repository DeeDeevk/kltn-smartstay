import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EventScanTriggeredBy } from 'src/common/enums/event-scan-triggered-by.enum';
import { EventScanStatus } from 'src/common/enums/event-scan-status.enum';

// Lưu riêng bảng với LocalEvent (không gộp) vì đây là nhật ký 1 LẦN CHẠY quét (có thể tạo
// ra 0, 1, hoặc nhiều LocalEvent, hoặc thất bại không tạo dòng nào) — khác hẳn bản chất của
// LocalEvent (1 dòng = 1 sự kiện). Không có khoá ngoại từ LocalEvent trỏ ngược lại đây:
// admin xem "nguồn trích dẫn" của 1 lần quét độc lập với việc các sự kiện tạo ra từ lần đó
// còn tồn tại/đã bị xoá hay chưa.
@Entity('EventScanRun')
export class EventScanRun {
  @PrimaryGeneratedColumn('uuid', { name: 'scanRunId' })
  scanRunId!: string;

  // Khoảng ngày ĐÃ DÙNG cho lần quét này — lưu lại để admin xem lịch sử biết chính xác đã
  // quét tới đâu, không suy ngược từ createdAt (lần quét có thể chạy hôm nay nhưng tìm sự
  // kiện cho khoảng ngày trong tương lai xa hơn nhiều).
  @Column({ name: 'fromDate', type: 'date' })
  fromDate!: string;

  @Column({ name: 'toDate', type: 'date' })
  toDate!: string;

  @Column({
    name: 'triggeredBy',
    type: 'enum',
    enum: EventScanTriggeredBy,
  })
  triggeredBy!: EventScanTriggeredBy;

  // Chỉ có giá trị khi triggeredBy = MANUAL — không @ManyToOne tới User: đây là nhật ký,
  // không cần join ngược lại (admin xem lịch sử không cần thông tin đầy đủ về user, chỉ
  // cần biết "có người bấm thủ công" hay không — UI tự hiển thị "Admin thủ công"/"Tự động"
  // dựa vào triggeredBy, không cần tên cụ thể).
  @Column({ name: 'triggeredByUserId', type: 'uuid', nullable: true })
  triggeredByUserId!: string | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: EventScanStatus,
  })
  status!: EventScanStatus;

  // Chỉ có giá trị khi status = FAILED.
  @Column({ name: 'errorMessage', type: 'text', nullable: true })
  errorMessage!: string | null;

  // Nguồn trích dẫn (URL + tiêu đề) mà Gemini search-grounding đã dùng để tổng hợp câu trả
  // lời cho lần quét này — KHÔNG phải nhật ký duyệt web từng trang, chỉ là danh sách nguồn
  // được model trích dẫn trong câu trả lời cuối cùng. Rỗng [] nếu quét thất bại trước khi
  // kịp gọi Gemini (vd. chưa cấu hình địa chỉ khách sạn).
  @Column({ name: 'citations', type: 'jsonb', default: () => "'[]'" })
  citations!: { url: string; title: string }[];

  @Column({ name: 'createdEventsCount', type: 'int', default: 0 })
  createdEventsCount!: number;

  @Column({ name: 'skippedDuplicateCount', type: 'int', default: 0 })
  skippedDuplicateCount!: number;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;
}
