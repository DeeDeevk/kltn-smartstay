// Trạng thái xử lý 1 yêu cầu hoàn tiền (RefundRequest) — tạo tự động khi huỷ 1 đơn ĐÃ
// thanh toán (xem BookingService.cancel()). Quy trình BÁN TỰ ĐỘNG: hệ thống chỉ ghi nhận
// + hỗ trợ xác minh qua chat, việc chuyển khoản thật do nhân viên tự làm thủ công ngoài hệ
// thống (tài khoản PayOS hiện tại chỉ ở gói "Thu", không có Payouts/API hoàn tiền tự động).
export enum RefundRequestStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
}
