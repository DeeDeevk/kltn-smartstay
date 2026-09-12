// Phải khớp với VAT_RATE ở backend/src/bookings/booking.service.ts — dùng ở đây chỉ để
// hiển thị tạm tổng tiền trước khi tạo booking; số tiền thật luôn do backend tính lại.
export const VAT_RATE = 0.08;

export function calculateVat(amount) {
  return Math.round(amount * VAT_RATE);
}
