import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Booking } from '../../bookings/entities/booking.entity';
import { Conversation } from '../../chat/entities/conversation.entity';
import { RefundRequestStatus } from '../../common/enums/refund-request-status.enum';

// 1 yêu cầu hoàn tiền = 1 đơn đặt phòng ĐÃ thanh toán (paidAmount > 0) bị huỷ — tạo TỰ
// ĐỘNG bởi BookingService.cancel(), xem chú thích đầu file đó. Không có bảng Payment riêng
// trong hệ thống (thông tin thanh toán nằm thẳng trên Booking.paidAmount/paymentStatus/
// payosOrderCode), nên không có cột "paymentId" — amount lấy trực tiếp từ
// booking.paidAmount tại thời điểm huỷ.
//
// QUAN TRỌNG (quy trình BÁN TỰ ĐỘNG — xem RefundRequestStatus): hệ thống KHÔNG gọi bất kỳ
// API PayOS nào để tự động chuyển tiền (tài khoản hiện tại chỉ ở gói "Thu", không có
// Payouts). Việc xác thực danh tính (tên trên QR khớp tên người đặt) do NHÂN VIÊN tự xác
// nhận bằng mắt qua ảnh đính kèm trong chat (KAN-112/113) — hệ thống không tự động đọc/
// parse QR, không tự động đổi trạng thái dựa trên nội dung ảnh.
@Entity('RefundRequest')
export class RefundRequest {
  @PrimaryGeneratedColumn('uuid', { name: 'refundRequestId' })
  refundRequestId!: string;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'bookingId' })
  booking!: Booking;

  // Số tiền cần hoàn = booking.paidAmount TẠI THỜI ĐIỂM huỷ — snapshot riêng (không đọc lại
  // qua booking.paidAmount về sau), vì paidAmount có thể bị sửa độc lập bởi nghiệp vụ khác
  // sau khi yêu cầu hoàn tiền này đã được tạo.
  @Column({ name: 'amount', type: 'int' })
  amount!: number;

  // % đã áp dụng khi tạo (snapshot, KAN-117) — amount = booking.paidAmount * refundPercent /
  // 100 tại thời điểm huỷ. Cho khách/admin biết rõ vì sao số tiền hoàn không bằng 100% nếu
  // huỷ cận giờ nhận phòng. Dữ liệu tạo trước tính năng này luôn là 100 (xem migration).
  @Column({ name: 'refundPercent', type: 'int', default: 100 })
  refundPercent!: number;

  // Thông tin tài khoản người nhận hoàn tiền — hệ thống KHÔNG có nguồn dữ liệu nào lưu sẵn
  // (PayOS không trả thông tin người chuyển khoản qua webhook), nên luôn null lúc tạo tự
  // động. Để ngỏ cho admin tự ghi lại sau khi xác minh qua chat nếu cần, không bịa.
  @Column({ name: 'payerBankInfo', type: 'jsonb', nullable: true })
  payerBankInfo!: Record<string, unknown> | null;

  // Hội thoại chat với khách để nhân viên xem ảnh QR xác minh — tự điền nếu tìm được hội
  // thoại OPEN của khách lúc tạo (best-effort, không bắt buộc tìm bằng mọi giá), admin có
  // thể tự gắn/đổi thủ công sau qua PATCH :id/conversation.
  @ManyToOne(() => Conversation, { nullable: true, eager: true })
  @JoinColumn({ name: 'conversationId' })
  conversation!: Conversation | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: RefundRequestStatus,
    default: RefundRequestStatus.PENDING,
  })
  status!: RefundRequestStatus;

  // Lý do huỷ đơn (snapshot từ booking.cancelReason tại thời điểm tạo).
  @Column({ name: 'reason', type: 'text', nullable: true })
  reason!: string | null;

  // Không dùng quan hệ FK tới User (chỉ cột id thường) — cùng pattern với
  // EventScanRun.triggeredByUserId: tránh ràng buộc phức tạp cho 1 field chỉ dùng để hiển
  // thị "ai đã xử lý", không cần join thường xuyên.
  @Column({ name: 'processedByUserId', type: 'uuid', nullable: true })
  processedByUserId!: string | null;

  @Column({ name: 'processedAt', type: 'timestamptz', nullable: true })
  processedAt!: Date | null;

  // Ghi chú của admin lúc hoàn tất (VD số tham chiếu giao dịch chuyển khoản thủ công) hoặc
  // lý do từ chối (bắt buộc khi reject).
  @Column({ name: 'adminNote', type: 'text', nullable: true })
  adminNote!: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;
}
