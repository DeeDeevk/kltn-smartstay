// Giá trị thực sự mã hoá trong QR của vé đặt phòng. Chỉ là bookingId (UUID) — không phải
// text mô tả — để lễ tân quét được bằng QRScannerModal và tra cứu thẳng qua GET
// /bookings/:id lúc check-in. Toàn bộ thông tin "đẹp" (tên khách, ngày, tổng tiền) đã
// hiển thị sẵn dạng chữ thường quanh QR trên trang/modal, không cần nhồi lại vào QR.
export default function getBookingQrPayload(booking) {
  return booking.bookingId;
}
