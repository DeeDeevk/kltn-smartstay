// Mã đặt phòng ngắn hiển thị cho khách (8 ký tự đầu của UUID, viết hoa) — dùng chung ở
// mọi nơi hiển thị booking (lịch sử đặt phòng, modal chi tiết, vé QR, trang thành công).
export default function getBookingCode(bookingId) {
  return bookingId.slice(0, 8).toUpperCase();
}
