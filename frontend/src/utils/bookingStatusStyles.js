export const BOOKING_STATUS_STYLES = {
  PENDING: 'bg-amber-50 text-amber-600 ring-amber-100',
  CONFIRMED: 'bg-blue-50 text-blue-600 ring-blue-100',
  CHECKED_IN: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  CHECKED_OUT: 'bg-gray-100 text-gray-600 ring-gray-200',
  CANCELLED: 'bg-red-50 text-red-600 ring-red-100',
};

export const PAYMENT_STATUS_STYLES = {
  UNPAID: 'bg-amber-50 text-amber-600',
  PAID: 'bg-emerald-50 text-emerald-600',
  FAILED: 'bg-red-50 text-red-600',
};

// Nhãn dùng chung cho mọi modal chi tiết đơn (trước đây mỗi modal tự khai riêng và đã bị
// lệch chữ cho cùng 1 trạng thái — vd "Đã hoàn thành" vs "Đã trả phòng" cho CHECKED_OUT).
export const BOOKING_STATUS_LABELS = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận (chưa nhận phòng)',
  CHECKED_IN: 'Đang lưu trú',
  CHECKED_OUT: 'Đã trả phòng',
  CANCELLED: 'Đã huỷ',
};

export const PAYMENT_STATUS_LABELS = {
  UNPAID: 'Chưa thanh toán',
  PAID: 'Đã thanh toán',
  FAILED: 'Thanh toán lỗi',
};
