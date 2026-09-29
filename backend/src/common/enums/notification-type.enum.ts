// Loại thông báo gửi cho khách. Tất cả hiện đều phát sinh từ sự kiện đặt phòng —
// thêm loại mới (khuyến mãi, nhắc nhận phòng...) chỉ cần thêm giá trị ở đây.
export enum NotificationType {
  BOOKING_CONFIRMED = 'BOOKING_CONFIRMED',
  BOOKING_CANCELLED = 'BOOKING_CANCELLED',
  CHECKED_IN = 'CHECKED_IN',
  CHECKED_OUT = 'CHECKED_OUT',
  PAYMENT_PAID = 'PAYMENT_PAID',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  REVIEW_REPLIED = 'REVIEW_REPLIED',
}
